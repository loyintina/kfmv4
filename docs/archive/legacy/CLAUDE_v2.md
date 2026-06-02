---
status: superseded
archived_at: 2026-06-02
---
# KFM v4 (Kaf Fee Mew / 咖啡猫)

> ⚠️ **存档文档**。本文引用的部分源文件（`scroll.ts`、`GestureRecognizer.ts` 等）已从项目中删除，目录结构与当前代码不完全一致。仅供参考。

AI 人机交互个人工作台，面向移动端浏览器。核心理念：**一切皆盒子**。

## 技术栈

- TypeScript (ES2022) + Express 服务器
- Canvas 2D 自研渲染引擎（v2: Box → Renderer），非 LeaferJS
- GSAP 3.15.0 动画
- esbuild 构建（TypeScript → dist/server/index.js + public/bundle.js）
- `@chenglou/pretext` 文本测量（零 reflow 离屏测量）

## 构建与运行

```bash
npm run build    # tsc --noEmit → esbuild（类型不过不会打包）
npm run check    # tsc --noEmit 快速类型检查（不构建，比 build 快）
npm run start    # node dist/server/index.js  →  http://localhost:8021
npm run dev      # ts-node ESM 模式直接运行
```

## 目录结构

```
src/
├── server/index.ts           # Express 服务器（文件读写 API）
├── client/
│   ├── main.ts               # 入口：初始化顺序 → gestures.init() → App → UI → Orb → TreeRenderer → CardStack
│   ├── engine/v2/            # Canvas 渲染引擎
│   │   ├── box.ts            # Box 数据结构（一切皆盒）
│   │   ├── renderer.ts       # Canvas 2D 渲染器 + 主循环
│   │   ├── types.ts          # 全部类型定义
│   │   ├── flex.ts           # Flexbox 布局算法
│   │   ├── scroll.ts         # 滚动事件处理
│   │   ├── animation.ts      # 缓动函数
│   │   ├── BorderDrawer.ts   # 四边独立控制 + 宽度渐变边框
│   │   ├── StyleConfig.ts    # 边框状态配置（hidden/normal/emphasis）
│   │   └── GestureRecognizer.ts  # 手势识别器
│   └── modules/
│       ├── gesture-registry.ts    # 手势注册中心（优先级调度，独占执行）
│       ├── renderer-lifecycle.ts  # 渲染器生命周期（状态托管 + rAF/Listener 追踪）
│       ├── dom-refs.ts            # DOM 元素引用注册表（全局 getElementById 收敛于此）
│       ├── canvas-utils.ts        # 通用 Canvas 工具函数（60行，非文件树专属）
│       ├── canvas-cursor.ts       # 通用光标系统（246行，非文件树专属）
│       ├── canvas-scroll.ts       # 通用滚动系统（352行，非文件树专属）
│       ├── app.ts            # 全局初始化、日志系统、Toast、AI输入栏
│       ├── state.ts          # KFMState 统一状态层（发布-订阅 + beforeExpand Hook）
│       ├── tree-model.ts     # Box 树构建（文件树布局）
│       ├── tree-render.ts    # 文件树 Canvas 渲染（~910行：生命周期 + 树构建 + 点击）
│       ├── tree-loader.ts    # 懒加载（通过 KFMState.addHook 实现）
│       ├── ui.ts             # 侧栏开关
│       ├── gestures.ts       # 全局手势（边缘滑动→侧栏/卡片面板）
│       ├── orb.ts            # 悬浮光球 + AI 对话面板
│       ├── card-stack.ts     # 堆叠卡片面板（暮光配色，7卡堆叠）
│       └── style-registry.ts # 样式注册表（LINE_HEIGHT、配色等）
├── engine/text-layout/       # 文本排版引擎
└── index.html                # 已废弃的入口
```

## 注册中心（核心架构模式）

项目采用**注册中心**模式管理分散的资源：

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `gesture-registry.ts` | document 级触摸事件统一调度，优先级匹配 |
| `RendererLifecycle` (`L`) | `renderer-lifecycle.ts` | tree-render 全部可变状态 + rAF 追踪 + Listener 追踪 |
| `DOM` | `dom-refs.ts` | 全局 DOM 元素引用，getter 属性，去掉所有 document.getElementById |

**手势优先级**: orb(100) > card-stack-panel(90) > card-stack-global(80) > page-swipe(50)

## Canvas 通用模块（🔧 标记）

`canvas-utils.ts`、`canvas-cursor.ts`、`canvas-scroll.ts` 三个文件**不绑定任何具体页面**。它们是通用的 Canvas Box 基元，未来任何用 Box + Canvas 渲染的页面（卡片流 card-stream、编辑器面板等）都可以直接复用。

**依赖方向**（防循环依赖）:
```
renderer-lifecycle.ts (L 单例)
       ↓
canvas-utils.ts       ← 最底层工具，只依赖 L
       ↓
canvas-cursor.ts      ← 光标移动/吸附/模式判断
       ↓
canvas-scroll.ts      ← 滚轮/触摸/fling 惯性
       ↓
tree-render.ts        ← 文件树业务逻辑（展开/折叠/点击/重建）
```

