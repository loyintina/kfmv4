---
status: active
created_at: 2026-06-29
---

# KFM v4 — 诊断手册

> **遇到 bug 时先翻这里，而不是从头排查。**
>
> 关联文档：
> - `docs/KFM_V4_INVARIANTS.md` — 修改代码前的自查清单（预防性）
> - `docs/PRINCIPLES.md` — 约束全表（一站式查找）
> - `CLAUDE.md` — 项目总入口

---

## 一、隐性契约（破坏会出 Bug）

> 这些约定在代码中没有显式表达，但违反它们会产生难以调试的 bug。
> 修改对应模块前必须检查这些契约是否被破坏。

### 1.1 事件系统：全项目统一使用 PointerEvent

**涉及模块**：`gesture-registry.ts`、`canvas-scroll.ts`、`card-stack.ts`、`tree-render.ts`、`orb.ts`、所有 CSS 文件

**契约内容**：
- 所有触摸/鼠标输入必须走 `gesture-registry.ts` 的 PointerEvent 调度
- 不要在任何模块中直接添加原生 `touchstart/touchmove/touchend` 监听器
- 如果新模块需要手势，通过 `gestures.register()` 注册，不要自行绑定

**违规后果**：touch 和 pointer 两套事件系统在同一 DOM 元素上互相干扰，导致 `pointermove` 被浏览器提前终止，手势响应不完整。

**历史案例**：B.A.R. #001（Touch → PointerEvent 迁移断裂）

### 1.2 touch-action：全屏单页应用必须全局设为 none

**涉及模块**：`public/css/base.css`、所有 `position:fixed` 的覆盖层、所有自定义 Canvas 控件

**契约内容**：
- `body`、`.main`、所有全屏覆盖层必须设 `touch-action: none`
- 任何新添加的 `position:fixed` 元素如果覆盖了触摸区域，必须同步设 `touch-action: none`
- 任何自定义 Canvas 控件（如终端卡、canvas-scroll 区域）必须在 Canvas 元素上显式设 `touch-action: none`
- **不要**使用 `touch-action: pan-y` 或 `auto`——本项目没有浏览器原生滚动，所有滚动由代码实现

**违规后果**：浏览器检测到垂直滑动后接管触摸，停止派发 `pointermove`，导致手势在外部区域或 Canvas 控件上失效。
每手势仅 1-2 帧 move 就被 `pointercancel` 截断，画面几乎不动。

**历史案例**：B.A.R. #001（全局 touch-action）、B.A.R. #007（终端 Canvas 缺失 touch-action）

### 1.3 卡片堆是全局模式，不是局部组件

**涉及模块**：`card-stack.ts`、`gestures.ts`

**契约内容**：
- 卡片堆打开后，整屏都是它的操作区域
- 手势系统中的 `targetFilter: () => true` 不是设计缺陷——它服务于"不分内部/外部"的全局模式需求
- 任何试图"精确"限定卡片堆手势区域的做法都会破坏外部触摸体验

**违规后果**：外部区域的手势被其他模块拦截，卡片堆只能在其 DOM 区域内操作。

**历史案例**：B.A.R. #002（手势区域限定）

### 1.4 点击 BR 光球的切换行为必须双向（togglePanel 模式）

**涉及模块**：`card-stack.ts`（浮卡状态机）

**契约内容**：
- 紧凑态 → 点击 BR → 展开
- 展开态 → 点击 BR → 折叠回紧凑态
- 状态机必须闭环（compact ↔ active），不能单向

**违规后果**：未实现折叠路径时，只能用 dismiss 关闭浮卡，无法回到紧凑态。

**历史案例**：2026-05-24（浮卡折叠缺失）

### 1.5 卡片背景和边框必须正交解耦

**涉及模块**：`card-stack.ts`（双层 DOM 结构）

**契约内容**：
- 边框不能寄生在背景的 `background` 层叠上
- 物理结构：外层壳负责渐变边框（通过 `padding` 挤出），内层独立元素负责毛玻璃
- 任何企图在单个 `background` 属性里用 `padding-box`/`border-box` 分层模拟边框的做法都是补丁

**违规后果**：背景透明度或渐变方向一改，边框就消失。边框和背景耦合越紧，改成随机配色时越容易出"边框看不见"的 bug。

**历史案例**：2026-05-24（边框从背景层叠改为双层 DOM）

### 1.6 浮卡和卡片堆卡片必须共享同一套 DOM 结构

