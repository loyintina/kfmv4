# 2026-08-26 · 9.0 · 自观测基建 Stage① 落地回函：?debug 几何遥测全字段，真实设备自报实际状态

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核字段覆盖与出口时机；真机（Via）开 ?debug 跑 ranger/htop，agent 直读 /tmp/nz-ime-events.log 判定病灶层
> 回: kfmv4-9.0-self-observation-telemetry-review.md（观测层是瓶颈非修法，Stage① 第一块基石）
> 回函通知: psh
> 状态: 已回（2026-08-26 9.0：几何遥测全字段落地 @ 4cbe24a2——五组字段+四处出口+resized 闭环；三卷+npm85 不回退，headless 实证字段齐全值域合理）

## 一、字段覆盖（对你二节表）

- **视口**：vvOffsetTop / vvHeight / innerH ✅
- **卡身**：cardTop / cardH / cardBottom ✅
- **滚动区**：scrollTop / scrollH / scrollClientH / scrollRectTop / scrollRectBottom ✅
- **行列**：rows / cols / cellH / cellW ✅（原有保留；ch 并入 scrollClientH 正名，同值）
- **派生**：layoutMinusVisual（=innerH−vvHeight，地址栏/键盘占位）、overflowBeyondVisible（=scrollH−scrollClientH）✅
- **kb 态**：未做前端猜测字段——layoutMinusVisual 已够区分（≈0 无栏无键盘、几十 px=地址栏、几百 px=键盘），判读交给你读数，前端不猜（防误导字段）。

## 二、出口时机（四处）

1. `open`：开页即报基线几何（你要的「开页即上报」）。
2. `viewport` / `viewport-scroll`：视口事件当拍（卡身已钉、行列未落地——rows 是旧值）。
3. `alt-enter` / `alt-exit`：ALT 翻转（TUI 超屏诊断的关键事件）。
4. `resized`：**行列重测落地后补报**——补全「事件→落地」闭环（viewport 记录的 rows 是事件当拍旧值，resized 记录才是新 rows + rz 递增）。

## 三、验证

- 三卷不回退：bottom-anchor 6/6 + scrollback 5/5 + keybar-click 19/19；npm 85 全绿。
- headless 开 `?debug` + 缩窗 620→400 实证落盘（`/tmp/nz-ime-events.log`）：`open`（vvHeight=620 cardH=620 rows=32）→ `viewport`（vvHeight=400 cardH=400 rows=32 旧值）→ `resized`（rows=19 rz=1）三条闭环，字段齐全、值域合理、结构化可 grep。

## 四、待办

- 评审复核。
- 真机：Via 开 `8023/?debug` 跑 ranger/htop（地址栏+键盘两态），你直读日志判定「卡身错/vv 错/布局≠视觉」——不再靠用户转述数字。
- Stage②（adb 驱动真机）/Stage③（CDP 挂 Via）不在本信范围，基建字段已按随症可拆纪律留注册点。

——9.0 · 2026-08-26
