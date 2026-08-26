# 2026-08-26 · 9.0 · checkDrift 空闲覆盖洞修复回函：500ms 空闲巡查落地，④d 无事件无输入自愈钉补上

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核空闲巡查与④d钉；球交真机 C 档（地址栏态 ranger overflowBeyondVisible=0、空闲态也不溢出）
> 回: kfmv4-9.0-checkdrift-idle-gap-review.md（清测证伪输出门控：无输出空闲态不自愈）
> 回函通知: psh
> 状态: 已回（2026-08-26 9.0：500ms 空闲巡查落地 @ 805602a4——非输出触发补齐；④d 空闲自愈钉绿；三卷+npm85 不回退；待真机复核）

## 一、覆盖洞认可

你的清测是对的：checkDrift 只在 onOutput/onExit 跑，是 PTY 输出门控——④c 能过恰恰因为测试驱动了输入；真机 ranger 空闲（无输入无输出）+ vv 事件不送达 = 两条路都熄火。这正是「落定近 2 秒无事件」的残留洞，我的「结构封死」说过头了。

## 二、修法（@ 805602a4，方案 B）

1. **500ms 空闲巡查**：`setInterval(() => card.checkDrift(), 500)`——无 PTY 输出也触发，空闲态 1s 内收敛。幂等：一致即 no-op（直读一次 vv 属性 + 两次几何读，恒成本可忽略）；checkDrift 只发现不一致，量算仍归 scheduleResize 防抖块，不与防抖打架。
2. **pinToVv 同值跳过**：巡查把 pinToVv 变成高频调用，加缓存——值没变不写 style，避免无意义的 style recalc。
3. 卸载清 timer（unmountFollow 同路）。

未选方案 A（renderFrame 末尾）：renderFrame 同样只在输出/重排时跑，光标不闪烁时照样空闲——治标同病；定时巡查才真覆盖空闲。

## 三、④d 空闲自愈钉（新增，对齐真实失败模式）

mock vv 340 不派发事件、**不注入任何输入**，断言 ~1.6s 内卡身钉到 live vv（300→340）且 rows 自愈落地（13→15=floor(256/16.25)）。**无空闲驱动的旧实现必红**。④c（有输出路径）保留，两钉分管两个场景。亲测绿。

## 四、验证

- bottom-anchor 8/8（④c+④d 双路径）+ scrollback 5/5 + keybar-click 19/19 + npm 85 全绿。

## 五、待办

- 评审复核。
- 真机 C 档：地址栏态 ranger/htop 空闲放着（不输入），期望不再溢出、resized 记录 rows=floor(scrollClientH/cellH)、overflowBeyondVisible=0。
- 纪律收讫：「结构封死」类结论要用干净实验证伪覆盖洞——这次是输出门控，下次写自愈先问「触发源断了怎么办」。

——9.0 · 2026-08-26
