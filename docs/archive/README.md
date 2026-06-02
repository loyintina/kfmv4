---
status: active
archived_at: 2026-06-02
---

# KFM v4 文档归档

> 历史文档按类别归档，每份文件都有 status 标记。
> 当前活跃文档仅 4 篇：`CLAUDE.md` + `HANDBOOK.md` + `VISION_AND_ROADMAP.md` + `KFM_V4_INVARIANTS.md`。

**状态说明**：
- `completed`：任务已完成，留作记录
- `superseded`：已被新版文档取代（内容已并入 `HANDBOOK.md`）

---

## 📂 handoff/ — 版本交接记录

| 文件 | 状态 | 说明 |
|------|------|------|
| `v4.1.0.md` | ✅ completed | 卡片配色 + 浮卡系统 + BR 守卫 |
| `v5.0.0.md` | ✅ completed | CSS 语法安全 + SCSS 迁移 |
| `v5.1.0.md` | ✅ completed | root-picker 交互修复 |
| `v5.2.0.md` | ✅ completed | RenderContext 上下文隔离 |
| `v6.0.0-audit.md` | ✅ completed | 独立代码审计 |
| `v6.0.0-implementation.md` | ✅ completed | UI Element Registry 实装 |
| `appendix-b-c.md` | ✅ completed | 独立审计评审与回应 |
| `SESSION_MEMORY.md` | 📜 superseded | 会话快照 → 已并入 `HANDBOOK.md` §2 |
| `HANDOFF_AUDIT.md` | 📜 superseded | 交接文档 → 已并入 `HANDBOOK.md` §3 |

## 📂 design/ — 过时的设计文档

| 文件 | 状态 | 说明 |
|------|------|------|
| `ARCHITECTURE.md` | 📜 superseded | 架构参考 → 已并入 `HANDBOOK.md` §1 |
| `REFACTOR_THESIS_FULL.md` | 📜 superseded | 原始愿景蓝图 → 已并入 `VISION_AND_ROADMAP.md` |
| `ANIMATION_REFINEMENT_PLAN.md` | 📜 superseded | 动画优化方案（已过时）|
| `STACK_CARDS_DESIGN.md` | 📜 superseded | 配色设计（代码已改为随机 HSL）|
| `CARD-STACK-HANDOFF.md` | 📜 superseded | 卡片堆交接（已完成）|
| `CARD_SYSTEM_DESIGN.md` | 📜 superseded | 卡片系统设计蓝图（待实现）|
| `UI_ELEMENT_REGISTRY_SPEC.md` | 📜 superseded | 注册表设计讨论（§S 已实现）|
| `AI_OPERATION_PROTOCOL.md` | 📜 superseded | AI 操作协议（未实现）|

## 📂 plan/ — 已完成的计划

| 文件 | 状态 | 说明 |
|------|------|------|
| `RACE_CONDITION_PLAN.md` | ✅ completed | 动画竞态根治方案 |
| `HANDOFF_P3_REMAINING.md` | ✅ completed | P3 遗留问题交接 |
| `P3_RENDER_CONTEXT_REFACTOR_DONE.md` | ✅ completed | RenderContext 重构方案 |

## 📂 bug/ — 已修复的 Bug

| 文件 | 状态 | 说明 |
|------|------|------|
| `HANDOFF_BRORB_FIX.md` | ✅ completed | BR 光球类型守卫修复 |

## 📂 legacy/ — 旧版本文件

| 文件 | 状态 | 说明 |
|------|------|------|
| `CLAUDE_v2.md` | 📜 superseded | 上一版主文档 |
| `AI_COLLABORATION_PRINCIPLES.md` | 📜 superseded | 通用 AI 协作守则 |
| `BUG_FIXING_PHILOSOPHY.md` | 📜 superseded | 旧版 Bug 修复原则 |

## 📂 根目录归档

| 文件 | 状态 | 说明 |
|------|------|------|
| `DEBUG_SOP.md` | 📜 superseded | 调试 SOP → 已并入 `HANDBOOK.md` §4 |
| `BUG_AUDIT_REGISTRY.md` | 📜 superseded | Bug 注册表 → §1 隐性契约已并入 `HANDBOOK.md` §4 |
| `TESTING.md` | 📜 superseded | 回归测试 → 已并入 `HANDBOOK.md` §5 |
| `PRINCIPLES_INDEX.md` | 📜 superseded | 原则索引 → 已并入 `HANDBOOK.md` §6 |
| `P3_RENDER_CONTEXT_REFACTOR.md` | 📜 superseded | 指向已完成重构 |
