---
status: superseded
archived_at: 2026-06-02
superseded_by: docs/HANDBOOK.md
---
# KFM v4 会话记忆（2026-06-02）

> **新会话必读。** 本文档是当前会话的实时快照——焦点、架构状态、陷阱。
>
> 进度跟踪和待办总览在 `HANDOFF_AUDIT.md`，本文档不再维护进度列表。
> 开工前需通读 `KFM_V4_INVARIANTS.md`（修改约束协议）。

> ⏱ **TL;DR**：v6.0.0 已提交，当前焦点是保持。`(as any)` 零逃逸，
> 检查管线 4 道（anim + as-any + registry + docs），`npm run check` 必须零错误通过。

---

## 当前焦点

**v6.0.0 — UI Element Registry 已实现。**
- `(as any)` 逃逸全部清理（白名单清空）
- `ui-registry.ts` 已创建（类型定义 + Registry 类 + 全局单例）
- 10 个交互元素已注册
- `check-docs.mjs` 已加入构建管线（内部链接 + 篇幅预警 + 归档状态检查）
- 新增交互元素时必须同时：①在 init 函数中调 `Registry.register()` ②在 `check-registry.mjs` 的 MANIFEST 数组追加 id

## 关键架构状态

### 注册中心一览

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `gesture-registry.ts` | document 级触摸事件统一调度 |
| `RendererLifecycle` (L) | `renderer-lifecycle.ts` | 渲染器生命周期 + 状态机 |
| `DOM` | `dom-refs.ts` | 全局 DOM 元素引用 |
| `Registry` | `ui-registry.ts` | UI 元素注册表（黄页模式） |
| `KFMState` | `state.ts` | 全局状态层（发布-订阅） |

### 手势优先级

```
picker-lock         110  →  picker 打开时拦截所有事件
orb                 100  →  主光球拖拽
floating-orb        100  →  浮卡角球拖拽
sidebar-scroll       60  →  文件树滚动/光标 + 左滑关闭
gestures-page-swipe  50  →  页面级侧滑
card-stack-global    80  →  卡片堆手势
```

## 已知的隐式陷阱

1. **CSS 布局方程**（`BUG_AUDIT_REGISTRY.md` 1.10）：`.sidebar-content` + `.sidebar-tools` = 100dvh，禁止改用 flex
2. **`buildTree` 数据源**：`buildTree` 内部读 `KFMState.files`，修改后必须恢复
3. **`setExpanded` 多次 notify**（`BUG_AUDIT_REGISTRY.md` 1.9）：连续调 `setExpanded` 会触发多次 notify，动画守卫丢弃中间状态
4. **拖拽 VS 重构搬运**（心法原则 9）：搬运代码必须 `git show` 原样复制后改，禁止重写
5. **Registry MANIFEST**（`check-registry.mjs`）：新增交互元素必须同时注册 + 加入 MANIFEST

## 测试状态

- `npm run check` 零错误（check-anim ✓ / check-as-any ✓ / check-registry ✓ / check-docs ✓ / tsc ✓）
- `npm run test` 74 passed, 0 failed
- `(as any)` 逃逸：0 处（白名单已清空）
- 服务端：`node dist/server/index.js` → `http://localhost:8021`
