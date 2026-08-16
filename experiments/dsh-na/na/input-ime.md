# 输入/IME 域设计页 v0.1（评审裁决已落地，按方案 A 执行）

> v0 → v0.1（2026-08-16）：评审回信五条裁决全通过——**方案 A 批准**（§4.5
> 全合规），两道旧题迁移明示批准（断言一字不改，例外入档）；规格书 §4.2
> 已补形态判别准则（v1.2）。执行顺序按附带发现 2：先迁移旧题跑绿，
> 再写新题先红，最后实现转绿。

依据：插件架构规格书 v1.2 §8 九字段模板。域=输入/IME（§3，第一批最后一域）。
阶段 2 边界手术第三刀。**这一刀与前两刀不同构**——前两刀是「工厂+实例归
调用方」，本域只有共享态与纯函数，没有需要工厂的独占对象。本页如实呈现
差异，并带一个需要评审拍板的选项分叉（见 §2 末尾）。

现状实锤（行号 2026-08-16 核对）：

- `src/ime_queue.rs`：`ImeQueue`（Mutex<VecDeque<Inject>>），push 侧 = JNI
  回调线程（ime_bridge.rs，cfg android），drain 侧 = 事件循环
  （android_app.rs:331 `drain_ime_inject`）。进程级单例 `global()`。
- `src/keybar.rs`：布局/命中纯函数（`KEYS`/`hit`/`in_bar`）+ **进程级静态
  修饰键状态** `static MODS: AtomicU8`（keybar.rs:122），`toggle`/
  `take_modifiers`/`modifiers` 三个自由函数读写它。
- `src/keymap.rs`：纯函数 `map_text`（修饰键×文本）/`key_seq`（键码→序列，
  吃 app_cursor 参数）。零状态。
- `src/insets.rs`：JNI 直取键盘高度 `query_ime_bottom(app)` + 强弹键盘
  `force_show_keyboard(app)`（cfg android，B 档平台胶水）。
- 调用方 `android_app.rs`：`poll_ime_inset`（:99-112，500ms 节流轮询）、
  快捷键行触摸命中（:529-627，`keybar::hit`/`toggle`/`push_key_code`）、
  `drain_ime_inject`（:330-346，排干→keymap 翻译→TermCmd::Input）、
  `Ime::Commit` 分支（:659）。
- **关键耦合**：`termview.rs:507` `render_keybar` 直接读 `keybar::modifiers()`
  静态——修饰键状态不止输入侧用，渲染侧（终端插件的方法体内）也在读。
- A 档考题：keybar 6 道（含 `spec_修饰键_一次性粘滞` 直接测静态函数）、
  keymap 9 道、ime_queue 7 道。

---

## 1. 身份

- 插件名：`input-ime`
- 域：输入/IME（§3，第一批）
- 一句话职责：把输入域的**共享态**收进基座服务（§4.5 共享态纪律），
  平台胶水（JNI 键盘高度）变成可替换、可注入考题的服务。

## 2. 提供（服务键）

| 服务键 | 接口形态 | 内容 |
|--------|----------|------|
| `ime.insets` | 注册表式，**共享实例直挂**（Sync 内部可变，无工厂） | `dyn ImeInsets`：`ime_bottom_px() -> Option<u32>` + `force_show()` |
| `input.modifiers` | 注册表式，共享实例直挂 | `dyn ModifierState`：`toggle(bit)->u8` / `take()->u8` / `peek()->u8` |

**为什么直挂实例而不是工厂**：两个服务都是 Sync 内部可变（原子/Mutex），
共享即正确形态——registry 的 Arc 语义天然合身（对比：终端是 &mut 独占可变
才必须工厂）。这是第三种插件形态，前两刀的「工厂必然性」在这里不适用。

`ImeInsets` 实现两分：
- 生产 = `JniInsets`（insets.rs 加薄壳，持 AndroidApp 句柄，cfg android）；
- 考题 = 假实现（返回固定 px、记录 force_show 调用）。
- 注入缝在插件构造参数：`InputIme::new(insets: Arc<dyn ImeInsets>)`
  （与 conn 的 Spawner、term 的 candidates 同族）。v1 零配置。

**选项分叉（需评审拍板）——修饰键状态怎么搬**：

- **方案 A（推荐，§4.5 全合规）**：`static MODS` 删除，状态进
  `ModifierState` 服务实例（AtomicU8 不变，只是有了归属）。
  连带两处必须动：
  ① `render_keybar` 不再自读静态，改吃 `mods: u8` 参数（调用方 android_app
  从服务读位再传入）——**TermEmu trait 方法签名变更**（演化纪律允许的
  「调用方驱动的变更」，§4.5 是正当理由）；
  ② 考题迁移（**本刀首次动旧题，需评审明示批准**）：
  `keybar_spec::spec_修饰键_一次性粘滞` 断言原样搬到 ModifierState 实例上；
  `termview_spec::spec_快捷键行_渲染冒烟` 改传 mods 参数。断言一字不改，
  只换测试具身。
- **方案 B（保守）**：静态不动，`input.modifiers` 服务不建，本刀只做
  `ime.insets`。§4.5 留一个明示例外（进程级 UI 状态，参照 report.rs
  先例）。代价：渲染层读全局静态的耦合留在原地，与「一切皆插件」
  方向相违，且下次动 keybar 时这笔账还在。

