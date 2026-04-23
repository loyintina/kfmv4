# KFM v4 LeaferJS + Pretext + GSAP 重构计划

> 目标：保持现有视觉风格，用 LeaferJS 替换 DOM 渲染，用 Pretext 优化文本测量，用 GSAP 驱动动画，实现设计工具级别的文件树交互体验。

---

## 技术栈

| 技术 | 作用 | 参考文档 |
|------|------|----------|
| **LeaferJS** | Canvas 渲染引擎 | https://leaferjs.com/docs |
| **Pretext** | 无 DOM 文本测量 | https://github.com/chenglou/pretext |
| **GSAP** | 动画引擎 | https://gsap.com/docs |

### 技术分工

```
Pretext → 文本测量（宽度/高度/行数）
LeaferJS → Canvas 渲染（节点/连线/光标）
GSAP → 动画控制（入场/交互/状态切换）
```

---

## Phase 1：基础渲染层（已完成 Demo）

**目标**：建立 Leafer + Pretext + GSAP 基础架构，渲染原型验证。

### 已完成

- [x] 安装依赖：`npm install leafer-ui @chenglou/pretext gsap`
- [x] 创建 `tree-text.ts` — Pretext 文本测量封装
- [x] 创建 `tree-leafer.ts` — Leafer 渲染器基础类
- [x] 创建 Demo 页面验证技术可行性

### Demo 效果

| 功能 | 实现 | 技术 |
|------|------|------|
| 节点渲染 | Canvas 矩形 + 文字 | Leafer Rect/Text |
| 左粗边框 | 3px 左侧线 | Leafer Line |
| 层级连线 | L 形连线 | Leafer Line |
| 光标高亮 | 透明边框矩形 | Leafer Rect + GSAP |
| 入场动画 | 左侧滑入 + 延迟 | GSAP Timeline |
| hover 效果 | 背景变亮 | GSAP to |
| 选中效果 | 边框变色 + 光标移动 | GSAP power2.out |
| 文本测量 | 自然宽度计算 | Pretext |

### 问题

Demo 简陋，缺少：
- 滚动容器
- 真实文件数据
- 目录展开/收起
- 完整交互逻辑

---

## Phase 2：完整文件树迁移

**目标**：用 Leafer 渲染完整文件树，保持现有外观和交互。

### 任务清单

#### 2.1 数据层适配
```typescript
// tree-data.ts
export interface TreeNode {
  name: string
  path: string
  isDir: boolean
  level: number
  expanded: boolean
  children?: TreeNode[]
  parent?: TreeNode
}

// 现有 tree.ts 数据格式 → Leafer 格式转换
export function convertToLeaferFormat(items: any[]): TreeNode[]
```

#### 2.2 虚拟化渲染
```typescript
// tree-virtual.ts
class VirtualTreeRenderer {
  private visibleStart = 0
  private visibleEnd = 20
  private bufferSize = 5
  
  // Pretext 预计算所有节点高度
  calculateAllHeights(nodes: TreeNode[]): number[]
  
  // 只渲染可视区域 + 缓冲区
  renderVisibleNodes(scrollY: number): void
  
  // 滚动时动态增删节点
  onScroll(y: number): void
}
```

#### 2.3 滚动容器
```typescript
// 用 Leafer 的视口滚动或保持现有 sidebar-content 滚动
// 方案：Leafer 容器固定高度，内部 Group 位移模拟滚动

const contentGroup = new Group({
  y: -scrollY  // GSAP 动画滚动位置
})

// 滚动动画
gsap.to(contentGroup, {
  y: -targetY,
  duration: 0.3,
  ease: 'power2.out'
})
```

#### 2.4 样式完全复刻

| 现有样式 | Leafer 实现 |
|----------|-------------|
| `.tree-item` | Leafer Group |
| `border-left: 3px solid rgba(124,58,237,.3)` | Leafer Line (3px) |
| `border: 1px solid ...` | Leafer Rect stroke |
| `background: rgba(10,10,15,.6)` | Leafer Rect fill |
| `border-radius: 6px` | Leafer cornerRadius |
| 选中态边框发光 | GSAP stroke 动画 |
| 光标围框 | Leafer Rect + GSAP |

#### 2.5 交互复刻

