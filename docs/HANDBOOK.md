---
title: KFM v4 工作手册
last_reviewed: 2026-07-18
kfm_version: 7.1.0
status: active
maintainer: AI agent
---


# KFM v4 工作手册 (SOP)

> **日常开发参考**。改代码前先读 `KFM_V4_INVARIANTS.md`（修改约束协议），
> 规划设计时参考 `docs/design/VISION_AND_ROADMAP.md`（远景文档）。
> **加新卡片前先读** `docs/development/CARD_DEV_GUIDE.md`（卡片插件开发指南）。
> 做浮卡统一化时参考 `docs/archive/design/CARD_SYSTEM_UNIFICATION_SPEC.md`（浮卡系统统一化规范）。
> 本手册记录架构速查、当前状态、待办和审计清单。
> 诊断与 bug 排查见 `DIAGNOSTICS.md`，全量约束速查见 `docs/KFM_V4_INVARIANTS.md`。
>
> **文档规范**：本文使用 YAML frontmatter（版本 + 最后审核日期）。构建管线
> 中的 `check-versions.mjs` 会验证版本一致性，`check-doc-coverage.mjs` 会
> 验证所有代码文件在 §七 审计表中有覆盖条目。新增客户端模块后必须同步更新
> §七 表，否则 `npm run check` 会中断构建。

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

### 模块职能分组（全 46 个模块，不含 renderers/ 渲染器）

> 完整清单及依赖关系见 §七「客户端模块完整审计表」。此处按职能分组，方便快速定位。

| 分组 | 模块 | 核心职责 |
|------|------|---------|
| **骨架** | `app.ts` `ui.ts` `dom-refs.ts` `state.ts` `renderer-lifecycle.ts` | 初始化编排、全局状态、渲染器单例 L |
| **注册中心** | `ui-registry.ts` `gesture-registry.ts` `animation-registry.ts` | UI 元素、手势、动画的注册/调度 |
| **文件树渲染** | `tree-render.ts` `tree-overlay.ts` `tree-swipe.ts` `tree-model.ts` `tree-loader.ts` `canvas-cursor.ts` `canvas-scroll.ts` `canvas-utils.ts` `root-picker.ts` | Canvas 文件树的构建、交互、加载 |
| **文件树样式** | `style-registry.ts` `theme.ts` | 文件树尺寸/颜色/字体的唯一来源（改一处全局同步） |
| **视觉效果** | `char-rain.ts` | 字符散落/回收动画（展开折叠时） |
| **交互共享** | `interaction-constants.ts` `drag-handler.ts` `click-queue.ts` | 模块间共享的常量/类型/事件队列 |
| **卡片系统** | `card-registry.ts` `card-stack.ts` `floating-card.ts` `floating-shared.ts` `floating-fullscreen.ts` | 统一注册表（类型/实例）+ 堆叠抽屉 UI + 浮卡拖拽/全屏 UI |
| **AI / 通信** | `orb.ts` `orb-chat.ts` `orb-panel.ts` `ws-channel.ts` `session-store.ts` `debug-assert.ts` `gestures.ts` | 光球面板、下拉框、AI 消息/流式、WebSocket、会话持久化 |
| **日志** | `logger.ts` | KFM 日志系统（debug-card 伴侣） |

### 服务端模块（10 个）

服务端是 Express 4 + WebSocket 服务，通过 `index.ts` 统一入口编排。路由层已拆分到 `routes/`：

```
index.ts (入口路由 + 静态文件)
  ├── routes/files.ts     — 文件 CRUD API（list/read/write/copy/move/delete/rename/create）+ /system/info
  ├── routes/proxy.ts     — CORS 代理 /proxy/fetch（流式 SSE pipe + 非流式 JSON）
  ├── ai-tools.ts         — 从浏览器拉取 Registry snapshot（供 AI agent 查询页面状态）
  ├── capability-executor.ts  — 将 Registry 注册的能力映射为可执行函数（AI 工具调用端点）
  ├── path-utils.ts       — 安全路径守卫（所有用户路径逃逸校验，安全关键模块）
  ├── terminal-pty.ts     — PTY 会话管理（PtyManager: spawn/write/resize/kill）
  ├── ws-server.ts        — WebSocket 通信通道（服务端↔浏览器双向实时通信）
  ├── ai/                 — AI 对话子系统（v7.0.0 新增）
  │   ├── chat.ts         — SSE 流式对话核心（Provider/Model/SystemPrompt/ToolCall）
  │   ├── routes.ts       — AI 对话 HTTP 端点（/ai/chat、/ai/generate-title）
  │   └── tools/          — AI 工具定义与执行（kfm-exec/snapshot/logs）
  └── prompts/            — 提示词模板（system/base.md + tools/）
```

