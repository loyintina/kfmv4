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