```typescript
// 点击选中
grp.on('pointer.tap', () => {
  // 取消旧选中
  if (selectedIdx >= 0) {
    gsap.to(old.bg, { fill: C.nodeBg, duration: 0.2 })
    gsap.to(old.border, { stroke: C.border, duration: 0.2 })
  }
  
  // 新选中
  selectedIdx = index
  gsap.to(node.bg, { fill: C.nodeSelected, duration: 0.2 })
  gsap.to(node.border, { stroke: C.borderSelected, duration: 0.2 })
  
  // 光标移动 — 保持现有平滑效果
  gsap.to(cursorRect, {
    y: node.y,
    opacity: 0.7,
    duration: 0.3,
    ease: 'power2.out',
  })
  
  // 触发原有回调
  onNodeClick?.(node.data.path, node.data.isDir)
})

// 长按展开/收起（复用现有 gestures.ts）
// 只是触发时机改为 Leafer 事件
```

#### 2.6 光标跟随滚动

```typescript
// 复用现有 ui.ts 的 updateCursorHighlight 逻辑
// 但改为控制 Leafer 光标元素

function updateCursorPosition(targetY: number) {
  gsap.to(cursorRect, {
    y: targetY,
    duration: 0.3,
    ease: 'power2.out',
  })
}
```

### 验证标准

- [ ] 外观与现有 DOM 版本完全一致
- [ ] 滚动流畅 60fps
- [ ] 点击/长按交互正常
- [ ] 光标跟随正常
- [ ] 1000 节点不卡顿

### 预计时间

3-4 天

---

## Phase 3：GSAP 动画增强

**目标**：用 GSAP 实现超越现有 CSS 动画的效果。

### 3.1 目录展开动画

```typescript
// tree-animations.ts
import gsap from 'gsap'

export function expandDirectory(
  parentNode: LeaferNode,
  children: LeaferNode[],
  onComplete?: () => void
) {
  const tl = gsap.timeline({ onComplete })
  
  // 父节点轻微放大
  tl.to(parentNode.group, {
    scale: 1.02,
    duration: 0.1,
    ease: 'power2.out',
  })
  
  // 子节点从父节点位置弹性弹出
  children.forEach((child, i) => {
    child.group.y = parentNode.y
    child.group.scale = 0.8
    child.group.opacity = 0
    
    tl.to(child.group, {
      y: parentNode.y + (i + 1) * NODE_HEIGHT,
      scale: 1,
      opacity: 1,
      duration: 0.3,
      ease: 'elastic.out(1, 0.75)',
    }, i * 0.05)
  })
  
  // 父节点恢复
  tl.to(parentNode.group, {
    scale: 1,
    duration: 0.2,
  }, '-=0.2')
}

export function collapseDirectory(
  parentNode: LeaferNode,
  children: LeaferNode[],
  onComplete?: () => void
) {
  const tl = gsap.timeline({ onComplete })
  
  // 子节点收缩到父节点
  children.forEach((child, i) => {
    tl.to(child.group, {
      y: parentNode.y,
      scale: 0.8,
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
    }, i * 0.02)
  })
}
```

### 3.2 光标移动轨迹

```typescript
// 光标移动时留下渐隐轨迹
export function createCursorTrail(
  fromY: number,
  toY: number,
  container: Group
) {
  const trail = new Rect({
    y: fromY,
    height: Math.abs(toY - fromY),
    width: cursorRect.width,
    fill: 'rgba(0,212,255,0.1)',
    opacity: 0.5,
  })
  container.add(trail)
  
  // 渐隐消失
  gsap.to(trail, {
    opacity: 0,
    duration: 0.5,
    ease: 'power2.out',
    onComplete: () => trail.remove(),
  })
}
```

### 3.3 节点状态动画

```typescript
// Hover 发光
export function hoverNode(node: LeaferNode, isHover: boolean) {
  gsap.to(node.bg, {
    fill: isHover ? C.nodeHover : C.nodeBg,
    duration: 0.15,
  })
  
  // 边框发光效果
  gsap.to(node.border, {
    stroke: isHover ? 'rgba(124,58,237,0.5)' : C.border,
    duration: 0.15,
  })
}

// Press 按下效果
export function pressNode(node: LeaferNode, isPressed: boolean) {
  gsap.to(node.group, {
    scale: isPressed ? 0.98 : 1,
    duration: 0.1,
    ease: 'power2.out',
  })
}

// Selected 脉冲
export function pulseSelected(node: LeaferNode) {
  gsap.to(node.border, {
    stroke: C.borderSelected,
    strokeWidth: 2,
    duration: 0.2,
    yoyo: true,
    repeat: 1,
  })
}
```

### 3.4 名称盒子宽度动画（Pretext + GSAP）

