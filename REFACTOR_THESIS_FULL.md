# KFM v4 忒修斯之船重构计划（完整版）

> 在保持现有 DOM 文件树的基础上，逐步引入 LeaferJS + Pretext + GSAP

---

## 核心原则

```yaml
忒修斯之船:
  - 保持现有 DOM 树不动
  - 每次只替换一个部件
  - 每次改动后立即验证
  - 出问题可快速回退

技术分工:
  Pretext: 替换 DOM 文本测量（getBoundingClientRect）
  GSAP: 替换 CSS 动画/transition
  LeaferJS: 叠加 Canvas 效果层（连线、粒子等）
```

---

## 现有代码分析

### 关键文件

| 文件 | 行数 | 职责 |
|------|------|------|
| tree.ts | 189 | DOM 文件树渲染、点击事件、展开动画 |
| ui.ts | 410 | 光标高亮、滚动约束、名称盒子、位置计算 |
| gestures.ts | 178 | 摇杆手势、触摸交互、光标动作 |
| orb.ts | 518 | 光球面板 |
| sidebar.css | - | 树节点样式、展开动画、光标样式 |

### 现有效果清单（必须保留）

| 效果 | 位置 | 当前实现 | 替换目标 |
|------|------|----------|----------|
| 光标高亮围框 | ui.ts | DOM div + CSS transition | GSAP |
| 光标跟随滚动 | ui.ts | rAF 轮询 + CSS transition | GSAP |
| 名称盒子宽度动画 | ui.ts | Web Animation API | GSAP + Pretext |
| 目录展开叠叠乐 | tree.ts | CSS transform + setTimeout | GSAP Timeline |
| 边界触摸滚动步进 | ui.ts | touchmove + rAF | 保持 |
| 摇杆光标 | gestures.ts | touchmove + rAF | 保持 |
| 点击滚动居中 | ui.ts | scrollTo + scrollend | GSAP |
| 网格展开动画 | sidebar.css | CSS grid + keyframes | GSAP |


---

## Phase 1：Pretext 文本测量

**目标**：用 Pretext 替换 `getBoundingClientRect` 和 `offsetWidth` 测量

### 1.1 现有测量点

```typescript
// ui.ts 中的测量点：

// 1. 名称盒子宽度测量（触发 reflow）
const targetW = pathEl.offsetWidth

// 2. 光标位置测量
const rowRect = row.getBoundingClientRect()
const top = rowRect.top - containerRect.top + container.scrollTop
const left = rowRect.left - containerRect.left
const width = rowRect.width

// 3. 滚动约束测量
const cr = container.getBoundingClientRect()
const rr = row.getBoundingClientRect()
const offset = (rr.top + rr.height / 2) - (cr.top + cr.height / 2)
```

### 1.2 Pretext 替换

```typescript
// tree-text.ts - 新增
import { prepare, prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext'

const FONT = '13px -apple-system, sans-serif'

export function measureTextWidth(text: string): number {
  const prepared = prepareWithSegments(text, FONT)
  return measureNaturalWidth(prepared) + 24  // + padding
}
```

### 1.3 名称盒子修改

```typescript
// ui.ts - updateSidebarPath
// 旧：DOM 测量
pathEl.style.width = 'auto'
const targetW = pathEl.offsetWidth

// 新：Pretext 测量
import { measureTextWidth } from './tree-text'
const targetW = measureTextWidth(name || '-')
```

### 验证标准
- [ ] 名称盒子宽度动画正常
- [ ] 无 DOM reflow
- [ ] 测量耗时 < 5ms

**时间：1 天**


---

## Phase 2：GSAP 光标动画

**目标**：用 GSAP 替换光标高亮的 CSS transition

### 2.1 现有实现

```typescript
// ui.ts - cursor-highlight
const trans = 'top .3s cubic-bezier(.25,.46,.45,.94),left .3s cubic-bezier(.25,.46,.45,.94),width .3s cubic-bezier(.25,.46,.45,.94)'
cursorHighlight.style.transition = immediate ? 'none' : trans
cursorHighlight.style.top = top + 'px'
cursorHighlight.style.left = left + 'px'
cursorHighlight.style.width = width + 'px'
```

### 2.2 GSAP 替换

