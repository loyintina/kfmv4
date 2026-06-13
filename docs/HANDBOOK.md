# KFM v4 工作手册 (SOP)

> **日常开发参考**。改代码前先读 `KFM_V4_INVARIANTS.md`（修改约束协议），
> 规划设计时参考 `docs/design/VISION_AND_ROADMAP.md`（远景文档）。
> 做浮卡统一化时参考 `CARD_SYSTEM_UNIFICATION_SPEC.md`（浮卡系统统一化规范）。
> 本手册整合了架构速查、调试流程、隐性契约、当前状态、待办和测试指南。

---

## 一、架构速查

### 注册中心

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `gesture-registry.ts` | document 级触摸事件统一调度 |
| `RendererLifecycle` (L) | `renderer-lifecycle.ts` | 渲染器生命周期 + 状态机 |
| `DOM` | `dom-refs.ts` | 全局 DOM 元素引用 |
| `Registry` | `ui-registry.ts` | UI 元素注册表（黄页模式） |
| `KFMState` | `state.ts` | 全局状态层（发布-订阅） |

### 手势优先级

```
picker-lock(110) > orb(100) > floating-orb(100) > card-stack-global(80)
> sidebar-scroll(60) > page-swipe(50)
```

### 动画状态机

| 模块 | 状态机 |
|------|--------|
| tree-render | `idle ⇄ animating` (L.beginOp/endOp) |
| card-stack | `closed ⇄ opening ⇄ open ⇄ closing` |
| floating-card | `compact → expanding → active ⇄ editing` |
| orb (main) | `collapsed ⇄ expanding/collapsing ⇄ expanded ⇄ editing` |

### 依赖方向

```
renderer-lifecycle (L) → canvas-utils → canvas-cursor → canvas-scroll → tree-render
```

`canvas-*` 模块不导入任何 `tree-*` 模块。`(as any)` **零逃逸**（`check-as-any.mjs` 扫描）。

### 关键调用链

```
main.ts → gestures.init() → initApp() → initUI() → initGestures() → initOrb()
        → initTreeRenderer() → loadFileTree() → initLazyLoader() → initCardStack()
```

### 模块职能分组（全 29 个模块）

> 完整清单及依赖关系见 §七「客户端模块完整审计表」。此处按职能分组，方便快速定位。

| 分组 | 模块 | 核心职责 |
|------|------|---------|
| **骨架** | `app.ts` `ui.ts` `dom-refs.ts` `state.ts` `renderer-lifecycle.ts` | 初始化编排、全局状态、渲染器单例 L |
| **注册中心** | `ui-registry.ts` `gesture-registry.ts` `animation-registry.ts` | UI 元素、手势、动画的注册/调度 |
| **文件树渲染** | `tree-render.ts` `tree-overlay.ts` `tree-swipe.ts` `tree-model.ts` `tree-loader.ts` `canvas-cursor.ts` `canvas-scroll.ts` `canvas-utils.ts` `root-picker.ts` | Canvas 文件树的构建、交互、加载 |
| **文件树样式** | `style-registry.ts` `theme.ts` | 文件树尺寸/颜色/字体的唯一来源（改一处全局同步） |
| **视觉效果** | `char-rain.ts` | 字符散落/回收动画（展开折叠时） |
| **交互共享** | `interaction-constants.ts` `drag-handler.ts` `click-queue.ts` | 模块间共享的常量/类型/事件队列 |
| `drag-handler.ts` | 999 | 2 | ✅ 分组表 | 共享拖动状态机（orb + floating-card 去重） |
| **卡片系统** | `card-stack.ts` `floating-card.ts` | 卡片堆面板、浮卡发射/拖拽/缩放 |
| **AI / 通信** | `orb.ts` `ws-channel.ts` `debug-assert.ts` `gestures.ts` | 光球面板、WebSocket、运行时断言、页面手势 |
| **日志** | `logger.ts` | KFM 日志系统（debug-card 伴侣） |

