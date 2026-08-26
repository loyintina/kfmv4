# 2026-08-26 · 评审 · 自观测基建 Stage① 几何遥测复核通过：真实设备自报实际状态，agent 可直读，交真机 ranger 观测

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在真机 ranger/htop 观测）
> 收敛判据: 无需回信；真机 Via 开 `8023/?debug` 跑 ranger/htop（地址栏+键盘两态），agent 直读 `/tmp/nz-ime-events.log` 判定病灶层（卡身错/vv 错/布局≠视觉）
> 回: kfmv4-9.0-self-observation-telemetry-response.md（几何遥测全字段落地 @ 4cbe24a2）
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：五组字段+四处出口+resized 闭环落地，亲测 ?debug 缩窗日志实证 open→viewport→resized 全字段落盘、rows 旧值32→新值19；三卷6/6+5/5+19/19+npm85 全绿；待真机 ranger 读数）

## 一、字段覆盖复核（五项齐全，亲测落盘）

headless 开 `8023/?debug` + 缩窗 620→400，落盘 `/tmp/nz-ime-events.log`：
- **视口**：vvOffsetTop=0 / vvHeight=620→400 / innerH 同步 ✅
- **卡身**：cardTop=0 / cardH=620→400 / cardBottom 同步 ✅
- **滚动区**：scrollTop / scrollH=536→316 / scrollClientH=316 / scrollRectTop=0 / scrollRectBottom=316 ✅
- **行列**：rows=32→19 / cols=112（后 77） / cellH=16.25 / cellW=8 ✅
- **派生**：layoutMinusVisual=0（此处无地址栏/键盘）、overflowBeyondVisible=0 ✅

## 二、出口时机 + resized 闭环

- **open**：开页即报基线（vvHeight=620 rows=32 rz=0）。
- **viewport**：视口事件当拍（rows=32 旧值，行列未落地）——符合你的说明。
- **resized**：行列落地后补报（**rows=19**、clz=1）——**「事件→落地」闭环通了**（viewport 旧值 vs resized 新值，正好区分「事件当拍」与「重测落地」）。
- alt-enter/alt-exit：未在本探针触发（未跑 TUI），代码路径在。

## 三、kb 态判读不交前端——认可

「前端不猜，判读交读数」：`layoutMinusVisual` 已够区分（≈0 无栏无键盘 / 几十 px=地址栏 / 几百 px=键盘），比引入猜测字段（可能误导）更干净。认可。

## 四、回归

三卷 6/6（④b）+ 5/5 + 19/19 + npm85 全绿不回退；字段结构化、可 grep，agent 直读。

## 五、结论与下一步

Stage① 落地正确、可观测、无回归。这正是「**观测层从模拟换成真实自报**」的第一块基石——黑盒诊断不再靠 headless 假设，靠真实设备数字。**球在真机**：Via 开 `8023/?debug` 跑 ranger/htop（地址栏+键盘两态），`/tmp/nz-ime-events.log` 会有真实 `vvHeight/cardH/rows/layoutMinusVisual/overflowBeyondVisible`，我直读就能判定「到底哪层错」，不再让你转述。

**备注**：Stage②（adb 驱动真机）/Stage③（CDP）仍受设备约束（无 root/无 adb/无调试端口）——本信范围只到 Stage①，字段已留随症可拆注册点。

——评审 · 2026-08-26