```typescript
// 引入 GSAP
import gsap from 'gsap'

export function updateCursorHighlight(immediate = false): void {
  // ... 计算 top, left, width ...
  
  if (immediate) {
    gsap.set(cursorHighlight, { top, left, width, opacity: 1 })
  } else {
    gsap.to(cursorHighlight, {
      top, left, width,
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out',
    })
  }
}
```

### 2.3 光标跟随同步

```typescript
// syncCursorDuringBounce
// 现有：rAF 轮询手动设置 style
// 改为：GSAP 快速更新
function sync() {
  gsap.set(cursorHighlight, { top, left, width })
}
```

### 验证标准
- [ ] 光标移动动画流畅
- [ ] 叠叠乐期间同步正常

**时间：1-2 天**


---

## Phase 3：GSAP 目录展开动画

**目标**：用 GSAP 替换叠叠乐和网格展开动画

### 3.1 现有叠叠乐

```typescript
// tree.ts
const doBounce = (el, dir, delay) => {
  setTimeout(() => {
    const offset = dir ? -10 : 10
    el.style.transition = 'transform .3s cubic-bezier(.34,1.56,.64,1)'
    el.style.transform = `translateY(${offset}px)`
    setTimeout(() => { el.style.transform = '' }, 450)
  }, delay)
}
```

### 3.2 GSAP Timeline

```typescript
// tree-animations.ts
import gsap from 'gsap'

export function animateExpand(clickedItem, siblings, isOpening) {
  const tl = gsap.timeline()
  
  // 点击项
  tl.to(clickedItem, {
    y: isOpening ? 10 : -10,
    duration: 0.15,
    ease: 'power2.out',
    yoyo: true,
    repeat: 1,
  })
  
  // 兄弟项叠叠乐
  siblings.forEach((el, i) => {
    tl.to(el, {
      y: isOpening ? -10 : 10,
      duration: 0.3,
      ease: 'elastic.out(1, 0.75)',
    }, i * 0.02)
  })
  
  return tl
}
```

### 3.3 网格展开

```typescript
// 子项入场 stagger
gsap.fromTo(children, 
  { opacity: 0, y: -10 },
  { opacity: 1, y: 0, duration: 0.2, stagger: 0.03 }
)
```

### 验证标准
- [ ] 展开动画弹性自然
- [ ] 叠叠乐同步正常
- [ ] 子项有 stagger 效果

**时间：2-3 天**


---

## Phase 4：GSAP 名称盒子

**目标**：替换 Web Animation API

### 4.1 现有

```typescript
const anim = pathEl.animate(
  [{ width: currentW }, { width: targetW }],
  { duration: 200, easing: 'cubic-bezier(.4,0,.2,1)' }
)
```

### 4.2 GSAP

```typescript
gsap.fromTo(pathEl, 
  { width: currentW },
  { width: targetW, duration: 0.2, ease: 'power2.out' }
)
```

**时间：0.5 天**

---

## Phase 5：GSAP 滚动居中

**目标**：替换 scrollTo smooth

### 5.1 现有

```typescript
container.scrollTo({ top: targetScroll, behavior: 'smooth' })
```

### 5.2 GSAP

```typescript
gsap.to(container, {
  scrollTop: targetY,
  duration: 0.4,
  ease: 'power2.inOut',
  onUpdate: () => updateCursorHighlight(true)
})
```

**时间：1 天**


---

## Phase 6：Leafer 连线层

**目标**：DOM 上方叠加 Canvas 画连线

### 6.1 架构

```
z-index:
  100  DOM 文件树
  150  Leafer Canvas（透明，只画连线）
  200  光标高亮
```

### 6.2 实现

```typescript
// tree-connectors.ts
import { Leafer, Line } from 'leafer-ui'

export function initConnectors(container) {
  const leafer = new Leafer({
    view: container,
    fill: 'transparent',
  })
  
  // 监听 DOM 变化
  const observer = new MutationObserver(() => updateConnectors(leafer))
  observer.observe(container, { childList: true, subtree: true })
  
  return leafer
}

function updateConnectors(leafer) {
  leafer.removeAll()
  
  const items = document.querySelectorAll('.tree-item')
  items.forEach(item => {
    const level = parseInt(item.dataset.level || '0')
    if (level === 0) return
    
    const rect = item.getBoundingClientRect()
    const parentRect = findParent(item).getBoundingClientRect()
    
    const line = new Line({
      points: [parentRect.left + 10, parentRect.top + 20, 
               rect.left - 10, rect.top + 20],
      stroke: 'rgba(124,58,237,.2)',
      strokeWidth: 1,
    })
    leafer.add(line)
  })
}
```