```typescript
// 用 Pretext 计算目标宽度，GSAP 动画宽度
export function animateNameBox(
  box: Rect,
  text: string,
  targetWidth: number
) {
  // Pretext 计算文本宽度
  const prepared = prepareWithSegments(text, FONT)
  const textWidth = measureNaturalWidth(prepared)
  const finalWidth = Math.min(textWidth + PADDING * 2, targetWidth)
  
  // GSAP 动画宽度
  gsap.to(box, {
    width: finalWidth,
    duration: 0.2,
    ease: 'power2.out',
  })
}
```

### 3.5 滚动平滑动画

```typescript
// 点击滚动居中
export function scrollToNode(
  contentGroup: Group,
  nodeY: number,
  containerHeight: number
) {
  const targetY = nodeY - containerHeight / 2 + NODE_HEIGHT / 2
  
  gsap.to(contentGroup, {
    y: -targetY,
    duration: 0.4,
    ease: 'power2.inOut',
  })
}
```

### 验证标准

- [ ] 展开动画弹性自然
- [ ] 光标轨迹可见但不干扰
- [ ] hover/press 反馈即时
- [ ] 名称盒子动画流畅
- [ ] 滚动动画平滑

### 预计时间

2-3 天

---

## Phase 4：连线可视化层

**目标**：添加目录连线，增强层级关系可视化。

### 4.1 基础连线

```typescript
// tree-connectors.ts
import { Line } from 'leafer-ui'
import gsap from 'gsap'

export function createConnector(
  parent: LeaferNode,
  child: LeaferNode,
  container: Group
): Line {
  const line = new Line({
    points: [
      parent.x + INDENT, parent.y + NODE_HEIGHT / 2,
      child.x + INDENT / 2, child.y + NODE_HEIGHT / 2,
      child.x, child.y + NODE_HEIGHT / 2,
    ],
    stroke: C.border,
    strokeWidth: 1,
    opacity: 0.3,
  })
  container.add(line)
  return line
}

// 连线入场动画
export function animateConnectorIn(line: Line) {
  line.strokeDasharray = [100, 100]
  line.strokeDashoffset = 100
  
  gsap.to(line, {
    strokeDashoffset: 0,
    opacity: 0.3,
    duration: 0.4,
    ease: 'power2.out',
  })
}
```

### 4.2 流动粒子

```typescript
// 连线上的流动粒子
export function createFlowParticle(
  line line: Line,
  container: Group
) {
  const particle = new Ellipse({
    width: 4,
    height: 4,
    fill: C.borderSelected,
  })
  container.add(particle)
  
  // 沿路径移动
  const pathLength = line.getPathLength()
  
  gsap.to(particle, {
    motionPath: {
      path: line.points,
      align: line.points,
      alignOrigin: [0.5, 0.5],
    },
    duration: 2,
    repeat: -1,
    ease: 'none',
  })
}
```

### 4.3 连线高亮

```typescript
// Hover 节点时高亮相关连线
export function highlightConnectors(
  node: LeaferNode,
  lines: Line[],
  isHighlight: boolean
) {
  lines.forEach(line => {
    gsap.to(line, {
      stroke: isHighlight ? C.borderSelected : C.border,
      opacity: isHighlight ? 0.7 : 0.3,
      strokeWidth: isHighlight ? 1.5 : 1,
      duration: 0.2,
    })
  })
}
```

### 4.4 搜索连线

```typescript
// 搜索匹配节点连线
export function createSearchConnections(
  matchedNodes: LeaferNode[],
  container: Group
): Line[] {
  const lines: Line[] = []
  
  for (let i = 0; i < matchedNodes.length - 1; i++) {
    const line = new Line({
      points: [
        matchedNodes[i].x + matchedNodes[i].width / 2,
        matchedNodes[i].y + NODE_HEIGHT / 2,
        matchedNodes[i + 1].x + matchedNodes[i + 1].width / 2,
        matchedNodes[i + 1].y + NODE_HEIGHT / 2,
      ],
      stroke: C.borderSelected,
      strokeWidth: 1,
      opacity: 0,
    })
    container.add(line)
    lines.push(line)
    
    // 入场动画
    gsap.to(line, {
      opacity: 0.5,
      duration: 0.3,
      delay: i * 0.1,
    })
  }
  
  return lines
}
```

### 验证标准

- [ ] 连线不遮挡节点内容
- [ ] 粒子流动流畅
- [ ] 高亮效果明显
- [ ] 搜索连线形成星座图
- [ ] 性能影响 < 5% CPU

