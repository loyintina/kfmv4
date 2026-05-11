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
npm run build    # tsc --noEmit → esbuild（类型不过不会打包）
npm run check    # tsc --noEmit 快速类型检查（不构建，比 build 快）
npm run start    # node dist/server/index.js  →  http://localhost:8021
npm run dev      # ts-node ESM 模式直接运行
```

**`npm run check` 必须零错误通过。** 全部历史类型错误已修复。如果报错 → 是改动引入的，必须修复。

## 文档结构

```
CLAUDE.md                          # 主文档（本文件）
docs/
├── HANDOFF_AUDIT.md               # 项目交接 + 代码审计结论（新接手必读）
├── KFM_V4_INVARIANTS.md           # 项目专用架构不变量（开工前必读）
├── AI_COLLABORATION_PRINCIPLES.md # 通用 AI 协作守则
├── STACK_CARDS_DESIGN.md          # 堆叠卡片配色设计（暮光/琉璃/星云）
└── archive/
    ├── BUG_FIXING_PHILOSOPHY.md   # 旧版 Bug 修复原则（已拆分为通用+专用）
    ├── CLAUDE_v2.md               # 上一版 CLAUDE（已合并）
    ├── RACE_CONDITION_PLAN.md     # P1-P5 竞态方案（已完成）
    ├── REFACTOR_THESIS_FULL.md    # 愿景 + 架构蓝图（大部分已过时）
    ├── AI_OPERATION_PROTOCOL.md   # AI 操作协议（未实现功能设计）
    ├── CARD-STACK-HANDOFF.md      # 卡片面板交接笔记（已完成）
    ├── BUG_HANDOFF_ROOT_CHAR_RAIN.md  # 字符雨 bug 交接（已修复）
    └── HANDOFF_P3_REMAINING.md    # P3 遗留任务单（任务已完成）
```

## 目录结构

```
src/
├── server/index.ts           # Express 服务器（文件读写 API）
├── client/
│   ├── main.ts               # 入口：gestures.init() → App → UI → Orb → TreeRenderer → CardStack
│   ├── engine/v2/            # Canvas 渲染引擎
│   │   ├── box.ts            # Box 数据结构（一切皆盒）
│   │   ├── renderer.ts       # Canvas 2D 渲染器 + 主循环
│   │   ├── types.ts          # 全部类型定义
│   │   ├── flex.ts           # Flexbox 布局算法
│   │   ├── scroll.ts         # 滚动事件处理
│   │   ├── animation.ts      # 缓动函数
│   │   ├── BorderDrawer.ts   # 四边独立控制 + 宽度渐变边框
│   │   ├── StyleConfig.ts    # 边框状态配置
│   │   └── GestureRecognizer.ts  # 手势识别器
│   └── modules/
│       ├── gesture-registry.ts    # 手势注册中心（优先级调度，独占执行）
│       ├── renderer-lifecycle.ts  # 渲染器生命周期（状态机 + rAF/Listener 追踪）
│       ├── dom-refs.ts            # DOM 元素引用注册表
│       ├── canvas-utils.ts        # 通用 Canvas 工具函数
│       ├── canvas-cursor.ts       # 通用光标系统
│       ├── canvas-scroll.ts       # 通用滚动系统
│       ├── click-queue.ts         # 点击事件队列（P4 提取）
│       ├── app.ts                 # 全局初始化、日志、AI 输入栏
│       ├── state.ts               # KFMState 统一状态层（发布-订阅 + beforeExpand Hook）
│       ├── tree-model.ts          # Box 树构建（buildSidebarTree → buildExpanded）
│       ├── tree-render.ts         # 文件树渲染 + 动画 + 光标（~970行）
│       ├── tree-loader.ts         # 懒加载（KFMState.addHook）
│       ├── char-rain.ts           # 字符雨粒子动画（独立 GSAP 时间线）
│       ├── animation-registry.ts  # GSAP scope 隔离（anim.scope + AnimTimeline）
│       ├── abort.ts               # 代际令牌（treeAbort）
│       ├── ui.ts                  # 侧栏开关
│       ├── gestures.ts            # 全局手势
│       ├── orb.ts                 # 悬浮光球 + AI 对话面板
│       ├── card-stack.ts          # 堆叠卡片面板（暮光配色）
│       └── style-registry.ts      # 样式注册表（LINE_HEIGHT、配色等）
```

## 核心架构

### 注册中心模式

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `gesture-registry.ts` | document 级触摸事件统一调度 |
| `RendererLifecycle` (`L`) | `renderer-lifecycle.ts` | tree-render 全部可变状态 + rAF/Listener 追踪 |
| `DOM` | `dom-refs.ts` | 全局 DOM 元素引用 |

手势优先级: orb(100) > card-stack-panel(90) > card-stack-global(80) > page-swipe(50)

### 动画系统（P2 + P3）

```
展开/折叠状态机:
  L.beginOp(path, 'expand'|'collapse')  — 开始动画
  L.endOp()                              — 结束动画
  L.isAnimating                          — 是否动画中
  L.animatingDir                         — 当前方向

overlay 模式:
  GSAP tween 只碰临时 overlay Box，不碰主树。
  动画完成 → _removeAllOverlays() → 主树已是终端态。
  中断: ts.clear() + _removeAllOverlays() → 安全回到稳态。