### 服务端模块（5 个）

服务端是 Express 4 + WebSocket 服务，通过 `index.ts` 统一入口编排，架构流向如下：

```
index.ts (入口路由)
  ├── ai-tools.ts         — 从浏览器拉取 Registry snapshot（供 AI agent 查询页面状态）
  ├── capability-executor.ts  — 将 Registry 注册的能力映射为可执行函数（AI 工具调用端点）
  ├── path-utils.ts       — 安全路径守卫（所有用户路径逃逸校验，安全关键模块）
  └── ws-server.ts        — WebSocket 通信通道（服务端↔浏览器双向实时通信）
```

| 模块 | 核心职责 |
|------|---------|
| `index.ts` | Express 入口 + HTTP 路由注册 + 静态文件服务 |
| `ai-tools.ts` | 包装 Registry snapshot 为服务端 API 端点（GET/POST） |
| `capability-executor.ts` | 维护能力名→执行函数映射，被 AI 命令调用 |
| `path-utils.ts` | `SAFE_ROOT` + `sanitizePath()`，路径逃逸守卫 |
| `ws-server.ts` | WebSocket 连接管理，接收推送的 snapshot |

> 每个文件头部注释已有完整职责说明，此处仅列出架构概览。服务端不涉及复杂状态机，接手者读各自文件即可。

### 关键客户端模块

#### theme.ts — 主题系统（颜色唯一来源）

`theme.ts` 是项目所有视觉颜色的**唯一定义点**。导出 `currentTheme: ThemeConfig` 对象，
包含光球色、卡片色、文件树行色、选中态、光标色等全部色值。

- **出口**：`currentTheme`（单例对象，运行时不可变）
- **消费者**：`tree-render.ts`（文件树渲染）、`card-stack.ts`（卡片堆）、`orb.ts`（光球）、`floating-card.ts`（浮卡）、`root-picker.ts`（选择器）、`style-registry.ts`（样式）、`canvas-cursor.ts`（光标）
- **规则**：新增颜色只能在这里加，禁止在消费方硬编码色值。改一个色值全项目同步。

#### style-registry.ts — 文件树样式（尺寸/字体/间距唯一来源）

`style-registry.ts` 是文件树所有**尺寸相关的常量**唯一定义点。导出 `DIMENSIONS`（行高、边距、缩进等）、`TEXT_STYLES`（目录/文件/注释的字体和颜色）、`getRowLayout()`（按深度计算 x 偏移和宽度）、`createBox()`（按模板名创建 Box）。

- **出口**：`DIMENSIONS`、`TEXT_STYLES`、`LINE_HEIGHT`、`MAX_LINES`、`FONT`、`getFileColor()`、`getShift()`、`getRowLayout()`、`createBox()`、`templates`、`styleRegistry`
- **消费者**：`tree-render.ts`、`tree-model.ts`、`canvas-cursor.ts`、`canvas-scroll.ts`、`char-rain.ts`
- **规则**：文件树的行高、缩进、字体大小只能在这里改。新增文件类型颜色走 `getFileColor()`。

#### floating-card.ts — 浮卡系统

`floating-card.ts` 管理浮卡发射、拖拽、缩放和编辑模式。浮卡从卡片堆的日志卡（02 日志卡）发射，
经过 compact → expanding → active → editing 四态状态机。拖拽完全通过 GestureRegistry 统一调度。

- **出口**：`initFloatingCards()`、`launchFocusedCard()`、`dismissFloatingCard()`、`hasFloatingCard()`
- **状态机**：`compact(120×36, 仅 BR 光球) → expanding(GSAP tween) → active(155×68, 四角光球) ⇄ editing(长按 BR 光球 600ms → 右下角缩放手柄)`
- **消费者**：`card-stack.ts`（发射入口）、`main.ts`（初始化）
- **共享常量**：导入自 `interaction-constants.ts`（`MARGIN`、`LONG_PRESS_MS`、`DRAG_THRESHOLD`）
- **规则**：与 `orb.ts` 是独立模块，各管各的。统一化方案已放弃。新增交互模式走 gesture-registry，禁止直接 addEventListener。