| 模块 | 核心职责 |
|------|---------|
| `index.ts` | Express 入口 + 路由装配 + 静态文件 + 启动（协调层） |
| `src/server/routes/files.ts` | 文件 CRUD：list / read / write / copy / move / delete / rename / create / media + system/info |
| `src/server/routes/proxy.ts` | CORS 代理：POST /proxy/fetch（流式 SSE + 非流式 JSON） |
| `ai-tools.ts` | 包装 Registry snapshot 为服务端 API 端点（GET/POST） |
| `capability-executor.ts` | 维护能力名→执行函数映射，被 AI 命令调用 |
| `path-utils.ts` | `SAFE_ROOT` + `sanitizePath()`，路径逃逸守卫 |
| `terminal-pty.ts` | PTY 会话 spawn/write/resize/kill |
| `ws-server.ts` | WebSocket 连接管理，接收推送的 snapshot |
| `src/server/ai/chat.ts` | SSE 流式对话核心：Provider 加载、SystemPrompt 拼接、Tool Call |
| `src/server/ai/routes.ts` | AI 对话 HTTP 端点：/ai/chat（流式）、/ai/generate-title |
| `src/server/ai/tools/` | AI 工具定义（types→index→kfm-exec/snapshot/logs） |
| `src/server/prompts/` | 提示词模板：system/base.md（基础角色）+ tools/（工具描述） |

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

`floating-card.ts` 管理浮卡发射、拖拽、缩放和编辑模式。浮卡从卡片堆的聚焦卡片发射，
经过 compact → expanding → active → editing 四态状态机，支持全屏切换。拖拽完全通过 GestureRegistry 统一调度。
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
> **最后更新**：2026-07-15（v7.1.0 — orb/floating-card/server 拆分 + 构建加固 + 214 测试）

### 当前焦点
**orb.ts AI 面板强化 + 会话卡管理 + 构建管线对齐**

卡片插件系统基础（card-registry + plugins/）已在 v7.0.0 奠定。当前阶段的工作重心：
1. **orb.ts AI 面板** — 复用完整 markdown 管线（marked + preprocessMd + code-highlight + math + mermaid），流式 reasoning 折叠，滚动位置保持
2. **会话卡** — 名称编辑框 + 保存/新建按钮 + 气泡区重构，按钮移至气泡区下方
3. **管理卡** — 编辑器框限高 70vh + 内容区可滚动 + 按钮粘性底部
4. **构建管线** — build.mjs 全量 check 对齐 npm run check + check-handbook-sync 过期阻断


> **数据目录**：v7.0.0 后将 `.kfmv4/` 从项目根目录迁移到 `$HOME/.kfmv4/`（由 `path-utils.ts` 的 `KFM_DATA_DIR` 定义）。
> 包含：`providers.json`、`active.json`、`sessions/`、`roles/`、`configs/`。
> 客户端通过 API 端点（`/api/files/read`、`/api/files/write`、`/api/files/list`）以相对路径 `.kfmv4/...` 访问，
> 服务端 `sanitizePath()` 将其解析到 `SAFE_ROOT`（`$HOME`）下。

