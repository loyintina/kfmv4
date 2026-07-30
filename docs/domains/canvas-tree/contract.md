> 这是什么：Canvas 文件树——渲染、样式唯一来源、引擎层。
> 别的去哪找：手势/注册中心 → ../client-shell/；卡片堆 → ../floating-card/；引擎细节 → detail-engine.md。

# canvas-tree 域契约

## 两个「唯一来源」（硬规则）

1. **`theme.ts` = 全项目颜色唯一定义点**。导出 `currentTheme`（单例，运行时不可变）。
   新增颜色只能在这里加，禁止消费方硬编码色值；改一处全局同步。
2. **`style-registry.ts` = 文件树尺寸/字体/间距唯一定义点**。导出 `DIMENSIONS`、
   `TEXT_STYLES`、`createBox()`。行高/缩进/字号只能在这里改。

## 模块职责

- 渲染编排：`tree-render.ts`（Canvas 编排层）`tree-overlay.ts` `tree-animation.ts`
- 交互：`tree-swipe.ts`（文件行右滑→卡片堆）`canvas-cursor.ts`（含液体粒子，几何在 `liquid-geometry.ts`）`canvas-scroll.ts` `canvas-utils.ts`
- 数据：`tree-model.ts`（绝对深度布局模型）`tree-loader.ts`（按需加载展开路径）
- 模式系统：`mode-system.ts`（copy/move/delete 模式按钮）`file-action-bar.ts`（长按抽屉操作栏）
- 目录切换：`sibling-switcher.ts`——纯 DOM 弹窗，弹开时 canvas 点击/手势被 guard 拦截；出口 `initSiblingSwitcher()`（模块加载即自执行）/`isSwitcherOpen()`/`closeSwitcher()`
- 视觉效果：`char-rain.ts`（字符散落/回收）
- 引擎层：`engine/v2/` 8 文件自包含子系统 → **detail-engine.md**

## 架构规则（自 INVARIANTS §四迁入，2026-07-28）

### 动画安全（4.1）
▎ 动画开始前相关状态应处于初始态（tree-render: _activeOverlays === []）
▎ 动画结束后相关状态应回到初始态
▎ rebuildTree() 被调用时 L.isAnimating 应为 false
    例外：懒加载路径有意在动画中触发 rebuild（tree-loader 先 markAnimatingPath 再
    notify），靠 rebuildTree 入口 endOp 强清；waitForAnimUnlock 等锁最长 3s，
    超时放弃等待继续执行（是等锁放弃，不是强制释放锁）
▎ 每轮动画结束时必须调用 _resetAnimTimeline()
    ts.clear() + ts.time(0) + ts.reversed(false)

### 类型安全 Box 侧（4.2 拆分）
- Box.data 必须通过 getFileRowData() 访问，禁止 (box as any).data.xxx（白名单已清空）。
- Overlay 元数据用 (as Box & OverlayMeta) 访问，禁止 (as any)._xxx。
- 所有 _ 前缀属性只在模块内访问，跨模块读写走显式接口。

### 侧栏空间层级（4.5）
▎ 侧栏（.sidebar）是文件树的操作空间，所有文件树相关的 UI 元素必须在此空间内
▎ 弹出面板/选择器必须贴左栏对齐，不能脱离侧栏层级去做全局居中
▎ 浏览态侧栏交互禁止使用遮罩或背景变暗
▎ 操作态侧栏交互（如长按抽屉栏）允许全屏遮罩作为功能守卫
▎ 左栏的视觉语言：毛玻璃暗色底 + 紫色/青色边框 + 绿底光标

### 文件树变体面板（4.6）
▎ 当需要加一个"文件树的变体"（如只显示目录、只显示某类型）
   — 不创建新的手势/渲染/交互管线
▎ 原 pushContext/popContext 原子化切换机制已随死代码批次二删除（2026-07-29，
   生前零调用方）；现存参照：根目录切换由 sibling-switcher 直接清 KFMState 实现
▎ 适合场景：侧栏根目录选择器、右栏卡片堆内的文件子集面板
▎ 不适合场景：完全不同的交互模型（如拖拽排序）

## #陷阱

1. **`buildTree` 数据源**：内部只读 `KFMState.files`（tree-model 全程不写状态，
   无「修改后恢复」义务——旧陷阱表述已随只读化失效）。
2. **`setExpanded` 连续调用**：触发多次 notify，动画守卫丢弃中间状态
   （完整版见 ../client-shell/contract.md #陷阱 8）。
3. **Canvas 初始化 `clientWidth=0`**：必须在 rAF 回调里 `rebuildTree()`。
4. **overlay 残留**：`rebuildTree` 入口已加防御性清理 `removeAllOverlays()` +
   `renderer.setOverlayRoot(null)`（v6.6.0 根解）——新路径触发 rebuild 不得绕过此入口。
5. **方向锁**：12px 死区后扇形分区——右侧 ±65° 扇形（`absDy < absDx × 2.14`）判水平、
   其余竖向；纯竖向（`dx<5px`）`dy>12px` 提前解锁（canvas-scroll onMove）。
   tree-swipe 轴向判定另用 10px 死区 + `|dx|>|dy|` 比较。
6. **行变暗**：`_dimmedPaths` + `_dimmedBoxes` + `opacity` 即时生效。
7. **Canvas 尺寸数据源必须随渲染器上下文**：优先 `L.renderer?.canvas ?? DOM.treeCanvas`；
   硬编码 `DOM.treeCanvas` 意味着代码只在主树上下文正确。案例：B.A.R. #007
   （6 处硬编码修复，光标偏移/越界）。
8. **禁止给 overlay 加 `overflow` 补丁**：字符雨被裁剪的根解是建在独立 charLayer 上，
   不是给 overlay 加 overflow: visible（INVARIANTS §五补丁模式迁入）。

## 素材考古（原文已随 archive 注销，`git show v8.1.1:docs/archive/design/…` 可挖）

- `ENGINE_ARCHITECTURE.md`：v2 逐帧渲染/双树/边框渐变/Flex 四遍布局/Pretext 管线细节。
- `BOX_LOCATION_MAP_SPEC.md`：path→Box→像素坐标映射接口与重建时机。
- `WORKBENCH_PHASE1.md`：右滑回弹双树 overlay 方案 + GSAP 参数。
- `WORKBENCH_PHASE7.md`：长按手势时序 + 抽屉栏 z-index/动画/关闭条件。
- `ANIMATION_REFINEMENT_PLAN.md`：多层展开瀑布时序（0.06s/层）+ 点击三规则。

## 文件清单

`tree-render.ts` `tree-overlay.ts` `tree-animation.ts` `tree-swipe.ts` `tree-model.ts`
`tree-loader.ts` `canvas-cursor.ts` `liquid-geometry.ts` `canvas-scroll.ts` `canvas-utils.ts`
`style-registry.ts` `theme.ts` `color-utils.ts` `sibling-switcher.ts` `mode-system.ts`
`file-action-bar.ts` `char-rain.ts`
引擎层：`engine/v2/`（8 文件）→ detail-engine.md
