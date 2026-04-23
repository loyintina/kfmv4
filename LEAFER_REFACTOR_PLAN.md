# KFM v4 LeaferJS + Pretext 重构计划

> 目标：保持现有视觉风格，用 LeaferJS 替换 DOM 渲染，用 Pretext 优化文本测量，实现设计工具级别的文件树交互体验。

---

## 技术栈

```yaml
渲染引擎: LeaferJS
  - Canvas 2D 高性能渲染
  - 70KB min+gzip，零依赖
  - 支持动画、交互、连线、编辑器功能
  - 性能：100万元素流畅操作

文本测量: Pretext
  - 纯 JS 文本测量，无 DOM reflow
  - 45,100 星 GitHub 项目
  - 支持多语言、手动布局、富文本 inline
  - 与 Leafer 完美配合：计算 + 渲染分离
```

---

## 核心原则

```yaml
风格不变:
  - 紫色主色调保持 (#7c3aed)
  - 左侧加粗边框风格保持
  - 网格背景保持
  - 光球面板交互保持
  - 光标高亮围框保持

渐进重构:
  - 不一次性推翻现有代码
  - 每个阶段可独立验证
  - 出问题可快速回退

性能优先:
  - 先解决性能瓶颈（滚动/渲染）
  - 后添加视觉效果（动画/连线）
  - Pretext 负责文本测量（无 DOM）
  - Leafer 负责渲染（Canvas）
```

---

## Phase 1：基础渲染层

**目标**：引入 LeaferJS + Pretext，建立渲染框架。

### 任务清单

1. **安装依赖**
   ```bash
   npm install leafer-ui @chenglou/pretext
   ```

2. **创建渲染模块**
   ```
   src/client/modules/
   ├── tree-leafer.ts    # Leafer 文件树渲染
   ├── tree-text.ts      # Pretext 文本测量封装
   ├── tree-layout.ts    # 虚拟化布局计算
   ```

3. **Pretext 文本测量封装**
   ```ts
   // tree-text.ts
   import { prepare, layout, measureNaturalWidth } from '@chenglou/pretext'

   export function measureTextHeight(text: string, width: number, font: string, lineHeight: number) {
     const prepared = prepare(text, font)
     return layout(prepared, width, lineHeight).height
   }

   export function measureTextWidth(text: string, font: string) {
     const prepared = prepareWithSegments(text, font)
     return measureNaturalWidth(prepared)
   }
   ```

4. **Leafer 容器创建**
   - 在 `.sidebar-content` 内创建 Leafer Canvas
   - 设置 `view: container` 绑定侧栏
   - 配置交互事件映射

5. **节点渲染原型**
   - 单个文件节点：Rect + Text 组合
   - 左粗边框样式复用现有 CSS 颜色
   - 选中态高亮边框

### 验证标准

- Leafer Canvas 正常显示
- Pretext 文本测量结果准确
- 单节点渲染外观与现有一致
- 性能：测量100个文件名 < 50ms

### 预计时间

1-2 天

---

## Phase 2：文件树迁移

**目标**：用 Leafer 渲染完整文件树，保持现有外观。

### 任务清单

1. **节点批量渲染**
   - 读取文件树数据
   - Pretext 预计算所有节点高度
   - Leafer 批量创建元素
   - 保持现有样式：
     - 左侧加粗边框 `rgba(124,58,237,.3)`
     - 选中态 `rgba(0,212,255,.7)`
     - 文字颜色 `#e0e0e0`

2. **滚动适配**
   - Leafer 自带视口滚动
   - 或保持现有 `.sidebar-content` 滚动
   - Leafer 只渲染可视区域 + 缓冲区

3. **交互映射**
   - Leafer pointer 事件 → 现有 click/touch 逻辑
   - Leafer draggable → 现有拖拽
   - 光标选中逻辑复用

4. **光标高亮**
   - Leafer 创建光标高亮层
   - 保持现有动画效果
   - 与滚动约束逻辑配合

### 验证标准

