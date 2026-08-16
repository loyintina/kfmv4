# 终端模拟器设计页 v0.1（评审裁决已落地，可执行）

> v0 → v0.1（2026-08-16）：评审回信五条裁决全通过 + 2 条附带发现——
> 考题先红后写码（已执行）；trait 定义处加演化纪律注释（§2 trait 文档
> 同步）。落地时 build 返回类型抽别名 `BuiltTerm`（clippy type_complexity
> 要求，签名语义不变）。

依据：插件架构规格书 v1.1 §8 九字段模板。域=终端模拟器（§3，第一批）。
阶段 2 边界手术第二刀：把 termview（alacritty 芯终端）从 `android_app.rs`
的直接构造，降级为插件提供的可替换服务。第一刀（连接 provider）已闭环
——本刀是它的同构复刻，模式不变、判卷不变。

现状实锤（行号 2026-08-16 核对）：

- `src/termview.rs`：`TermView` 公共方法面——`feed`/`resize_cells`/`cell_size`/
  `render_into`/`render_keybar`/`take_tofu_chars`/`scroll_lines`/
  `scroll_to_bottom`/`mouse_report_active`/`app_cursor_mode`/`font_probe`
  （termview.rs:325-486）；构造入口 `build_from_candidates`（:722）；
  纯函数群（grid_dims/cell_origin/颜色表/paintable）是自由函数不进对象面。
- 调用方 `src/android_app.rs`：字段 `term: Option<TermView>`（:67）；
  构造+字体诊断上报（:146-192）；每个 SessionEvent::Output `term.feed`（:295）；
  窗口/键盘尺寸变化 `resize_cells`（:246）；每帧 `render_into`+`render_keybar`
  +`take_tofu_chars`（:387-392）；滚屏/回底/鼠标上报判定（:351/375/527-564）。
- A 档考题 `tests/termview_spec.rs` 33 道 + `scroll_spec.rs` 7 道（行为零变化
  的判卷基线）。

---

## 1. 身份

- 插件名：`term-alacritty`（alacritty_terminal 芯的终端模拟器，第一个实现）
- 域：终端模拟器（§3，第一批）
- 一句话职责：向基座注册「终端模拟器工厂」服务，把「用哪个终端芯」从应用
  主循环拿走；终端实例归调用方持有（含 scrollback 的 mutable 长寿命状态）。

## 2. 提供（服务键）

| 服务键 | 接口形态 | 内容 |
|--------|----------|------|
| `term.emu.factory` | **注册表式**（可交换，独占绑定 v1，同连接 provider） | `dyn TermEmuFactory` |

接口定义（放 `src/termview.rs`，与 TermView 同文件共演化）：

```rust
/// 终端模拟器对象面：方法集 = android_app 现用的 TermView 公共方法原样抽取
pub trait TermEmu: Send {
    fn feed(&mut self, bytes: &[u8]);
    fn resize_cells(&mut self, cols: u32, rows: u32);
    fn cell_size(&self) -> (u32, u32);
    fn render_into(&mut self, buf: &mut [u32], w: u32, h: u32);
    fn render_keybar(&self, buf: &mut [u32], w: u32, h: u32, ime_bottom: u32);
    fn take_tofu_chars(&self) -> Vec<char>;
    fn scroll_lines(&mut self, lines: i32);
    fn scroll_to_bottom(&mut self);
    fn mouse_report_active(&self) -> bool;
    fn app_cursor_mode(&self) -> bool;
    fn font_probe(&self, c: char) -> (usize, usize, usize);
}

pub trait TermEmuFactory: Send + Sync {
    /// 建一台终端；Err = 字体候选全灭（现状的建不成路径，调用方上报）
    /// Ok 附（主字体名, CJK 字体名）供调用方诊断上报（现状行为保持）
    fn build(&self) -> Result<(Box<dyn TermEmu>, String, Option<String>), String>;
}
```

- **为什么是工厂不是实例**：基座 registry 取回 `Arc<T>`（共享不可变），而
  终端是每帧 `&mut` 渲染 + 喂字节的独占可变对象——`Arc<Mutex>` 包实例会让
  主循环每帧抢锁，是负优化。工厂瞬时可共享，实例归调用方（与连接 provider
  的 `TermHandle` 同理：长寿命 mutable 状态不下 plugin）。
- **方法面零增删**：trait 方法就是 android_app 正在调用的 11 个，`TermView`
  原样实现。自由函数（grid_dims/paintable/颜色表）不进 trait——它们无状态，
  谁都能直接调，不构成实现差异点。
- **build 瞬时返回**：字体加载是文件 IO 但毫秒级（现状就在主线程做），
  不违反瞬时返回契约；真机 C 档实拍盯着启动时长。

## 3. 依赖（inject）

无。渲染底座（§3 内核域）目前只有占位 `ctx.term`；帧缓冲所有权在
android_app（softbuffer surface 归应用壳），v1 不 inject。
（keybar/scroll 已编译进 termview 的 render_keybar/scroll_lines 里——
它们是终端画面的一部分，不单独成插件；输入/IME 域注册化是另一刀。）