#### root-picker.ts — 文件树根目录切换器

`root-picker.ts` 实现侧栏文件树根目录切器。通过 `L.pushContext()` 复用完整的 Canvas 交互系统（RenderContext 上下文栈），
不创建独立的手势/渲染管线。

- **出口**：`createRootPicker()`、`destroyRootPicker()`、`isPickerOpen()`、`pickerHandleClick()`
- **生命周期**：`createRootPicker()` → `L.pushContext({ renderer, rowIndex: [], ... })` → 构建目录列表 Box 树 → 用户选择 → `L.popContext()` 恢复主树
- **消费者**：`tree-render.ts`、`canvas-scroll.ts`、`main.ts`
- **规则**：选择器锁 (priority 110) 在手势优先级最高，打开后外部滑动手势全部被拦截。关闭时必须调 `L.popContext()` 恢复上下文。

## 二、当前会话状态

> **最后更新**：2026-06-09（v6.6.1 — Box 位置映射 + 引擎架构文档 + 死代码清理）

### 当前焦点
**卡片工作台**（见 `docs/design/WORKBENCH_SPEC.md`）

v6.6.0 之前的焦点「浮卡系统统一化」已两次尝试均回退放弃（详见 `docs/archive/design/CARD_SYSTEM_UNIFICATION_SPEC.md`）。当前方向改为「三层共享层」——常量层 + 类型层 + 能力声明层，可在不碰逻辑的前提下逐步统一。

- **v6.6.0 已完成**：
  - 交互共享层建立（`interaction-constants.ts` + `drag-handler.ts`）✅
  - overlay 残留 bug 根解（`rebuildTree` 入口加防御性清理）✅
  - Box 位置映射设计文档（`docs/archive/design/BOX_LOCATION_MAP_SPEC.md`）✅
  - 卡片工作台设计文档（`docs/design/WORKBENCH_SPEC.md`）✅
- **v6.6.1 已完成**：
  - Box 位置映射实施（`click-path` 命令 + `_boxLocationMap`）✅
  - 引擎层架构文档（`docs/archive/design/ENGINE_ARCHITECTURE.md`）✅
  - 死代码清理（~300 行：两套拖拽系统、`*Capability`、`anim.play/kill` API、遗留函数）✅
  - `notifyStateChange` 散布分类审计（35 处，26/35 必要，9 冗余）✅

> **v6.3.x 历史成就**：三轮深度审计 + CI 基线固化 + `(as any)` 零逃逸 + 能�����������层解耦 + 文档质量自动化。详见 `archive/handoffs/v6.3.1` 交接记录。

> **v6.2.0 历史成就**：AI 操作命令体系（expand-dir/collapse-dir/select-file）+ 用户与 AI 对称操作 + Registry 内容层增强 + Box 引擎完善。详见 `archive/handoffs/v6.2.0` 交接记录。

