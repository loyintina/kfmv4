---
status: superseded
superseded_by: docs/archive/ui-registry/HANDOFF_2026-06-03_REGISTRY_DEEP_AUDIT.md
archived_at: 2026-06-03
created_at: 2026-06-03
context: 三方对照审计深度修复 — _ 前缀显式接口 + 状态纠偏 + IIFE 扁平化 + 冗余通知清理
supersedes: docs/notes/HANDOFF_2026-06-03_TRIAGE_AUDIT_FIX.md
---

# 交接：三方对照审计深度修复

## 本轮做了什么

对照 `docs/UI_ELEMENT_REGISTRY_SPEC.md`、`docs/KFM_V4_INVARIANTS.md`、代码行为，发现 4 类缺口，全部修复。

### 修复清单

| 类型 | 问题 | 文件 | 操作 |
|------|------|------|------|
| 🔴 §1.2 | `_` 前缀跨模块访问：9 个 `L._*` 属性被 4 个模块直接读写 | `renderer-lifecycle.ts` + 3 消费者 | 新增 8 个显式接口方法 + 新增 `animElapsed` getter；全部消费者迁移 |
| 🔴 代码误导 | `orb-panel` 静态 state `'collapsed'` 与运行时 `panelState` 类型 (`'closed'|'open'|'editing'`) 不匹配 | `orb.ts:548` | `'collapsed'` → `'closed'` |
| 🟡 可读性 | `card-stack-content` 和 `file-tree` 内容生成器使用冗余 IIFE 嵌套 | `card-stack.ts`, `tree-loader.ts` | 扁平化为直接 `() => { return { ... }; }` |
| 🟡 冗余 | `eye-btn` 两处 `Registry.notifyStateChange('eye-btn')` 被 `KFMState.notify()` 覆盖 | `app.ts` | 移除 2 处 |
| 🟡 冗余 | `L._animBusy` 已有显式 `L.isAnimating` getter | `tree-render.ts` | 统一使用 `isAnimating` |
| 🟡 冗余 | `L._animBusyAt` 超时检查 | `tree-render.ts` (2 处) | 改为 `L.animElapsed > 3000` |

### 关键设计决策

**显式接口 vs 修改约束**：选择给 `RendererLifecycle` 加显式接口方法，不修改 §1.2 约束文字。理由——心法 8（选能自然满足约束的方案）。新增的方法名不前缀 `_`，语义与操作对应。

**不做**：
- `_rowIndex` (35+ 访问点) — 渲染管线的主数据通道，留待体系化改造
- rAF 句柄 (`_wheelRaf` 等 4 个) — canvas-scroll 与 cancelAllRafs 紧密耦合，当前模式可接受

### 验证

- `npm run check` → 零错误
- `npm run test` → 105/105 通过

## 留给下一轮的

### 持续观察

- **`_rowIndex` 显式接口化**：如果未来有人重构 canvas 渲染管线，建议同时给 `_rowIndex` 加 `getRowAtIndex(i)` / `findRowIndex(fn)` / `getRowIndexLength()` 替代直接数组引用
- **rAF 句柄封装**：`_wheelRaf` 等 4 个句柄在 canvas-scroll 的 5 个 rAF 循环中散布读写，可考虑封装一个 `RafHandleSet` 类统一管理
- **`L._savedScrollY`**：当前仅 tree-render.ts 内部使用（非跨模块），未封装。如果有人新增 save/restore 场景，建议一并迁移到 `saveSidebarScrollState()`
