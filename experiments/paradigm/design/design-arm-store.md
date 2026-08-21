# arm-store：实验臂数据库设计（paradigm 研究线基建）

> 2026-08-06 立。解决的问题：`.kfmv4/sessions/script/` 已淤积 **3883 个文件 /
> 105MB**（e11×1454、e12×324、px 系列 68、历次探针散件），面板文件树打不开该
> 目录；更根本的是**臂语义解码要靠考古**——arm id 里的 p/m 下标是**每批次
> 独立编号**（同一格 e11-t0p0m0 有 100 个文件、三种哈希后缀+无哈希变体），
> 只有哈希（task+paradigm+model 摘要）才是真消歧键，而批次→参数清单的映射
> 散落在结果文档和 shell 历史里。

## 设计判据

1. **臂是会话数据，不是文件**。臂的唯一消费者是判卷器和分析脚本，它们要的是
   「按语义条件取臂」，不是「按文件名 glob」。
2. **语义列在写入时落定**。批次清单（paradigms/models/provider/task）在
   batch-run 启动时全知——那时写库，零考古成本。文件名编码下标是
   「把数据库 Schema 压缩进文件名」的失败模式，废止。
3. **人可观测的留文件，机读的进库**。px 插件实验的 transcript（用户随时
   打开盯梢）、exam-state（续跑）、exam-meta（幂等跳过）保持文件——量小
   （17 跑 ×4 文件）且是人的界面。px 的会话 .json 同样留文件（17 个，无碍）。

## 库存储（`~/.kfmv4/experiments/arms.db`，node:sqlite）

node:sqlite 于 node v22 需 `--experimental-sqlite` 标志（本机 v22.22.1 已验证
可用，仅 ExperimentalWarning）——工具统一经 arm-store.mjs 入口，内部
`spawn` 或文档注明 `NODE_OPTIONS=--experimental-sqlite`。不引新 npm 依赖。

### 表：batches（批次注册表——根解下标歧义）

| 列 | 说明 |
|----|------|
| batch_id | PK，自增 |
| invoked_at | 启动时间 |
| prefix | e11-t0 / e12-t0 …（含任务下标） |
| task_file | 任务文件路径 |
| paradigms | JSON 数组，下标=pN |
| models | JSON 数组，下标=mN |
| provider | 硅基流动 / 聚光 … |
| arms_planned | 计划臂数 |

### 表：arms（臂）

| 列 | 说明 | 来源 |
|----|------|------|
| arm_id | PK（含哈希后缀全名） | batch-run 生成 |
| batch_id | FK → batches | 写入时 |
| experiment | e11 / e12 / … | 解析 prefix |
| task / paradigm / model / provider | **语义列** | 写入时直给 |
| rep | 重复序号 | 解析 id |
| status | ok / error / censored | 归档时判定（错误桩检） |
| message_count / token_count / full_token_count | 统计 | 会话文件已有字段 |
| chan | reasoning 通道分桶（none/partial/full） | 归档时扫描末条 AI 消息 |
| occupancy | 上下文占用率分桶 | full_token_count ÷ 模型上下文（模型登记表） |
| created_at / updated_at | 时间 | 会话文件已有字段 |
| content | 完整会话 JSON（原文件内容） | 原样 |

索引：`(experiment, paradigm, model)`、`(batch_id)`、`(status)`。
判卷结果不进库——判卷归档（meta-pool/*.json）是 git 跟踪的结果层，维持现状。

## 访问层（`experiments/paradigm/tools/arm-store.mjs`）

```
putArm({batchId, armId, task, paradigm, model, provider, rep, content})  # batch-run 写
getArm(armId) → content JSON                                             # 判卷/分析读
listArms({experiment, paradigm, model, status, prefix}) → arm_id[]       # 枚举（替代 glob）
iterArms(filter) → 逐臂 yield（判卷主循环）
registerBatch({prefix, taskFile, paradigms, models, provider}) → batchId # batch-run 启动时
```

改动面：batch-run（启动注册批次 + 归档写库）、judge-llm（--prefixes 枚举改走
listArms，读内容改 getArm）、分析脚本（格均值/分桶直接 SQL）。plugin-exam 不动
（px 留文件）。session-runner 不动（它只负责跑和写 out 路径——batch-run 拿到
out 后读文件入库再删，或后续让 runner 直接回调；**一期保持 runner 写文件、
batch-run 入库后删文件**，改动最小）。

## 存量迁移（1778 臂）

解码策略（按优先级）：
1. **哈希重算**：从历史批次命令（结果文档/wrapper/shell 历史）收集全部
   (task, paradigm, model) 组合，重算哈希匹配 `-xxxxxx` 后缀 → 精确解码。
2. **内容嗅探**：无哈希裸 id——model/provider 读文件顶层 modelId/providerId；
   范式读 user 消息里的〔范式包〕包裹匹配已知包文本；任务读首条 user 消息
   匹配任务文件。
3. **隔离区**：解码失败的进 `_quarantine`（现状已有 1 个），不丢。

迁移脚本 dry-run 先出解码覆盖率报告，用户确认后执行。**原文件不删**，移到
`~/.kfmv4/experiments/paradigm/sessions-archive/`（保留一个完整分析周期，
验证 DB 数据足以复现格均值分析后才清理）。sessions/ 根目录 36 个散件 json
另行盘点（多为早期探针，同法处置）。

## 分期

1. **一期（本设计落地）**：arm-store.mjs + batches/arms 表 + batch-run/judge-llm
   接入 + 存量迁移。验收：格均值分析纯走 DB 复现一次，与文件版结果一致；
   sessions/script 只剩 px 系列与运行态文件。
2. **二期（后议）**：判卷结果表化、px 会话入库、分析 SQL 视图固化、
   面板「实验浏览器」卡（读 DB 展示臂/判分）——与 subagent 工具线会合。

## 风险与开放问题

- node:sqlite 实验性：API 在 node 22→24 间有变动史，升级 node 时需回归验证
  （写入 docs/active/STACK.md 备注）。
- 并发写：batch-run 并发 3-6 写库——sqlite WAL 模式 + 单写者队列
  （arm-store 内部串行化 putArm）。
- 105MB 会话 JSON 入库后 DB ~120MB——可接受；content 列不建索引。
- 模型上下文长度登记表（occupancy 分母）还没有——并入一期，先从模型池
  22 个条目起步（experiments/paradigm/model-*.md 已有成本数据处扩列）。
