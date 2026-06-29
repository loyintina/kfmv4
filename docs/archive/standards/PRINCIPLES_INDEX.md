---
status: superseded
archived_at: 2026-06-29
superseded_by: docs/PRINCIPLES.md
---
# KFM v4 原则索引

> 所有心法原则、架构约束、隐性契约的一站式查找表。
> 每一条原则只有一个权威定义位置（SSoT），此处仅记录链接和摘要。

---

## 心法原则（思考框架）

来源：`KFM_V4_INVARIANTS.md` §〇

| # | 原则 | 一句话摘要 |
|---|------|-----------|
| 1 | 先问"为什么"，再问"改哪里" | 找到根因，不修症状 |
| 2 | 从源头上简化，不是在输出端增加 | 数据模型只存不可简化的原始信息 |
| 3 | 不要跨模块依赖 | 一个模块的决策边界等于它的可见边界 |
| 4 | 状态在展示前就位 | 不要让用户看到"变化的过程" |
| 5 | 代码越改越少是正向指标 | 改完后代码变多，大概率方向错了 |
| 6 | 先理解整体，再拆解局部 | 理解 → 诊断 → 方案 → 执行 |
| 7 | 选择最匹配的一个方案，不列清单 | 给出你推荐的那一个，附上理由 |
| 8 | 选能自然满足所有约束的方案，不是改动最小的 | 擦掉重做的成本永远小于修修补补 |
| 9 | 搬运代码必须原样复制后再改 | 禁止凭记忆重写，差异行数应仅限于意图改动的部分 |
| 10 | 写代码前先口述"我要做 X，只因为……" | 要做什么、可选方案、选的哪一个、为什么 |
| 11 | 步骤 3 必须暴露所有已知缺口 | 能自动继承的部分 + 不能自动继承的缺口 + 填补方案 |
| 12 | 发现补丁就立即根除 | 不留给"以后"，补丁存在越久风险越大 |

---

## 架构约束

来源：`KFM_V4_INVARIANTS.md` §一、`ARCHITECTURE.md`

| 约束 | 来源 | 说明 |
|------|------|------|
| 动画安全 | `KFM_V4_INVARIANTS.md` §1.1 | 动画前后状态归位，`rebuildTree` 时 `L.isAnimating` 为 false |
| 类型安全 — 禁止 (as any) | `KFM_V4_INVARIANTS.md` §1.2 | 零逃逸，`check-as-any.mjs` 扫描 |
| 依赖方向 | `KFM_V4_INVARIANTS.md` §1.3 | L → canvas-utils → canvas-cursor → canvas-scroll → tree-render |
| GSAP 治理 | `KFM_V4_INVARIANTS.md` §1.4 | 所有 GSAP 通过 `animation-registry.ts` |
| 侧栏空间层级 | `KFM_V4_INVARIANTS.md` §1.5 | 所有侧栏 UI 以左栏为基础 |
| RenderContext 上下文栈 | `KFM_V4_INVARIANTS.md` §1.6 | 变体面板复用 pushContext/popContext |
| 指针事件统一 | `BUG_AUDIT_REGISTRY.md` §1.1 | 全项目统一使用 PointerEvent |
| touch-action | `BUG_AUDIT_REGISTRY.md` §1.2 | 全屏单页必须全局设为 `none` |
| 卡片堆全局模式 | `BUG_AUDIT_REGISTRY.md` §1.3 | 不是局部组件，整屏都是操作区域 |
| BR 光球双向切换 | `BUG_AUDIT_REGISTRY.md` §1.4 | 状态机必须闭环（compact ↔ active） |

---

## 注册中心

来源：`CLAUDE.md`（核心架构）

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `gesture-registry.ts` | document 级触摸事件统一调度 |
| `RendererLifecycle` (L) | `renderer-lifecycle.ts` | 渲染器生命周期 + 状态机 |
| `DOM` | `dom-refs.ts` | 全局 DOM 元素引用 |
| `Registry` | `ui-registry.ts` | UI 元素注册表 |

---

## 状态机

来源：`CLAUDE.md`（核心架构）

| 模块 | 状态机 |
|------|--------|
| tree-render | `idle ⇄ animating` (L.beginOp/endOp) |
| card-stack | `closed ⇄ opening ⇄ open ⇄ closing` |
| floating-card | `compact → expanding → active ⇄ editing` |
| orb (main) | `collapsed ⇄ expanding/collapsing ⇄ expanded ⇄ editing` |

---

## 关键约定速查

来源：`CLAUDE.md`（关键约定速查）

- `_` 前缀 = 模块内私有
- `L.renderer` 等通过 `renderer-lifecycle.ts` 单例访问
- `(as any)` **零逃逸**（白名单已清空，`check-as-any.mjs` 扫描）
- `Box.data` 必须通过 `getFileRowData()` 守卫访问
- 所有 GSAP 调用通过 `animation-registry.ts`，禁止直接 `import gsap`
- Canvas 滚动/点击走元素级监听，不走 GestureRegistry
- overlay 元数据用 `(as Box & OverlayMeta)` 类型访问
- 向 `ts` 加 tween 的函数，必须在 `ts.call` 回调里 `ts.clear()`
- 动画中 `_stateSub` 不会触发 `rebuildTree`（`L.isAnimating` 守卫）
