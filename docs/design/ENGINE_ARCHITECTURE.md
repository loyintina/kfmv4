# KFM v4 — 引擎层架构

> **状态**：v1.0（2026-06-09）
>
> 本文记录 KFM v4 自研 Canvas 渲染引擎的两大子系统：v2 渲染管线和 text-layout 文本排版。
> 改渲染逻辑前先读本文。

---

## 一、整体结构

```
public/index.html
       │
src/client/main.ts ← 入口
       │
       ├── modules/         ← 29 个业务模块（tree-render, orb, floating-card...）
       │       │                     依赖引擎层但不依赖引擎层内部结构
       │       ▼
       └── engine/          ← 渲染引擎（14 个文件，零外部依赖）
               │
               ├── v2/              Canvas 渲染管线（8 文件）
               │   ├── types.ts     所有类型定义（单一事实来源）
               │   ├── box.ts       节点类型「万物皆盒」
               │   ├── renderer.ts  渲染主循环
               │   ├── flex.ts      Flex 布局算法
               │   ├── BorderDrawer.ts  四边独立控制边框
               │   ├── StyleConfig.ts   边框预设配置
               │   ├── animation.ts    缓动函数
               │   └── utils.ts        间距工具
               │
               └── text-layout/     Pretext 文本排版（6 文件）
                   ├── index.ts     便捷 API 入口
                   ├── layout.ts    分词+测量+换行 核心管线
                   ├── measurement.ts  Canvas 文本测量
                   ├── analysis.ts   CJK 分词 + kinsoku 禁则
                   ├── bidi.ts      双向文本
                   └── line-break.ts    换行算法
```

**依赖方向**：`modules/` → `engine/`（业务模块引用引擎，引擎不引用业务模块）。

---

## 二、v2 渲染管线

### 2.1 核心理念

**数据与渲染分离。** Box 只描述「是什么」——尺寸、颜色、文本、手势——不描述「怎么画」。Renderer 负责把 Box 树绘制到 Canvas。

### 2.2 文件职责

| 文件 | 行数 | 核心职责 |
|------|------|---------|
| `types.ts` | 423 | 所有类型定义：Spacing、Transform、TextStyle、GestureConfig、FlexStyle 等 |
| `box.ts` | 624 | Box 节点类：几何、变换、树操作、动画 tick、碰撞检测、序列化 |
| `renderer.ts` | 825 | 渲染主循环：tick→draw、双树渲染（主树+overlay）、input 元素管理 |
| `flex.ts` | 245 | Flex 布局：direction/justify/align/grow/gap，四遍算法 |
| `BorderDrawer.ts` | 267 | 8 段分解圆角矩形 + 宽度渐变 + 四边独立控制（emphasis/normal/hidden） |
| `StyleConfig.ts` | 155 | 边框预设（`left-emphasis-rest-hidden` 等）+ `resolveStyle()` |
| `animation.ts` | 39 | 缓动函数：linear、quad、cubic、elastic、bounce |
| `utils.ts` | 23 | `uniformSpacing()` / `hvSpacing()` / `ZERO_SPACING` |

### 2.3 渲染流程

```
renderer._render(now)
  ├── 清屏（fillRect）
  ├── _tickAndRender(root, now)     ← 主树
  │   ├── box.tickAnimations(now)   动画更新
  │   ├── _drawShadow / _drawBackground / _drawBorder / _drawHighlight
  │   ├── _drawIcon / _drawText      ← 使用 Pretext 排版
  │   ├── clip（overflow:hidden 时）
  │   ├── applyFlexLayout(box)       ← 子元素布局
  │   ├── scroll 偏移
  │   └── 递归子元素（按 zIndex 排序）
  ├── _tickAndRender(overlayRoot, now)  ← 动画树（如有）
  └── _renderCursorPost(root)           ← 光标画在所有层之上
```

### 2.4 双树渲染

主树（`_root`）和动画树（`_overlayRoot`）独立渲染，互不影响：

- 主树：文件树的稳定状态
- overlay 树：展开/折叠动画期间的克隆节点，overflow:visible 不受 clip 影响
- 光标：画在两个树之上（`_renderCursorPost`）

### 2.5 边框系统

两套边框系统并存：