### 已知陷阱
1. **CSS 布局方程**：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex
2. **`buildTree` 数据源**：`buildTree` 内部读 `KFMState.files`，修改后必须恢复
3. **`setExpanded` 多次 notify**：连续调用会触发多次 notify，动画守卫丢弃中间状态
4. **拖拽 VS 重构搬运**（心法 9）：搬运代码必须 `git show` 原样复制后改，禁止重写
5. **Registry MANIFEST**：新增交互元素必须同时注册 + 加入 MANIFEST
5b. **Registry state getter**：如果元素的 state 会在运行时变化（几乎所有交互元素都如此），注册后必须同时调 `registerStateGetter()`，否则 `snapshot()` 返回的是过时的静态 state。**推荐使用 `registerElement()` 便捷方法**——它一次完成 register + registerStateGetter，避免遗漏配对。
6. **`notifyStateChange` 覆盖范围**：`Registry.notifyStateChange()` 只通知"状态发生了变化"，不传递状态值本身。snapshot 仍通过 `registerStateGetter` 读取实时状态。新增模块的状态变化如果漏调 `notifyStateChange()`，AI 看到的 snapshot 会滞后。**注意**：`check-registry.mjs` 现在会检查 `register()` 调用的必需字段完整性，但 notifyStateChange 的覆盖仍需人工保证。
7. **Canvas 初始化 `clientWidth=0`**：需在 rAF 回调里 `rebuildTree()`
8. **事件冒泡**：侧栏触摸区事件冒泡到 document → GestureRegistry 误触发
9. **动画锁超时**：`processClickQueue` 有 3000ms 超时释放，说明动画管理有设计缺陷
10. **esbuild `nullish-coalescing` 禁用**：但源码大量使用 `??`，TS 6 编译时需确保正确降级
11. **测试 mock 脆弱**：GSAP mock 中 `tl.call(cb)` 同步执行回调，改变了动画时序

---

## 三、当前待办
12. **Canvas 元素的 AI click 无坐标**：~~v6.3 部分缓解。v6.6.0 进入设计阶段。~~ ✅ **已根解（v6.6.1）**：Box 位置映射实施完成。AI 可通过 `click-path` 命令直接按路径操作 Canvas 文件行，不再依赖合成坐标。`expand-dir`/`collapse-dir`/`select-file` 保持保留。详见 `docs/archive/design/BOX_LOCATION_MAP_SPEC.md`。<a id='trap-12'></a>
13. **`registerContent()` 与生成器关系**：同一 id 下生成器优先，`registerContent()` 不会覆盖已注册的生成器。如需强制更新静态内容，先调 `registerContentGenerator(id, null)` 注销生成器。<a id='trap-13'></a>
15. **文件树 overlay 残留导致滚动分裂**：~~已根解（v6.6.0）~~：在 `rebuildTree` 入口加防御性清理 `_removeAllOverlays()` + `renderer.setOverlayRoot(null)`，确保无论从哪条路径触发，旧 overlay 都不会残留。~~原描述：开启显示隐藏文件后，展开空文件夹再折叠，滑动文件树时 overlay 遗留的半截树不跟随滚动。~~<a id='trap-15'></a>

14. **`notifyStateChange()` 散布**：散布在 6 个文件的 35 处调用（v6.6.1 审计）。三级分类：

| 类别 | 数量 | 说明 |
|------|------|------|
| **A: 必要（模块局部变量）** | 17 | orb.ts 8 处（`orbState`/`panelState`）、card-stack.ts 9 处（`_state`）|
| **B: 必要（Canvas/GSAP 回调）** | 6 | tree-render.ts：动画 onComplete、光标移动、rebuildTree 自身 |
| **C: 必要（纯 DOM 操作）** | 3 | app.ts 2 处 operation-toast、ws-channel.ts 1 处 operation-toast |
| **D: 冗余（已删除）** | ~~9~~ 0 | ✅ v6.6.1 已全部移除：tree-render.ts 5 处（onSidebarOpen/Close、sidebar touch area 点击、forceRebuildTree）、app.ts 4 处（close-sidebar-btn、sidebar-toggle-btn、card-stack-toggle-btn、card-stack）

结论：当前剩余 26 处均为必要。无冗余。<a id='trap-14'></a>

### 活跃待办