- **v7.0.0 后已完成**：
  - 设置卡 → API 卡重构：Provider 管理界面（多 Provider 编辑/测试/选择/模型自动拉取）✅
  - `$HOME/.kfmv4/` 文件持久化（providers.json，取代 localStorage）+ 异步数据加载 ✅
  - 服务端 CORS 代理 `/api/proxy/fetch` 端点（AI API 请求走服务端）✅
  - 自定义 Provider 下拉面板（取代原生 select，浮在卡片上方）✅
  - 卡片样式规范落地：CARD_DEV_GUIDE §10.6 边框规范 + §10.7 多级嵌套颜色交替 + §10.2.1 文字颜色可读性 ✅
  - 设置卡视觉迭���（buildCardLayout + theme.ts 对齐、渐变边框、纯暗色背景、accent 标签栏）✅
  - 卡片堆点击/左滑发射全屏卡 + 收起堆（含 revert + GSAP 冲突修复）✅
  - 构建管线加固：预存 tsc 13 错误消除（floating-card/handler-factory/gesture-registry）✅
  - 文档归档对齐：43 份文档 frontmatter + 交叉引用修复 ✅
  - CONTEXT_ASSEMBLY_SPEC — AI 上下文拼接与工作空间设计 draft ✅
  - API 卡路径适配 nginx 反代（自动检测前缀）✅
  - 输入框/按钮排版统⼀（em 单位、`--card-font-size` CSS 变量）✅
  - 终端方向键左上下右修复 ✅
  - orb.ts markdown 管线复用（marked + preprocessMd + code-highlight + math + mermaid）✅
  - 流式输出 reasoning 默认展开、完成后折叠，移除 emoji 改为纯文本标签 ✅
  - renderChatContent 滚动位置保持（仅用户已在底部时自动滚底）✅
  - 会话卡名称编辑框 + 保存/新建按钮 + 气泡区重构 ✅
  - 管理卡编辑器限高 70vh + 内容区可滚动 + 按钮粘性底部 ✅
  - api 卡池框间距修复 ✅
  - build.mjs 全量检查对齐 npm run check（补全 15 步检查管线）✅
  - check-handbook-sync.mjs 过期时 exit(1) 阻断构建 ✅

v6.6.0 之前的焦点是「浮卡系统统一化」已两次尝试均回退放弃（详见 `docs/archive/design/CARD_SYSTEM_UNIFICATION_SPEC.md`）。当前方向改为「三层共享层」——常量层 + 类型层 + 能力声明层，可在不碰逻辑的前提下逐步统一。

- **v6.6.0 已完成**：
  - 交互共享层建立（`interaction-constants.ts` + `drag-handler.ts`）✅
  - overlay 残留 bug 根解（`rebuildTree` 入口加防御性清理）✅
  - Box 位置映射设计文档（`docs/archive/design/BOX_LOCATION_MAP_SPEC.md`）✅
  - 卡片工作台设计文档（`docs/archive/design/WORKBENCH_SPEC.md`）✅
- **v6.8.0 已完成**：
  - 卡片工作台模式系统：copy/move/delete 按钮 + ✓ 执行 API + 卡片动画 ✅
  - 传送门液体粒子：三段独立管道 + 物理/路径双坐标分离 + 粒子长度自适应 ✅
  - 方向锁简化：`dx>dy` 45° 分界，删三代补丁 ✅
  - 行变暗系统：`_dimmedPaths`+`_dimmedBoxes`+`opacity` 即时生效 ✅
  - `(as any)` 零逃逸：`CData` 类型替 `as any`，白名单清空 ✅
  - 案例研究文档：`CASE_STUDY_MODEL_CHOICE.md`（模型选择错误教训）✅
- **v6.7.0 已完成**：
  - 浮卡系统重构：`createFloatingCard(config)` 模板函数，`floating-card.ts` 不再依赖 `card-stack.ts` ✅
  - 投放/撤销按钮（✓/✗），卡片散落全屏浮卡（完整四角光球交互） ✅
  - 拖拽边界压缩 + 永久尺寸记忆修复 ✅
  - WORKBENCH_SPEC.md 更新：模式系统 + 长按功能栏设计 ✅
- **v6.6.1 已完成**：
  - Box 位置映射实施（`click-path` 命令 + `_boxLocationMap`）✅
  - 引擎层架构文档（`docs/archive/design/ENGINE_ARCHITECTURE.md`）✅
  - 死代码清理（~300 行：两套拖拽系统、`*Capability`、`anim.play/kill` API、遗留函数）✅
  - `notifyStateChange` 散布分类审计（35 处，26/35 必要，9 冗余）✅

