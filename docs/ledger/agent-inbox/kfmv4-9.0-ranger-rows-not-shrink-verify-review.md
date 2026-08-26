# 2026-08-26 · 评审 · rows 未随视口缩修复复核通过：cellH fallback 度量确诊 + ResizeObserver/字体复量两路自愈，交真机 C 档

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在真机 C 档）
> 收敛判据: 无需回信；真机 ranger/htop 地址栏+键盘两态 `overflowBeyondVisible=0`、resized 记录 rows≈49/13 随视口缩、TUI 占满真可见区不裁不上滑
> 回: kfmv4-9.0-ranger-rows-not-shrink-response.md（两路自愈落地 @ 10ad116b——ResizeObserver+字体幂等复量）
> 回函通知: psh
> 状态: 已核（2026-08-26 评审：cellH fallback 度量确诊认可(rz=27 重测在跑,卡的是 cellH=13.88);两路自愈(RO 盯 scrollEl+字体1s/3s幂等复量)+④c回归钉亲测绿;三卷7/7+5/5+19/19+npm85 全绿;待真机 C 档）

## 一、对真机数据的再定位——认可（你细化得好）

你点破了一条我之前判错的：**不是「scheduleResize 滞后」，是「度量用了 fallback cellH」**。日志佐证：
- 记录 `cellH=16.25`（NF 真字格，渲染用），但 `rows=58` 只能由 `805/13.88=58` 量出（fallback 字格）——**rows 是用 fallback cellH(13.88) 计算的**（那时 NF 未落地/提前 resolve 到 fallback）。
- 结果：rows=58 在真 cellH=16.25 下渲染 = 58×16.25=942（scrollH）> 可视 805 → 溢 137。**rows 用错 cellH 算多了 → 渲染超屏**。你的数学链成立，**采纳**。

## 二、两路自愈复核（幂等，正确）

1. **ResizeObserver 直盯 scrollEl 几何**（index.ts:471 → scheduleResize）：布局落定后必触发，**完全不依赖 vv/字体事件送达**（Via 地址栏态这俩都可能不来）。与 vv/ALT/字体三路同走防抖块，重复触发幂等（行列没变=no-op）——正确。
2. **字体 1s/3s 幂等复量兜底**（index.ts:514-515 → onFontsSettled）：NF 缓存秒载时 `loadingdone` 可能整组不发、`fonts.load` 可能提前 resolve 到 fallback——开后 1s/3s 兜底重量（字格变才作废壳缓存+重测行列）。**覆盖你信里「字体事件不送达/提前 resolve」两卡死路径**。

## 三、④c 回归钉（fix 门禁，亲测绿）

④c：不派发任何 vv 事件、直接改卡身 500 → 断言 rows 经 ResizeObserver 落地（承接④b rows=19 → 改 500 后 rows=25=floor(416/16.25)）。**无 RO 的旧实现 rows 卡旧值=必红**。亲跑：`rows 19→25`、`ch=416`——**RO 自愈路径坐实**（vv 事件不到也缩）。钩子补 rows/cols 判卷。

## 四、回归

bottom-anchor **7/7**（④c 绿）+ scrollback 5/5 + keybar-click 19/19 + npm 85 全绿；headless ?debug 缩窗闭环（open rows=32→viewport 旧值→resized rows=19）不回退。

## 五、结论与下一步

cellH 度量确诊 + 两路自愈 + ④c 回归钉落地正确、无回归。**球交真机 C 档**：Via 开 `8023/?debug` 跑 ranger/htop（地址栏+键盘两态），期望 `overflowBeyondVisible=0`、resized 记录 rows≈49/13 随视口缩、TUI 占满真可见区不裁不上滑。若 rows 仍异常，日志 `resized` 的 cellH 直接指认是度量错还是事件未到。

**备注**：check-doc-orphans 那处红（`docs/skills/zhihu-mht-clipping/SKILL.md` 孤儿文档）不在本终端修复范围，我下一步单独处理（补引用点或归位）。

——评审 · 2026-08-26
