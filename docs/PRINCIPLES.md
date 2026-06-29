---
status: active
created_at: 2026-06-29
---

# KFM v4 — 约束全表

> 所有心法原则、架构约束、隐性契约的一站式查找表。
> 每一条原则只有一个权威定义位置（SSoT），此处仅记录链接和摘要。
>
> 关联文档：
> - `docs/KFM_V4_INVARIANTS.md` — 心法原则全文 + 修改自查清单
> - `docs/DIAGNOSTICS.md` — 隐性契约全文 + 诊断流程 + 根因案例库

---

## 心法原则（17 条）

来源：`docs/KFM_V4_INVARIANTS.md` §〇

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
| 13 | 能自己做完的事就该自己做完 | 不给后续 agent 留半截工作 |
| 14 | 替换分散不等于解决根因 | 集中化的违规仍是违规 |
| 15 | 以实为准，忌凭记忆 | 确认"是否已完成"必须用实际文件内容验证 |
| 16 | 一个数据对象只能有一个生产者 | 两套机制追同一份数据必然打架，删掉一个 |
| 17 | 修复 bug 时不在旁边另开一条路 | 修正原路径，不加补偿路径——新增未删旧 = 补丁 |

---

## 架构约束

来源：`docs/KFM_V4_INVARIANTS.md` §一

| 约束 | 来源 | 说明 |
|------|------|------|
| 动画安全 | §1.1 | 动画前后状态归位，`rebuildTree` 时 `L.isAnimating` 为 false |
| 类型安全 — 禁止 (as any) | §1.2 | 零逃逸，`check-as-any.mjs` 扫描 |
| 依赖方向 | §1.3 | L → canvas-utils → canvas-cursor → canvas-scroll → tree-render |
| GSAP 治理 | §1.4 | 所有 GSAP 通过 `animation-registry.ts` |
| 侧栏空间层级 | §1.5 | 所有侧栏 UI 以左栏为基础 |
| RenderContext 上下文栈 | §1.6 | 变体面板复用 pushContext/popContext |

---

## 隐性契约（11 条）

来源：`docs/DIAGNOSTICS.md` §一

> 违反这些契约会触发难以排查的 bug。修改对应模块前必须先确认合规。

| # | 契约 | 关键词 |
|---|------|--------|
| 1.1 | 全项目统一使用 PointerEvent | PointerEvent、GestureRegistry、事件混用 |
| 1.2 | 全屏单页 `touch-action: none` | touch-action、pointercancel、手势截断 |
| 1.3 | 卡片堆是全局模式 | targetFilter、外部区域、全局接管 |
| 1.4 | BR 光球双向切换 | togglePanel、状态机闭环 |
| 1.5 | 卡片背景和边框正交解耦 | 双层 DOM、background 层叠 |
| 1.6 | 浮卡和卡片堆共享 DOM 结构 | flow 布局、视觉统一 |
| 1.7 | 卡片双色渐变颜色对应规则 | 135deg、color1→右、color2→左 |
| 1.8 | 配色种子在 openCardStack 时生成 | _currentAccents 初始化时序 |
| 1.9 | 批量修改必须合并为一次 notify | setExpanded、L.isAnimating 守卫 |
| 1.10 | 侧栏布局 content + tools = 100dvh | calc(100%-52px)、position:sticky |
| 1.11 | Canvas 尺寸数据源随上下文切换 | L.renderer?.canvas、DOM.treeCanvas |

---

## 注册中心

来源：`CLAUDE.md`（核心架构）

| 注册中心 | 文件 | 职责 |
|----------|------|------|
| `GestureRegistry` | `src/client/modules/gesture-registry.ts` | document 级触摸事件统一调度 |
| `RendererLifecycle` (L) | `src/client/modules/renderer-lifecycle.ts` | 渲染器生命周期 + 状态机 |
| `DOM` | `src/client/modules/dom-refs.ts` | 全局 DOM 元素引用 |
| `cardRegistry` | `src/client/modules/card-registry.ts` | 卡片类型注册 + 实例管理 |
| `anim` | `src/client/modules/animation-registry.ts` | GSAP 隔离层 |

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

## 手势优先级

| 处理器 | 优先级 | 场景 |
|--------|--------|------|
| orb | 100 | 主光球交互 |
| card-stack-global | 90 | 卡片堆全屏模式（关闭时否决自身） |
| card-stack-close | 80 | 卡片堆内部关闭手势 |
| terminal-scroll | 61 | 终端卡 Canvas 滚动 |
| sidebar-scroll | 60 | 侧栏文件树滚动 |
| gestures-page-swipe | 50 | 页面级滑动（卡片堆打开时否决自身） |

---

## 关键约定速查

- `_` 前缀 = 模块内私有
- `L.renderer` 等通过 `renderer-lifecycle.ts` 单例访问
- `(as any)` **零逃逸**（白名单已清空，`check-as-any.mjs` 扫描）
- `Box.data` 必须通过 `getFileRowData()` 守卫访问
- 所有 GSAP 调用通过 `animation-registry.ts`，禁止直接 `import gsap`
- overlay 元数据用 `(as Box & OverlayMeta)` 类型访问
- 向 `ts` 加 tween 的函数，必须在 `ts.call` 回调里 `ts.clear()`
- 动画中 `_stateSub` 不会触发 `rebuildTree`（`L.isAnimating` 守卫）
- `crypto.randomUUID()` → 用 `_uuid()` 替代（兼容旧浏览器）
- 所有卡片内容通过 `buildCardLayout()` 统一骨架