**重要**: canvas-* 模块不导入任何 tree-* 模块（`canvas-cursor.ts` 例外——它从 `tree-model.js` 导入 `getShift` 和从 `style-registry.js` 导入 `LINE_HEIGHT/MAX_LINES`，这都是数据/参数类依赖，不涉及业务逻辑）。

## 关键约定

- `_` 前缀 = 模块内私有（但 JS 无真正私有，跨模块也能访问）
- 服务端 API 支持 `/api/` 和 `/kfmv4/api/` 双前缀
- `L.renderer` 等通过 `renderer-lifecycle.ts` 单例访问，不要新造 `let renderer`
- `KFMState` 是发布-订阅模式，订阅后记得取消订阅（`_ensureSubscribed` 的正确模式）
- Canvas 滚动/点击事件是元素级监听（在 canvas 上），不走 GestureRegistry
- 新建 Canvas 页面时，从 `canvas-*` 模块导入通用基元，只写本页面业务逻辑

## 跨模块依赖（关键调用链）

```
main.ts
  ├─ gestures.init()          # 必须在 initApp() 之前
  ├─ initApp()                # 日志、Toast、AI 输入栏
  ├─ initUI()                 # 往 window 挂 openSidebar/closeSidebar
  ├─ initGestures()           # → gestures.register(id="page-swipe")
  ├─ initOrb()                # → gestures.register(id="orb")
  ├─ initTreeRenderer()       # 创建 canvas + Renderer + 订阅 KFMState
  ├─ loadFileTree(/root)    # 加载初始数据
  │   └─ initLazyLoader()     # KFMState.addHook(beforeExpand) 实现懒加载
  └─ initCardStack()          # → gestures.register(id="card-stack-panel" + "card-stack-global")

tree-render.ts ← 被 tree-loader.ts、card-stack.ts、ui.ts 导入
  ├─ card-stack.ts 导入: (从 canvas-cursor.ts 导入 getCursorRowIndex, getRowIndexLength)
  ├─ tree-loader.ts 导入: markAnimatingPath, isAnimLocked, triggerExpandAnimation
  └─ ui.ts 导入: onSidebarOpen, onSidebarClose
```

## 完整性校验（每次改动后必做）

**改动代码后，按顺序执行：**

```bash
npm run check   # TypeScript 类型检查 → 拦住 import/export 缺失、类型错误
npm run build   # esbuild 构建 → 拦住语法错误、未定义变量
```

两者都要过。esbuild 在打包模式下不严格检查命名导出（把模块合并到同一作用域），所以不能只靠 build。`tsc --noEmit` 是真正严格的检查。

**全部 34 个历史类型错误已在 commit `e2f0e07` 修复。** `npm run check` 或 `npm run build` 应该零错误通过。如果报错 → 是改动引入的，必须修复。

## 功能回归检查清单

**每次部署后，在手机上对着这个清单快速过一遍：**

| # | 操作 | 预期结果 |
|---|------|----------|
| 1 | 打开页面 | 主页面正常显示，光球可见 |
| 2 | 点击左上角三横线按钮（或右滑） | 左栏打开，文件树完整显示 |
| 3 | 左栏区域上下滑动 | 文件列表正常滚动 |
| 4 | 点击文件夹 | 文件夹展开/折叠，有动画 |
| 5 | 点击文件 | 文件打开（在堆叠卡片中显示） |
| 6 | 左栏区域左滑 | 左栏关闭，回到主页面 |
| 7 | 左栏打开时，左侧 Canvas 区域左滑 | 左栏关闭（不召唤卡堆） |
| 8 | 主页面（侧栏关闭时）左滑 | 召唤堆叠卡片面板 |
| 9 | 卡堆打开后右滑（水平主导） | 卡堆关闭。垂直滑动中轻微水平偏移不触发关闭 |
| 10 | 卡堆打开后上下滑 | 切换卡片。关闭再打开后焦点保持在上次位置 |
| 11 | 点击光球 | AI 对话面板打开 |
| 12 | 右边缘右滑（侧栏关闭时） | 打开侧栏 |

**注意第 7 条**：这是最容易出 bug 的场景。左栏打开后，侧栏触摸区（sidebarTouchArea）的触摸事件会冒泡到 document 被 GestureRegistry 捕获。如果先关了侧栏再冒泡上去，全局层会以为"侧栏已关闭"而走"召唤卡堆"的逻辑。

## 已知坑点

- **bash heredoc**: SSH + heredoc + Python 三重引号会导致 shell 误解析，建议用 `scp` 上传 Python 脚本
- **esbuild**: `supported: { nullish-coalescing: false }` 要求 ES2019 目标
- **Canvas 初始化**: canvas 刚创建时 `clientWidth=0`，需要在 `requestAnimationFrame` 回调里 `rebuildTree()`
- **PM2 不存在**: 用 `nohup node dist/server/index.js &` 启动，`kill $(pgrep -f node.*dist/server)` 停止
- **`kill` 退出码 255**: 没有匹配进程时 pgrep 返回空 → kill 报 255，不影响后续命令
- **事件冒泡冲突**: 侧栏触摸区事件会冒泡到 document → GestureRegistry 误触发。修复时注意只隔离 sidebarTouchArea，不要阻止 Canvas 区域的正常冒泡