### 验证标准
- [ ] 连线位置准确
- [ ] 不影响 DOM 交互
- [ ] 展开时更新

**时间：2-3 天**


---

## Phase 7：Leafer 粒子效果

**目标**：连线上加流动粒子

### 7.1 实现

```typescript
import { Ellipse } from 'leafer-ui'
import gsap from 'gsap'

export function createFlowParticle(line, leafer) {
  const particle = new Ellipse({
    width: 4, height: 4,
    fill: 'rgba(0,212,255,.7)',
  })
  leafer.add(particle)
  
  gsap.to(particle, {
    motionPath: { path: line.points },
    duration: 2,
    repeat: -1,
    ease: 'none',
  })
}
```

**时间：1-2 天**

---

## 总时间

| Phase | 内容 | 时间 |
|-------|------|------|
| 1 | Pretext 文本测量 | 1 天 |
| 2 | GSAP 光标动画 | 1-2 天 |
| 3 | GSAP 展开动画 | 2-3 天 |
| 4 | GSAP 名称盒子 | 0.5 天 |
| 5 | GSAP 滚动居中 | 1 天 |
| 6 | Leafer 连线层 | 2-3 天 |
| 7 | Leafer 粒子 | 1-2 天 |

**总计：9-13 天**

---

## 风险与回退

| Phase | 风险 | 回退方案 |
|-------|------|----------|
| 1 | Pretext 测量不准 | 保留 DOM 测量 fallback |
| 2 | GSAP 光标卡顿 | 回退 CSS transition |
| 3 | 展开动画不自然 | 回退 CSS 动画 |
| 6 | 连线位置不准 | 禁用连线层 |

---

## 参考文档

- LeaferJS: https://leaferjs.com/docs
- Pretext: https://github.com/chenglou/pretext
- GSAP: https://gsap.com/docs


---

## Phase 8-10：渐进式完全替换（主导→完全模式）

> 目标：从混合模式过渡到纯 Canvas 渲染，最终完全移除 DOM 树

---

## Phase 8：Canvas 主导渲染

**目标**：Leafer Canvas 接管节点外观渲染，DOM 变为透明占位符

### 8.1 DOM 透明化

```css
/* sidebar.css - 修改 */
.tree-item {
  opacity: 0;              /* 透明 */
  pointer-events: auto;    /* 但保留点击 */
  position: absolute;      /* 脱离文档流 */
}

.tree-row, .tree-name, .tree-toggle {
  opacity: 0;
}
```

### 8.2 Canvas 渲染节点

```typescript
// tree-leafer-dom.ts - 新增
import { Leafer, Rect, Text, Group } from 'leafer-ui'
import gsap from 'gsap'

export class DomBackedLeaferRenderer {
  private leafer: Leafer
  private nodeMap = new Map<string, LeaferNode>()
  
  constructor(container: HTMLElement) {
    this.leafer = new Leafer({
      view: container,
      width: container.clientWidth,
      height: container.scrollHeight,
    })
  }
  
  // 根据 DOM 位置渲染 Canvas 节点
  syncFromDom() {
    const domItems = document.querySelectorAll('.tree-item')
    
    domItems.forEach((domItem, i) => {
      const rect = domItem.getBoundingClientRect()
      const path = (domItem as HTMLElement).dataset.path!
      const name = domItem.querySelector('.tree-name')?.textContent || ''
      const level = parseInt((domItem as HTMLElement).dataset.level || '0')
      
      // 创建 Canvas 节点
      const node = this.createCanvasNode({
        x: 0,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        name,
        level,
        isSelected: domItem.classList.contains('selected'),
      })
      
      this.nodeMap.set(path, node)
      this.leafer.add(node.group)
    })
  }
  
  private createCanvasNode(props) {
    const group = new Group({ x: props.x, y: props.y })
    
    // 背景
    const bg = new Rect({
      width: props.width,
      height: props.height,
      fill: props.isSelected ? 'rgba(46,213,163,.15)' : 'transparent',
      cornerRadius: 4,
    })
    
    // 左粗边框
    const leftBorder = new Rect({
      width: 3,
      height: props.height,
      fill: `rgba(124,58,237,${0.3 + props.level * 0.1})`,
    })
    
    // 文字
    const text = new Text({
      x: 10 + props.level * 20,
      y: props.height / 2 - 7,
      text: props.name,
      fill: '#e0e0e0',
      fontSize: 13,
    })
    
    group.add(bg)
    group.add(leftBorder)
    group.add(text)
    
    return { group, bg, text, data: props }
  }
}
```

