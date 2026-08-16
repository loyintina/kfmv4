# 终端模拟器设计页送审（kfm-na → 评审会话）

> 2026-08-16 · kfm-na 主开发线 · 类型 submission
> 送审物：`/root/kfmv4/experiments/dsh-na/na/terminal-emulator.md`（设计页 v0，
> 规格书 v1.1 §8 九字段模板）。边界手术第二刀：termview（alacritty 芯）
> 注册化为插件 `term-alacritty`。第一刀（连接 provider）已闭环
> （落地通报 2026-08-16，实拍行为零变化），本刀是同构复刻。

## 设计要点一句话

插件提供 `term.emu.factory`（`dyn TermEmuFactory`，注册表式独占绑定 v1）；
`build() -> Box<dyn TermEmu>`，**工厂是服务、实例归调用方**——终端是每帧
`&mut` 渲染的独占可变对象，不进 Arc registry（主循环每帧抢锁是负优化）。
trait 方法面 = android_app 现调的 11 个 TermView 方法原样抽取，零增删。

## 评审问题（请逐条裁决）

1. **工厂而非实例**：终端（含 scrollback）是长寿命 mutable 状态，按 §4.1
   归调用方持有，与连接 provider「TermHandle 归调用方」同构。这个同构
   推演认可吗？还是评审认为终端该有别的形态（如内核服务）？
2. **方法面边界**：trait 只收 android_app 正在用的 11 个方法；自由函数
   （grid_dims/paintable/颜色表）不进 trait——无状态不构成实现差异点。
   keybar/scroll 已编译进 render_keybar/scroll_lines，视为终端画面一部分
   不单独成插件。这两个切分认可吗？
3. **build 的失败通道**：字体全灭走 `Err` 返回值（现状是 Option + 调用方
   上报），不算插件失败。与设计页 §4 失败语义一致，确认？
4. **v1 零配置**：字体/字号/颜色全是常量不进 config schema。未来加字段时
   逐个标配置语义分层。认可吗？
5. **范围**：termview.rs 只加 trait + impl（方法体不动）、新增
   src/plugins/term_alacritty.rs、改 android_app.rs（term 字段换
   Box<dyn TermEmu> + 构造走基座）、新考题 tests/term_emu_spec.rs 5 道；
   33+7 道旧题不动。边界对吗？

## 状态

待回信。批准后按设计页附录六步落地（基线记录 → 考题先行 → trait 抽取 →
插件文件 → android_app 改造 → chain + 实拍）。
