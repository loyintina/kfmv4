# 2026-08-26 · 9.0 · rows 未随视口缩修复回函：真机数据再定位——rz=27 证明重测在跑，卡的是 cellH；ResizeObserver+字体复量两路自愈

> 日期: 2026-08-26
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核两路自愈与④c回归钉；球交真机 C 档（地址栏+键盘两态 ranger/htop overflowBeyondVisible=0、resized 记录 rows 随视口缩）
> 回: kfmv4-9.0-ranger-rows-not-shrink-review.md（真机 ranger 数据：卡身锚对、rows 卡 58）
> 回函通知: psh
> 状态: 已回（2026-08-26 9.0：两路自愈落地 @ 10ad116b——ResizeObserver 盯 scrollEl+字体 1s/3s 幂等复量；④c 回归钉绿；三卷+npm85 不回退；待真机复核）

## 一、对真机数据的再定位（与你的诊断有一处细化）

你判断「rows 那路（scheduleResize→重测）没跟上/滞后」——但日志里 `rz=27`（已落地行列变更 27 次）说明**重测一直在跑、也一直在落地**。真正卡死的不是触发，而是**度量**：rows=58 只在 cellH≈13.88 时能量出（805/13.88=58；正确的 NF 字格是 16.25，应得 49）——**cellH 停在了 fallback 字体值，字体真正落地后没有任何事件触发重量**。

两个卡死路径都成立，都修：

1. **字体事件不送达/提前 resolve**：Via 上 NF 字体若缓存秒载，`loadingdone` 可能整组不发；而 open 时的 `fonts.load` 又可能提前 resolve 量到 fallback 字格（代码注释里早有此虑）。→ **开后 1s/3s 幂等复量兜底**（字格没变=no-op，变了才作废壳缓存+重测行列）。
2. **vv 事件不送达**（地址栏伸缩在 Via 可能不触发 vv resize/scroll，卡身钉对的那几次可能是初始钉或键盘事件带的）→ **ResizeObserver 直盯 scrollEl 几何**：布局落定后必触发，完全不依赖 vv 事件送达。与 vv/ALT/字体三路同走 scheduleResize 防抖块，重复触发幂等。

## 二、④c 回归钉（fix 门禁要求，已补）

bottom-anchor 新增④c：**直接改卡身高度、不派发任何 vv 事件**（模拟 Via 地址栏不送事件的路径），断言 rows 经 ResizeObserver 落地（承接④b 末态 rows=19 → 卡身改 500 后 rows=25=floor(416/16.25)）。**无 RO 的旧实现 rows 卡旧值=必红**。判卷钩子 `__kfmNzTermScroll` 补 rows/cols 字段。

## 三、验证

- bottom-anchor 7/7（④c 新钉绿）+ scrollback 5/5 + keybar-click 19/19 + npm 85 全绿。
- headless ?debug 缩窗闭环不回退：open(rows=32)→viewport(旧值)→resized(rows=19, rz=1)。

## 四、待办

- 评审复核（重点：rz=27 的解读——重测在跑、卡在度量，这个细化是否成立；两路自愈覆盖度）。
- 真机 C 档：地址栏+键盘两态 ranger/htop，期望 `overflowBeyondVisible=0`、resized 记录 rows≈49/13、TUI 占满真可见区不裁不上滑。若 rows 仍异常，日志里 resized 记录的 cellH 值会直接指认真凶（度量错 vs 事件未到）。

——9.0 · 2026-08-26
