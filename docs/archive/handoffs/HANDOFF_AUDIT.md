---
status: superseded
archived_at: 2026-06-02
superseded_by: docs/HANDBOOK.md
---
# KFM v4 项目交接文档

> 最后更新：2026-06-02（v6.0.0）
> 本文档是项目**唯一的**待办总览数据源。`SESSION_MEMORY.md` 不维护进度列表。

> ⏱ **TL;DR**：当前活跃待办仅 1 项（P2 拆分 card-stack.ts），其余为持续观察项。
> 历史版本详情已归档至 `docs/archive/handoffs/`，需要追溯时查阅。

---

## 当前待办

| 优先级 | 事项 | 说明 | 状态 |
|--------|------|------|------|
| **🟠 P2** | 拆分 `card-stack.ts`（1352 行） | 面板逻辑 ~400 行 + 浮卡系统 ~900 行两职责混合 | ⬜ |
| **🟢 Obs** | 测试基础设施 | GSAP mock 失真，无 UI/Canvas/手势覆盖 | 持续观察 |
| **🟢 Obs** | orb / card-stack 拖动逻辑重复 | 各自实现 pointerdown/move/up 循环 | 持续观察 |
| **🟢 Obs** | archive/ 文档健康度 | 已按分类重组，定期检查 | 持续观察 |

---

## v6.0.0 版本摘要

**核心变更**：UI Element Registry 实现 + 独立代码审计清理。

| 完成项 | 状态 |
|--------|------|
| `ui-registry.ts` 创建 + 10 个交互元素注册 | ✅ |
| `check-registry.mjs` MANIFEST 验证挂入构建管线 | ✅ |
| `(as any)` 白名单清零（3 处活跃 → 0 处） | ✅ |
| `window` 全局变量清理（14 处，5 文件） | ✅ |
| 空 catch 块修复（4 处） | ✅ |

**已知缺口**：
- **Problem 5**：AI→浏览器通信通道未解决（Registry 只有"眼睛"没有"手"）
- **动态状态更新未实现**：snapshot 只返回初始化时的静态状态

详情见 `docs/archive/handoffs/v6.0.0-audit.md` 和 `docs/archive/handoffs/v6.0.0-implementation.md`。

---

## 历史版本归档

| 版本 | 焦点 | 归档位置 |
|------|------|---------|
| v5.0.0 | CSS 语法安全 + SCSS 迁移 + 文档审计 | `docs/archive/handoffs/v5.0.0.md` |
| v5.1.0 | root-picker 交互修复 + 代码审计 | `docs/archive/handoffs/v5.1.0.md` |
| v5.2.0 | RenderContext 上下文隔离实现 | `docs/archive/handoffs/v5.2.0.md` |
| v6.0.0 | UI Element Registry + 代码审计清理 | `docs/archive/handoffs/v6.0.0-*.md` |

---

## 已知陷阱

1. **Canvas 初始化 `clientWidth = 0`** — 需在 rAF 回调里 `rebuildTree()`
2. **esbuild `nullish-coalescing` 禁用** — 但源码大量使用 `??`，TS 6 编译时需确保正确降级
3. **事件冒泡** — 侧栏触摸区事件冒泡到 document → GestureRegistry 误触发
4. **动画锁超时** — `processClickQueue` 有 3000ms 超时释放，长期依赖说明动画管理有设计缺陷
5. **测试 mock 脆弱** — GSAP mock 中 `tl.call(cb)` 同步执行回调，改变了动画时序

---

## 关联文档

| 文档 | 用途 |
|------|------|
| `CLAUDE.md` | 项目入口 + 架构速查 |
| `SESSION_MEMORY.md` | 当前会话快照 |
| `KFM_V4_INVARIANTS.md` | 修改约束协议（**改代码前必读**） |
| `BUG_AUDIT_REGISTRY.md` | 隐性契约 + 根因案例 |
| `PRINCIPLES_INDEX.md` | 所有原则/约束的索引 |

> 接手新对话的推荐阅读顺序：`CLAUDE.md` → `SESSION_MEMORY.md` → `KFM_V4_INVARIANTS.md` → 本文件待办区。
