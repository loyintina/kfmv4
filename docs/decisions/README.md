# decisions 索引（决策层地图）

> 本层是**不可变决策记录**（ADR = 为什么这么设计；case-study = 案例研究/失败教训）。
> 索引让每份决策文档可去得——追溯「为什么」时从这进。文档正文不可改（改 = 新增
> ADR 并标注 superseded），但本索引随层内文件变化维护。

## ADR（架构决策记录）

| 编号 | 决策 | 状态 | 追溯入口 |
|------|------|------|---------|
| [ADR-001](adr-001-orb-floating-card-independent.md) | orb 与 floating-card 保持独立模块 | ✅ accepted | 浮卡契约 |
| [ADR-002](adr-002-card-unification-abandoned.md) | 卡片系统统一化两次失败后放弃 | ✅ accepted | ADR-001、浮卡契约 |
| [ADR-003](adr-003-frontend-optimizations-deferred.md) | v8.1 前端优化三项评估后放弃 | ✅ accepted | history 版本线、bugs 优化钉 |
| [ADR-004](adr-004-drift-provenance-rulings.md) | 漂移溯源审计三分歧裁决 | ✅ accepted | drift-provenance 深潜案、STACK |

## Case Study（案例研究）

| 案例 | 主题 | 追溯入口 |
|------|------|---------|
| [冰山工作量实验](case-study-iceberg-experiment.md) | 设计沉淀 vs 后续 fix 链长度 | invariants 心法 34、STACK |
| [模型选择错误](case-study-model-choice.md) | 液体粒子 portal 补丁链教训 | invariants 心法 8 |
| [重构愿景对照](case-study-refactor-thesis.md) | REFACTOR_THESIS 蓝图与现实的对照 | vision 远景、history |
| [统一化 SPEC 失败](case-study-unification-spec.md) | 统一化计划的失败教训 | ADR-002、ADR-001 |

## 纪律

- 新 ADR：`adr-0NN-<kebab-case>.md`，正文含「这是什么 / 别的去哪找」，加进本索引
- 新案例研究：`case-study-<kebab>.md`，加进本索引
- 每份决策文档至少被本索引引用（doc-orphan 纪律：文档不可孤悬）