## 4. 生命周期语义（apply / unload / 失败）

- **apply(ctx)**：只注册工厂闭包，瞬时返回。**不建终端**（同连接 provider：
  真建设在工厂被调用时）。
- **unload 三相**：①停供摘注册表；②无监听无配置，无额外反注册；
  ③dispose 释放闭包。
- **已建终端不随 unload 死**：`Box<dyn TermEmu>` 归调用方（应用壳）持有，
  scrollback/画面状态跨插件生命周期存活（§4.1 状态存活 + 裁决先例
  「连接 provider unload 不断连」同构）。
- **失败语义**：apply 唯一失败点 = 注册冲突 → Err → 钉死 Failed 不传染兄弟
  （serial+bail）。build 失败（字体全灭）不是插件失败：走 `Err` 返回值，
  调用方上报「TermView 建不成」（现状行为逐字保持）。

## 5. 配置 schema

| 字段 | 类型 | 默认 | 变更语义 |
|------|------|------|----------|
| （v1 无字段） | — | — | — |

v1 零配置：字体候选/字号/颜色全是 termview.rs 常量，行为零变化锚。
未来字段（字号缩放、颜色主题、字体路径表）进来时按 §4.1 配置语义分层
逐个标「局部应用 vs 自我重载」——**本页不预设**。

## 6. 事件（派发模式）

无。终端不发射也不监听基座事件——字节流走 `feed`（连接 provider 的
`TermHandle.events` → 调用方 → `term.feed`），是服务数据通道不是插件事件
（同连接 provider §6 措辞钉死，评审裁决 1 先例）。

## 7. 状态存活

| 状态 | 归属 | 理由 |
|------|------|------|
| 工厂闭包 | 插件内，可蒸发 | 注册表条目，重建成本≈0 |
| 终端网格/scrollback/字体栅格缓存 | **调用方持有**（`Box<dyn TermEmu>`） | 长寿命 mutable 状态；应用壳活得比插件久 |
| tofu 目击名单 | 终端实例内，随实例生灭 | 现状如此 |

## 8. 契约测试清单

**行为零变化硬考题**（一题不改全绿）：

1. `tests/termview_spec.rs` 33 道全绿（TermView 本体不碰）；
2. `tests/scroll_spec.rs` 7 道全绿；
3. 变异抽检：抽 1 道渲染题做变异（如改坏 paintable 放行控制符），
   确认考题咬人。

**基座层新题**（`tests/term_emu_spec.rs`，考题先行）：

4. 注册成功：load 后 `ctx.get::<dyn TermEmuFactory>()` 可取回；
   `build()` 得 `Ok`，返回主/CJK 字体名（host 有 DejaVu/Nimbus 夹具，
   termview_spec 已同款解析路径）；
5. trait 对象冒烟：经 `Box<dyn TermEmu>` feed「hi」→ render_into 帧缓冲
   非背景像素 > 0（对象面全通，不虚注册）；
6. 卸载回滚 + 实例存活：unload 后 get=DeclaredButInactive；卸载前 build
   的实例照常 feed/render（终端不随插件死）；
7. reload 换新工厂：reload 后 build 出新实例可用，旧实例不受影响；
8. 注册冲突：第二个同键插件 apply Err → Failed，先到者 Active 且服务不变
   （serial+bail 停该链）。

**不进考题的**：渲染质量（33 道已有）、字体选择逻辑（load_font 自有题）、
每帧性能（C 档实拍）。

## 9. 实拍判卷点（C 档）

手机实拍与现状逐格对齐（行为零变化最终判卷）：

- 启动即进交互 shell，字体诊断上报照常在 field-reports.log
  （字体候选逐行判定 + 探针 'M'/'中'）；
- 渲染观感零变化：字号/边距/快捷键行/滚屏/中文/光标反色全与上一版一致；
- 切后台再回来画面保持（终端实例跨生命周期存活的实拍证据）。

证据链：手机 `~/w/项目/kfm-na/` 实拍 + `field-reports.log`。

---

## 附：落地步骤预告（送审通过后执行）

1. 跑基线记录（116 题 + 2 live ignored 为预期起点）；
2. 先写考题：`tests/term_emu_spec.rs`（清单 4-8）验证红；
3. `termview.rs` 加 `TermEmu`/`TermEmuFactory` trait + `TermView` 实现
   （纯抽取，方法体一行不动）；
4. 新增 `src/plugins/term_alacritty.rs`（apply 注册工厂）；
5. `android_app.rs`：`term: Option<Box<dyn TermEmu>>`，构造走基座取工厂，
   字体诊断上报保持原样；
6. chain 全绿 → 手机实拍对齐 §9 → 落地通报。

预计动 4 个文件（2 改 2 新），不碰 termview 方法体、不碰现有考题。
