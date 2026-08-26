# 2026-08-26 · 9.0 回函 · TUI 底部要求落地：ALT 不藏键栏、TUI=视口−KEYBAR_H @ c9b0b011（runaway 三路禁滚保留）

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审亲跑三卷+npm85 不回退、④f 新钉落地正确；用户真机 C 档 ranger/htop 键栏在视口底可见、TUI 窗口更小、overflow=0、rows=floor(视口−键栏/cellH)
> 回: kfmv4-9.0-tui-keybar-bottom-review.md
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：syncAlt 摘两行落地正确、三路禁滚保留、④f 新钉绿、三卷+npm85 全绿；推翻「TUI 占满」取向认可）· 见 kfmv4-9.0-tui-keybar-bottom-verify-review.md · 代际戳 gen-2026-08-26-TUI底栏-已核

## 一、落地（改动比预想还小）

`syncAlt` ALT 分支只摘两行：`barStripEl.style.display='none'` 和 `scrollEl.style.bottom='0px'`——键栏两态恒在流内垫底（bottom:0 于卡身）、scrollEl bottom 恒 KEYBAR_H，TUI 内容只填视口−键栏高。行列重测仍走 scheduleResize 三方同步，TUI 自适应新尺寸。

## 二、正交保留（评审三节③，没丢）

- `overflow` 切换保留：ALT=hidden（硬裁剪防 TUI 溢出撑滚动条）/行模式=auto（回翻）——这是物理兜底；
- 048be6f8 的 **ALT 三路禁滚完整保留**：壳 renderFrame 游标块 `!alt`、followOutput/inputToBottom ALT 早退、syncAlt ALT 进入清零残留 scrollTop——治程序化赋值，与本需求正交。

## 三、钉与考卷

- **新钉 ④f**（bottom-anchor）：TUI 态断言 `scrollClientH==vh−KEYBAR_H`（不能=vh）+ keybar `display!=none` + keybar 矩形底=视口底——绿（536=620−84、display=grid、kb.bottom=620.0=ih）。
- **④e 随需求改**：ALT 不再让位，期望 rows 38→**32**（floor(536/16.25)）、缩窗 24→**19**（floor(316/16.25)）——禁滚/不跑飞断言不变。
- 三卷+npm85：bottom-anchor **10/10**、scrollback 5/5、keybar-click 19/19、npm85 全绿。

## 四、评审四节点④的确认（两层底栏并存）

htop 自带 F1-F10 底栏会贴在 TUI 底（=键栏正上方），两层底栏并存。**我认为可接受先落地**：语义清晰（上层=TUI 应用的键、下层=终端的键），手机端拇指区两层可达；若用户真机观感嫌挤/嫌重复，后续再调（比如 TUI 态键栏换紧凑单行）——不阻塞本次。

## 五、球交真机 C 档

ranger/htop 进入后：键栏按钮在视口底可见、TUI 窗口更小（不占满）、`overflowBeyondVisible=0`、rows=floor((视口−84)/cellH)（≈比之前少 5 行）。与 runaway 那轮的 C 档（空闲 rows 不增/scrollTop=0/mCellH≈16.25）可一次并验。
