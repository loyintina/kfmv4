# 2026-08-26 · 评审 · TUI 底部要求复核通过：ALT 不藏键栏、TUI=视口−KEYBAR_H，交真机 C 档

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在真机 C 档）
> 收敛判据: 无需回信；真机 ranger/htop——键栏按钮在视口底可见、TUI 窗口更小（视口−键栏高）、`overflowBeyondVisible=0`、rows=floor((视口−84)/cellH)；与 runaway C 档（空闲 rows 不增/scrollTop=0/mCellH≈16.25）一次并验
> 回: kfmv4-9.0-tui-keybar-bottom-response.md（ALT 不藏键栏、TUI=视口−KEYBAR_H 落地 @ c9b0b011）
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：syncAlt 摘两行藏键栏/占满、键栏恒流内垫底+scrollEl bottom KEYBAR_H、overflow ALT=hidden+三路禁滚保留；headless htop ch=536=vg−84、keybar display=block kbBottom=620=vh、截图两层底栏并存；三卷 10/10(④f 新钉+④e 随改)+5/5+19/19+npm85 全绿；待真机 C 档）

## 一、落地复核（变更比预想更小，正确）

- `syncAlt` ALT 分支只摘两行：`barStripEl display:none` 与 `scrollEl bottom=0`——键栏两态恒在流内垫底（bottom:0 于卡身）、scrollEl bottom 恒 KEYBAR_H，TUI 内容只填视口−键栏高。✅
- **正交保留（你没丢）**：overflow 切换 ALT=hidden（物理防溢撑滚动条）/行模式=auto（回翻）；048be6f8 的 **ALT 三路禁滚完整保留**（壳游标块 `!alt`、followOutput/inputToBottom ALT 早退、syncAlt ALT 进入清零残留 scrollTop）。✅ 治程序化赋值，与本需求不冲突。

## 二、亲测

- **headless htop**：`scrollClientH=536=620−84`（TUI 填键栏上方）、keybar 父容器 `display=block`（**可见**）、`kbBottom=620=vh`（**在视口底**）、`overflow=hidden`（防溢）。截图人审：htop 填 `视口−84`、htop 自身 F1-F10 底栏在 htop 底、按键栏 ESC/ALT/…/ENTER **在视口最底完整可见**——两层底栏并存。
- **三卷**：bottom-anchor **10/10**（④f 新钉：TUI `scrollClientH==vh−KEYBAR_H` + keybar 可见 + 底=视口底，536/620）；④e 随需求改（rows 38→**32**、缩窗 24→**19**，禁滚/不跑飞不变）+ scrollback 5/5 + keybar-click 19/19 + npm85 全绿。

## 三、两层底栏并存——认可落地

htop 自带 F1-F10 与终端键栏两层并存：语义清晰（上=TUI 应用键、下=终端键），手机拇指区两层可达；若真机嫌挤/重复，后续再调（如 TUI 态紧凑单行）——**不阻塞本次**，认可先落地。

## 四、结论与下一步

ALT 不藏键栏 + TUI=视口−键栏高落地正确、无回归，满足用户「键栏在视口底、TUI 更小」。**球交真机 C 档**（与 runaway 那轮并验）：ranger/htop——键栏按钮在视口底可见、TUI 更小不占满、`overflowBeyondVisible=0`、rows=floor((视口−84)/cellH)；空闲 rows 不增/scrollTop=0/mCellH≈16.25。

**备注**：这条「键栏在底」其实是推翻我之前「TUI 占满全屏」的取向（那套让 TUI 里发不了 Ctrl/方向键，用户说得对）——**用户对，推翻得值**；runaway 修复与三路禁滚都保留没丢。

——评审 · 2026-08-26
