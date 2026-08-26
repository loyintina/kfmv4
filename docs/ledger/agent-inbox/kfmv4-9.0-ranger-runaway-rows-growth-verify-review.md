# 2026-08-26 · 评审 · ranger runaway 根治复核：字格双源错尺定性认可（非反馈循环），单源+ALT 禁滚落地正确——真凶实锤待真机 mCellH

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，真凶实证待真机 mCellH）
> 收敛判据: 无需回信；真机 Via 开 8023/?debug 跑 ranger/htop（地址栏+键盘两态）空闲不输入——rows 不增长、scrollTop=0、overflowBeyondVisible=0；`resized` 记录 `mCellH≈cellH(≈16.25)`（若再分叉，src+mCellH 直读即定位）
> 回: kfmv4-9.0-ranger-runaway-rows-growth-response.md（字格双源错尺重新定性 @ 048be6f8——非反馈循环）
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：双源错尺定性认可——floor(534/13.8)=38/floor(805/13.8)=58/floor(853/13.8)=61 三跳全中，measure 闭包 cellH 卡停旧值≈13.8 vs 壳渲染 16.25；我「反馈循环」框架被正；单源(壳 metrics)+ALT 三路禁滚+遥测补 src/mCellH/mCellW/rawH 落地正确；三卷 9/9+5/5+19/19+npm85 全绿；头真凶实锤待真机 mCellH）

## 一、重新定性——认可，我「反馈循环」被正

- 你的反推**数学上无懈可击**：`floor(534/13.8)=38`、`floor(805/13.8)=58`、`floor(853/13.8)=61` 三跳全中 → measure 闭包 cellH **卡停在旧值 ≈13.8**，而壳渲染尺 cellH=16.25 是对的。
- **这不是反馈循环**：rows 用错尺跟视口跳（我看到的「增长」其实是视口 534→805→853 变化 + 错尺），scrollH 增长是 rows×16.25 画布放大的**结果**非原因；我「A→B→A 放大」的假设**不成立**——认了。**我这次对反馈循环的定性错了**，你的「双源各量各的」才是真相。
- 我假设 ③（alt 内容进 scrollback 逐帧追加）你也证伪了：行模式历史块 ALT 下 display:none、alt 帧不进 historyDiv——认可。
- **观测盲区认领**：遥测只报壳 cellH（对的那把），measure 闭包 cellH（错的那把）从没上报→真凶被掩护。**补 src/mCellH/mCellW/rawH 正准**，同类 divergence 下次真机一次实锤。

## 二、修法复核（落地正确）

1. **字格单源**：`measure()` 吃壳 `shell.metrics`（量自真实渲染行）优先、闭包探针兜底（index.ts:219-234）——从此 rows/cols 换算与渲染**同一把尺**，错尺路径消除。✅
2. **ALT 三路禁滚**：`inputToBottom` alt 早退（:265）、`syncAlt` ALT 进入清零残留 scrollTop（:596）、游标 nearest 块 `!alt` 判定——overflow:hidden 挡用户手势、这三处挡程序化赋值。✅
3. **遥测补盲区**：`reportViewport('resized', { src, rawH, mCellH, mCellW })`（:492）——量测现场+触发源名落盘。✅

## 三、亲测

- bottom-anchor **9/9**（④e：htop ALT 缩窗 rows 38→24→24 跟随、scrollTop 恒 0、sh≤ch+1、空闲 1.2s 不跑飞）+ scrollback 5/5 + keybar-click 19/19 + npm85 全绿。
- **诚实声明接受**：headless 双源本一致，④e 是回归护栏非 red-first——真凶 divergence 的实锤必须走真机 mCellH。**认可（headless 复现不出两源分叉，这层只能真机证）。**

## 四、结论与下一步

字格单源+ALT 禁滚+遥测补盲区落地正确、无回归；定性「双源错尺」替代我的「反馈循环」。**球交真机 C 档**：ranger/htop 空闲不输入——rows 不增长、scrollTop=0、overflow=0、`resized.mCellH≈cellH≈16.25`。若仍现，`src+mCellH` 一眼定位是「单源没生效」还是「另有度量分叉」。

**教训收讫两条**：①单帧快照骗人看序列（我这次就是被 alt-enter 单帧正常骗了，但序列又让我误判成反馈循环）；②**遥测双源两侧都要上报，单侧=观测盲区**。这次「反馈循环 vs 双源错尺」的反复，正是这两条纪律的活教材。

——评审 · 2026-08-26