| 优先级 | 事项 | 说明 |
|--------|------|------|
| **🔴 P0** | 卡片工作台 Phase 1 | 购物车模式 + 基本文件浮卡（见 `docs/design/WORKBENCH_SPEC.md` §9） |
| ~~🔴 P0~~ | ~~文档-代码同步审计修复~~ | ✅ 全部 16 项已处理（见下方审计表） |
| ~~🟠 P1~~ | ~~Box 位置映射实施~~ | ✅ v6.6.1 已实施（`click-path` 命令 + `_boxLocationMap` 反向索引，见 `docs/archive/design/BOX_LOCATION_MAP_SPEC.md`） |
| ~~🟠 P1~~ | ~~版本号同步~~ | ✅ v6.6.1 |
| ~~🔴 P0~~ | ~~浮卡系统统一化~~ | ❌ 两次尝试均回退放弃。当前方向：三层共享层（已完成 ✅） |
| ~~🟠 P2~~ | ~~`CARDS` 数组迁移~~ | ✅ 已完成 |
| ~~🟠 P2~~ | ~~拆分 `card-stack.ts`~~ | ✅ 已完成 |
| ~~🟠 P2~~ | ~~文件树 overlay 残留~~ | ✅ v6.6.0 已根解（rebuildTree 入口防御性清理） |

### 持续观察
- 测试基础设施脆弱（GSAP mock 失真，无 UI/Canvas/手势覆盖）
- orb / card-stack 拖动逻辑重复（各自实现 pointerdown/move/up 循环）
### 历史版本归档

|------|------|---------|
| v4.1.0 | 卡片配色 + 浮卡系统 + BR 守卫 | `archive/handoffs/v4.1.0.md` |
| v5.0.0 | CSS 语法安全 + SCSS 迁移 | `archive/handoffs/v5.0.0.md` |
| v5.1.0 | root-picker 交互修复 | `archive/handoffs/v5.1.0.md` |
| v5.2.0 | RenderContext 上下文隔离 | `archive/handoffs/v5.2.0.md` |
| v6.0.0 | UI Element Registry + 代码审计 | `archive/handoffs/v6.0.0-audit.md` `archive/handoffs/v6.0.0-implementation.md` |
| v6.1.0 | Registry 全面接入 + 三层 MANIFEST 验证 | git `25a295e` |
| v6.1.1 | Registry 对齐修正 | git `462fe49` |
| v6.2.0 | 文件树 AI 命令 + 内容层增强 + 对称操作修复 | git `87a025d` |
| v6.3.0 | Registry 文档-代码对齐审计 + registerElement() 便捷方法 | git `47e82a2` |
| **v6.3.1** | **第三轮深度审计 + 心法 LEVEL + CI 基线固化** | git `847e988` |
| **v6.6.0** | 交互共享层 + overlay 根解 + 文档-代码审计 | git `6006949` |
| **v6.6.1** | **Box 位置映射 + 引擎架构文档 + 死代码清理（~300行） + notifyStateChange审计** | **HEAD** |
---

## 四、调试与 Bug 排查

### CSS/视觉 Bug 三步法

1. **CSS 解析检查**：在 DevTools 检查 `document.styleSheets`，争议规则是否存在？
   - 不存在 → 检查最近一条未闭合的 `{`/`(`/`[`
   - 存在但计算样式不匹配 → 检查 CSS 优先级和选择器拼写
2. **工具编辑安全**：`edit` 替换 CSS 块时，确保末尾包含了 `}`/`;`/`)` 等闭合字符
3. **浏览器二次确认**：强制无缓存刷新，用 `getComputedStyle(el)` 验证计算值

### 隐性契约（破坏会出 Bug）

| # | 契约 | 涉及模块 |
|---|------|---------|
| 1 | **全项目统一使用 PointerEvent** — 禁止直接添加 `touchstart`/`touchmove`/`touchend` | gesture-registry, canvas-scroll, card-stack, tree-render, orb |
| 2 | **`touch-action: none`** — 全屏单页应用全局设为 `none`，禁止 `pan-y`/`auto` | public/css/base.css, 所有 position:fixed 覆盖层 |
| 3 | **卡片堆是全局模式** — 打开后整屏都是操作区域，`targetFilter: () => true` 不是缺陷 | card-stack.ts, gestures.ts |
| 4 | **BR 光球双向切换** — 状态机必须闭环 `compact ↔ active`，不能单向 | card-stack.ts（浮卡状态机） |

