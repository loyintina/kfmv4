# 2026-08-26 · 评审 · 真机 ranger 数据改写诊断：卡身锚已修对，残留=PTY rows 未随视口收缩重测——ranger 缓冲溢出可见区

> 日期: 2026-08-26
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: kfmv4-9.0
> 收敛判据: 9.0 定位并修「视口缩小(地址栏/键盘)时 rows 未重测到与卡身一致」→ rows×cellH ≤ scrollClientH 恒成立，真机 ranger/htop 地址栏+键盘两态 overflowBeyondVisible=0；A 档三卷不回退
> 回: kfmv4-9.0-self-observation-telemetry-response.md（Stage① 遥测落地@4cbe24a2，本次用真机数据诊断 ranger）
> 回函通知: psh
> 状态: 已回（2026-08-26 9.0：两路自愈落地 @ 10ad116b——ResizeObserver 盯 scrollEl+字体幂等复量；再定位：rz=27 证明重测在跑、卡的是 cellH 停 fallback 值；④c 回归钉绿；待评审复核+真机 C 档）· 代际戳 gen-2026-08-26-rows自愈

## 一、真机数据（Via 跑 ranger，Stage① 遥测，agent 直读）

日志 `/tmp/nz-ime-events.log` 尾部（真实设备、非 headless）：

| 态 | innerH | vvHeight | cardH | layoutMinusVisual | rows | scrollClientH | scrollH | overflowBeyondVisible |
|---|---|---|---|---|---|---|---|---|
| 全屏无栏 | 853 | 853 | 853 | ≈0 | 38 | 853 | 853 | 0 ✅ |
| 地址栏可见 | 853 | 805 | 805 | 47 | 58 | 805 | 942 | **137 ❌** |
| 键盘态 | 545 | 226 | 226 | 318 | 58 | 226 | 942 | **716 ❌** |

## 二、诊断改写（关键）

1. **卡身锚已修对**：`cardH` 正确= `vvHeight`（805/226/853），不再是布局视口——上一轮「锚视觉视口」e4e9ad95 修复**确认有效**。
2. **残留真凶 = rows/PTY 未随视口缩**：
   - 地址栏态：cardH=805（卡身对），但 `rows=58`（58×16.25=942=scrollH），可视 `scrollClientH=805`（只装 ~49 行）→ **rows 比可视多 9 行 → 溢 137px**。
   - 键盘态：cardH=226，rows=58 → 溢 716px（更夸张）。
   - 全屏无栏：rows=38 与可视 853 匹配 → overflow=0（此态正常）。
3. **规律**：**rows 是被钉在某个大值（58），视口缩小（地址栏/键盘让 vvHeight/cardH 缩）时 rows 没有重新测成 `floor(scrollClientH/cellH)`**。所以 TUI(ranger) 缓冲比可视区高 → 「超屏/需上滑/被裁」。

## 三、请 9.0 定位

**为什么 viewport 缩小时 rows 未重测到与卡身一致？** 排查方向：
- `measure()` 的 rows=floor(scrollEl.clientHeight/cellH)——address bar 收缩时 scrollEl.clientHeight 应=新值，但看起来 rows 用的是**旧/更大高度**（或重测未触发、或 scheduleResize 防抖后仍用旧值）。
- 与 cardH=vvHeight（当拍即钉）对比：**卡身当拍缩了，但 rows 那一路（scheduleResize→重测）没跟上/滞后**——卡身/rows 两条路不同步。
- 期望：任一 vvHeight 变化（地址栏 hide/show + 键盘 + ALT 翻转）后，`rows×cellH ≤ scrollClientH` 恒成立（resized 落地记录应为「新 rows」，非旧值）。

## 四、验收

- 真机 ranger/htop：地址栏可见 + 键盘两态，`overflowBeyondVisible=0`、ranger 占满真可见区不超/不裁。
- A 档三卷（bottom-anchor 6/6 + scrollback 5/5 + keybar 19/19）+ npm85 不回退。
- `?debug` resized 记录 rows 应随视口缩到 `floor(scrollClientH/cellH)`（如地址栏态 rows≈49、键盘态 rows≈13）。

## 五、备注

- 这一步验证了「黑盒→建模」路线：**先用真机数据看真病，再谈修**——本次正是靠 Stage① 把「卡身锚错」这个被 headless 误导的判断推翻，定位到「rows 未缩」这个真因。
- kb 态（键盘弹起）ranger 溢 716 可能含瞬时键盘切换噪音，建议重点以「地址栏可见、无键盘」的稳态（溢137）作基准定位。

——评审 · 2026-08-26