- 文件树外观与现在完全一致
- 滚动流畅（60fps）
- 点击/选择功能正常
- 光标跟随正常
- 光球面板交互不受影响

### 性能对比

| 指标 | 现在的 DOM | Leafer Canvas |
|------|-----------|---------------|
| 100节点渲染 | ~200ms | ~30ms |
| 滚动帧率 | 30-40fps | 60fps |
| 内存占用 | 每节点DOM | 单Canvas |
| 文本测量 | DOM reflow | Pretext纯计算 |

### 预计时间

2-3 天

---

## Phase 3：动画增强层

**目标**：利用 Leafer 动画系统，实现流畅的视觉效果。

### 任务清单

1. **目录展开动画**
   - 子节点从父节点位置弹性展开
   - Leafer `animate` + `spring` 缓动
   - 带延迟的瀑布式动画
   - 收起时反向收缩

2. **光标移动轨迹**
   - 光标切换时留下渐隐轨迹线
   - Leafer `Path` + 动画循环
   - 轨迹带发光效果

3. **节点状态动画**
   - hover: 发光边框
   - press: 缩小 + 颜色加深
   - selected: 持续高亮

4. **叠叠乐动画优化**
   - Leafer `Group` 管理节点组
   - 物理弹簧效果

5. **名称盒子动画**
   - Pretext 计算目标宽度（无 DOM）
   - Leafer 动画宽度变化

### 验证标准

- 展开/收起动画流畅（60fps）
- 光标轨迹视觉效果优雅
- 状态动画响应灵敏
- 名称盒子无闪烁

### 预计时间

1-2 天

---

## Phase 4：连线可视化层

**目标**：添加目录连线，增强层级关系可视化。

### 任务清单

1. **基础连线**
   - 父节点到子节点的直线连线
   - Leafer `Line` 元素
   - 颜色同边框 `rgba(124,58,237,.3)`
   - 宽度 1px

2. **流动粒子**
   - 连线上添加流动小点
   - Leafer `Circle` + 动画循环
   - 粒子从父节点流向子节点
   - 频率可调节（1-2秒一个）

3. **连线高亮**
   - hover 节点时相关连线高亮
   - 高亮颜色 `rgba(0,212,255,.7)`
   - 高亮时粒子加速流动

4. **搜索连线**
   - 搜索匹配时连线连接所有匹配节点
   - 形成星座图式可视化

### 验证标准

- 连线不遮挡节点内容
- 粒子流动流畅
- 高亮效果明显
- 性能影响可控（<5% CPU）

### 预计时间

1-2 天

---

## Phase 5：高级功能层

**目标**：实现设计工具级别的编辑功能。

### 任务清单

1. **缩略图预览**
   - 图片文件显示 Leafer `Image` 缩略图
   - 缩略图尺寸 32x32 或自适应

2. **拖拽重构**
   - 拖起节点放大 + 发光
   - 移动路径带轨迹
   - 放下目标位置预览虚影
   - 调用 API 实际移动文件

3. **多选框选**
   - Leafer 拖拽矩形框选
   - 框选时节点被圈起
   - 支持批量操作

4. **层级视觉**
   - 第 N 层节点大小 = baseSize * 0.9^N
   - 第 N 层背景透明度 = 0.3 * 0.8^N
   - 形成透视深度感

5. **状态动画**
   - loading: Leafer 旋转圆圈
   - error: 红色脉冲
   - success: 绿色光晕一闪

### 验证标准

- 缩略图清晰且不影响性能
- 拖拽手感自然
- 多选操作准确
- 层级视觉明显
- 状态动画响应灵敏

### 预计时间

2-3 天

---

## Phase 6：性能优化层

**目标**：处理极端场景，确保海量文件流畅。

### 任务清单

1. **虚拟渲染**
   - Pretext 预计算所有节点高度
   - 只渲染可视区域 + 缓冲区节点
   - 滚动时动态加载/卸载 Leafer 元素

2. **分层渲染**
   - 静态层：未变化的节点
   - 动态层：动画中的节点
   - 交互层：hover/selected 节点
   - Leafer 分层配置