### 根因案例索引

详细诊断过程见 `archive/bugs/` 和已归档的 `archive/handoffs/`。

| 案例 | 根因类型 | 症状关键词 |
|------|---------|-----------|
| B.A.R. #001 | 事件系统混用 | 外部区域滑动失效、不跟手 |
| B.A.R. #002 | 全局/局部模式误判 | 手势区域限定、外部滑动失效 |
| B.A.R. #006 | CSS 语法错误/编辑遗漏 | 边框看不见、CSS 规则不生效 |

---

## 五、回归测试

### 自动化测试

```bash
npm test   # 159 个测试，覆盖 23 个模块（含 Box 引擎）
```

### 手动回归清单

| # | 操作 | 预期结果 |
|---|------|----------|
| 1 | 打开页面 | 主页面正常，光球可见 |
| 2 | 右滑 / 三横线 | 左栏打开��文件树完整 |
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
| 13 | 浮卡 BR 展开/折叠 | 三颗角光球从 BR 位置滑入/滑回，同步无淡入淡出 |
| 14 | 浮卡 TR 关闭 | 所有光球 + 卡片向 TR 圆心收缩消失 |
| 15 | 展开动画期间误触 TR | 不触发关闭（状态守卫） |

---

## 六、原则索引

> 完整原则定义和 LEVEL 分类见 `KFM_V4_INVARIANTS.md` 第零章。关键约定速查：`_` 前缀=私有、`(as any)` 零逃逸、GSAP 走 animation-registry、Canvas 事件走元素级监听、overlay 元数据用 `(as Box & OverlayMeta)` 访问。

> 历史交接记录（v6.2.0 / v6.3.x）已归档至 `archive/handoffs/`。各版本成就已在 §2 中概述。

---

## 七、文档-代码审计（2026-06-08）

> 本节记录项目全量审计发现的问题，供接手 agent 参考。

### 文档审计问题清单

| # | 优先级 | 问题 | 说明 |
|---|--------|------|------|
| ~~1~~ | ~~🔴~~ ✅ | ~~版本号三处不一致~~ 已修复 | 已统一为 v6.6.0（package.json + git tag + HANDBOOK §2） + CI 检查脚本 `check-versions.mjs` 已加入管线 |
| ~~2~~ | ~~🔴~~ ✅ | ~~HANDBOOK §2 当前焦点严重过时~~ 已修复 | 已改为"卡片工作台"，版本已更新为 v6.6.0 |
| ~~3~~ | ~~🔴~~ ✅ | ~~HANDBOOK §3 待办表过时~~ 已修复 | 待办表已更新：overlay 标记根解、统一化标记放弃、新增工作台 P0 |
| 4 | 🔴 P0 | 8 个客户端模块零文档 | ✅ 已审计：全部有效，无死代码，无功能重叠。头部注释已有清晰用途说明。HANDBOOK §1 已补入模块职能分组表 |
| ~~5~~ | ~~🟠~~ ✅ | ~~引擎层零文档~~ | ✅ v6.6.1 已补充 `docs/archive/design/ENGINE_ARCHITECTURE.md`（v2 渲染管线 + text-layout 排版引擎全架构） |
| ~~6~~ | ~~🟠~~ ✅ | ~~CLAUDE.md 文档树缺 `design/` 和 `notes/`~~ 已修复 | 已在 CLAUDE.md 中补充 |
| ~~7~~ | ~~🟠~~ ✅ | ~~CLAUDE.md 架构描述缺交互共享层~~ 已修复 | 已在架构描述中补充 |
| 8 | ✅ 已处理 | `cards/` 目录零文档 | 已删除。2 个文件（index.ts + logger.ts）移除。实际使用的 logger 在 `src/client/modules/logger.ts`，不受影响 |
| 9 | ✅ 已处理 | `.github_token` 安全风险 | 已迁移至 `.env` 文件（`GITHUB_TOKEN=...`），`.github_token` 已删除，`.gitignore` 已保护 `.env`。CLAUDE.md 已补充 Git 推送认证说明 |
| 10 | ✅ 已处理 | `sidebar-*.png` 临时截图 | 已删除（两个文件无代码引用，调试残留） |
| 11 | ✅ 已处理 | `public/bundle.js` 构建产物 | 已在 `.gitignore` 中保护，不会被提交 |
| ~~12~~ | ~~🟡~~ ✅ | ~~HANDBOOK 陷阱 #12 描述需更新~~ 已更新 | 已加注设计阶段 |
| ~~13~~ | ~~🟠~~ ✅ | ~~HANDBOOK §1 模块列表不完整~~ 已修复 | §1 已补全为 29 个模块的职能分组表 |
| 14 | ✅ 已处理 | `path-utils.ts` 无独立文档描述 | 头部注释已补充安全约束+依赖方+环境变量说明 |
| 15 | ✅ 已处理 | 服务端 5 个文件总体无架构文档 | HANDBOOK §1「服务端模块」已补充架构概览 + 5 个模块职责表 + 调用流向图 |
| 16 | ✅ 已排查 | 注册表遗漏 & 重复造轮子 | 交互层13=MANIFEST13、内容层3=MANIFEST3、能力层3=MANIFEST3，一一对应。类型共享无重复，点击队列无重复，缩进逻辑无重复。发现1处可修复的重复：`floating-card.ts:555` 局部定义 `MARGIN_F=8` 绕过共享常量 `MARGIN`—已修正 |
### 审计总结（2026-06-08）