1. **简化边框**（`box.border`）：`VisualBorderConfig`——基础颜色 + 宽度 + 方向
2. **KFM 高级边框**（`box.kfmStyle`）：通过 `BorderDrawer.drawBorders()` 绘制
   - 四边独立三态：`hidden` / `normal` / `emphasis`
   - 圆角处的宽度渐变（emphasis→normal 从 3px 渐变到 1px）
   - 通过 `StyleConfig.PRESETS` 选择预设：`left-emphasis-rest-hidden` 等

### 2.6 手势系统（Box 级）

Box 上的 `gesture` 属性配置手势回调（`onTap`/`onLongPress`/`onSwipeLeft` 等），这是 D-013 决策的结果——手势属性化。

**注意**：Box 级手势仅在 Renderer 的 `hitTest()` 中用于碰撞检测，实际的 PointerEvent 分发由 `modules/gesture-registry.ts` 统一管理。Box 级手势用于文件行点击等场景。

### 2.7 Flex 布局

轻量 Flexbox 子集，四遍算法：
1. 第一遍：计算子元素主轴尺寸（flexBasis/min/max）
2. 第二遍：flex-grow 分配剩余空间
3. 第三遍：justifyContent 分配主轴位置
4. 第四遍：alignItems 分配交叉轴位置

暂不支持：wrap、flex-shrink 复杂计算。

---

## 三、Text-Layout 文本排版

### 3.1 来源

从 `@chenglou/pretext`（MIT）移植，做了以下适配：
- Canvas 上下文外部注入（`setMeasureContext()`）
- 简化 emoji 校正（跳过 DOM 校准）
- 浏览器 + Node.js 双环境兼容

### 3.2 核心管线

```
prepare(text, font)               ← 一次性的分词+测量
  ├── analyzeText()               ← 分词（CJK/拉丁/空白/标点）
  ├── measureAnalysis()           ← 逐段测量宽度 + 缓存
  └── → PreparedText（不透明句柄）

layout(prepared, maxWidth, lineHeight)  ← 纯算术换行
  └── → { lineCount, height }

prepareWithSegments(text, font)   ← 带分段信息的 prepare
layoutWithLines(prepared, maxWidth, lineHeight)  ← 返回每行文本+宽度
  └── → { lineCount, height, lines[] }
```

### 3.3 文件职责

| 文件 | 行数 | 核心职责 |
|------|------|---------|
| `index.ts` | 49 | API 入口：`measureText()` / `layoutLines()` |
| `layout.ts` | 442 | 核心管线：prepare/measure/layout/walkLineRanges |
| `measurement.ts` | 226 | Canvas 文本测量 + 缓存 + emoji 校正 |
| `analysis.ts` | ~320 | CJK 分词 + kinsoku 禁则 + 空白模式 |
| `bidi.ts` | ~160 | 双向文本（阿拉伯语/希伯来语）层级别计算 |
| `line-break.ts` | ~600 | `walkPreparedLines` 换行算法 + 断词策略 |

---

## 四、关键决策记录

| 决策 | 内容 | 文件 |
|------|------|------|
| A-002 | 三层解耦（type/box/renderer） | types.ts, box.ts, renderer.ts |
| D-001 | 万物皆盒（唯一节点类型） | box.ts:8 |
| D-003 | 边框宽度渐变（8段拆解圆角） | BorderDrawer.ts:8  |
| D-013 | 手势属性化（Box.gesture） | types.ts:327, box.ts:310 |
| T-001 | 渲染器负责绘制（Box 不存渲染状态） | renderer.ts:8 |
| T-004 | 命名重构（BorderState 三态） | StyleConfig.ts:8 |
| T-005 | 模块分离（animation/utils 独立） | animation.ts:8 |

---

## 五、与业务模块的衔接

业务模块通过以下方式使用引擎层：

1. **`tree-model.ts`** — 调用 `new Box()` / `createBox()` 构造文件树，设 `gesture.onTap`、`data`、`textStyle` 等
2. **`tree-render.ts`** — 创建 `Renderer` 实例，调 `setRoot()` / `setOverlayRoot()`；`rebuildTree()` 重建 Box 树
3. **`style-registry.ts`** — 定义 Box 模板（`folder-row` / `file-row` 等）
4. **`orb.ts`** — 调 `measureText()` / `layoutLines()` 排版 AI 对话气泡
5. **其他模块** — 一般不直接使用引擎层，通过 tree-render 间接使用