> **v6.3.x 历史成就**：三轮深度审计 + CI 基线固化 + `(as any)` 零逃逸 + 能力层解耦 + 文档质量自动化。详见 `archive/handoffs/v6.3.1` 交接记录。

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
9. **动画锁超时**（`tree-loader.ts` `waitForAnimUnlock` 3s 兜底）— ~~说明动画管理有设计缺陷~~ ✅ **已根解（v6.11.0+）**：展开/折叠动画的 `onComplete` 中 `L.endOp()` 在 `root !== animRoot` 的早期 return 前执行，不再因 root 变更而漏释放。
10. **esbuild `nullish-coalescing` 禁用**：但源码大量使用 `??`，TS 6 编译时需确保正确降级
11. **测试 mock 脆弱**：GSAP mock 中 `tl.call(cb)` 同步执行回调，改变了动��时��
12. **补���链 = 模型错误信号**：同一问题超过 3 层补丁（cap→锚点→margin→边界修正），不是补丁不够准，是底层模型错了。停止修修补补，换上能自然满足所有约束的模型。案例：`docs/archive/design/CASE_STUDY_MODEL_CHOICE.md`。
16. **每次代码改动后立即提交**（心法 14）：禁止攒多个改动后一次性提交。写完一个函数/模块就 `git add` + `git commit`。历史教训：2026-07-05 浮卡全天工作丢失；2026-07-14 orb.ts ~200 行 AI 集成因 `git checkout --` 全丢，需逐行重写。<a id='trap-16'></a>
17. **`display:''` 会清除 inline style**：隐藏/显示元素时，如果元素原本有 `display:flex`（inline style），用 `display:''` 恢复会 revert 到 CSS 默认值（block），破坏 flex 布局。必须用 `display:'flex'` 恢复。历史案例：2026-07-05 光球 SVG 偏移 ~6px，排查耗时数小时。<a id='trap-17'></a>
18. **修改 .css 前检查是否有 .scss 源文件**：项目使用 SCSS 编译，`sass base.scss → base.css`。直接修改 `.css` 文件会被下一次 `npm run check` 编译覆盖。所有样式修改必须在 `.scss` 文件中进行。历史案例：2026-07-06 全屏卡片 touch-action 规则加到 base.css 被覆盖，排查 1 轮。<a id='trap-18'></a>
19. **第三方触摸库手势冲突**：集成有自己触摸处理的库（如 xterm.js、地图、画布等）时，如果库"全捕获"但只处理部分方向（如只处理垂直滚动），其他方向的手势（如水平滑动）会被静默丢弃。解决方案：在库的手势处理器中添加方向检测，将不处理的方向传递给其他处理器。历史案例：2026-07-06 终端卡全屏模式下水平滑动无法打开侧栏/卡片堆。<a id='trap-19'></a>
20. **`querySelectorAll('*')` + inline style 是继承链毒药**：`touch-action` 是 CSS 继承属性。对后代逐元素设 `elem.style.touchAction = 'none'` 后，该值永久粘住，父级改 `pan-y` 也传不下去。退出全屏/浮卡态时，只改容器元素的 `touchAction`，不要遍历后代。历史案例：2026-07-14 浮卡滚动失效（B.A.R. #008），排查 2 小时，根因是 `exitFullscreen` 的 `querySelectorAll('*')` 覆盖。<a id='trap-20'></a>

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
| ~~🔴 P0~~ | ~~卡片工作台 Phase 1~~ | ✅ v6.7.0 购物车模式 + 基本文件浮卡（临时卡片堆 + ✓/✗ 投放撤销，见 `docs/archive/design/WORKBENCH_SPEC.md` §11） |
| ~~🔴 P0~~ | ~~文档-代码同步审计修复~~ | ✅ 全部 16 项已处理（见下方审计表） |
| ~~🟠 P1~~ | ~~Box 位置映射实施~~ | ✅ v6.6.1 已实施（`click-path` 命令 + `_boxLocationMap` 反向索引，见 `docs/archive/design/BOX_LOCATION_MAP_SPEC.md`） |
| ~~🟠 P1~~ | ~~版本号同步~~ | ✅ v6.6.1 |
| ~~🔴 P0~~ | ~~浮卡系统统一化~~ | ❌ 两次尝试均回退放弃。当前方向：三层共享层（已完成 ✅） |
| ~~🟠 P2~~ | ~~`CARDS` 数组迁移~~ | ✅ 已完成 |
| ~~🟠 P2~~ | ~~拆分 `card-stack.ts`~~ | ✅ 已完成 |
| ~~🟠 P2~~ | ~~文件树 overlay 残留~~ | ✅ v6.6.0 已根解（rebuildTree 入口防御性清理） |
| ~~🟠 P1~~ | ~~card04/tmux 收尾~~ | ✅ 紧缩态测试确认（洛手动通过）+ 设计决策转为代码头部注释（设计注释规约 v2026-07-03） |
| ~~🟠 P2~~ | ~~card.meta 类型化~~ | ✅ 泛型守卫 + `check-card-meta.mjs` 自动化检查 + 17 处 `as` 断言清除 |
| ~~🟠 P2~~ | ~~核心模块测试补全~~ | ✅ 新增 19 个测试覆盖 card-registry(focusCard)/preMatchHook/tmux-card factory。floating-card 键盘避让因 DOM 依赖暂跳过 |
| ~~🟡 P3~~ | ~~terminal-aux-bar.ts 空占位~~ | ✅ 已删除（2 行注释，无文件引用） |
| ~~🟡 P3~~ | ~~xterm _core 私有 API~~ | ✅ 已锁定版本（`@xterm/xterm` `^6.0.0` → `6.0.0`，`@xterm/addon-fit` `^0.11.0` → `0.11.0`）。不升级就不会爆，P3 已消除 |
| 🟡 P3 | 手势系统研究与全局交互区域分权 | 浮卡/卡片堆/设置卡内容区与全局左右滑手势的交互边界需要重新梳理。当前 GestureRegistry 的 targetFilter 方式能解决大部分问题，但 touch-action 分区策略需要文档化并确保一致性。见对话记录。 |
### 持续观察
- ~~测试基础设施脆弱（GSAP mock 失真，无 UI/Canvas/手势覆盖）~~ ✅ 测试基础设施阶段 A-D 已完成。GSAP mock 时序修正 + DOM mock 布局增强 + Canvas 渲染层测试 + 浮卡状态机测试均已覆盖。浏览器级手势集成测试（Playwright）延后评估。
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
| **v6.6.1** | **Box 位置映射 + 引擎架构文档 + 死代码清理（~300行） + notifyStateChange审计** | git `96508b5` |
| **v6.7.0** | **浮卡模板化（createFloatingCard）+ ✓/✗ 投放撤销 + 拖拽尺寸永久记忆 + tree-render 拆分** | git `0b47b2e` |
| **v6.8.0** | **模式系统（copy/move/delete）+ 传送门液体粒子 + 方向锁简化 + 行变暗 + (as any)零逃逸** | git `5585967` |
| **v6.8.1** | **代码质量审计修复 + 模块拆分 + console 治理** | git `0061bb5` |
| **v6.9.0** | **Phase 7 长按抽屉栏（重命名/复制/删除）+ 引擎 scrollPaddingBottom + 键盘生命周期 + 折叠祖先级联同步** | git `0d43f00` |
| **v6.9.1** | **滚动方向轴锁定重构：12px死区+65°扇形分区+统一冻结 + BR光球双click根除 + pointercancel守卫 + 浮卡默认展开态** | git `5b9d0b8` |
| **v6.10.0** | **键盘避让完整方案 + card04 tmux 终端 + card-registry 聚焦/实例 + preMatch 钩子 + BR orb 触控 + SOP 3a 心法回溯** | `145136d` |
| **v6.10.1** | **card.meta 类型化 + 测试补全 + 设计注释规约 + 构建工具强化 + xterm 版本锁定** | git `f8d3e2a` |
| **v6.11.0** | **_handleStart 跳过纯双指处理器 + 全屏卡片原生滚动 + 文件点击直接全屏** | git `53dcf21` |
| **v6.11.1** | **心法重组（22条+6偏差组）+ 动画锁3s根因修复 + 测试拆分7文件 + 卡片插件系统 + _cards统一 + check-handbook-sync** | git `fedab31` |
| **v6.11.2** | **终端全屏辅助栏（aux bar）+ 光球避开辅助栏 + TERMINAL_CARD_SPEC 归档** | git `c386da3` |
| **v7.0.0** | **Phase 0+I 完成 — 心法/测试/插件/文档全部清理，进入 Agent 阶段** | git `9de2a8c` |
| **v7.1.0** | **orb/floating-card 拆分（848→524 + 1195→780）+ server 路由拆分（355→60）+ MD CSS/MARKED_OPTS/marked 统一 + 构建管线加固 + 214 测试 + 2 ADR** | git `3deb88b` |