16 项审计全部完成。项目文档-代码同步性已恢复，接手 agent 可信任文档体系为当前一致基准。


### 客户端模块完整审计表

> HANDBOOK §1 注册中心表仅覆盖部分模块。以下是全部 29 个客户端模块的完整清单。

| 模块 | 行数 | 被导入 | 文档覆盖 | 用途 |
|------|------|--------|---------|------|
| `app.ts` | 181 | 1 | ✅ 入口 | 初始化流程��排 |
| `animation-registry.ts` | 93 | 5 | ✅ 提及 | GSAP 动画隔离层 |
| `canvas-cursor.ts` | 244 | 3 | ✅ 提及 | Canvas 盒子光标系统 |
| `canvas-scroll.ts` | 315 | 2 | ✅ 提及 | Canvas 盒子滚动系统 |
| `canvas-utils.ts` | 60 | 4 | ✅ 依赖图 | Canvas 通用工具函数 |
| `card-stack.ts` | 498 | 4 | ✅ 独立条目 | 堆叠卡片面板 |
| `char-rain.ts` | 305 | 1 | ✅ 分组表 | 字符散落/回收动画 |
| `click-queue.ts` | 38 | 1 | ✅ 分组表 | 点击事件队列 |
| `debug-assert.ts` | 23 | 1 | ✅ 提及 | 运行时断言 |
| `dom-refs.ts` | 36 | 9 | ✅ 注册表 | DOM 元素引用 |
| `floating-card.ts` | 646 | 2 | ✅ 独立条目 | 浮卡系统（核心模块） |
| `gesture-registry.ts` | 215 | 6 | ✅ 独立条目 | 手势注册中心 |
| `gestures.ts` | 69 | 1 | ✅ 提及 | 页面滑动手势配置 |
| `interaction-constants.ts` | 15 | 2 | ✅ 分组表 | 交互常量共享层（v6.6.0 新增） |
| `drag-handler.ts` | 130 | 2 | ✅ 分组表 | 共享拖动状态机（orb + floating-card 去重） |
| `logger.ts` | 55 | 3 | ✅ 分组表 | KFM 日志系统 |
| `orb.ts` | 508 | 1 | ✅ 独立条目 | 光球 + AI 对话面板 |
| `renderer-lifecycle.ts` | 242 | 5 | ✅ 注册表 | 渲染器生命周期单例 L |
| `root-picker.ts` | 432 | 2 | ✅ 独立条目 | 文件树根目录切换器 |
| `state.ts` | 244 | 10 | ✅ 注册表 | 全局状态层 KFMState |
| `style-registry.ts` | 212 | 4 | ✅ 独立条目 | 文件树样式唯一来源 |
| `theme.ts` | 217 | 7 | ✅ 独立条目 | 主题系统（颜色唯一来源） |
| `tree-loader.ts` | 185 | 2 | ✅ 分组表 | 数据加载层（按需加载展开路径） |
| `tree-model.ts` | 185 | 2 | ✅ 分组表 | 绝对深度布局模型 |
| `tree-overlay.ts` | 377 | 1 | ✅ 分组表 | Overlay 双树构建系统（从 tree-render 拆分） |
| `tree-render.ts` | 969 | 3 | ✅ 核心条目 | 文件树 Canvas 渲染（编排层） |
| `tree-swipe.ts` | 610 | 1 | ✅ 分组表 | 文件行右滑 → 卡片堆（从 tree-render 拆分） |
| `ui-registry.ts` | 331 | 9 | ✅ 独立条目 | UI 元素注册表 |
| `ui.ts` | 70 | 10 | ✅ 提及 | UI 初始化编排 |
| `ws-channel.ts` | 317 | 6 | ✅ 独立条目 | WebSocket 通信通道 |
| **合计** | **7822** | | | |

