# KFM v4 (Kaf Fee Mew / 咖啡猫)

AI 人机交互个人工作台，面向移动端浏览器。核心理念：**一切皆盒子**。

## 技术栈

- TypeScript (ES2022) + Express 服务器
- Canvas 2D 自研渲染引擎（v2: Box → Renderer），非 LeaferJS
- GSAP 3.15.0 动画
- esbuild 构建（TypeScript → dist/server/index.js + public/bundle.js）
- `@chenglou/pretext` 文本测量（零 reflow 离屏测量）

## 构建与运行

```bash
npm run build    # esbuild 构建服务端+客户端
npm run start    # node dist/server/index.js  →  http://localhost:8021
npm run dev      # ts-node ESM 模式直接运行
npm run check    # tsc --noEmit 类型检查
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
│       ├── gesture-registry.ts    # 🔑 手势注册中心（优先级调度，独占执行）
│       ├── renderer-lifecycle.ts  # 🔑 渲染器生命周期（状态托管 + rAF/Listener 追踪）
│       ├── app.ts            # 全局初始化、日志系统、Toast、AI输入栏
│       ├── state.ts          # KFMState 统一状态层（发布-订阅）
│       ├── tree-model.ts     # Box 树构建（文件树布局）
│       ├── tree-render.ts    # Canvas 渲染 + 展开/折叠动画（~1500行，核心文件）
│       ├── tree-loader.ts    # 懒加载（劫持 setExpanded 实现）
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

**手势优先级**: orb(100) > card-stack-panel(90) > card-stack-global(80) > page-swipe(50)

## 关键约定

- `_` 前缀 = 模块内私有（但 JS 无真正私有，跨模块也能访问）
- 服务端 API 支持 `/api/` 和 `/kfmv4/api/` 双前缀
- `L.renderer` 等通过 `renderer-lifecycle.ts` 单例访问，不要新造 `let renderer`
- `KFMState` 是发布-订阅模式，订阅后记得取消订阅（`_ensureSubscribed` 的正确模式）
- Canvas 滚动/点击事件是元素级监听（在 canvas 上），不走 GestureRegistry

## 跨模块依赖（关键调用链）

```
main.ts
  ├─ gestures.init()          # 必须在 initApp() 之前
  ├─ initApp()                # 日志、Toast、AI 输入栏
  ├─ initUI()                 # 往 window 挂 openSidebar/closeSidebar
  ├─ initGestures()           # → gestures.register(id="page-swipe")
  ├─ initOrb()                # → gestures.register(id="orb")
  ├─ initTreeRenderer()       # 创建 canvas + Renderer + 订阅 KFMState/styleRegistry
  ├─ loadFileTree(/root)    # 加载初始数据
  │   └─ initLazyLoader()     # 劫持 KFMState.setExpanded 实现懒加载
  └─ initCardStack()          # → gestures.register(id="card-stack-panel" + "card-stack-global")

tree-render.ts ← 被 tree-loader.ts、card-stack.ts、ui.ts 导入
  ├─ card-stack.ts 导入: getCursorRowIndex, getRowIndexLength
  ├─ tree-loader.ts 导入: markAnimatingPath, isAnimLocked, triggerExpandAnimation
  └─ ui.ts 导入: onSidebarOpen, onSidebarClose
```

## 已知坑点

- **bash heredoc**: SSH + heredoc + Python 三重引号会导致 shell 误解析，建议用 `scp` 上传 Python 脚本
- **esbuild**: `supported: { nullish-coalescing: false }` 要求 ES2019 目标
- **Canvas 初始化**: canvas 刚创建时 `clientWidth=0`，需要在 `requestAnimationFrame` 回调里 `rebuildTree()`
- **PM2 不存在**: 用 `nohup node dist/server/index.js &` 启动，`kill $(pgrep -f node.*dist/server)` 停止
- **`kill` 退出码 255**: 没有匹配进程时 pgrep 返回空 → kill 报 255，不影响后续命令
- **tree-render 的 `_sidebarClosed`**: 原来是 `let` 变量，现在在 `L._sidebarClosed`（renderer-lifecycle 单例）
