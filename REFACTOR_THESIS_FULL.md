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
| tree.ts | 189→165 | DOM 文件树渲染、点击事件、展开动画 |
| ui.ts | 410→380 | 光标高亮、滚动约束、名称盒子、位置计算 |
| gestures.ts | 178→155 | 摇杆手势、触摸交互、光标动作 |
| orb.ts | 518 | 光球面板 |
| tree-text.ts | 29 | Pretext 文本测量封装 |
| sidebar.css | - | 树节点样式、展开动画、光标样式 |

### 现有效果清单

| 效果 | 位置 | 原实现 | 现实现 | 状态 |
|------|------|--------|--------|------|
| 光标高亮围框 | ui.ts | DOM div + CSS transition | GSAP gsap.to() | ✅ Phase2 |
| 光标跟随同步 | ui.ts | rAF 轮询 + style赋值 | GSAP ticker + gsap.set() | ✅ Phase2 |
| 名称盒子宽度动画 | ui.ts | offsetWidth + Web Animation API | Pretext + gsap.fromTo() | ✅ Phase1+4 |
| 目录展开叠叠乐 | tree.ts | CSS transform + setTimeout嵌套 | GSAP Timeline | ✅ Phase3 |
| 统一展开路径 | gestures.ts | 独立classList.toggle | dispatchEvent('click') | ✅ 修复 |
| 统一选中逻辑 | 5处分散 | 各自手动classList+setSelected | selectFileItem() | ✅ 修复 |
| 边界触摸滚动步进 | ui.ts | touchmove + rAF | 保持 | ⏳ |
| 摇杆光标 | gestures.ts | touchmove + rAF | 保持 | ⏳ |
| 点击滚动居中 | ui.ts | scrollTo smooth | 保持（原生已足够好） | ❌ Phase5跳过 |
| 网格展开动画 | sidebar.css | CSS grid + keyframes | 保持（CSS原生实现更优） | ❌ Phase3跳过 |

---

## Phase 1：Pretext 文本测量 ✅

**目标**：用 Pretext 替换 `offsetWidth` 测量

### 实际完成

- `ui.ts` 中 2 处 `pathEl.offsetWidth` → `measureNaturalWidthSync(text, PATH_FONT) + 24`
- 2 处 `void pathEl.offsetWidth` 强制 reflow → **移除**
- 2 处 `width: 'auto'` 中间态测量 → **移除**
- `updateSidebarPath` 调用链 **零 reflow**

### 改动

```typescript
// ui.ts - 修改
import { measureNaturalWidthSync } from './tree-text.js';

const PATH_FONT = '12px -apple-system, sans-serif';

// Before: offsetWidth 触发 reflow
const targetW = pathEl.offsetWidth;

// After: Pretext 离屏测量
const targetW = measureNaturalWidthSync(name || '-', PATH_FONT) + 24;
```

**commit**: `7187acc`

---

## Phase 2：GSAP 光标动画 ✅

**目标**：用 GSAP 替换光标高亮的 CSS transition

### 实际完成

- `updateCursorHighlight`: `style.transition` + 手动赋值 → `gsap.to()` / `gsap.set()`
- `syncCursorDuringBounce`: 手动 rAF 帧计数器（~40行） → `gsap.ticker` + `delayedCall`
- 所有 `cursorHighlight.style.transition` 赋值 → **移除**

### 改动

```typescript
const CURSOR_EASE = 'cubic-bezier(.25,.46,.45,.94)';
const CURSOR_DURATION = 0.3;

// Before: CSS transition
cursorHighlight.style.transition = 'top .3s ...';
cursorHighlight.style.top = top + 'px';

// After: GSAP
gsap.to(cursorHighlight, {
  top, left, width, height, opacity: 1,
  duration: CURSOR_DURATION,
  ease: CURSOR_EASE,
});
```

**commit**: `5fc4071`

---

## Phase 3：GSAP 目录展开动画 ✅

**目标**：用 GSAP 替换叠叠乐动画

### 实际完成

- `doBounce` + 2 段 while 循环 + 3 层 `setTimeout` 嵌套 → `gsap.timeline`
- 删除 `.bounce-up` / `.bounce-down` CSS（不再需要）

### 保留不动（足够优雅）

