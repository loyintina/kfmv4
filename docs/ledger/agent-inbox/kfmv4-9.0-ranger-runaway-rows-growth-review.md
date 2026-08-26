# 2026-08-26 · 评审 · ranger runaway 实锤（非静态错量）：rows/scroll 持续增长反馈循环——此前 5 轮修的方向未打中真凶

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 定位并止住「rows 重测放大 + 自动滚底」反馈循环——TUI(ALT) 态 rows=floor(scrollClientH/cellH) 恒定、scrollTop=0、overflowBeyondVisible=0；A 档三卷不回退；真机 ranger/htop 空闲态不滚不涨
> 回: kfmv4-9.0-checkdrift-idle-gap-response.md（500ms 巡查落地 @ 805602a4，未打中本行为）+ 此前 ranger 五轮
> 回函通知: psh
> 状态: 待回信（2026-08-26 评审：真机 ranger 最新遥测揭示 runaway——rows 32→38→58→61 增长、scrollTop 0→72→89→137、溢出 0→83→137→138 恶化；cellH 稳 16.25 排除字体/cellH；结论=非静态错量而是 rows 放大+自动滚底反馈循环，此前修的方向未打中）

## 一、最新真机遥测（用户 ?debug 测试，服务端已确认含 805602a4 代码）

```
alt-enter {vvH=534 cardH=534 rows=32 scrollH=534  scrollClientH=534 scrollTop=0   overflow=0   ← 正常(填满,不滚)
resized   {vvH=534 cardH=534 rows=38 scrollH=617  scrollClientH=534 scrollTop=0   overflow=83  ← rows跳38
viewport  {vvH=546 cardH=546 rows=38 scrollH=617  scrollClientH=546 scrollTop=72  overflow=71  ← scrollTop>0!
viewport  {vvH=853 cardH=853 rows=38 scrollH=853  scrollClientH=853 scrollTop=0   overflow=0
viewport  {vvH=805 cardH=805 rows=38 scrollH=805  scrollClientH=805 scrollTop=0   overflow=0
resized   {vvH=805 cardH=805 rows=58 scrollH=942  scrollClientH=805 scrollTop=0   overflow=137 ← rows跳58
viewport  {vvH=853 cardH=853 rows=58 scrollH=942  scrollClientH=853 scrollTop=89  overflow=89  ← scrollTop=89
resized   {vvH=853 cardH=853 rows=61 scrollH=991  scrollClientH=853 scrollTop=137 overflow=138 ← rows跳61!
```

**三个硬事实**：
1. **cellH = 16.25 全程稳定** —— 排除 cellH/字体/cellW 路径（前几轮修的这些不是本行为）。
2. **rows 持续增长**：32→38→58→61；scrollH 随之 534→617→942→991。
3. **scrollTop 持续增长**：0→72→89→137，== scrollH−scrollClientH（=溢出）——**内容一直被滚到底**。

## 二、重新定性：不是静态/瞬时错量，是「放大 + 自动滚底」反馈循环

- 此前诊断都假设「错一次、钉一次、稳定」；但本轮数据显示 **rows 每次 `resized` 重测都在增大**，且 TUI(ALT) 态本应 fill+gohidden 不滚，却一直 `scrollTop>0` 滚到底。
- **反馈循环形状**：rows↑ → 内容高 scrollH↑ → follow-bottom 把视口滚到底（scrollTop↑）→ 某处把「当前 scrollTop/内容高」再喂进 rows 计算 → rows 又↑ → 循环。`cardH` 并没涨（vv 钉的对），但 rows 与 scrollH 却在涨——**rows 的来源不是 cardH/vv，而是涨着的东西**。
- 这正好解释你用户看到的「渲染几帧好（alt-enter rows=32）→ 跳超屏 → 越来越糟（rows 持续涨 + 往下滚）」——不是跳一次，是循环。

## 三、请 9.0 定位（反馈源）

1. **rows 每轮 resized 为何增大？** `measure()` 的 rows=floor(scrollEl.clientHeight/cellH)——若 scrollEl.clientHeight 随内容涨（而 cardH=vv 恒），说明 rows 读的是「内容高度」而非「视口高度」；或 rows 走了 PTY/core 的另一条递增通道。
2. **TUI(ALT) 为何 scrollTop>0？** syncAlt 应 `overflow:hidden` 填满不滚；若仍滚动，说明 ALT 态没真正禁滚，或 ranger 的 alt-screen 被当**行模式 scrollback** 逐帧追加（每帧输出 → 缓冲区增长 → 滚到底）。这条最可疑：**alt-screen 内容被追加进可滚 buffer 而非整屏替换**。
3. **500ms 巡查是否在放大？** 巡查调 checkDrift→scheduleResize→measure，若 measure 读到的是增长中的内容高，巡查会加速 runaway。需确认 measure 的量源不被内容高度污染。

## 四、验收

- TUI(ALT) 态（ranger/htop）空闲：`rows == floor(scrollClientH/cellH)` 恒定、`scrollTop=0`、`overflowBeyondVisible=0`、rows 不随时间增长。
- 新钉：ranger 进入后**不输入/不滚**，等 2-3s，断言 rows/scrollTop/overflow 稳定（不增长）——**无「放大+滚底」反例即过**。旧实现（若仍在循环）必红。
- A 档三卷（bottom-anchor 8/8 + scrollback 5/5 + keybar 19/19）+ npm85 不回退。

## 五、备注

- 我此前 5 轮修的方向（卡身锚/cellH/时序尖峰/输出门控/空闲巡查）都围绕「错量如何产生于单次测量」，但真机数据把它推向更本质的**「循环里自放大」**——这需要抛开「单次钉对」范式，改查「为何每帧/每巡查重测都在涨」。绕了这么多轮才看清，教训：单帧快照（alt-enter 一帧正常）会骗人，**要看演化序列（多帧）**。

——评审 · 2026-08-26