**涉及模块**：`card-stack.ts`（`createCard` 和 `launchFocusedCard`）

**契约内容**：
- 浮卡不是独立的视觉元素——它是"从卡片堆飞出去的卡片"，必须和卡片堆卡片保持样式一致
- 内层毛玻璃必须用 `flow` 布局（由外层壳的 `padding` 自然约束），不能用 `inset:0` 的 absolute 定位
- 修改任何一方的背景/边框/布局时，必须同步另一方

**违规后果**：浮卡出现时和卡片堆风格不统一，或者浮卡的毛玻璃覆盖了边框区。

**历史案例**：2026-05-24（浮卡内层毛玻璃改为 flow 布局）

### 1.7 卡片双色渐变的颜色对应关系有固定规则

**涉及模块**：`card-stack.ts`（`cardGradient`、光球颜色、图标颜色）

**契约内容**：
- 渐变方向：135deg（右上→左下）
- color1（渐变起点）对应：右侧光球（TR、BR）、图标背景
- color2（渐变终点）对应：左侧光球（TL、BL）、图标数字
- 文字颜色统一用白色，不派生自任何卡片色（视觉舒适 > 派生规则）

**违规后果**：光球颜色与接触的边框区域不匹配，或者文字在深色背景上看不清。

**历史案例**：2026-05-24（光球颜色修正 + 文字改为白色）

### 1.8 颜色随机的种子在 `openCardStack` 时生成，不在 `initCardStack` 时

**涉及模块**：`card-stack.ts`（`_generateRandomAccents`）

**契约内容**：
- `_generateRandomAccents()` 在 `openCardStack()` 开头调用，每次召唤都重新随机
- `initCardStack()` 只在页面加载时调用一次，也需预生成一次配色避免 null 崩溃
- 初始化路径上的任何消费者（`createCard`、`buildCards`）必须保证 `_currentAccents` 已赋值

**违规后果**：页面加载时 `_currentAccents` 为 null，`createCard` 崩溃，卡片堆完全无法初始化。

**历史案例**：2026-05-24（`_currentAccents` 初始化时序 bug）

### 1.9 KFMState 通知机制：批量修改必须合并为一次 notify

**涉及模块**：`state.ts`、`tree-render.ts`、任何调用 `setExpanded`/`setActivePath` 的模块

**契约内容**：
- `setExpanded()` 每次调用都触发 `notify()`，而 `_stateSub` 受 `L.isAnimating` 守卫
- 连续调两次 `setExpanded()`，第二次的变更可能在动画守卫中被丢弃 → 状态丢失
- 任何需要批量修改 expanded 状态的代码，必须用 `L.beginOp`/`L.endOp` 包裹，或确保在空闲时执行

**违规后果**：展开/折叠动画执行到一半，部分状态丢失，出现幽灵图标（`tree-toggle` 的旋转状态与实际展开状态不一致）、兄弟元素延迟上移。

**历史案例**：2026-05-29（sidebar-nav 三连 setExpanded 导致 ghost toggle + 动画断裂）

### 1.10 侧栏布局方程：content + tools = 100dvh

**涉及模块**：`sidebar.scss`、`tree-render.ts`、`root-picker.ts`

**契约内容**：
- `.sidebar-content`（文件树 Canvas）和 `.sidebar-tools`（工具栏）两等分侧栏高度
- 等式：`.sidebar-content` 高度 = `calc(100% - 52px)`，`.sidebar-tools` 高度 = 52px
- 任何新侧栏内元素必须用 `position:absolute`/`fixed` 覆盖，不参与流式布局
- 禁止在 `.sidebar` 上设 `display:flex`，禁止改 `.sidebar-content` 的 `calc` 为 `flex:1`

**违规后果**：工具栏错位、文件树 Canvas 尺寸计算错误（`clientWidth` 为 0 或负值）。

**历史案例**：2026-05-29（root-picker 重写时误改 sidebar 布局）

### 1.11 Canvas 尺寸数据源必须随渲染器上下文切换

**涉及模块**：`canvas-cursor.ts`、`canvas-scroll.ts`、任何读取 Canvas 尺寸的代码

**契约内容**：
- 读取当前 Canvas 尺寸时，**必须优先使用当前渲染器的 Canvas**
- 数据源优先级：`L.renderer?.canvas ?? DOM.treeCanvas`
- 硬编码 `DOM.treeCanvas` 意味着代码只在主树上下文中正确