- `grid-template-rows: 0fr → 1fr` CSS transition — GSAP 无法控制 CSS Grid fr 单位
- `@keyframes q弹-in` CSS animation — 与 Grid 展开配合精确

### 改动

```typescript
// Before: setTimeout 嵌套
const doBounce = (el, dir, delay) => {
  setTimeout(() => {
    el.style.transition = '...';
    el.style.transform = `translateY(${offset}px)`;
    setTimeout(() => { ... }, 320);
    setTimeout(() => { ... }, 450);
  }, delay);
};

// After: GSAP timeline
const tl = gsap.timeline();
targets.forEach((el, i) => {
  tl.fromTo(el, { y: 0 }, { y: dir * 10, duration: 0.3, ease: 'back.out(1.7)' }, i * 0.02);
  tl.to(el, { y: dir * -2, duration: 0.15, ease: 'power2.out' }, '>0');
  tl.to(el, { y: 0, duration: 0.1, ease: 'power1.inOut' }, '>0');
});
```

**commit**: `f6dc1db`

---

## Phase 4：GSAP 名称盒子 ✅

**目标**：替换 Web Animation API，统一 ui.ts 动画技术栈

### 实际完成

- `pathEl.animate()` × 2 → `gsap.fromTo()`
- `getAnimations().cancel()` → `gsap.killTweensOf()`
- `anim.onfinish` → `onComplete`
- **ui.ts 中动画系统完全统一为 GSAP**

**commit**: `e863424`

---

## Phase 5：GSAP 滚动居中 ❌ 跳过

**原因**：`scrollTo({ behavior: 'smooth' })` 是浏览器原生实现，性能优秀且跟随用户系统偏好。GSAP 替换不会带来收益，反而失去系统一致性。摇杆的 `scrollTop +=` 是实时跟随，非动画，不适合 GSAP。

---

## 额外修复：统一展开/折叠路径 ✅

**问题**：展开/折叠有两条独立代码路径，`gestures.ts` 的 `executeCursorAction` 缺少叠叠乐动画。

**修复**：`executeCursorAction` 从 25 行手动展开逻辑 → 3 行 `dispatchEvent(new Event('click'))`，两条路径共享 `tree.ts` 的完整事件处理。

**commit**: `a8da6b4`

---

## 额外修复：统一选中逻辑 ✅

**问题**：文件选中操作有 5 条重复代码路径，且 `restoreCursorPosition` 缺少 `updateSidebarPath`。

**修复**：提取 `selectFileItem(item)` 公共函数（选中+光标+sidebarPath，不含滚动），5 处全部替换。

| 路径 | 触发方式 | 滚动行为 |
|------|----------|----------|
| tree.ts 点击 | `selectFileItem(div)` | + `scrollAndCenterCursor` |
| gestures.ts 摇杆步进 | `selectFileItem(items[i])` | 摇杆自带的 `scrollFollowCursor` |
| ui.ts 恢复光标 | `selectFileItem(items[i])` | + `centerCursorToView` |
| ui.ts moveCursorTo | `selectFileItem(target)` | 无（由调用方处理） |
| ui.ts 边界触摸 | `selectFileItem(allVisible[i])` | 无 |

**commit**: `8af658a`

---

## Phase 6：Leafer 连线层 ⏳

**目标**：DOM 上方叠加 Canvas 画连线

### 6.1 架构

```
z-index:
  100  DOM 文件树
  150  Leafer Canvas（透明，只画连线）
  200  光标高亮
```

### 6.2 实现方案

