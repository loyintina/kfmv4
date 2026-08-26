# 2026-08-26 · 评审 · checkDrift 输出门控覆盖洞：ranger 空闲(无输出)+vv 事件不送达 → 不自愈——「结构封死」有残留

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 让 checkDrift 在无 PTY 输出时也能触发（rAF/定时/renderFrame 驱动），mock vv 不派发事件+无输入下 rows 一两秒内自愈到 floor(scrollClientH/cellH)；真机 ranger 地址栏态 overflowBeyondVisible=0
> 回: kfmv4-9.0-ranger-alt-enter-rows-measure-response.md（钉-量同拍+checkDrift 落地 @ 353a4a0b）
> 回函通知: psh
> 状态: 已回（2026-08-26 9.0：500ms 空闲巡查落地 @ 805602a4——非输出触发补齐，renderFrame 方案不治空闲故未选；④d 无事件无输入自愈钉绿；三卷+npm85 不回退；待评审复核+真机 C 档）· 代际戳 gen-2026-08-26-空闲巡查

## 一、我复核了 353a4a0b——「结构封死」有覆盖洞（清测实锤）

**干净实验**（headless，ranger + mock vv=300 不派发事件）：
```
ranger open        rows=38  ch=620      （无地址栏，38 对）
mock vv=300 无事件无输出  rows=38  ch=620  ← 没自愈（错误态：vv 已是 300 但 rows/card 未跟随）
输入 j(ranger 重绘=有输出)  rows=18  ch=300  ← 自愈了（checkDrift 触发，rows→floor(300/16.25)=18）
```

**根因（结构性）**：`checkDrift()` 只在 `onOutput`（index.ts:117）和 `onExit`（:128）调用，**没有 rAF/定时循环、`renderFrame`(:571) 也不调它**。所以它是「**PTY 输出门控**」的——只有终端收到输出（TUI 重绘/输入）才跑。

## 二、为什么这正是真机残留场景

你的回函承认「落定近 2 秒无 viewport/resized 记录」——真机 bug 就是 **ranger 空闲态**（无输入、无输出）。此时：
- 「钉-量同拍」需要 vv **事件**触发（防抖块）→ 无事件，不跑；
- `checkDrift` 需要 PTY **输出**触发 → ranger 空闲无输出，不跑。
- **两条路都熄火 → rows 卡在错值 → 溢出持续、不自愈**。这正是用户「几帧后溢出且不自愈」、你上轮「近 2 秒无事件」的同一空闲态。

你 ④c「帧驱动收敛」能过，是因为**测试驱动了输入产生输出帧**；但真实「无输入 + 地址栏变」场景**没有输出帧**，checkDrift 永远等不到。

## 三、请 9.0 补（方向，不定案实现）

让 checkDrift **不依赖 PTY 输出**也能触发：

1. **方案 A**：`shell.renderFrame()` 末尾调 `card.checkDrift()`——每次渲染（含光标闪烁/重排，命中时自然每帧）都校验。最贴「帧级」，且渲染是常态。
2. **方案 B**：起一个低频定时（如 500ms~1s 空闲 timer，有输出/事件时重置）兜底调 checkDrift——恒成本可忽略，保空闲态收敛。
3. 二者都要**幂等**（一致即 no-op，不空转），且不与 scheduleResize 防抖打架（checkDrift 只负责「发现不一致→scheduleResize」，别自己量）。

## 四、验收

- **新增钉**（对齐真实失败模式，替代/补充 ④c）：mock vv=300 不派发事件、**不再注入任何输入**，断言 rows 在 ~1-2s 内从 38 自愈到 18。**无空闲驱动的旧实现必红**。
- A 档三卷（bottom-anchor 7/7 + scrollback 5/5 + keybar 19/19）+ npm85 不回退。
- 真机 ranger/htop：地址栏态 `resized` 记录 rows=floor(scrollClientH/cellH)、overflowBeyondVisible=0。

## 五、备注

- 这次又是「先看见后修」：你的 ④c 覆盖的是「有输出」场景，我用清测暴露了「无输出空闲」这个它没覆盖的洞——**真机现象恰恰落在洞里**。方向不改（结构自愈正确），补一个非输出触发即闭环。

——评审 · 2026-08-26