**违规后果**：光标位置偏移/越界、居中行计算错误、光标线宽度错误。

**历史案例**：2026-05-31 B.A.R. #007（6 处 `DOM.treeCanvas` 硬编码修复）

---

## 二、诊断流程

### 2.1 触控/手势 Bug（PointerEvent / GestureRegistry）

> **凡涉及滑动、拖拽、点击不跟手——先确认事件是否完整到达。**

1. **确认事件到达率**：用 `log()` 推到日志卡，观察 `scrollStart` vs `scrollMove` 的比例。如果每 gesture 只有 1-2 条 move → `pointercancel` 在截断
2. **检查 touch-action**：target 元素及其祖先链上是否有 `touch-action: auto/pan-y` 覆盖？→ 检查 `base.css` 和元素内联 style
3. **检查 GestureRegistry 优先级**：查看 `gestures.register()` 调用，是否有同/更高优先级抢走了 `_active`
4. **检查 targetFilter**：`e.target.closest('.xxx')` 是否匹配到了错误的元素（如透明 overlay、textarea）

### 2.2 CSS/视觉 Bug

1. **CSS 解析检查**：在 DevTools 检查 `document.styleSheets`——争议规则是否存在于 `cssRules` 中？
   - 规则不存在 → **CSS 语法错误**：检查最近一条未闭合的 `{`/`(`/`[`
   - 规则存在但计算样式不匹配 → **CSS 优先级**问题
   - 规则存在且优先级正确 → **选择器不匹配**
2. **工具编辑安全**：`edit` 工具替换时，确认替换范围的最后一行不遗漏 `}`/`;`/`)`
3. **浏览器二次确认**：`getComputedStyle(el)` 验证计算值，不要只看 Styles 面板

### 2.3 渲染/Canvas Bug

1. **先确认输入数据正确**：打印关键变量到日志卡（用 `log()`），不要依赖 console.log（手机不可见）
2. **检查 Canvas 尺寸**：`clientWidth` 是否为 0？
3. **检查 DPR**：`window.devicePixelRatio` 是否正确传入 `setTransform`
4. **检查渲染循环**：`requestAnimationFrame` 是否被取消/替换

### 2.4 构建/Bundle Bug

> **`npm run dev` 不打包客户端代码。** 改完 `src/client/` 下任何文件后，必须 `npx esbuild ...` 重新打 `public/bundle.js`。

1. 改源码后 → `npx esbuild src/client/main.ts --bundle --platform=browser --format=iife --outfile=public/bundle.js --target=es2019 --external:katex --external:mermaid --external:xterm`
2. 浏览器硬刷新（`Ctrl+Shift+R`）清除旧 bundle 缓存
3. 验证新代码是否在 bundle 中：`grep "关键词" public/bundle.js`

---

## 三、根因案例库

> 每条案例记录完整的诊断过程。遇到相似症状时，先按"根因类型"和"症状关键词"匹配。

---

### B.A.R. #007 — terminal 滚动 15 轮 debug：方向反 + 截断（过程性教训）

**日期**：2026-06-29
**根因类型**：过程性 — 未先查诊断手册 + 未确认事件到达就改渲染逻辑 + build 管线盲区
**症状关键词**：终端滑动、方向反、截断、pointercancel、touch-action

#### 症状
终端卡 Canvas 内容滑动时，上滑画面下落（方向反），且每手势仅 1-2 帧 move 就截断、松手后跳转一行。
日志卡显示每 gesture 只有 1-2 条 `[TERM] move`，dy 值仅 3-15px。

#### 根因（三重叠）
1. **方向映射**：`deltaPx = startY - rawY` 是自然滚动（上滑→内容下落看历史），但用户要的是上滑→内容上移（finger-tracking）。修复：翻转 delta + 允许过滚 + 松手弹回
2. **touch-action 缺失**：终端 Canvas 元素未显式设 `touch-action: none`，浮卡祖先容器的 `overflow-y: auto` 使浏览器接管触控 → `pointercancel` 秒杀手势 → 每 gesture 仅 1-2 帧 move。修复：Canvas 加 `touch-action: none`
3. **渲染层双机制打架**：逐行 `py - pixelOff` + `visibleStart` 整数跳变在边界处打架。修复：去掉 `baseOff`/`visibleStart`，全 buffer 画成连续长条，`ctx.translate` 整体平移

#### 根本过程教训（比技术细节更重要）

