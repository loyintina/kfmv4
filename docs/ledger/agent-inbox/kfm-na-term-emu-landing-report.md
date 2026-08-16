# 终端模拟器落地通报（kfm-na → 评审会话）

> 2026-08-16 · kfm-na 主开发线 · 类型 report
> 回：本目录 [`kfm-na-term-emu-review-response.md`](kfm-na-term-emu-review-response.md)
> （评审批准按设计页附录六步落地）。设计页 v0.1：
> `/root/kfmv4/experiments/dsh-na/na/terminal-emulator.md`。
> 结论：**六步全部落地，chain 6/6 全绿，手机实拍行为零变化（用户判卷过）**。

## 基线记录

- 改动前：116 题全绿 + 2 道 live ignored（2026-08-16 当场实跑核实）
- 改动后：**121 题全绿 + 2 道 live ignored**——旧 116 题一题未动全绿，
  新增 `/root/kfm-na/tests/term_emu_spec.rs` 5 题
- chain.sh 6/6 全过（中途 clippy 拦两处：build 返回类型抽 `BuiltTerm` 别名、
  考题文件去未用 import——均已修并复跑全绿）

## 裁决落地逐条对账

| 裁决 | 落地 |
|------|------|
| 1 工厂形态必然性 | `TermEmuFactory: Send+Sync`（进 registry 共享）/ `TermEmu: Send`（独占持有）——类型约束编码状态存活分层，照此实现 |
| 2 方法面边界 + 演化纪律注释 | trait = android_app 现调 11 方法原样抽取，方法体一行未动（impl 纯委托 inherent）；`TermEmu` 定义处已钉「方法面 = android_app 现调集合，新增方法须有调用方先例」注释 |
| 3 build 失败通道 | `build() -> Result<BuiltTerm, String>`，字体全灭走 Err（android_app 上报原文「字体候选全灭——TermView 建不成」，与现状逐字一致） |
| 4 v1 零配置 | 无 config schema；termview 常量原样；未来加字段按「默认值=当前常量」写修订记录（已记入立项.md 十三节防漂移） |
| 5 范围 2 改 2 新 | 实际：termview.rs 改（trait 层追加在文件尾，本体未动）、android_app.rs 改（`term: Option<Box<dyn TermEmu>>`，Base 装配提前、两插件同基座）、新增 src/plugins/term_alacritty.rs + tests/term_emu_spec.rs |
| 附带发现 1 考题先红 | 已执行：先写 5 题验证编译错红，再写答案转绿 |
| 附带发现 2 演化纪律注释 | 随 trait 抽取一并落地（不单独成步） |

## 附带说明（超出设计页的一处实现注记）

设计页未提字体候选注入缝——host 无 /system/fonts，考题需要可注入的候选表
（同连接 provider 的 Spawner 缝精神）。落地为
`TermAlacritty::with_candidates(&'static [&'static str])`（生产 new() =
FONT_CANDIDATES，考题喂 DejaVu 双环境夹具，与 termview_spec 同款解析）。

## C 档实拍（设计页 §9）

构建 16777492，用户实拍判卷：**「是正常的」**——启动即进 shell、渲染观感
（字号/边距/光标反色）、快捷键行/触摸滚屏/中文、切后台恢复，全部与上一版
一致。两个插件（term-alacritty + conn-provider-ws）同一基座跑着，观感零变化。

## 状态

落地完成，请评审核实。阶段 2 边界手术两刀已闭环（连接 + 终端）；第一批剩
输入/IME 域（ime_queue/keybar/insets 注册化）待立项。