## 3. 依赖（inject）

无。两个服务都不消费其他服务键。
（`drain_ime_inject` 的「键码→序列要按当下 app_cursor 模式翻」需要终端
实例——但那是**调用方编排**（app 同时持 term 实例和 modifiers 服务），
不是插件依赖：插件不碰终端，coordination 留在应用壳。）

## 4. 生命周期语义（apply / unload / 失败）

- **apply(ctx)**：注册两个服务实例，瞬时返回。无 IO 无线程。
- **unload 三相**：①停供摘两键；②无监听无配置；③dispose 摘条目。
- **存量持有者不受影响**：app 侧的 `Arc<dyn ModifierState>` 句柄跨 unload
  存活（与前两刀「实例归调用方」同判；修饰键状态本质是 UI 态，归应用壳）。
- **失败语义**：注册冲突 → Err → Failed 钉死不传染（同前两刀考题）。
  JniInsets 的 JNI 调用失败走 Option/日志（现状行为，B 档）。

## 5. 配置 schema

v1 零配置。JniInsets 的 AndroidApp 句柄走构造注入不走配置表
（句柄是运行时对象不是配置值；配置表是启动静态数据，句柄塞进去语义不对）。

## 6. 事件（派发模式）

无（连续第三刀零总线事件）。**如实记录**：IME 弹起/收起本是事件总线的
第一个天然候选，但 BAR-006 实锤本机 Ime::Enabled/Disabled 从未触发——
事件驱动在这条设备链路上是死路，轮询才是活路。总线的第一个真实用户
留给第二批插件（卡片堆/AI 会话），不为用而用。

## 7. 状态存活

| 状态 | 归属 | 理由 |
|------|------|------|
| 修饰键位掩码 | 服务实例（方案 A）/ 进程静态（方案 B） | UI 态，随 app 会话存活；实例归调用方持 Arc |
| 键盘 inset 轮询缓存（last_inset_poll 等） | 应用壳（现状字段不动） | 轮询节奏是主循环编排 |
| ime_queue 内容 | **进程级单例不动**（见 §8 注） | JNI 桥端点，B 档平台胶水，同 report.rs 先例 |

**ime_queue 不进插件的如实理由**：JNI extern fn 是进程静态入口，Java 侧
随时可回调，无法经基座拿服务（回调线程没有 ctx）。它是「桥端点」不是
「服务」，与 report.rs 的飞鸽传书同性质。drain 侧（app）行为不变。

## 8. 契约测试清单

**行为零变化硬考题**：

1. keymap 9 道、ime_queue 7 道全绿不动；
2. keybar 6 道中**布局/命中 5 道不动**；`spec_修饰键_一次性粘滞` 方案 A
   下迁移（断言原样）；termview 33 道中 `spec_快捷键行_渲染冒烟` 方案 A
   下改传参（断言原样）。**除这两道迁移外一题不动**；
3. 迁移题做变异抽检（改坏 ModifierState.toggle 验证题咬人）。

**基座层新题**（`tests/input_ime_spec.rs`，考题先行）：

4. 注册成功：两服务键均可取回；假 insets 返回配置 px、force_show 被记录；
5. ModifierState 语义：toggle 翻位 / take 读走清零 / peek 只读
   （= 原 spec_修饰键_一次性粘滞 断言集）；
6. 卸载回滚：两键消失（DeclaredButInactive），存量 Arc 句柄照常工作；
7. reload 换新实例：修饰键状态**清零重来**（状态随实例蒸发——这是明示
   语义：reload = 修饰键复位，符合「一次性粘滞」的小状态本质）；
8. 注册冲突：第二插件同键 → Failed，先到者服务不变。

## 9. 实拍判卷点（C 档）

手机实拍与现状逐格对齐：

- 快捷键行两排七列渲染、修饰键点亮高亮、一次性粘滞（Ctrl+字母联动）；
- 键盘弹起：行带上浮、内容不被盖、高度避让准确（insets 服务链路）；
- 中文拼音组词落字；点空白处召唤/收起键盘；
- 切后台再回来：修饰键状态、键盘避让正常。

证据链：手机实拍 + `field-reports.log`（[ime]/[java] 上报行照旧）。

---

## 附：落地步骤预告（送审通过后执行）

1. 基线记录（121 题 + 2 live ignored 为预期起点）；
2. 考题先行：`tests/input_ime_spec.rs`（清单 4-8）验证红；方案 A 获批则
   同步迁移两道旧题（断言不动）；
3. `keybar.rs`：`ModifierState` 结构体（方案 A 删静态）；
   `insets.rs` 加 `ImeInsets` trait + `JniInsets` 薄壳；
4. 新增 `src/plugins/input_ime.rs`；
5. `android_app.rs`：轮询/强弹/修饰键读写改走服务；render_keybar 传 mods；
6. chain 全绿 → 打包手机实拍对齐 §9 → 落地通报。

预计动 5 个文件（3 改 2 新）。方案 B 则缩到 3 个（不动 keybar/termview/
两道旧题）。