scope 隔离:
  ts = anim.scope('tree-render')  — tree-render 专用时间线
  anim.timeline()                 — char-rain 独立时间线
  每轮动画结束 ts.call() 内调用 ts.clear() 清理残留 tween。

overlay 元数据 (OverlayMeta 接口):
  _fullHeight, _origYs, _targetY, _savedCr, _toggleBox, _toggleRotate
  全部通过 (as Box & OverlayMeta) 类型化访问，无 (as any) 隐式契约。
```

### Canvas 通用模块依赖方向

```
renderer-lifecycle.ts (L 单例)
       ↓
canvas-utils.ts       ← 最底层工具，只依赖 L
       ↓
canvas-cursor.ts      ← 光标移动/吸附/模式判断
       ↓
canvas-scroll.ts      ← 滚轮/触摸/fling 惯性
       ↓
tree-render.ts        ← 文件树业务逻辑
```

canvas-* 模块不导入任何 tree-* 模块。

### 关键调用链

```
main.ts
  ├─ gestures.init()
  ├─ initApp()
  ├─ initUI()
  ├─ initGestures()        → gestures.register("page-swipe")
  ├─ initOrb()             → gestures.register("orb")
  ├─ initTreeRenderer()    → 创建 canvas + Renderer + 订阅 KFMState
  ├─ loadFileTree(/root)   → 加载初始数据
  │   └─ initLazyLoader()  → KFMState.addHook(beforeExpand) 懒加载
  └─ initCardStack()       → gestures.register("card-stack-*")

tree-render.ts 导出: markAnimatingPath, isAnimLocked, triggerExpandAnimation,
  onSidebarOpen, onSidebarClose, forceRebuildTree
```

## Bug 修复原则

**禁止打补丁。排查到最深层根因，通过调整架构间接消除 bug。**

具体来说：
- 不修症状（"字符雨不显示 → 加个 setTimeout"）
- 修根因（"字符雨不显示 → 发现 overflow: hidden 裁剪 → 让 overlay 默认 overflow: visible"）
- 每次修复后问自己：这个类别的 bug 以后还会出现吗？如果会，加类型、加断言、调架构，让它不可能出现。

参见 `docs/BUG_FIXING_PHILOSOPHY.md` — 当前架构审计 + 已知风险 + 改进计划。

## 关键约定

- `_` 前缀 = 模块内私有
- `L.renderer` 等通过 `renderer-lifecycle.ts` 单例访问
- `KFMState` 发布-订阅，订阅后用 `_ensureSubscribed` 模式
- Canvas 滚动/点击事件走元素级监听，不走 GestureRegistry
- overlay 元数据用 `(as Box & OverlayMeta)` 访问，**禁止 (as any)._xxx**
- 向 `ts` 添加 tween 的函数，必须在 `ts.call` 回调里 `ts.clear()`
- 动画中 `_stateSub` 不会触发 `rebuildTree`（`L.isAnimating` 守卫）

## 完整性校验

```bash
npm run check   # TypeScript 类型检查 → 必须零错误
npm run build   # esbuild 构建 → 必须通过
```

## 功能回归检查清单

| # | 操作 | 预期结果 |
|---|------|----------|
| 1 | 打开页面 | 主页面正常，光球可见 |
| 2 | 右滑 / 三横线 | 左栏打开，文件树完整 |
| 3 | 左栏上下滑动 | 列表正常滚动 |
| 4 | 点击文件夹 | 展开/折叠动画正常，字符雨可见 |
| 5 | 快速连点同目录 | 展开↔折叠正常切换，无闪烁 |
| 6 | 点击文件 | 文件在卡堆中打开 |
| 7 | 左栏左滑 | 左栏关闭 |
| 8 | 左栏打开时 Canvas 区左滑 | 左栏关闭（不召唤卡堆） |
| 9 | 侧栏关闭时左滑 | 召唤卡堆 |
| 10 | 卡堆右滑 | 关闭卡堆 |
| 11 | 卡堆上下滑 | 切换卡片，焦点保持 |
| 12 | 点击光球 | AI 面板打开 |
| 13 | 多层嵌套文件夹展开 | 子容器串行展开，字符雨正常 |
| 14 | 展开后立即折叠 | 折叠动画流畅，文字自然被裁 |

## 已知坑点

- **esbuild**: `supported: { nullish-coalescing: false }` 要求 ES2019
- **Canvas 初始化**: `clientWidth=0`，需在 `requestAnimationFrame` 回调里 `rebuildTree()`
- **服务端**: `nohup node dist/server/index.js &` 启动，`kill $(pgrep -f node.*dist/server)` 停止
- **事件冒泡**: 侧栏触摸区事件冒泡到 document → GestureRegistry 误触发

## 近期重构历史

```
992ba87 refactor: 清除 collapseSubs，终态树单次 rebuildTree
160df3f refactor: P4 事件队列形式化，提取 click-queue.ts
9b67561 chore: 清理死代码
36fa881 chore: 文档归档
99e2af8 refactor: P2 形式化展开/折叠状态机
9ae5dd8 fix: 三个展开动画 bug + 消除跨模块隐式契约
a455f36 fix: 折叠动画闪烁及癫痫 — ts.call 回调里加 ts.clear()
1c171f4 fix: 展开无字符雨 + 折叠文字提前消失
```
