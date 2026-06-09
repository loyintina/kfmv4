---
status: draft
version: v0.2
last_updated: 2026-06-09
---

# 卡片工作台 Phase 1 — 实施设计

> 本文是 `WORKBENCH_SPEC.md` §9 Phase 1 的详细实施设计。
> 版本 v0.2：取消购物车/预览，改为临时卡片堆方案。

---

## 一、设计变更记录

| 版本 | 变更 |
|------|------|
| v0.1 | 购物车 + 文件预览（已废弃）|
| v0.2 | 废弃购物车，改为 **文件树右滑 → 临时卡片堆 → 确认散落桌面** |

---

## 二、需求

### 交互链路

```
文件树打开时，右滑某一行
  └→ Canvas 行 q弹回弹（GSAP back.out，纯 Box 属性动画）
  └→ 在手指位置创建一个 DOM 卡片（视觉克隆该行）
  └→ DOM 卡片 GSAP 弹性飞入右边缘 → 加入临时卡片堆

临时卡片堆右上角有 ✓ 和 ✗ 按钮

✓ 确认：
  └→ 关闭侧栏（文件树）
  └→ 临时卡片堆中的卡片逐张 GSAP 飞散到桌面（随机位置）
  └→ 每张卡片成为独立的浮卡

✗ 取消：
  └→ 临时卡片堆 GSAP 向右滑出关闭
  └→ 卡片回收，不创建浮卡
```

### 交互边界

- 右滑手势仅在 **侧栏打开时** 生效
- 多次右滑不同行 → 逐一加入临时卡片堆（堆叠效果）
- 同文件再次右滑 → 允许重复加入（去重逻辑由未来配置决定）

---

## 三、渲染策略（核心决策）

**Canvas 负责稳态渲染，DOM 负责瞬态动画。**

| 场景 | 渲染方式 | 原因 |
|------|---------|------|
| 文件树常态（展开/光标/滚动）| Canvas | 性能，万行不卡 |
| 右滑时行的 q弹回弹 | Canvas（GSAP 改 Box.x）| Box 属性变化自动重绘 |
| 手指位置的视觉克隆卡片 | DOM | 需要独立于文件树飞行 |
| 飞入临时卡片堆 | DOM | 复现现有浮卡系统 |
| 临时卡片堆堆叠 | DOM | 复用 `card-stack.ts` 的视觉 |
| 确认后散落桌面 | DOM | 复用 `floating-card.ts` 的 `launchFocusedCard` |

---

## 四、改动清单

### 4.1 右滑手势 — `canvas-scroll.ts` + `tree-render.ts`

**手势触发条件**：侧栏打开时，在屏幕任意位置右滑 > 50px。
**操作目标**：光标当前所在行（`L.cursorRowId`），不是坐标反查。

**为什么要用光标行**：
- 用户通过滑动/点击移动光标到目标行
- 右滑时明确知道要操作的是哪一行（光标已高亮）
- 避免坐标反查的不确定性

**动画实现（双树 overlay 模式）**：
```
右滑检测 (sidebar-scroll 内水平轴向锁定)
  → onEnd: dx > 50
  → _bounceCursorRow()
      → _createVisualClone() 克隆光标行
      → 构建最小 overlayRoot，设到 renderer
      → 主树该行 opacity=0
      → GSAP ts.to(overlay, { x: 15, ease: back.out(2), yoyo, repeat })
      → onComplete: _removeOverlay + setOverlayRoot(null) + 恢复主树 opacity
```

**为什么不用坐标反查**：光标即目标。用户用光标选中行后右滑，语义清晰。
**为什么用 overlay**：遵循双树设计——主树不动，独立 overlay 树负责瞬态动画，cleanup 自动恢复。```

### 4.2 行弹性动画 — `tree-render.ts`

```
const row = _boxLocationMap.get(path).box;
ts.to(row, { x: 15, duration: 0.25, ease: 'back.out(2)', yoyo: true, repeat: 1 });
```

**注意**：`yoyo: true + repeat: 1` 会让行右移 15px 后弹回原位。动画完成后自动恢复，不需要额外清理。在此期间如果触发 rebuildTree，GSAP 会自动处理游离 target。

### 4.3 临时卡片堆 — 新建 `temp-stack.ts`

复用现有 `card-stack.ts` 的堆叠布局和 `floating-card.ts` 的配色函数。

与现有卡片堆的区别：
- 现有卡片堆：内置功能入口，持久存在，从右边缘左滑唤出
- 临时卡片堆：由文件树右滑触发，临时存在，确认后转化为桌面浮卡

两者共用 `Z_STACK_BASE` 层级，互斥显示。

### 4.4 ✓/✗ 按钮 — 浮动在临时卡片堆右上角

```
✓ 确认按钮：
  1. closeSidebar() — 触发文件树关闭动画
  2. 逐张弹出卡片 → anim.to(el, { scale: 1, opacity: 1, left: random, top: random })
  3. 调用 launchFocusedCard 类似的逻辑创建独立浮卡

✗ 取消按钮：
  1. 临时卡片堆向右滑出关闭动画
  2. 不创建浮卡
  
  两个按钮点击后自身也消失。
```

### 4.5 状态层 — `state.ts`（✅ 已就绪）

无需额外改动。已包含 `cart: CartState` 接口，改名使用即可。

---

## 五、不做的事

| 不做 | 原因 |
|------|------|
| 文件点击预览浮卡 | 取消，光标选中已够 |
| 购物车持久化 | OPEN-001，暂不讨论 |
| 临时卡片堆编辑态 | Phase 5 |
| 文件浮卡拖拽/缩放 | Phase 2+ |
