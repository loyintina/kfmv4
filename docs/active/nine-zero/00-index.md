# 9.0 设计文档地图（入口）

> 这是什么：9.0 设计文档的**唯一入口**——「找什么 → 去哪」。9.0 的信息
> 从这里出发，各文档的职责不重叠、引用不循环。对应降生协议（phase2 契约 1）
> 的「发现=路由表」设计：本目录的文档地图 = 文档世界给 agent 的发现面。
> 别的去哪找：跨线裁决史 → `../../ledger/agent-inbox/`（188 封信）；NA 线规格书
> → `../../../experiments/dsh-na/na/plugin-architecture-spec.md`；项目远景 →
> `../vision.md`。
>
> **⚠️ 本目录是规格书参考层（只读）。9.0 代码实现的唯一任务文档
> （状态/进度/接手指引）在 `/root/kfm-nz/TASK.md`**（2026-08-18 起单线）。
> 本目录文档与 kfm-nz 的关系：设计/契约/预排原文在此，执行状态在彼。

## 找什么 → 去哪

| 你要找的 | 去哪 |
|---------|------|
| 9.0 设计全景（拍板史 / 契约索引 / 待讨论） | `nine-zero-preface.md` |
| 第一阶段契约全文（运行时插件化 №1~№16） | `nine-zero-phase1-contracts.md` |
| 第二阶段契约全文（基建层插件化 0-9） | `nine-zero-phase2-contracts.md` |
| 「为什么这么定」（裁决史一张表） | `nine-zero-decision-index.md` |
| 台账 / 组件归宿 / 覆盖军规 | `nine-point-zero.md` |
| 基建层盘点（六族 + 两登记面） | `nine-zero-infra-inventory.md` |
| 三方语义映射表（文档世界↔Cordis↔cordis-na） | `nine-zero-semantic-map.md` |
| 能力审查（v8 能力 vs 9.0 契约覆盖） | `nine-zero-capability-review.md` |
| Cordis vendor 18 条强化评估 | `nine-zero-cordis-vendor-18-eval.md` |
| 隐式全局普查（window.__kfm* 清单） | `nine-zero-implicit-globals-audit.md` |
| 9.0 开发任务图（插件全景任务版 / 派活依据） | `nine-zero-dev-task-map.md` |
| dsh 取材总清单（任务×资产逐项对照 / 取材分类） | `nine-zero-dsh-sourcing.md` |
| 跨线评审往来（188 封信原始裁决） | `../../ledger/agent-inbox/` |
| NA 插件架构规格书（v1.3） | `../../../experiments/dsh-na/na/plugin-architecture-spec.md` |

## 文档地图（本目录 15 份 md；另含 nine-zero-plugin-map.html/json 两份全景图产物）

```
nine-zero/
├── 00-index.md                      ← 本文件（入口）
├── nine-zero-preface.md              ← 拍板史 + 契约索引 + 待讨论（瘦身版 292 行）
├── nine-zero-phase1-contracts.md     ← 一阶段契约 №1~№16（1508 行）
├── nine-zero-phase2-contracts.md     ← 二阶段契约 0-9（22KB）
├── nine-zero-decision-index.md       ← 决策索引（188 封信 → 一张表）
├── nine-zero-dev-task-map.md         ← 开发任务图（插件全景任务版，含小步预排）
├── nine-zero-dsh-sourcing.md        ← dsh 取材总清单（任务×资产对照）
├── nine-point-zero.md                ← 台账（组件归宿/军规）
├── nine-zero-infra-inventory.md      ← 基建层盘点（六族）
├── nine-zero-semantic-map.md         ← 三方语义映射（拼接视图）
├── nine-zero-semantic-map-cordis-side.md    ← 映射 Cordis 侧初稿（卡萝）
├── nine-zero-semantic-map-cordis-na-side.md ← 映射 cordis-na 侧初稿（NA）
├── nine-zero-capability-review.md    ← 能力审查
├── nine-zero-cordis-vendor-18-eval.md ← vendor 强化评估
└── nine-zero-implicit-globals-audit.md ← 隐式全局普查
```

## 阅读顺序（新读者）

1. `nine-zero-preface.md`（背景 + 拍板史 + 契约索引——30 分钟）
2. 按需进契约：先读 `nine-zero-phase1-contracts.md` 索引节，再读具体契约
3. 想查「为什么这么定」→ `nine-zero-decision-index.md`（出处信可回 agent-inbox）
4. 基建层 / 映射表 / 审计按任务需要进

## 维护规则

- **本文件是目录的活源头呈现**：新增文档必须在本地图登记一行（否则 check
  孤儿/读者找不到）；文档移动改名同步更新本表
- 契约迁出分文件的惯例：单个文档超 2000 行 + 内容已定稿 → 迁出并留索引节
  （第一阶段、第二阶段均照此办理）
- 决策索引随 agent-inbox 新信追加（只追加不删改）
- **单线纪律（2026-08-18）**：9.0 执行状态唯一写点 = `/root/kfm-nz/TASK.md`；
  本目录只维护规格书内容，不记执行进度
