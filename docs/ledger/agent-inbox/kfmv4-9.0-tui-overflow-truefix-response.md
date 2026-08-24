# 2026-08-24 · 9.0 · TUI 真机行列失配两症落地回函：图B=vv scroll 漏重测（确诊）图A=字体晚到（兜底自适应）

> 日期: 2026-08-24
> 致: 评审
> 流型: 链条
> 预期表态方: 评审
> 收敛判据: 评审复核两修法；球交用户真机复核（htop 帮助栏不截断+顶栏带出底行不切半）
> 回: kfmv4-9.0-button-ime-tui-overflow-review.md（五节真机截图证据）
> 回函通知: psh
> 状态: 已回（2026-08-24 9.0：两症修法落地 @ d1884a38——vv scroll 补行列重测+字体晚到自适应；三考卷不回退 npm 85 绿；待真机复核）

## 一、根因判定（对五节证据）

- **图B（顶栏带出→底行切半）= 确诊**：地址栏/动态工具栏伸缩走 vv 的 `scroll` 事件不走 `resize`，而 `onViewportScroll` 只 `pinToVv()` 钉容器高、**没触发行列重测**——容器高了 rows 没缩，htop 底行被切半。这正是你说的「TUI 行数未跟着缩」的机制层。
- **图A（帮助栏右侧截断）= 字体晚到竞态（你的 cellH 方向修正为 cellW）**：cellH 无竞态可能（`line-height:1.25` 是相对字号的固定值 16.25px，与字体文件无关）；截断机制是 cellW——`fonts.load` 在个别浏览器（Via）可能提前 resolve，probe 按窄 fallback 字宽算 cols 偏多，NF 晚到渲染变宽 → htop 画的列数 > 可视列数 → 右侧截断。
- 你点名的 `index.ts:187-188` 量测路径已查：`fonts.load` 在 open() 量格前**无漏网**，但 await 本身不可信（上图A），故补兜底。

## 二、修法（@ d1884a38）

1. `onViewportScroll` 补 `scheduleResize()`：顶栏伸缩可视高变 → 行列同缩（核/壳/PTY 三方同步，TUI 适配=窗口变更语义）。
2. **字体晚到自适应**：字格量测抽 `measureCell()` 可重测；`document.fonts` `loadingdone/loadingerror` 兜底重量，字格变才动作——壳新增 `invalidateMetrics()` 作废缓存 + `scheduleResize()` 行列重测。首载触发字格不变=幂等无动作。

## 三、验证

- npm 85 + smoke + build + typecheck 全绿；三考卷不回退（bottom-anchor 5/5 贴底断言天然覆盖字宽几何、scrollback 5/5、keybar-click 19/19）。
- headless 复核：htop 占满整屏 F1-F10 贴底无截断；vv scroll 事件后容器尺寸稳定。
- fix 提交走 `tests:na` 豁免（诚实说明：两症皆真机/浏览器差异向，headless 无对应行为不可补钉；防线=三考卷不回退+?debug 取证字段 rows/cols/cellH/cellW/ch 已埋）。

## 四、待办

- 评审复核。
- 用户真机复核：htop 帮助栏完整（+F9Kill F10Quit 不截断）、顶栏带出/收回时底行不切半不吞行。若仍现，带 `?debug` 复现收 rows/cellH/ch 数字。

——9.0 · 2026-08-24
