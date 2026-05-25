# KFM v4 Bug Audit Registry (B.A.R.)

> **诊断手册**。遇到 bug 时先翻阅这里，而不是从头排查。
> 第一章 记录已知的隐性契约（破坏它们就会出问题），第二章 记录根因案例和排查路径。
>
> **关联文档**：
> - `KFM_V4_INVARIANTS.md` — 修改代码前的自查清单（预防性）
> - `CLAUDE.md` — 项目总入口

---

## 第一章：隐性契约

> 这些约定在代码中没有显式表达，但违反它们会产生难以调试的 bug。
> 修改对应模块前必须检查这些契约是否被破坏。

### 1.1 事件系统：全项目统一使用 PointerEvent

**涉及模块**：`gesture-registry.ts`、`canvas-scroll.ts`、`card-stack.ts`、`tree-render.ts`、`orb.ts`、所有 CSS 文件

**契约内容**：
- 所有触摸/鼠标输入必须走 `gesture-registry.ts` 的 PointerEvent 调度
- 不要在任何模块中直接添加原生 `touchstart/touchmove/touchend` 监听器
- 如果新模块需要手势，通过 `gestures.register()` 注册，不要自行绑定

**违规后果**：touch 和 pointer 两套事件系统在同一 DOM 元素上互相干扰，导致 `pointermove` 被浏览器提前终止，手势响应不完整。

**历史案例**：2026-05-25 B.A.R. #001

### 1.2 touch-action：全屏单页应用必须全局设为 none

**涉及模块**：`public/css/base.css`、所有 `position:fixed` 的覆盖层

**契约内容**：
- `body`、`.main`、所有全屏覆盖层必须设 `touch-action: none`
- 任何新添加的 `position:fixed` 元素如果覆盖了触摸区域，必须同步设 `touch-action: none`
- **不要**使用 `touch-action: pan-y` 或 `auto`——本项目没有浏览器原生滚动，所有滚动由代码实现

**违规后果**：浏览器检测到垂直滑动后接管触摸，停止派发 `pointermove`，导致手势在外部区域失效。

**历史案例**：2026-05-25 B.A.R. #001

### 1.3 卡片堆是全局模式，不是局部组件

**涉及模块**：`card-stack.ts`、`gestures.ts`

**契约内容**：
- 卡片堆打开后，整屏都是它的操作区域
- 手势系统中的 `targetFilter: () => true` 不是设计缺陷——它服务于"不分内部/外部"的全局模式需求
- 任何试图"精确"限定卡片堆手势区域的做法都会破坏外部触摸体验

**违规后果**：外部区域的手势被其他模块拦截，卡片堆只能在其 DOM 区域内操作。

**历史案例**：2026-05-25 B.A.R. #002（手势区域限定）

### 1.4 点击 BR 光球的切换行为必须双向（togglePanel 模式）

**涉及模块**：`card-stack.ts`（浮卡状态机）

**契约内容**：
- 紧凑态 → 点击 BR → 展开
- 展开态 → 点击 BR → 折叠回紧凑态
- 状态机必须闭环（compact ↔ active），不能单向

**违规后果**：未实现折叠路径时，只能用 dismiss 关闭浮卡，无法回到紧凑态。

**历史案例**：2026-05-24（浮卡折叠缺失）

---

## 第二章：根因案例库

> 每条案例记录一次完整的 bug 诊断过程。
> 遇到相似症状时，先按"根因类型"和"症状关键词"匹配。

---

### B.A.R. #001 — 外部区域卡片堆滑动失效（Touch → PointerEvent 迁移断裂）

**日期**：2026-05-25  
**根因类型**：事件系统混用 / 隐式依赖断裂  
**症状关键词**：外部区域、卡片堆、滑动切换、不跟手、偶尔跳变

#### 症状
卡片堆打开后，在 `.stack-card` 内部的垂直滑动能正常切换聚焦卡片；
在外部空白区域的垂直滑动只触发 2-3 次 `onMove` 就终止，焦点不切换。

#### 根因（一句话）
`gesture-registry` 从 TouchEvent 改为 PointerEvent 时，没有同步迁移 `canvas-scroll.ts` 和 CSS 中的 `touch-action`，
两套事件系统在同一 DOM 上互相干扰，浏览器检测到垂直滑动后接管触摸并停止派发 `pointermove`。