### 预计时间

2-3 天

---

## Phase 5：高级功能层

**目标**：实现设计工具级别的编辑功能。

### 5.1 缩略图预览

```typescript
// 图片文件显示缩略图
import { Image } from 'leafer-ui'

export async function loadThumbnail(
  path: string,
  size: number
): Promise<Image> {
  const img = new Image({
    url: `/thumb?path=${encodeURIComponent(path)}&size=${size}`,
    width: size,
    height: size,
    cornerRadius: 4,
  })
  
  // 加载动画
  img.opacity = 0
  gsap.to(img, { opacity: 1, duration: 0.3 })
  
  return img
}
```

### 5.2 拖拽重构

```typescript
// 节点拖拽
import { DragEvent } from 'leafer-ui'

export function enableDrag(
  node: LeaferNode,
  onDragEnd: (from: string, to: string) => void
) {
  node.group.draggable = true
  
  node.group.on(DragEvent.START, () => {
    // 放大 + 发光
    gsap.to(node.group, {
      scale: 1.05,
      shadow: '0 4px 20px rgba(124,58,237,0.3)',
      duration: 0.2,
    })
  })
  
  node.group.on(DragEvent.END, (e) => {
    // 恢复原状
    gsap.to(node.group, {
      scale: 1,
      shadow: 'none',
      duration: 0.2,
    })
    
    // 计算放置位置
    onDragEnd(node.data.path, calculateDropTarget(e))
  })
}
```

### 5.3 多选框选

```typescript
// 拖拽矩形框选
export function createSelectionBox(
  startX: number,
  startY: number,
  container: Group
): Rect {
  const box = new Rect({
    x: startX,
    y: startY,
    width: 0,
    height: 0,
    fill: 'rgba(124,58,237,0.1)',
    stroke: C.borderSelected,
    strokeWidth: 1,
  })
  container.add(box)
  return box
}

// 更新框选范围
export function updateSelectionBox(
  box: Rect,
  currentX: number,
  currentY: number
) {
  gsap.to(box, {
    width: currentX - box.x,
    height: currentY - box.y,
    duration: 0.05,
  })
}
```

### 5.4 层级视觉

```typescript
// 层级透视效果
export function applyDepthVisual(
  node: LeaferNode,
  level: number
) {
  const scale = Math.pow(0.95, level)
  const opacity = 1 - level * 0.05
  
  gsap.to(node.group, {
    scale: scale,
    opacity: opacity,
    duration: 0.3,
  })
}
```

### 5.5 状态动画

```typescript
// Loading 旋转
export function showLoading(node: LeaferNode) {
  const spinner = new Ellipse({
    width: 16,
    height: 16,
    stroke: C.borderSelected,
    strokeWidth: 2,
    fill: 'transparent',
  })
  node.group.add(spinner)
  
  gsap.to(spinner, {
    rotation: 360,
    duration: 1,
    repeat: -1,
    ease: 'none',
  })
}

// Error 红色脉冲
export function showError(node: LeaferNode) {
  gsap.to(node.bg, {
    fill: 'rgba(255,71,117,0.2)',
    stroke: '#ff4775',
    duration: 0.2,
    yoyo: true,
    repeat: 3,
  })
}

// Success 绿色光晕
export function showSuccess(node: LeaferNode) {
  const glow = new Rect({
    width: node.width + 10,
    height: node.height + 10,
    fill: 'rgba(46,213,163,0.3)',
    cornerRadius: 8,
  })
  node.group.add(glow)
  
  gsap.fromTo(glow, 
    { scale: 0.8, opacity: 0 },
    { scale: 1.2, opacity: 1, duration: 0.3, yoyo: true, repeat: 1 }
  )
}
```

### 验证标准

- [ ] 缩略图清晰加载
- [ ] 拖拽手感自然
- [ ] 多选操作准确
- [ ] 层级视觉明显
- [ ] 状态动画响应灵敏

### 预计时间

3-4 天

---

## Phase 6：性能优化层

**目标**：处理极端场景，确保海量文件流畅。

### 6.1 虚拟化渲染

