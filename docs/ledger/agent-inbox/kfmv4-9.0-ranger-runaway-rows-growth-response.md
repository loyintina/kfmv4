# 2026-08-26 · 9.0 回函 · ranger runaway 根治落地：重定性=字格双源错尺（非反馈循环）+ ALT 三路禁滚 + 遥测封盲区 @ 048be6f8

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核修复与规格吻合、亲跑三卷+npm85 不回退；用户真机 C 档 ranger/htop 空闲态 rows 不增、scrollTop=0、overflowBeyondVisible=0
> 回: kfmv4-9.0-ranger-runaway-rows-growth-review.md
> 状态: 已核（2026-08-26 评审：双源错尺定性认可、反馈循环框架被正；单源+ALT 禁滚+遥测落地正确；三卷+npm85 绿；真凶实锤待真机 mCellH）· 见 kfmv4-9.0-ranger-runaway-rows-growth-verify-review.md · 代际戳 gen-2026-08-26-字格单源-已核

## 一、重定性：不是反馈循环，是两套字格度量各量各的

拿全量时序反推三次 rows 跳变的隐含除数：

- floor(534/x)=38、floor(805/x)=58、floor(853/x)=61 → **x∈(13.76,13.88] 三跳全中**
- 壳渲染尺 cellH=16.25（遥测报的、是对的）；measure() 闭包 cellH≈13.8 **卡停旧值**

结论：rows 重测用了一把卡住的旧尺，视口越大错尺算出的行数越多——表现出来就是"持续增长"，实际是行数用错尺跟着视口跳舞。不是评审假设的放大循环（没有 A→B→A 的反馈通路，scrollH 增长是 rows×cellH 画布放大的**结果**不是原因）。

观测盲区认领：遥测只报壳的 cellH（对的那个），measure 的闭包 cellH（错的那个）从没上报过——双源并存只报单侧，等于给真凶打了掩护。本轮遥测补 **mCellH/mCellW/rawH/src** 四字段（measure 实尺+量测现场+触发源名），此类 divergence 下次真机一次实锤。

## 二、scrollTop>0 真凶：ALT 下三路程序化滚动没禁

overflow:hidden 挡得住用户手势，挡不住代码赋值。ALT（TUI）态下三处仍在写 scrollTop：

1. 壳 renderFrame 游标 nearest 兜底滚动（只判 autoScroll 不判 alt）
2. 插件 followOutput（atBottom 时跟底）
3. 插件 inputToBottom（输入回底）

行模式残留的 scrollTop 还会被带进 ALT 当起点。评审假设③（alt 内容进 scrollback 逐帧追加）**不成立**——shell.ts 行模式历史块在 ALT 下 display:none，alt 帧不进 historyDiv。

## 三、修法（fix @ 048be6f8）

- **字格单源**：measure 吃壳 metrics（量自真实渲染行）优先、闭包探针兜底——从此行列换算与渲染共用一把尺，错尺路径消除
- **ALT 三路禁滚**：壳游标块加 `!alt` 判定；followOutput/inputToBottom ALT 早退；syncAlt ALT 进入清零残留 scrollTop
- **遥测补盲区**：reportViewport 带 src（ro/viewport/vv-scroll/fonts/drift 触发源名）+ mCellH/mCellW/rawH

## 四、验证

- bottom-anchor **9/9**（新增 ④e：htop ALT 缩窗 rows 38→24→24 跟随、scrollTop 恒 0、scrollHeight≤clientHeight+1、空闲 1.2s 不跑飞）
- scrollback 5/5、keybar-click 19/19、npm85 全绿，无回归
- 诚实声明：headless 双源本一致，④e 绿色两可，是回归护栏非 red-first；真凶 divergence 的实锤走新遥测字段真机取证

## 五、球交用户真机 C 档（随四单并验）

Via 开 8023/?debug 跑 ranger/htop（地址栏+键盘两态），**空闲放着不输入**：

- rows 不随时间增长、scrollTop=0、overflowBeyondVisible=0
- 遥测 mCellH 应 ≈16.25 与 cellH 一致（若再分叉，src+mCellH 直读即定位）

教训收讫：单帧快照会骗人，要看多帧演化序列。本轮自补一条：**遥测双源并存时两侧都要上报**，单侧上报=观测盲区。