### 死代码检查

**结论：无死代码。** 所有 29 个模块都被至少 1 个文件导入。`src/cards/` 目录已彻底删除。实际使用的 logger 在 `src/client/modules/logger.ts`。

### 引擎层清单（14 文件）

> 完整架构见 `docs/archive/design/ENGINE_ARCHITECTURE.md`。

#### engine/v2 — Canvas 渲染引擎（8 文件）

| 文件 | 行数 | 用途 |
|------|------|------|
| `renderer.ts` | 825 | Canvas 渲染器主类（自研 Box → Canvas 2D） |
| `box.ts` | 623 | Box 数据结构（树节点，含事件/布局/绘制） |
| `types.ts` | 423 | Box 系统全部类型定义（40+ 类型/接口/常量） |
| `BorderDrawer.ts` | 267 | 8 段圆角矩形边框绘制 |
| `flex.ts` | 245 | Flex 布局算法 |
| `StyleConfig.ts` | 155 | 边框/辉光/背景样式配置 |
| `animation.ts` | 39 | 纯缓动函数（ease） |
| `utils.ts` | 23 | 间距工具函数 |

#### engine/text-layout — 文本排版引擎（6 文件）

| 文件 | 行数 | 用途 |
|------|------|------|
| `line-break.ts` | 763 | 行断引擎（CSS white-space 语义） |
| `layout.ts` | 442 | 排版公开 API（prepare → layout → walkLines） |
| `analysis.ts` | 346 | 文本分析（Intl.Segmenter、CJK、标点） |
| `measurement.ts` | 226 | Canvas 文本测量（含 emoji 修正） |
| `bidi.ts` | 176 | 双向文字元数据（computeSegmentLevels） |
| `index.ts` | 49 | 桶导出 + measureText/layoutLines 便捷包装 |

#### 引擎层依赖图

```
types / StyleConfig（纯数据，无项目导入）
  → utils / animation（纯工具）
    → box（核心数据结构）
      → flex / BorderDrawer（布局/绘制）
        → renderer（集成中枢 → 唯一导入 modules/theme.ts）
```

> 唯一反向耦合：`src/client/engine/v2/renderer.ts` → `src/client/modules/theme.ts`（`currentTheme`）。
> 其余 13 个引擎文件零项目导入，完全自包含。