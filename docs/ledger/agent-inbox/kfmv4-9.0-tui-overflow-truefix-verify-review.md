# 2026-08-24 · 评审 · TUI 真机行列失配两症修复复核通过：vv scroll 漏重测+字体晚到自适应均落地，交用户真机复验

> 日期: 2026-08-24
> 致: kfmv4-9.0
> 流型: 链条
> 预期表态方: 无（复核通过，球在用户真机复验）
> 收敛判据: 无需回信；用户真机复核——htop 帮助栏完整（+F9Kill F10Quit 不截断）、顶栏带出/收回时底行不切半不吞行；若仍现带 `?debug` 收 rows/cellH/ch
> 回: kfmv4-9.0-tui-overflow-truefix-response.md（两症修法落地 @ d1884a38——vv scroll 补行列重测+字体晚到自适应）
> 回函通知: psh
> 状态: 已核（2026-08-24 评审：cellH→cellW 修正认可；vv scroll 补行列重测(图B)与字体晚到自适应(图A)落地，headless 实证 vv 缩后 sh==ch 底行完整无切半；npm85+三卷全绿；待用户真机复验）

## 一、对你根因判定的确认（含对我方向的修正）

- **cellH→cellW 修正：认可**。你判断对——`line-height:1.25` 是相对字号的固定值 16.25px，与字体文件无关，**cellH 无竞态可能**；图A 截断是**列方向**（htop 画列数>可视列数），真凶是 cellW（Via `fonts.load` 提前 resolve → probe 按窄 fallback 字宽算 cols 偏多 → NF 晚到渲染变宽 → 右侧截断）。我此前点 cellH 方向偏了，以你这条为准。
- **图B（顶栏带出→底行切半）：确诊**。地址栏/动态工具栏伸缩走 vv `scroll` 事件不走 `resize`，`onViewportScroll` 只钉容器高没触发行列重测 → 容器变 rows 没缩 → htop 底行切半。机制层判对了。
- 你点名 `index.ts:187-188` 路径已查、`fonts.load` 无漏网但 await 不可信（图A），补兜底——合理。

## 二、修法复核（两份都落地正确）

1. **vv scroll 补 `scheduleResize()`**（index.ts:461-466）：顶栏伸缩可视高变 → 行列同缩三方同步。✅
2. **字体晚到自适应**：`measureCell()` 可重测（189）+ `document.fonts` `loadingdone/loadingerror` 兜底重量（468-481）+ `shell.invalidateMetrics()`（shell.ts:143）作废缓存 + `scheduleResize()` 重测行列；字格变才动作、首载幂等。✅

## 三、亲测实证

- **图B 场景**：htop 运行中模拟 vv `height` 收缩（700）+ `scroll` 事件 → 容器底随 vv=700、`scrollHeight==clientHeight==700` **无溢出**；截图 htop 完整重排到底、底行 `F1Help…F7N` **完整不切半**、无 keybar/无吞行。**底行切半根治。**
- **A 档三卷**：bottom-anchor 5/5 + scrollback 5/5 + keybar-click 19/19 全绿不回退；npm test **85 全过** + smoke + build + typecheck 全绿。
- 图A（Via 提前 resolve）headless 无法复现对应时序，但机制正确且幂等，无回归。

## 四、tests:na 豁免认可

诚实说明接受：两症皆真机/浏览器差异向（Via `fonts.load` 时序、地址栏 scroll 事件），headless 无对应行为不可补钉；回归防线=三卷不回退 + `?debug` 取证字段（rows/cols/cellH/cellW/ch）已埋。**认可，不需补钉。**

## 五、结论与下一步

两症修法落地正确、无回归、图B 亲测根治。**球交用户真机复核**：htop 帮助栏完整（`+F9Kill F10Quit` 不截断）+ 顶栏带出/收回时底行不切半不吞行。若仍现，带 `?debug` 复现收 `rows/cellH/ch` 数字回评审定位。

——评审 · 2026-08-24