**教训 1：先确认事件是否完整到达，再改处理事件的代码。**
病灶在触控事件层（`touch-action` 缺失 → `pointercancel`），但我一开始就往渲染层追（`pixelOff` 符号、`ctx.translate` 方向、`visibleStart` 跳变）。如果先看日志卡中 `scrollStart` vs `scrollMove` 的比例——每条 gesture 只有 1-2 帧 move——立刻就能定位是事件截断。

**教训 2：`npm run dev` 不打包客户端。**
改完源码后浏览器拿到的是旧 `public/bundle.js`。应该 `npx esbuild` 手动重打。这个盲区让至少一半的测试轮次白跑。

**教训 3：诊断手段要选对。**
`console.log` 手机不可见 → 浪费时间。Canvas 7px 小字不可见 → 浪费第二轮。`log()` 推日志卡 → 拿到真实数据 → 立刻定位。先用对的管道，再分析数据。

---

### B.A.R. #006 — `}` 缺失导致 `.sidebar-nav-label` 全部 CSS 规则被浏览器丢弃

**日期**：2026-05-29
**根因类型**：CSS 语法错误 / 工具编辑遗漏
**症状关键词**：边框看不见、CSS 规则不生效、计算样式为默认值、样式表规则数量异常

#### 症状
`.sidebar-nav-label` 的边框、背景、display:flex、border-radius、flex:1 全部不生效。

#### 根因（一句话）
`edit` 工具替换行范围 165-167 时，`.sidebar-close-btn:hover span{ opacity:1; box-shadow:... }` 的 `}` 在第 168 行（范围外），替换后被丢弃，规则未闭合。
浏览器将此后的所有规则当作 CSS Nesting 嵌套语法处理，全部丢弃。

#### 排查关键发现
1. 服务器提供的 CSS 文件内容正确，`.sidebar-nav-label` 规则完整
2. `document.styleSheets[1].cssRules` 仅 55 条，正常应为 69+ 条
3. 最后一条规则为 `.sidebar-close-btn:hover span { & .sidebar-nav-label:hover { ...`（断裂）
4. `getComputedStyle(.sidebar-nav-label)` 返回全默认值
5. 规则在 54 条之前的部分样式正常（未受断裂影响）

#### 心法/自查关联
- 视觉 bug 先检查 CSS 解析，不要分析颜色/透明度
- `edit` 工具行范围替换：替换 CSS 块末尾必须包含 `}`

---

### B.A.R. #001 — 外部区域卡片堆滑动失效（Touch → PointerEvent 迁移断裂）

**日期**：2026-05-25
**根因类型**：事件系统混用 / 隐式依赖断裂
**症状关键词**：外部区域、卡片堆、滑动切换、不跟手、偶尔跳变

#### 症状
卡片堆打开后，在 `.stack-card` 内部的垂直滑动正常；在外部空白区域只触发 2-3 次 `onMove` 就终止。

#### 根因（一句话）
`gesture-registry` 从 TouchEvent 改为 PointerEvent 时，没有同步迁移 `canvas-scroll.ts` 和 CSS 中的 `touch-action`，
两套事件系统在同一 DOM 上互相干扰，浏览器检测到垂直滑动后接管触摸并停止派发 `pointermove`。

#### 排查关键发现
1. 内部滑动：dy 累积到 40+，触发 20+ 次 onMove
2. 外部滑动：dy 最多 11，只有 2-3 次 onMove，且没有 `_handleEnd` 被调用
3. 排查链路：gestures-page-swipe → canvas-scroll import → sidebarTouchArea → `.main` 的 `touch-action: pan-y`

#### 解决方案
三步迁移（`6294a0d` + `a177b74` + `cca2098`）：
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
`gestures-page-swipe` 的 `targetFilter` 排除了 `.stack-card` 外部区域，但卡片堆打开后整屏都应当是它的操作区域。

#### 解决方案
在 `gestures.ts` 中给 `gestures-page-swipe` 增加 `condition: () => !isCardStackOpen()`，卡片堆打开时否决自身，让 `card-stack-global`（priority 80）全权接管。

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
重构后 `_currentAccents` 的默认值为 null，但 `initCardStack()` → `buildCards()` → `createCard(i)` 在 `_generateRandomAccents()` 之前执行。

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

---

### B.A.R. #005 — 端口冲突 + `tsc` 僵尸进程耗尽服务器资源

**日期**：2026-05-28
**根因类型**：环境冲突 / 资源管理
**症状关键词**：服务器卡死、构建超时、API 返回 HTML 而不是 JSON、CPU/内存 99%