3. **节点缓存**
   - 已渲染节点缓存为图像
   - 减少重复绘制

4. **Web Worker**
   - Pretext 支持主线程计算
   - Leafer 支持 Web Worker 渲染
   - 解放主线程

### 性能目标

| 场景 | 目标 |
|------|------|
| 1000+ 文件滚动 | 60fps |
| 展开大目录 | <100ms |
| 内存占用 | <500MB |
| 文本测量100项 | <50ms |

### 验证标准

- 1000+ 文件滚动流畅
- 展开大目录无卡顿
- 内存占用可控
- 无 DOM reflow

### 预计时间

1-2 天

---

## 技术架构

### 文件结构

```
src/client/modules/
├── tree.ts          → 保留（数据层）
├── tree-leafer.ts   → 新增（Leafer渲染层）
├── tree-text.ts     → 新增（Pretext文本测量）
├── tree-layout.ts   → 新增（虚拟化布局）
├── tree-animations.ts → 新增（动画定义）
├── tree-connectors.ts → 新增（连线系统）
├── tree-editor.ts   → 新增（编辑功能）
├── ui.ts            → 保留（光标逻辑）
├── orb.ts           → 保留（光球面板）
└── gestures.ts      → 保留（手势）
```

### 渲染流程

```
数据层 (tree.ts)
    ↓ 提供文件数据
文本测量 (tree-text.ts / Pretext)
    ↓ 计算文本宽度/高度
布局层 (tree-layout.ts)
    ↓ 计算节点位置（虚拟化）
渲染层 (tree-leafer.ts / Leafer)
    ↓ 渲染 Canvas 元素
动画层 (tree-animations.ts)
    ↓ 添加动画效果
连线层 (tree-connectors.ts)
    ↓ 绘制连线
交互层 (gestures.ts)
    ↓ 处理用户输入
```

### 样式映射

```css
/* Leafer 元素样式映射 */
Leafer Rect {
  fill: rgba(18,18,26,.85)  → 对应 var(--surface)
  stroke: rgba(124,58,237,.3) → 对应 border-left 颜色
  strokeWidth: { left: 3, others: 1 }
}

Leafer Text {
  fill: #e0e0e0 → 对应 var(--text)
  fontSize: 12px
  fontFamily: -apple-system, sans-serif
}

/* Pretext 字体配置 */
prepare(text, '12px -apple-system, sans-serif')
layout(prepared, treeWidth, 24)
```

---

## 依赖安装

```bash
npm install leafer-ui @chenglou/pretext
```

---

## 时间估算

| Phase | 预计时间 | 优先级 |
|-------|---------|--------|
| Phase 1 | 1-2天 | ⭐⭐⭐⭐⭐ |
| Phase 2 | 2-3天 | ⭐⭐⭐⭐⭐ |
| Phase 3 | 1-2天 | ⭐⭐⭐⭐ |
| Phase 4 | 1-2天 | ⭐⭐⭐ |
| Phase 5 | 2-3天 | ⭐⭐ |
| Phase 6 | 1-2天 | ⭐ |

总计：约 8-14 天（按实际进度调整）

---

## 当前状态

```yaml
版本: v4.4.0-stable-cursor-animation
Git HEAD: 20f9093
依赖: leafer-ui, @chenglou/pretext (待安装)
下一步: Phase 1 任务 1 - npm install
```

---

## 决策点

洛需要在以下节点做出选择：

1. **Phase 1 完成后**：渲染原型是否满意？继续 Phase 2？
2. **Phase 2 完成后**：文件树外观是否一致？继续动画？
3. **Phase 3 完成后**：动画效果是否足够炫？继续连线？
4. **Phase 4 完成后**：连线效果是否满意？继续高级功能？
5. **Phase 5 完成后**：编辑功能是否需要？继续性能优化？

每个 Phase 都是独立可交付的版本。

---

> 计划文档 v2.0
> 更新时间：2026-04-23 15:32
> 维护者：蔚然
> 技术栈：LeaferJS + Pretext
