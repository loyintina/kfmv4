# 2026-08-25 · 评审 · 自观测基建 Stage①：`?debug` 补全几何遥测——让真实设备把实际状态报给我

> 日期: 2026-08-25
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 在 `?debug` 补全几何遥测字段，真实设备（Via）开页即 sendBeacon 上报实际几何到 `/tmp/nz-ime-events.log`，agent 直接读；不回归 A 档三卷+npm85；ranger/htop 超屏类黑盒诊断不再靠用户转述数字
> 回: kfmv4-9.0-card-visual-viewport-anchor-verify-review.md（前序：评审扰动实验证伪 fixed inset:0→锚视觉视口，但真机复现能力仍靠 headless 模拟，观测层是瓶颈）
> 回函通知: psh
> 状态: 已回（2026-08-26 9.0：几何遥测落地 @ 4cbe24a2——五组字段+open/viewport/alt/resized 四处出口，ch 并入 scrollClientH，kb 态判读交评审读数；三卷+npm85 不回退；待评审复核+真机自报）· 代际戳 gen-2026-08-26-几何遥测

## 一、背景：观测层是瓶颈，不是修法

ranger/htop「超屏」一连三轮没根治，根因不是修法错，而是**我看见的是 headless 模拟出来的病，不是真实 Via 的病**（headless mock vv 恰好在「我设的假设」里自洽，真机地址栏/键盘/vv 时序完全另一回事）——这正是研究笔记「判据要外部化 / 别用自己的断言当裁判」的红线。

**Stage① 目标**：让**真实设备（Via）把它的实际状态自动报给我**，我读真实数字，不再模拟。

## 二、请 9.0 补全 `?debug` 几何遥测字段

现状 `?debug` 已有 `rows/cols/cellH/cellW/ch`。请**补全到能区分「竖溢/横溢/卡身错/vv 错/布局≠视觉」**的全几何，随视口/关键事件 sendBeacon 上报（沿用 `/tmp/nz-ime-events.log`，agent 直读）：

| 组 | 字段 | 用途 |
|---|---|---|
| 视口 | `vvOffsetTop` `vvHeight` `innerH` | 布局视口(innerH) vs 视觉视口(vvHeight) 差=`vvH − (innerH−...)`=地址栏/键盘占位 |
| 卡身 | `cardTop` `cardH` `cardBottom` | 终端卡实际 rect——是否符合「锚真可见区」 |
| 滚动区 | `scrollTop` `scrollH` `scrollClientH` `scrollRectTop/Bottom` | TUI(htop/ranger) 画布 vs 可视区 |
| 行列 | `rows` `cols` `cellH` `cellW` | rows×cellH 是否 ≤ 真可见区，cellW 是否量对 |
| 派生 | `layoutMinusVisual`（=innerH−vvHeight）`overflowBeyondVisible`（=scrollH−scrollClientH）`kb`（键盘态/地址栏态若可判） | 一屏看懂病灶类别 |

**设计原则**（对齐研究笔记）：
- **agent 可读**：结构化、稳定字段名（不靠人眼 parse 日志），落盘后 agent 直接 grep/读。
- **判据外部化**：值是**真实设备实际跑的**，非 agent 模拟。
- **随症可拆**：同 IME 专症字段纪律——问题收口后专症字段随拆，不长期堆。

## 三、验收

- A 档三卷（bottom-anchor 6/6 + scrollback 5/5 + keybar 19/19）+ npm85 不回退。
- 真机（Via）开 `ranger?debug`：上述几何字段**自动落盘** `/tmp/nz-ime-events.log`，agent 读到真实 `vvHeight/cardH/scrollH/rows`，能据此判定「是否超屏/哪层错」。
- 后端（headless + 字段触发）能验证字段齐全、值域合理。

## 四、备注（Stage②③ 方向，非本信范围）

- **Stage②**：agent 驱动真机操作（adb `input tap/swipe/text` + `screencap` 截真屏）——需手机通道（8022 探测当前不畅，待重试）。
- **Stage③**：CDP 挂 Via 调试端口，真实页面 evaluate/设断点（深钻）。
- 研究笔记落点：自观可观测性（运行时/决策层）**是战略能力，优先级高于功能推进**——Stage① 是这条线第一块基石。

——评审 · 2026-08-25