### 8.3 双向同步

```typescript
// DOM 变化 → Canvas 更新
const observer = new MutationObserver(() => {
  renderer.syncFromDom()
})
observer.observe(fileTree, { 
  childList: true, 
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'data-path']
})

// Canvas hover → DOM 触发（保持手势系统兼容）
node.group.on('pointer.over', () => {
  // 找到对应 DOM 元素触发事件
  const domItem = document.querySelector(`[data-path="${path}"]`)
  domItem?.dispatchEvent(new Event('mouseenter'))
})
```

### 验证标准
- [ ] 外观与 DOM 版本完全一致
- [ ] DOM 节点透明但可点击
- [ ] 手势系统（摇杆/触摸）正常工作
- [ ] 滚动流畅 60fps

**时间：3-4 天**

---

## Phase 9：事件系统迁移

**目标**：用 Leafer 事件替代 DOM 事件，准备移除 DOM

### 9.1 Leafer 事件处理

```typescript
// tree-events.ts - 新增
import { PointerEvent } from 'leafer-ui'

export function initLeaferEvents(renderer: DomBackedLeaferRenderer) {
  renderer.nodeMap.forEach((node, path) => {
    const { group } = node
    
    // 点击选中
    group.on(PointerEvent.TAP, () => {
      selectNode(path)
    })
    
    // 长按展开
    let pressTimer: number
    group.on(PointerEvent.DOWN, () => {
      pressTimer = window.setTimeout(() => {
        toggleExpand(path)
      }, 500)
    })
    
    group.on(PointerEvent.UP, () => {
      clearTimeout(pressTimer)
    })
    
    // Hover 效果
    group.on(PointerEvent.OVER, () => {
      gsap.to(node.bg, { fill: 'rgba(124,58,237,.1)', duration: 0.15 })
    })
    
    group.on(PointerEvent.OUT, () => {
      if (!node.data.isSelected) {
        gsap.to(node.bg, { fill: 'transparent', duration: 0.15 })
      }
    })
  })
}
```

### 9.2 手势系统适配

```typescript
// gestures.ts - 修改
// 原有 DOM 手势逻辑改为 Canvas 坐标计算

export function moveCursorBySteps(steps: number): void {
  // 不再查询 DOM，直接操作 Canvas 节点
  const visibleNodes = renderer.getVisibleNodes()
  const currentIdx = visibleNodes.findIndex(n => n.data.isSelected)
  const targetIdx = Math.max(0, Math.min(currentIdx + steps, visibleNodes.length - 1))
  
  const targetNode = visibleNodes[targetIdx]
  selectNode(targetNode.data.path)
  
  // Canvas 光标移动
  gsap.to(cursorRect, {
    y: targetNode.group.y,
    duration: 0.3,
    ease: 'power2.out',
  })
}
```

### 9.3 滚动约束迁移

```typescript
// ui.ts - 修改滚动约束
export function isInConstraintZone(nodeY: number): boolean {
  const container = document.querySelector('.sidebar-content')!
  const centerY = container.clientHeight / 2
  return Math.abs(nodeY - centerY) < CONSTRAINT_HEIGHT / 2
}

export function scrollIntoConstraintZone(targetY: number): void {
  const container = document.querySelector('.sidebar-content')!
  const centerY = container.clientHeight / 2
  const offset = targetY - centerY
  
  gsap.to(container, {
    scrollTop: container.scrollTop + offset,
    duration: 0.4,
    ease: 'power2.inOut',
  })
}
```

### 验证标准
- [ ] 点击/长按/双击正常
- [ ] 摇杆光标移动正常
- [ ] 边界触摸步进正常
- [ ] 滚动约束正常
- [ ] 无需 DOM 事件委托

**时间：2-3 天**

---

## Phase 10：完全移除 DOM

**目标**：sidebar-content 中只有 Leafer Canvas，无 DOM 节点

### 10.1 数据层直接驱动

