# 2026-08-26 · 评审 · TUI 底部要求：按键栏应在视口底端、TUI 窗口更小（视口−按键栏高）——请 9.0 改回 ALT 不藏键栏

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 让 ALT/TUI 态按键栏保持在视口底端可见、TUI 内容只填视口−KEYBAR_H（比全屏更小）；ranger/htop 底部按钮在视口底、window 不再占满；overflowBeyondVisible=0、rows=floor(scrollClientH/cellH) 且 scrollClientH=视口−KEYBAR_H
> 回: kfmv4-9.0-ranger-runaway-rows-growth-response.md（048be6f8，runaway 已修对——顶部已好；本信是底部布局回改）
> 回函通知: psh
> 状态: 已回信（2026-08-26 9.0：syncAlt 摘藏键栏+占满两行、三路禁滚保留；④f 新钉绿、④e 期望随改；三卷+npm85 绿 @ c9b0b011；两层底栏并存先落地可接受）· 见 kfmv4-9.0-tui-keybar-bottom-response.md · 代际戳 gen-2026-08-26-TUI底栏

## 一、用户要求（清楚）

进入 ranger/htop 类 TUI：**底端按钮（按键栏）应出现在视口底端；TUI 窗口应更小（不占满全视口）**——即 TUI 内容只填 `视口 − 按键栏高`，按键栏恒在底部可见。

## 二、现状（我实测确认，与要求相反）

- **遥测**（真机 TUI）：`vvHeight=853 cardH=853 scrollClientH=853 rows=52`——**scrollClientH=整个视口**，没给按键栏留 KEYBAR_H；即 TUI 填满全屏。
- **headless htop**：`ch=620=vh`、keybar 父容器 `display:none`、`kbRectBottom=0`——**按键栏被藏**。
- 即当前 `syncAlt` ALT 态是「keybar display:none + scrollEl 占满容器底（=全视口）」——**正好与要求相反**。

## 三、请 9.0 改：ALT/TUI 不藏键栏，TUI=视口−KEYBAR_H

把 `syncAlt` 的 ALT 分支从「藏键栏 + scrollEl 占满」**改回「按键栏始终在流内垫底、scrollEl bottom=KEYBAR_H（=视口−键栏高）」**，与行模式一致——TUI 同样只在按键栏上方，键栏可见在底。

要点：
1. ALT 态 `scrollEl` bottom 保持 KEYBAR_H 不留全（删除/改掉「ALT→scrollEl 占满、keybar display:none」）。
2. TUI 行数 = floor((视口−KEYBAR_H)/cellH)，不再 = floor(视口/cellH)。
3. ALT 三路禁滚（048be6f8 加的 cursor/followOutput/inputToBottom、syncAlt 清零）**保留**——它们治 runaway，与本需求正交，别丢。
4. htop/ranger 自己的底栏（F1Help…F10Quit）会贴在 TUI 底（键栏上方）——两层底栏并存是否符合预期，请 9.0 一并确认（用户可能接受，也可能后续再调，不影响本次先让键栏回到视口底）。

## 四、验收

- **A 档/钉**：bottom-anchor（含 ④e runaway 钉）+ scrollback + keybar 19/19 不回退；原有「TUI 填满」相关断言若有，随需求改（TUI=视口−键栏）。
- **新钉（定位此需求）**：TUI 态断言 `scrollClientH == vh − KEYBAR_H`（不能=vh）、keybar `display != none` 且矩形底=视口底。
- **真机**：ranger/htop 进入后——按键栏按钮在视口底可见、TUI 窗口更小（不占满）、`overflowBeyondVisible=0`、rows=floor(视口−键栏/cellH)（≈比现在少 5 行）。

## 五、备注

- 这是把「TUI 藏键栏、占满全屏」翻回「键栏恒在底、TUI 填键栏上方」——手机 UX 上讲得通（TUI 里也要靠键栏发 Ctrl/方向键）。runaway 那轮的修复不受影响，别误删。

——评审 · 2026-08-26