```typescript
// tree-connectors.ts - 新增
import { Leafer, Line } from 'leafer-ui'

export function initConnectors(container) {
  const leafer = new Leafer({
    view: container,
    fill: 'transparent',
  })
  
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

**预计时间：2-3 天**

---

## Phase 7：Leafer 粒子效果 ⏳

**目标**：连线上加流动粒子

### 实现方案

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

**预计时间：1-2 天**

---

## Phase 8-10：渐进式完全替换（主导→完全模式）⏳

> 目标：从混合模式过渡到纯 Canvas 渲染，最终完全移除 DOM 树

---

## Phase 8：Canvas 主导渲染

**目标**：Leafer Canvas 接管节点外观渲染，DOM 变为透明占位符

### 8.1 DOM 透明化

```css
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
  
  syncFromDom() {
    const domItems = document.querySelectorAll('.tree-item')
    domItems.forEach((domItem, i) => {
      const rect = domItem.getBoundingClientRect()
      const path = (domItem as HTMLElement).dataset.path!
      const name = domItem.querySelector('.tree-name')?.textContent || ''
      const level = parseInt((domItem as HTMLElement).dataset.level || '0')
      
      const node = this.createCanvasNode({
        x: 0, y: rect.top,
        width: rect.width, height: rect.height,
        name, level,
        isSelected: domItem.classList.contains('selected'),
      })
      
      this.nodeMap.set(path, node)
      this.leafer.add(node.group)
    })
  }
  
  private createCanvasNode(props) {
    const group = new Group({ x: props.x, y: props.y })
    const bg = new Rect({
      width: props.width, height: props.height,
      fill: props.isSelected ? 'rgba(46,213,163,.15)' : 'transparent',
      cornerRadius: 4,
    })
    const text = new Text({
      x: 10 + props.level * 20,
      y: props.height / 2 - 7,
      text: props.name, fill: '#e0e0e0', fontSize: 13,
    })
    group.add(bg, text)
    return { group, bg, text, data: props }
  }
}
```

**预计时间：3-4 天**

---

## Phase 9：事件系统迁移

**目标**：用 Leafer 事件替代 DOM 事件，准备移除 DOM

```typescript
import { PointerEvent } from 'leafer-ui'

renderer.nodeMap.forEach((node, path) => {
  node.group.on(PointerEvent.TAP, () => selectNode(path))
  node.group.on(PointerEvent.OVER, () => {
    gsap.to(node.bg, { fill: 'rgba(124,58,237,.1)', duration: 0.15 })
  })
})
```

**预计时间：2-3 天**

---

## Phase 10：完全移除 DOM

**目标**：sidebar-content 中只有 Leafer Canvas，无 DOM 节点

```typescript
// tree-full-canvas.ts - 新增
export class FullCanvasTree {
  async loadData(path: string) {
    const items = await fetchTreeData(path)
    this.virtualRenderer.render(this.convertToNodes(items))
  }
  
  private renderVisibleNodes(scrollY: number) {
    this.contentGroup.removeAll()
    range.visible.forEach((nodeData, i) => {
      const node = this.createNode(nodeData)
      gsap.from(node.group, { x: -20, opacity: 0, duration: 0.2, delay: i * 0.02 })
    })
  }
}
```

### 验证标准
- [ ] sidebar-content 中无 .tree-item DOM 节点
- [ ] 1000+ 文件 60fps
- [ ] 无 DOM reflow/recalculate style

**预计时间：2-3 天**

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

## 当前进度与总时间

| Phase | 内容 | 状态 | 实际时间 |
|-------|------|------|----------|
| 1 | Pretext 文本测量 | ✅ | ~1h |
| 2 | GSAP 光标动画 | ✅ | ~1h |
| 3 | GSAP 展开动画 | ✅ | ~30min |
| 4 | GSAP 名称盒子 | ✅ | ~10min |
| 5 | GSAP 滚动居中 | ❌ 跳过 | 0 |
| + | 统一展开路径修复 | ✅ | ~15min |
| + | 统一选中逻辑 | ✅ | ~20min |
| 6 | Leafer 连线层 | ⏳ | 2-3天 |
| 7 | Leafer 粒子效果 | ⏳ | 1-2天 |
| 8 | Canvas 主导渲染 | ⏳ | 3-4天 |
| 9 | 事件系统迁移 | ⏳ | 2-3天 |
| 10 | 完全移除 DOM | ⏳ | 2-3天 |

**已完成：1-4 + 2项修复（约3h实际工作量）**
**剩余：6-10（约10-15天）**

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

---

## Git 历史

```
03d2468 docs: 清理旧计划文档，保留唯一完整版
9497ef6 docs: 添加 Phase 8-10 渐进式完全替换方案
87bcb0d docs: 完整版忒修斯之船重构计划 - 7 Phase详细方案
7187acc refactor(phase1): Pretext替换offsetWidth测量
5fc4071 refactor(phase2): GSAP替换光标高亮动画
f6dc1db refactor(phase3): GSAP替换叠叠乐动画
a8da6b4 fix: executeCursorAction改为dispatch click事件
e863424 refactor(phase4): GSAP替换Web Animation API
8af658a refactor: 提取selectFileItem统一选中逻辑
```