```typescript
// 只渲染可视区域
class VirtualRenderer {
  private itemHeight = NODE_HEIGHT + NODE_GAP
  private visibleCount = 0
  private bufferSize = 5
  
  calculateVisibleRange(scrollY: number, containerHeight: number) {
    const startIdx = Math.max(0, Math.floor(scrollY / this.itemHeight) - this.bufferSize)
    const endIdx = Math.min(
      totalCount,
      Math.ceil((scrollY + containerHeight) / this.itemHeight) + this.bufferSize
    )
    return { startIdx, endIdx }
  }
  
  // 增删节点
  updateVisibleNodes(newRange: { startIdx, endIdx }) {
    // 移除离开可视区的节点
    // 添加进入可视区的节点
    // GSAP 入场/退场动画
  }
}
```

### 6.2 节点池复用

```typescript
// 对象池避免频繁创建销毁
class NodePool {
  private pool: LeaferNode[] = []
  private inUse = new Set<LeaferNode>()
  
  acquire(): LeaferNode {
    if (this.pool.length > 0) {
      const node = this.pool.pop()!
      this.inUse.add(node)
      return node
    }
    return createNewNode()
  }
  
  release(node: LeaferNode) {
    this.inUse.delete(node)
    // 重置状态
    node.group.scale = 1
    node.group.opacity = 1
    this.pool.push(node)
  }
}
```

### 6.3 分层渲染

```typescript
// 不同更新频率分层
const layers = {
  static: new Group(),    // 不变化的节点
  dynamic: new Group(),   // 动画中的节点
  overlay: new Group(),   // hover/selected 高亮
}

// 节点状态变化时切换层级
function moveToLayer(node: LeaferNode, layer: Group) {
  node.group.remove()
  layer.add(node.group)
}
```

### 6.4 Pretext 缓存

```typescript
// 文本测量结果缓存
const textMeasureCache = new Map<string, TextMeasure>()

export function measureTextCached(text: string, maxWidth: number): TextMeasure {
  const key = `${text}_${maxWidth}`
  if (textMeasureCache.has(key)) {
    return textMeasureCache.get(key)!
  }
  const result = measureText(text, maxWidth)
  textMeasureCache.set(key, result)
  return result
}
```

### 验证标准

- [ ] 1000+ 文件滚动 60fps
- [ ] 展开大目录 < 100ms
- [ ] 内存占用 < 500MB
- [ ] 无 DOM reflow

### 预计时间

2-3 天

---

## 文件结构

```
src/client/modules/
├── tree.ts              # 保留（数据层）
├── tree-data.ts         # 新增（数据转换）
├── tree-text.ts         # 新增（Pretext 封装）
├── tree-leafer.ts       # 新增（Leafer 渲染器）
├── tree-virtual.ts       # 新增（虚拟化）
├── tree-animations.ts    # 新增（GSAP 动画）
├── tree-connectors.ts    # 新增（连线系统）
├── tree-editor.ts        # 新增（编辑功能）
├── ui.ts                 # 修改（光标控制适配 Leafer）
├── gestures.ts           # 保留（手势逻辑）
├── orb.ts                # 保留（光球面板）
└── ...
```

---

## 依赖安装

```bash
npm install leafer-ui @chenglou/pretext gsap
```

---

## 时间估算

| Phase | 内容 | 时间 | 优先级 |
|-------|------|------|--------|
| **Phase 1** | 基础架构 + Demo | ✅ 完成 | ⭐⭐⭐⭐⭐ |
| **Phase 2** | 完整文件树迁移 | 3-4天 | ⭐⭐⭐⭐⭐ |
| **Phase 3** | GSAP 动画增强 | 2-3天 | ⭐⭐⭐⭐ |
| **Phase 4** | 连线可视化 | 2-3天 | ⭐⭐⭐ |
| **Phase 5** | 高级功能 | 3-4天 | ⭐⭐ |
| **Phase 6** | 性能优化 | 2-3天 | ⭐ |

**总计**：约 12-17 天

---

## 当前状态

```yaml
版本: v4.4.0-stable-cursor-animation
Git HEAD: be893c6
已完成: Phase 1 Demo
进行中: Phase 2 完整文件树迁移
下一步: 开始 Phase 2 任务 2.1
```

---

## 参考文档

| 技术 | 文档地址 | 关键 API |
|------|----------|----------|
| LeaferJS | https://leaferjs.com/docs | Rect, Text, Group, Line, Image, animate |
| Pretext | https://github.com/chenglou/pretext | prepare, layout, measureNaturalWidth |
| GSAP | https://gsap.com/docs | gsap.to, gsap.timeline, ease |

---

> 计划文档 v3.0
> 更新时间：2026-04-23 16:35
> 维护者：蔚然
> 技术栈：LeaferJS + Pretext + GSAP