> 完整诊断手册见 [`docs/DIAGNOSTICS.md`](./DIAGNOSTICS.md)，包含：
> - **隐性契约（11 条）** — 破坏会出 bug 的隐藏约束
> - **诊断流程** — 触控/手势、CSS/视觉、渲染/Canvas、构建/Bundle 四类排查路径
> - **根因案例库（#001–#007）** — 每次 bug 的完整诊断过程
>
> 速查：遇到 bug 先确认事件是否完整到达（用 `log()` 推日志卡），再查处理逻辑。

## 五、回归测试

> 完整测试清单见 [`docs/DIAGNOSTICS.md` 附录 B](./DIAGNOSTICS.md#附录-b回归测试)。
>
> ```bash
> npm test   # 214 个测试，覆盖 23 个模块（含 Box 引擎）
> ```

## 六、约束与原则

> 全量约束交叉引用见 [`docs/KFM_V4_INVARIANTS.md`](./KFM_V4_INVARIANTS.md)（心法 18 条 + 架构约束 + 隐性契约 + 关键约定速查）。
> 修改代码前必读 [`docs/KFM_V4_INVARIANTS.md`](./KFM_V4_INVARIANTS.md)（修改约束协议）。
> 补充原则（流程建议）见 [`docs/DIAGNOSTICS.md`](./DIAGNOSTICS.md) §四。

---

## 七、文档-代码审计（2026-06-08）

> 本节记录 2026-06-08 项目全量审计发现的问题，供接手 agent 参考。
> **当前轮次审计追踪见 `docs/archive/audits/v6.8-code-quality/AUDIT_TRACKER.md`。**

### 文档审计问题清单

| # | 优先级 | 问题 | 说明 |
|---|--------|------|------|
| ~~1~~ | ~~🔴~~ ✅ | ~~版本号三处不一致~~ 已修复 | 已统一为 v6.8.1（package.json + git tag + HANDBOOK §2） + CI 检查脚本 `check-versions.mjs` 已加入管线，含 tag 检查和版本历史表完整性检查 |
| ~~2~~ | ~~🔴~~ ✅ | ~~HANDBOOK §2 当前焦点严重过时~~ 已修复 | 已改为"卡片工作台"，版本已更新为 v6.6.0 |
| ~~3~~ | ~~🔴~~ ✅ | ~~HANDBOOK §3 待办表过时~~ 已修复 | 待办表已更新：overlay 标记根解、统一化标记放弃、新增工作台 P0 |
| 4 | 🔴 P0 | 8 个客户端模块零文档 | ✅ 已审计：全部有效，无死代码，无功能重叠。头部注释已有清晰用途说明。HANDBOOK §1 已补入模块职能分组表 |
| ~~5~~ | ~~🟠~~ ✅ | ~~引擎层零文档~~ | ✅ v6.6.1 已补充 `docs/archive/design/ENGINE_ARCHITECTURE.md`（v2 渲染管线 + text-layout 排版引擎全架构） |
| ~~6~~ | ~~🟠~~ ✅ | ~~CLAUDE.md 文���树缺 `design/` 和 `notes/`~~ 已修复 | 已在 CLAUDE.md 中补充 |
| ~~7~~ | ~~🟠~~ ✅ | ~~CLAUDE.md 架构描述缺交互共享层~~ 已修复 | 已在架构描述中补充 |
| 8 | ✅ 已处理 | `cards/` 目录零文档 | 已删除。2 个文件（index.ts + logger.ts）移除。实际使用的 logger 在 `src/client/modules/logger.ts`，不受影响 |
| 9 | ✅ 已处理 | `.github_token` 安全风险 | 已迁移至 `.env` 文件（`GITHUB_TOKEN=...`），`.github_token` 已删除，`.gitignore` 已保护 `.env`。CLAUDE.md 已补充 Git 推送认证说明 |
| 10 | ✅ 已处理 | `sidebar-*.png` 临时截图 | 已删除（两个文件无代码引用，调试残留） |
| 11 | ✅ 已处理 | public/bundle.js 构建产物 | 已在 .gitignore 中保护，不会被提交 |
| ~~12~~ | ~~🟡~~ ✅ | ~~HANDBOOK 陷阱 #12 描述需更新~~ 已更新 | 已加注设计阶段 |
| ~~13~~ | ~~🟠~~ ✅ | ~~HANDBOOK §1 模块列表不完整~~ 已修复 | §1 已补全为 29 个模块的职能分组表（历史数据，当前为 41 个模块 + 8 个渲染器） |
| 14 | ✅ 已处理 | `path-utils.ts` 无独立文档描述 | 头部注释已补充安全约束+依赖方+环境变量说明 |
| 15 | ✅ 已处理 | 服务端 6 个文件总体无架构文档 | HANDBOOK §1「服务端模块」已补充架构概览 + 模块职责表 + 调用流向图 |
| 16 | ✅ 已排查 | 注册表遗漏 & 重复造轮子 | 交互层13=MANIFEST13、内容层3=MANIFEST3、能力层3=MANIFEST3，一一对应。类型共享无重复，点击队列无重复，缩进逻辑无重复。发现1处可修复的重复：`floating-card.ts:555` 局部定义 `MARGIN_F=8` 绕过共享常量 `MARGIN`—已修正 |
### 审计总结（2026-06-08）

16 项审计全部完成。项目文档-代码同步性已恢复，接手 agent 可信任文档体系为当前一致基准。


### 客户端模块完整审计表

> HANDBOOK §1 注册中心表仅覆盖部分模块。以下是全部 49 个客户端源文件的完整清单（含 renderers/ 渲染器）。

| 模块 | 行数 | 被导入 | 文档覆盖 | 用途 |
|------|------|--------|---------|------|
| `app.ts` | 182 | 1 | ✅ 入口 | 初始化流程��排 |
| `animation-registry.ts` | 91 | 5 | ✅ 提及 | GSAP 动画隔离层 |
| `canvas-cursor.ts` | 444 | 3 | ✅ 提及 | Canvas 盒子光标系统 |
| `canvas-scroll.ts` | 361 | 2 | ✅ 提及 | Canvas 盒子滚动系统 |
| `canvas-utils.ts` | 61 | 4 | ✅ 依赖图 | Canvas 通用工具函数 |
| `card-toast.ts` | 52 | 1 | ✅ 分组表 | 卡片风格轻量提示 |
| `char-rain.ts` | 306 | 2 | ✅ 分组表 | 字符散落/回收动画 |
| `card-stack.ts` | 452 | 4 | ✅ 独立条目 | 堆叠卡片面板（消费 card-registry，按注册表动态构建） |
| `click-queue.ts` | 39 | 1 | ✅ 分组表 | 点击事件队列 |
| `custom-select.ts` | 244 | 1 | ✅ 分组表 | 可复用的自定义下拉框组件 |
| `confirm-dialog.ts` | 190 | 1 | ✅ 分组表 | 可复用的自定义确认对话框 |
| `color-utils.ts` | 46 | 2 | ✅ 分组表 | 颜色工具函数（从 tree-swipe 拆分） |
| `debug-assert.ts` | 24 | 1 | ✅ 提及 | 运行时断言 |
| `dom-refs.ts` | 37 | 9 | ✅ 注册表 | DOM 元素引用 |
| `floating-card.ts` | 782 | 3 | ✅ 独立条目 | 浮卡创建/状态机/手势（核心模块） |
| `floating-shared.ts` | 172 | 1 | ✅ 分组表 | 浮卡共享类型/常量/状态/工具（从 floating-card 拆分） |
| `floating-fullscreen.ts` | 214 | 1 | ✅ 分组表 | 浮卡全屏/退出/关闭逻辑（从 floating-card 拆分） |
| `gesture-registry.ts` | 385 | 6 | ✅ 独立条目 | 手势注册中心 |
| `gestures.ts` | 217 | 1 | ✅ 提及 | 页面滑动手势配置 |
| `interaction-constants.ts` | 21 | 2 | ✅ 分组表 | 交互常量共享层（v6.6.0 新增） |
| `drag-handler.ts` | 136 | 2 | ✅ 分组表 | 共享拖动状态机（orb + floating-card 去重） |
| `file-action-bar.ts` | 427 | 2 | ✅ 分组表 | 文件行长按 → 底部抽屉操作栏 |
| `logger.ts` | 58 | 3 | ✅ 分组表 | KFM 日志系统 |
| `mode-system.ts` | 444 | 1 | ✅ 分组表 | 模式按钮系统（从 tree-swipe 拆分，v6.8.0 新增） |
| `orb.ts` | 529 | 2 | ✅ 独立条目 | 光球 UI + 拖拽手势 + 面板状态机（协调层） |
| `orb-chat.ts` | 405 | 1 | ✅ 分组表 | AI 消息渲染 + SSE 流式通信（从 orb.ts 拆分） |
| `orb-panel.ts` | 205 | 1 | ✅ 分组表 | 面板 Provider/Session/Model/Role 下拉框（从 orb.ts 拆分） |
| `orb-state.ts` | 17 | 0 | ✅ 分组表 | orb 状态机纯逻辑（零依赖，从 orb.ts 拆分，可脱离浏览器测试） |
| `session-store.ts` | 301 | 1 | ✅ 分组表 | 会话持久化统一存储（替代 orb.ts 散布的会话逻辑） |
| `renderer-lifecycle.ts` | 243 | 5 | ✅ 注册表 | 渲染器生命周期单例 L |
| `root-picker.ts` | 434 | 2 | ✅ 独立条目 | 文件树根目录切换器 |
| `state.ts` | 257 | 10 | ✅ 注册表 | 全局状态层 KFMState |
| `style-registry.ts` | 206 | 4 | ✅ 独��条目 | 文件树样式唯一来源 |
| `theme.ts` | 239 | 7 | ✅ 独立条目 | 主题系统（颜色唯一来源） |
| `tree-loader.ts` | 188 | 2 | ✅ 分组表 | 数据加载层（按需加载展���路径） |
| `tree-model.ts` | 191 | 2 | ✅ 分组表 | 绝对深度布局模型 |
| `tree-overlay.ts` | 414 | 1 | ✅ 分组表 | Overlay 双树构建系统（从 tree-render 拆分） |
| `tree-animation.ts` | 74 | 1 | ✅ 分组表 | 文件树插入/移除 GSAP 动画（新建/删除/复制/移动共享） |
| `tree-render.ts` | 1019 | 3 | ✅ 核心条目 | 文件树 Canvas 渲染（编排层） |
| `tree-swipe.ts` | 725 | 1 | ✅ 分组表 | 文件行右滑 → 卡片堆（从 tree-render 拆分，v6.8.0 拆分为 color-utils + mode-system） |
| `ui-registry.ts` | 334 | 9 | ✅ 独立条目 | UI 元素注册表 |
| `ui.ts` | 71 | 10 | ✅ 提及 | UI 初始化编排 |
| `ws-channel.ts` | 348 | 6 | ✅ 独立条目 | WebSocket 通信通道 |
| `terminal-card-04.ts` | 692 | 0 | TERMINAL_CARD_SPEC | 03 号终端卡 xterm.js 集成 |
| `tmux-card.ts` | 195 | 0 | — | 04 号 tmux 窗口管理卡 |
| `card-registry.ts` | 155 | 5 | CARD_REGISTRY_SPEC | 卡片注册表：类型声明 + 实例追踪 |
| **渲染器（renderers/）** | | | | |
| `../src/client/modules/renderers/binary-fallback.ts` | 37 | 1 | — | 二进制文件回退渲染器（文字提示不可预览） |
| `../src/client/modules/renderers/code-highlight.ts` | 100 | 1 | — | 代码语法高亮渲染器（highlight.js） |
| `../src/client/modules/renderers/file-type.ts` | 17 | 1 | — | 文件类型图标映射 |
| `../src/client/modules/renderers/handler-factory.ts` | 279 | 1 | — | 卡片内容处理器工厂（按 typeId 分发） |
| `../src/client/modules/renderers/katex-css.ts` | 3 | 1 | — | KaTeX CSS 注入（CDN） |
| `../src/client/modules/renderers/math-diagram.ts` | 153 | 1 | — | 数学公式/图表渲染器（KaTeX + Mermaid CDN） |
| `../src/client/modules/renderers/md-extensions.ts` | 51 | 1 | — | Markdown 渲染扩展（链接、任务列表） |
| `../src/client/modules/renderers/md-css.ts` | 57 | 2 | ✅ 分组表 | Markdown 渲染 CSS（全局唯一来源，orb + handler-factory 共享） |
| `../src/client/modules/renderers/text-preview.ts` | 26 | 1 | — | 文本文件预览渲染器 |
| **合计** | **13350** | | | |

### 死代码检查
**结论：无死代码。** 所有 41 个模块都被至少 1 个文件导入（`terminal-card-04.ts` 和 `tmux-card.ts` 被导入数为 0，但这是模块自身的特性：它们仅在用户侧打开卡片时由 `card-registry.ts` 的 `createHandler` 工厂按需实例化，属于动态加载。`terminal-aux-bar.ts` 已删除（空占位，无任何引用）。`src/cards/` 目录已彻底删除。实际使用的 logger 在 `src/client/modules/logger.ts`。

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