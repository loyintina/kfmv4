# KFM v4 会话记忆（2026-06-01）

> **新会话必读。** 本文档是当前会话的实时快照——焦点、架构状态、陷阱。
> 
> 进度跟踪和待办总览在 `HANDOFF_AUDIT.md`，本文档不再重复维护。
> 开工前还需通读 `KFM_V4_INVARIANTS.md`（修改约束协议）。

---

## 当前焦点

**项目进入稳定期** — v6.0.0 独立代码审计已完成。
- P3 RenderContext 上下文隔离 + root-picker 交互修复已完成
- `window` 全局变量清理（14 处）已完成
- 空 catch 块修复（4 处）已完成

当前已无进行中的任务。完整的待办优先级见 `HANDOFF_AUDIT.md`。

---

## 关键架构状态

### gesture-registry 现有 handler

```
picker-lock         110  →  picker 打开时拦截所有事件
orb                 100  →  主光球拖拽
floating-orb        100  →  浮卡角球拖拽
sidebar-scroll       60  →  文件树滚动/光标 + 左滑关闭
gestures-page-swipe  50  →  页面级侧滑
card-stack-global    80  →  卡片堆手势
```

### picker 防御体系（单一防线）

```
picker-lock (priority 110, stopPropagation)
  → 阻挡 gesture-registry 所有 handler
  → click handler 通过 isPickerOpen() 守卫
  → 无需 pointer-events:none hack
```

### 当前设计模式

**RenderContext 上下文栈**（`KFM_V4_INVARIANTS.md` §1.6）：
- 打开变体面板时 `L.pushContext(...)`，关闭时 `L.popContext()`
- 自动隔离 `renderer`、`rowIndex`、`cursorBox`、`cursorRowId`
- `KFMState.files` 是全局状态，不属于 RenderContext，变体写入后需额外清理

---

## 已知的隐式陷阱

1. **CSS 布局方程**（`BUG_AUDIT_REGISTRY.md` 1.10）：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex
2. **`buildTree` 数据源**：`buildTree` 内部读 `KFMState.files`，修改后必须恢复
3. **`setExpanded` 多次 notify**（`BUG_AUDIT_REGISTRY.md` 1.9）：连续调 `setExpanded` 会触发多次 notify，动画守卫丢弃中间状态
4. **拖拽 VS 重构搬运**（心法原则 9）：搬运代码必须 `git show` 原样复制后改，禁止重写
5. **改动前先说明**（SOP 步骤 5）：每项改动前需说清"改什么、为什么、效果、怎么验证"

---

## 测试状态

- `npm run check` 和 `npm run build` 零错误
- 测试 74 passed, 0 failed（v6.0.0 独立审计后 gestrue-registry 测试已修复）
- 活跃 `(as any)` 逃逸：3 处（canvas-cursor.ts:85/:123, renderer-lifecycle.ts:147）
- 服务端：`serve public -l 8021` + `node dist/server/index.js` 双进程