#### 排查关键发现
1. 内部滑动：dy 累积到 40+，触发 20+ 次 onMove
2. 外部滑动：dy 最多 11，只有 2-3 次 onMove，且没有 `_handleEnd` 被调用
3. 没有 `_handleEnd`、没有 `condition false`、没有新的 `pointerdown`——_active 被浏览器级截断
4. 排查链路：gestures-page-swipe → canvas-scroll import → sidebarTouchArea → `.main` 的 `touch-action: pan-y`

#### 解决方案
三步迁移（全部在同一 commit 中完成，见 `6294a0d` + `a177b74` + `cca2098`）：
1. `canvas-scroll.ts`：`touchstart/touchmove/touchend` → `pointerdown/pointermove/pointerup`
2. `tree-render.ts`：sidebarTouchArea 的滑动关闭改用 PointerEvent
3. `card-stack.ts`：brOrb 拖拽改用 PointerEvent
4. CSS：`.main` 的 `touch-action: pan-y` → `none`
5. 全局：`gesture-registry.init()` 中设 `document.body.style.touchAction = 'none'`

#### 心法/自查关联
- 第〇章第 6 条（先理解整体，再拆解局部）：跳过这一步就没有同步迁移其他模块
- 自查清单"功能系统关联检查"：改动事件系统时，项目里还有谁在消费触摸事件？

---

### B.A.R. #002 — 手势区域限定导致卡片堆外部滑动失效

**日期**：2026-05-25  
**根因类型**：全局模式误判为局部组件  
**症状关键词**：外部区域、卡片堆、手势注册、targetFilter

#### 症状
卡片堆打开后，外部区域无法通过左滑召唤浮卡、垂直滑动切换焦点。

#### 根因（一句话）
`gestures-page-swipe` 的 `targetFilter` 排除了 `.stack-card` 外部区域，
但卡片堆打开后整屏都应当是它的操作区域。

#### 解决方案
在 `gestures.ts` 中给 `gestures-page-swipe` 增加 `condition: () => !isCardStackOpen()`，
卡片堆打开时否决自身，让 `card-stack-global`（priority 80）全权接管。

#### 心法/自查关联
- 第〇章第 6 条（先理解整体，再拆解局部）：`targetFilter: () => true` 不是粗心
- 隐性契约 1.3（卡片堆是全局模式）

---

### B.A.R. #003 — _currentAccents 初始化时序导致卡片堆崩溃

**日期**：2026-05-24  
**根因类型**：初始化路径遗漏  
**症状关键词**：卡片堆、无法召唤、buildCards 失败、_currentAccents 为 null

#### 症状
页面加载后立即召唤卡片堆，buildCards 抛出 `Cannot read properties of null (reading '0')`。

#### 根因（一句话）
重构后 `_currentAccents` 的默认值为 ``，但 `initCardStack()` → `buildCards()` → `createCard(i)` 在 `_generateRandomAccents()` 之前执行。

#### 解决方案
在 `initCardStack()` 开头加 `_generateRandomAccents()`，确保构建卡片前配色已就位。

#### 心法/自查关联
- 自查清单"初始化路径检查"：这个改动直接催生了这条检查项

---

### B.A.R. #004 — 浮卡折叠缺失（BR 光球只能展开不能折叠）

**日期**：2026-05-24  
**根因类型**：状态机不完整  
**症状关键词**：浮卡、BR 光球、展开后无法缩回

#### 症状
从紧凑态点击 BR 光球展开后，BR 光球的点击不再做任何事情。

#### 根因（一句话）
BR 光球的 click 事件只写了 `compact → expanding` 方向，没有写 `active → compact` 的折叠路径。

#### 解决方案
在 BR 光球的 click 事件中增加 `else if (item.state === 'active')` 分支，实现反向动画（缩回紧凑态并移除 TL/TR/BL 光球）。

#### 心法/自查关联
- 隐性契约 1.4（BR 光球应双向切换）

---

## 附录：根因类型索引

| 类型 | 典型场景 | 排查方向 |
|------|---------|---------|
| 事件系统混用 | touch 和 pointer 同时使用 | 检查所有 addEventListener 的回调类型 |
| 隐式依赖断裂 | 改了一个模块，另一个关联模块失效 | 检查功能系统关联清单 |
| 初始化路径遗漏 | 新数据模型在加载时没初始化 | 检查 buildCards / initXxx 调用链 |
| 全局模式误判 | 把全屏操作区域限定为局部 DOM | 检查 targetFilter 是否过于精确 |
| 状态机不完整 | 交互只有一条路径 | 检查状态迁移图中是否有未实现的方向 |
| CSS 配置冲突 | JS 逻辑正确但视觉效果不对 | 检查 touch-action / pointer-events / z-index |