#### 症状
`npm run build` 超时 60s，服务器 CPU 和内存占用 99%，API 请求返回 HTML 页面而非 JSON。

#### 根因（一句话）
一个误启动的 `npx serve public -l 8021` 进程抢占 8021 端口且不受 `kill -9` 影响，导致 Express 服务无法绑定正确端口。同时多次超时的 `tsc --noEmit` 进程在后台堆积，累积消耗全部 CPU 和内存。

#### 排查关键发现
1. `ss -tlnp` 显示 8021 端口有非 Express 进程占用
2. `ps aux | grep serve` 发现 `npx serve public` 进程
3. `pkill -f tsc` 后发现多个残留 tsc 进程
4. `kill -9` 对 serve 进程无效（需 `fuser -k` 或等其自然退出）

#### 解决方案
1. 清除残留 serve 进程（`fuser -k 8021/tcp`）
2. 在 `package.json` start 脚本中加入 `fuser -k 8021/tcp` 前置清理
3. 在 `build.mjs` 开头加入 `pkill -f "tsc"` 清理残留 tsc

---

## 附录 A：根因类型索引

| 类型 | 典型场景 | 排查方向 |
|------|---------|---------|
| 事件系统混用 | touch 和 pointer 同时使用 | 检查所有 addEventListener 的回调类型 |
| 隐式依赖断裂 | 改了一个模块，另一个关联模块失效 | 检查功能系统关联清单 |
| 初始化路径遗漏 | 新数据模型在加载时没初始化 | 检查 buildCards / initXxx 调用链 |
| 全局模式误判 | 把全屏操作区域限定为局部 DOM | 检查 targetFilter 是否过于精确 |
| 状态机不完整 | 交互只有一条路径 | 检查状态迁移图中是否有未实现的方向 |
| CSS 配置冲突 | JS 逻辑正确但视觉效果不对 | 检查 touch-action / pointer-events / z-index |
| 环境冲突/资源管理 | 构建超时、端口冲突 | 检查端口占用 + pkill 残留进程 |
| CSS 语法错误 | 规则在 `styleSheets.cssRules` 中缺失 | 检查最近规则是否未闭合 |
| 过程性（诊断失误） | 长时间 debug 无果、反复回退 | 先确认数据到达，再查处理逻辑；先选对管道，再看数据 |
| Canvas 渲染偏差 | 画面不跟手、跳帧、方向反 | 检查 DPR/touch-action/translate 方向/整数边界 |

---

## 附录 B：回归测试

### 自动化测试

```bash
npm test   # 159 个测试，覆盖 23 个模块
```

### 手动回归检查清单

仍需要手动验证的交互（无法通过 CLI 自动化）：

| # | 操作 | 预期结果 |
|---|------|----------|
| 1 | 打开页面 | 主页面正常，光球可见 |
| 2 | 右滑 / 三横线 | 左栏打开，文件树完整 |
| 3 | 左栏上下滑动 | 列表正常滚动 |
| 4 | 点击目录 | 展开/折叠动画正常，字符雨可见 |
| 5 | 快速连点同目录 | 展开/折叠正确切换，无闪烁 |
| 6 | 左栏左滑 | 左栏关闭 |
| 7 | 侧栏关闭时左滑 | 召唤卡堆 |
| 8 | 卡堆右滑 | 关闭卡堆 |
| 9 | 卡堆上下滑 | 切换卡片，焦点保持 |
| 10 | 点击光球 | AI 面板打开 |
| 11 | 多层嵌套文件夹展开 | 子容器串行展开，字符雨正常 |
| 12 | 展开后立即折叠 | 折叠动画流畅，文字自然被裁 |
| 13 | 紧凑态浮卡点击 BR 光球展开 | 三颗角光球从 BR 位置滑入，与卡片动画同步 |
| 14 | 展开态浮卡点击 BR 光球折叠 | 三颗角光球滑回 BR 位置，卡片同步收缩 |
| 15 | 展开态浮卡点击 TR 光球关闭 | 所有光球 + 卡片同步向 TR 圆心收缩消失 |
| 16 | 快速点击展开态 TR 光球 | 展开动画期间误触不触发关闭（状态守卫） |
| 17 | 展开后观察 BR 光球 SVG 图标 | 图标已切换为十字+圈，折叠时同步清除 |
| 18 | 终端卡输入命令后滑动 | 内容跟手平移，日志卡显示连续 move 事件 |
