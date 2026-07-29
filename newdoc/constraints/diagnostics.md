> 这是什么：Bug 排查流程——症状 → 排查路径。根因不明的异常先翻这里。
> 别的去哪找：各域契约陷阱 → ../domains/；根因案例库（8 例全文）→ detail-cases.md；纪律 → invariants.md。

# 诊断排查流程

> **凡涉及滑动、拖拽、点击不跟手——先确认事件是否完整到达，再查处理逻辑。**

## 触控/手势（PointerEvent / GestureRegistry）

1. **确认事件到达率**：`log()` 推日志卡，观察 `scrollStart` vs `scrollMove` 比例。
   每 gesture 只有 1-2 条 move → `pointercancel` 在截断。
2. **检查 touch-action**：target 及祖先链是否有 `auto/pan-y` 覆盖 → 查 base.css 与内联 style。
3. **检查 GestureRegistry 优先级**：是否有同/更高优先级抢走 `_active`。
4. **检查 targetFilter**：`e.target.closest('.xxx')` 是否匹配到错误元素（透明 overlay、textarea）。

## CSS/视觉

1. **CSS 解析检查**：DevTools 查 `document.styleSheets`——争议规则是否存在于 `cssRules`？
   - 不存在 → **CSS 语法错误**：查最近一条未闭合的 `{`/`(`/`[`
   - 存在但计算样式不匹配 → **优先级**问题
   - 存在且优先级正确 → **选择器不匹配**
2. **工具编辑安全**：`edit` 替换时确认范围最后一行不遗漏 `}`/`;`/`)`。
3. **浏览器二次确认**：`getComputedStyle(el)` 验证计算值，不要只看 Styles 面板。

## 渲染/Canvas

1. **先确认输入数据**：`log()` 推日志卡（console.log 手机不可见）。
2. **检查 Canvas 尺寸**：`clientWidth` 是否为 0？
3. **检查 DPR**：`devicePixelRatio` 是否正确传入 `setTransform`。
4. **检查渲染循环**：`requestAnimationFrame` 是否被取消/替换。

## 构建/Bundle

> 构建由 build.mjs 接管（`npm run build` / `npm run dev` 均先打包再启动）。
> （2026-07-28 迁移时更新：旧文「npm run dev 不打包 + 手动 esbuild 命令」已过时，
> 旧命令的 external/target 与 build.mjs 现状不符。）

1. 改完 `src/client/` → `npm run build`（dev 在跑时重新执行 build 即可）。
2. 浏览器硬刷新清旧 bundle 缓存（`?v=` 指纹正常应自动失效，异常时硬刷）。
3. 验证新代码在 bundle 中：`grep "关键词" public/bundle.js`。

## 第三方库手势冲突

症状：某方向手势在特定区域不工作，其他区域正常。

1. 库的手势处理器是否拦截该区域；`targetFilter` 是否匹配；是否只处理部分方向；
   `stopPropagation` 是否为 true。
2. 解法与案例（xterm-scroll 水平滑丢弃）见 `../domains/floating-card/contract.md` #陷阱 1。

## 根因类型索引（症状 → 排查方向）

| 类型 | 典型场景 | 排查方向 |
|------|---------|---------|
| 事件系统混用 | touch 和 pointer 同时使用 | 所有 addEventListener 的回调类型 |
| 隐式依赖断裂 | 改了一个模块，关联模块失效 | 功能系统关联清单 |
| 初始化路径遗漏 | 新数据模型加载时没初始化 | buildCards / initXxx 调用链 |
| 全局模式误判 | 全屏操作区域被限定为局部 DOM | targetFilter 是否过于精确 |
| 状态机不完整 | 交互只有一条路径 | 状态迁移图是否有未实现方向 |
| CSS 配置冲突 | JS 正确但视觉不对 | touch-action / pointer-events / z-index |
| 环境冲突/资源管理 | 构建超时、端口冲突 | 端口占用 + pkill 残留进程 |
| CSS 语法错误 | 规则在 cssRules 中缺失 | 最近规则是否未闭合 |
| 过程性（诊断失误） | 长时间 debug 无果、反复回退 | 先确认数据到达，再查处理逻辑 |
| Canvas 渲染偏差 | 画面不跟手、跳帧、方向反 | DPR/touch-action/translate 方向/整数边界 |
| 协议假设错误 | 假设下游逐条处理输入缓冲区 | 协议规范 + 实测单条 vs 批量 |

## 流程建议（LEVEL 3）

> 2026-07-28 迁移注：本节两条在 v6.11 心法重构时为解决「良莠不齐」被**主动降级**
> 出心法。尊重原定位——是建议不是命令，不提级、不删。

### 状态在展示前就位

不要让用户看到「变化的过程」；内容准备好后再展示（或用骨架屏）。
AI 倾向「先展示再加载」，体验更好的是「准备好再展示」。

### 写代码前先口述

写代码前先口述「我要做 X，只因为……」——明确做什么、可选方案、选了哪个、为什么。
没有明确目标的「快速产出」往往方向错误。
