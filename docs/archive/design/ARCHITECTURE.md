---
status: superseded
archived_at: 2026-06-02
superseded_by: docs/HANDBOOK.md
---
# KFM v4 架构参考

> 本文档记录核心架构的详细设计。CLAUDE.md 是入口，本文档是深度参考。
> 改代码前先读 `KFM_V4_INVARIANTS.md`（修改约束协议），遇到 bug 先读 `DEBUG_SOP.md`。

---

## 注册中心模式

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `gesture-registry.ts` | document 级触摸事件统一调度 |
| `RendererLifecycle` (`L`) | `renderer-lifecycle.ts` | tree-render 全部可变状态 + rAF/Listener 追踪 |
| `DOM` | `dom-refs.ts` | 全局 DOM 元素引用 |

手势优先级: orb(100) > card-stack-panel(90) > card-stack-global(80) > page-swipe(50)

---

## 动画系统

### 展开/折叠状态机

```
L.beginOp(path, 'expand'|'collapse')  — 开始动画
L.endOp()                              — 结束动画
L.isAnimating                          — 是否动画中
L.animatingDir                         — 当前方向
```

### overlay 模式

- GSAP tween 只碰临时 overlay Box，不碰主树。
- 动画完成 → `_removeAllOverlays()` → 主树已是终端态。
- 中断: `ts.clear()` + `_removeAllOverlays()` → 安全回到稳态。

### scope 隔离

- `ts = anim.scope('tree-render')` — tree-render 专用时间线
- `anim.timeline()` — char-rain 独立时间线
- 每轮动画结束 `ts.call()` 内调用 `ts.clear()` 清理残留 tween

### OverlayMeta 接口

```typescript
interface OverlayMeta {
  _fullHeight: number;
  _origYs: number[];
  _targetY: number;
}
```

全部通过 `(as Box & OverlayMeta)` 类型化访问，无 `(as any)` 隐式契约。

### 所有 GSAP 调用必须通过 `animation-registry.ts`

禁止直接 `import gsap`（构建时 `check-anim.mjs` 扫描白名单强制执行）。
- tree-render 内的动画加到 `ts = anim.scope('tree-render')`
- char-rain 使用独立 timeline（`anim.timeline()`），`ts.clear()` 不影响
- card-stack / orb 的 GSAP 调用走 `anim` 工具方法

---

## Canvas 通用模块依赖方向

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

`canvas-*` 模块不导入任何 `tree-*` 模块。

---

## 关键调用链

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
  onSidebarOpen, onSidebarClose
```

---

## RenderContext 上下文栈

将 `L.renderer`、`L._rowIndex`、`L.cursorBox`、`L.cursorRowId` 封装进 `RenderContext`，
通过 `pushContext`/`popContext` 原子化切换。

详细设计见 `docs/archive/P3_RENDER_CONTEXT_REFACTOR_DONE.md`。

---

## 相关文档

| 文档 | 用途 | 使用时机 |
|------|------|---------|
| `CLAUDE.md` | 项目入口 | 第一次接手 |
| `KFM_V4_INVARIANTS.md` | 修改约束协议 | 改代码前 |
| `DEBUG_SOP.md` | 调试标准流程 | 遇到 bug 时 |
| `BUG_AUDIT_REGISTRY.md` | 隐性契约 + 根因案例 | 上述流程排查无果后 |
| `HANDOFF_AUDIT.md` | 待办总览 + 交接记录 | 规划下一阶段工作 |
| `SESSION_MEMORY.md` | 当前会话快照 | 新开对话时 |
