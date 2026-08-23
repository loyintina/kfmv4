# 2026-08-23 · 9.0 · keybar 过渡帧闪帧修法已落：钉 vv 移出防抖 + bar 实测 rect 上报

> 日期: 2026-08-23
> 致: 评审
> 流型: 链条
> 预期表态方: 评审（修法核对）+ 用户（真机逐帧验收）
> 收敛判据: 真机同步录屏逐帧：键盘弹起那几帧 keybar 下排不再闪/被盖；settled 两排稳定；?debug brb（bar 实测 rect 底）与键盘顶对齐
> 回: kfmv4-9.0-keybar-float-transition-report.md
> 回函通知: psh
> 状态: 已回（2026-08-23 9.0：修法 be5f95b1 已落，球在用户真机逐帧验收）

## 一、三条修法对应落地

**① 去到防抖后跳 —— 已去。** 病根确认：键盘弹起是动画，vv 逐帧变；栏/容器等 150ms 防抖才追 = 键盘占位那几帧下排被盖的闪帧真凶。修法：
- 新增 `pinToVv()`（容器顶=vv.offsetTop、高=vv.height-栏高），与 `keybar.updateBottom()` 一起在 vv resize/scroll **事件当拍**执行——样式改写很便宜，布局一变立即钉；
- 贵的部分（重测行列 + 核/壳/PTY 三方 resize）**仍留 150ms 防抖**——动画期逐帧 thrash 核 resize 才是新灾难，防抖里只剩它。

**② 对齐最终 vv —— 由①天然满足。** 当拍钉用的是事件触发时的最新 vv；浏览器逐帧发事件逐帧钉，bar 跟键盘动画同步上移，无中间值滞留。

**③ bar 实测 rect 上报 —— 已加。** `reportViewport` 新增 `brt/brb` = `barStrip.getBoundingClientRect()` 的 top/bottom 实测渲染坐标（不再只报 style.top 设定值）；kbc 同源改用同一 rect。专症字段，随症收口。

## 二、验证基线

- `npm run build && typecheck && test`：84 passed 全绿；bundle v=d08c10ee（哈希缓存破坏，真机强刷即新包）；
- smoke PASS；点击可测性 E2E 17/17 绿（bar 可点性无回归）；
- chain 在 kfmv4 根目录跑（nz 提交后补跑）。

## 三、验收口径（球在用户）

真机 `http://<机器IP>:8023/?debug` 强刷后：**同步录屏逐帧**看键盘弹起那几帧——keybar 下排应**立即跟上不再闪/被盖**；settled 态两排稳定；`brb`（bar 实测底）应与键盘顶对齐（≈vv 底）。

8.8.3b 验收全过后照旧收口：移除专症字段（ih/vh/ot/dch/kbb/kbc/brt/brb/fx/vm + 双轨色条），保留 f/rp/sc/rz 骨架。

——9.0 · 2026-08-23
