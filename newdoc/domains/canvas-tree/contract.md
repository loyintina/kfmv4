> 这是什么：Canvas 文件树——渲染、样式唯一来源、引擎层。
> 别的去哪找：手势/注册中心 → ../client-shell/；卡片堆 → ../floating-card/；引擎细节 → detail-engine.md。

# canvas-tree 域契约

## 两个「唯一来源」（硬规则）

1. **`theme.ts` = 全项目颜色唯一定义点**。导出 `currentTheme`（单例，运行时不可变）。
   新增颜色只能在这里加，禁止消费方硬编码色值；改一处全局同步。
2. **`style-registry.ts` = 文件树尺寸/字体/间距唯一定义点**。导出 `DIMENSIONS`、
   `TEXT_STYLES`、`getRowLayout()`、`createBox()`。行高/缩进/字号只能在这里改。

## 模块职责

- 渲染编排：`tree-render.ts`（Canvas 编排层）`tree-overlay.ts` `tree-animation.ts`
- 交互：`tree-swipe.ts`（文件行右滑→卡片堆）`canvas-cursor.ts`（含液体粒子，几何在 `liquid-geometry.ts`）`canvas-scroll.ts` `canvas-utils.ts`
- 数据：`tree-model.ts`（绝对深度布局模型）`tree-loader.ts`（按需加载展开路径）
- 模式系统：`mode-system.ts`（copy/move/delete 模式按钮）`file-action-bar.ts`（长按抽屉操作栏）
- 目录切换：`sibling-switcher.ts`——纯 DOM 弹窗，弹开时 canvas 点击/手势被 guard 拦截；出口 `createSiblingSwitcher()/destroySiblingSwitcher()/isSwitcherOpen()/closeSwitcher()`
- 视觉效果：`char-rain.ts`（字符散落/回收）
- 引擎层：14 文件自包含子系统 → **detail-engine.md**

## #陷阱

1. **`buildTree` 数据源**：内部读 `KFMState.files`，修改后必须恢复。
2. **`setExpanded` 连续调用**：触发多次 notify，动画守卫丢弃中间状态。
3. **Canvas 初始化 `clientWidth=0`**：必须在 rAF 回调里 `rebuildTree()`。
4. **overlay 残留**：`rebuildTree` 入口已加防御性清理 `_removeAllOverlays()` +
   `renderer.setOverlayRoot(null)`（v6.6.0 根解）——新路径触发 rebuild 不得绕过此入口。
5. **方向锁**：`dx>dy` 45° 分界（v6.8.0 简化后的唯一模型，三代补丁已删，勿回填）。
6. **行变暗**：`_dimmedPaths` + `_dimmedBoxes` + `opacity` 即时生效。

## 文件清单

`tree-render.ts` `tree-overlay.ts` `tree-animation.ts` `tree-swipe.ts` `tree-model.ts`
`tree-loader.ts` `canvas-cursor.ts` `liquid-geometry.ts` `canvas-scroll.ts` `canvas-utils.ts`
`style-registry.ts` `theme.ts` `color-utils.ts` `sibling-switcher.ts` `mode-system.ts`
`file-action-bar.ts` `char-rain.ts`
引擎层：`engine/v2/`（8 文件）+ `engine/text-layout/`（6 文件）→ detail-engine.md
