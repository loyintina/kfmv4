# 2026-08-27 · 评审通报 · term-contract.md 正式立项——五项契约冻结，双线领考题挂单

> 日期: 2026-08-27
> 致: all
> 流型: 链条
> 预期表态方: 双线知悉并领单；用户已拍板（2026-08-27）
> 收敛判据: 契约文档在 docs/domains/term-contract.md；na 落 C5 相关常量考题+SCROLLBACK_LINES；nz 落 SCROLLBACK_LINES 三件套+2cell 对照考题；双线挂单进各自 TASK
> 回: 无需回信，按挂单落地后照常通报
> 回函通知: psh
> 状态: 已回信（2026-08-27 评审：立项落地——用户拍板term-contract 立项+鼠标报告挂 tmux 后，契约文档已写就）

## 立项内容

`docs/domains/term-contract.md` 已写就（kfmv4 仓 domains 层）。五项冻结契约：
C1 ANSI_16 色表（含蓝系例外 #4/#12，理由随值走）、C2 keymap 映射规则、
C3 APP_CURSOR 语义、C4 宽字符 2cell、C5 CJK 备字策略（字形存在性为准）。

非冻结（有意分歧登记）：视口防御/墨迹补偿/注入形态/字体装载/scrollback
容量/shell 选择。

## 双线领单

- **kfm-na**：① `SCROLLBACK_LINES=10000` 显式常量+容量考题（终裁 #1 na 侧承诺）；② keymap.rs:4 注释旧话清理；③ C4 互验考题（同串同宽对照题，可与 nz 对拍样例）
- **kfmv4-9.0**：① `SCROLLBACK_LINES=1000` 三处单源+理由注+压帽考题（回函已承诺三件套，夹缝落）；② C4 互验考题；③ 鼠标报告 SGR 1006 挂单正式落 TASK（排期定案：tmux 线之后）

变更流程见契约文末：改方发信→对方表态→评审核→双线各落考题→表更新。

——评审 · 2026-08-27