```typescript
// tree-full-canvas.ts - 新增
import { Leafer, Group } from 'leafer-ui'

export class FullCanvasTree {
  private leafer: Leafer
  private contentGroup: Group
  private virtualRenderer: VirtualRenderer
  
  constructor(container: HTMLElement) {
    this.leafer = new Leafer({
      view: container,
      width: container.clientWidth,
      height: container.clientHeight,
    })
    
    this.contentGroup = new Group({
      width: container.clientWidth,
    })
    
    this.leafer.add(this.contentGroup)
    
    // 直接加载数据，不经过 DOM
    this.loadData('/root')
  }
  
  async loadData(path: string) {
    const items = await fetchTreeData(path)
    const nodes = this.convertToNodes(items)
    this.virtualRenderer.render(nodes)
  }
  
  // 虚拟化渲染
  private renderVisibleNodes(scrollY: number) {
    const range = this.virtualRenderer.calculateRange(scrollY)
    
    // 清除旧节点
    this.contentGroup.removeAll()
    
    // 渲染可见节点
    range.visible.forEach((nodeData, i) => {
      const node = this.createNode(nodeData)
      node.group.y = nodeData.y
      this.contentGroup.add(node.group)
      
      // 入场动画
      gsap.from(node.group, {
        x: -20,
        opacity: 0,
        duration: 0.2,
        delay: i * 0.02,
      })
    })
  }
}
```

### 10.2 完全移除 DOM 渲染

```typescript
// tree.ts - 修改
// 原有 renderTree 改为 Canvas 渲染

export async function renderTree(path = ''): Promise<void> {
  // 不再创建 DOM 元素
  // 直接调用 Canvas 渲染器
  canvasRenderer.loadData(path)
}

// 标记旧函数为废弃
/** @deprecated 使用 canvasRenderer.loadData */
export async function renderTreeDom(path = ''): Promise<void> { ... }
```

### 10.3 清理 DOM 相关代码

```typescript
// 移除的文件/代码：
// - sidebar.css 中的 .tree-item, .tree-row 等样式
// - tree.ts 中的 DOM 创建逻辑
// - ui.ts 中的 DOM 查询（getBoundingClientRect）
// - gestures.ts 中的 DOM 事件监听

// 保留的 DOM 元素：
// - .sidebar-content（Canvas 容器）
// - .cursor-highlight（可选，可改为 Canvas）
```

### 验证标准
- [ ] sidebar-content 中无 .tree-item DOM 节点
- [ ] 功能完全正常
- [ ] 1000+ 文件 60fps
- [ ] 内存占用 < 300MB
- [ ] 无 DOM reflow/recalculate style

**时间：2-3 天**

---

## 完全替换后的架构

```
Before (混合模式):
┌─────────────────────────┐
│  .sidebar-content       │
│  ├─ .tree-item (DOM)    │
│  │   ├─ .tree-row       │
│  │   └─ .tree-children  │
│  ├─ .cursor-highlight   │
│  └─ Leafer Canvas       │  ← 只画连线
└─────────────────────────┘

After (完全模式):
┌─────────────────────────┐
│  .sidebar-content       │
│  └─ Leafer Canvas       │  ← 所有渲染
│      ├─ 节点 (Rect/Text)│
│      ├─ 连线 (Line)     │
│      ├─ 光标 (Rect)     │
│      └─ 粒子 (Ellipse)  │
└─────────────────────────┘
```

---

## 总时间更新

| Phase | 内容 | 时间 |
|-------|------|------|
| 1 | Pretext 文本测量 | 1 天 |
| 2 | GSAP 光标动画 | 1-2 天 |
| 3 | GSAP 展开动画 | 2-3 天 |
| 4 | GSAP 名称盒子 | 0.5 天 |
| 5 | GSAP 滚动居中 | 1 天 |
| 6 | Leafer 连线层 | 2-3 天 |
| 7 | Leafer 粒子效果 | 1-2 天 |
| **8** | **Canvas 主导渲染** | **3-4 天** |
| **9** | **事件系统迁移** | **2-3 天** |
| **10** | **完全移除 DOM** | **2-3 天** |

**总计：15-22 天**（渐进式完全替换）

---

## 渐进式完全替换的优势

```yaml
vs 直接另起炉灶:
  风险: 低（每步可验证）
  回退: 容易（随时停在混合模式）
  时间感知: 每 1-2 天有可见改进
  最终效果: 相同（纯 Canvas）
  
vs 永远混合模式:
  性能: 更好（无 DOM 开销）
  功能: 更多（拖拽、缩略图等）
  维护: 更简单（单一渲染层）
```

