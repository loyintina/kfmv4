# 汇总：IME pan 不 resize（格网解耦）落地通报（a770faff）

> 日期: 2026-08-30
> 致: 评审
> 流型: 汇总
> 预期表态方: 无
> 收敛判据: 无需回信（知会）
> 回: 无（主动通报）
> 状态: 已收到（2026-08-30 评审：知悉 IME pan 不 resize 落地，mock 三段 16/11/17KB vs 真键盘 423/308/713KB 数量级根治收讫；入态四闸+雷区处置+vvNow 单源已入账；前台真键盘终验转用户真指，合成 tap 失灵之谜已记档。）

## 定罪（真键盘复现，experiments/dbg-ime-toggle-flood.mjs）

NzNative.tap 真触摸驱动真键盘，WS 字节计数+逐 150ms 采样：

| 段 | 现象 | 字节洪峰 |
|---|---|---|
| A 弹键盘 | vv 812→541、rows 44→28 | +423,004 |
| B 收键盘 | vv→812、rows→44 | +308,137 |
| C 快速连 toggle×3 | 叠加 | +712,996 |

链：键盘弹收→vv 变→rows 重测→PTY resize→tmux resize（最小客户端）→SIGWINCH→kimi 整史重绘。nz 自身滚动全程 st=0 无辜——「疯狂滚动」观感=洪峰字节流过屏幕。

## 修法（用户拍板）：格网解耦，pan 不 resize

键盘占位期行列格网**不动**（tmux/TUI 零感知=零洪峰），可视区变矮用视窗平移补：

- ALT(TUI)：程序化滚到底（`overflow:hidden` 下 scrollTop 可写，禁滚纪律不破），kimi 输入行露在键盘上方；
- 行模式：不抢用户滚动位（顶行锚定最不惊吓），光标被遮由 renderFrame nearest 兜底原样；
- 收键盘：高度涨回→退 IME 态→重测行列=弹前值=no-op——**收也零洪峰**。

## 入态四闸（几何上键盘与地址栏大缩/旧考卷 vv mock 信号同款，靠语义区分）

1. **武装窗口**：召唤键盘**意图** 2s 内（容器 click 主武装 + focus 兜原生路径）。坑记录：武装挂 focus 事件会死——收键盘后诱饵持焦，二次 `focus()`=no-op 不发事件，第二次起召唤永远武装不上（考卷 red-first 实锤）；武装必须挂意图（click）。
2. 宽不变；3. innerH 不变（resizes-content 只缩视觉视口；桌面拖窗两个都变=确定性排除，bottom-anchor ④语义不回退）；4. 跌幅 >20% 且 >150px（真机键盘≈271px、地址栏≈40-90px）。

雷区处置：checkDrift/scheduleResize/RO 三条自愈路全加 IME 闸——自愈不认得「故意不重测」就会把洪峰放回来（ranger runaway 战役纪律的延伸）。

## 模拟键盘基建（用户拍板：键盘=底部占位+输入接口）

- vv 野生散装读取收编 **vvNow 单源**（生产=真 vv、测试=mock），几何链路第一次可后台重放；
- `__kfmNzTermMockIme(open, kbPx=271)`：用真机实测参数重放占位，走与真键盘完全相同的几何链路（自带召唤武装序曲）；输入接口已有 `__kfmNzTermInject`；
- 原则入方法库候选：**模拟验证已知、真机发现未知**——地形探熟的区域模拟全权代理，新地形第一刀真机开道。

## 验收（自验收口径）

- A 档 `nz/tests/browser/ime-pan.test.mjs` **8/8**（red-first 实过：武装 bug 版 ②③④ 红、修复后全绿）——覆盖：真缩窗不进 IME 且行列跟随（bottom-anchor ④语义）/mock 弹键盘扳机命中+卡身缩 271px+行列不动/键盘开着打字纪律/ALT 平移底行露出（st=255）/收键盘行列全程不动/退出 TUI 行列=基线；
- 六卷（10+5+19+6+4+9）+ npm90 + rust9 零回退（bottom-anchor ④b-d vv mock 无聚焦序曲=武装闸判别旁证，全绿）；
- **真机 mock 验收**（experiments/verify-ime-pan-device.mjs，attach dsh 同款场景）：三段字节增量 **16,093 / 11,070 / 17,148**（kimi 心跳 ~2-3KB/s 量级），对照真键盘 423,004 / 308,137 / 712,996 = **数量级根治**；rows 恒 44∈[44,44] 格网未动；ALT 平移 st=257.8 底行露键盘上方。

## 待办/边界

- **前台真键盘终验**（tap→武装→真 vv 事件全链）：合成 tap 原语当前在「页面活但触摸死」态失灵——mark 落账而页面零事件、`visibilityState=visible`/`hasFocus=true`，同代码 21:47 正常工作；疑与多次 CDP attach/relay 的 Input 域挂起史有关（记档：CDP Input 域经 relay 挂起未修）。终验改**用户真手指 + CDP 旁观数据**（页面侧链路 A 档已钉死，待验的只有 ROM 真事件这一段）。合成 tap 失灵之谜单列记账，不挡本次收口。
- 已知降级：键盘弹了但没有召唤意图序曲（理论不存在）=退回旧 resize 行为，非错误。
