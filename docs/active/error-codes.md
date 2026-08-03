# 错误码总表（流程引导）

> 构建失败时，check 报错尾部带 `⛳ <前缀>-FLOW-<NN>` 引导——把处理者（agent 或人）
> 引回正确流程：读具体文档 + 走具体工作流步骤，而不是自己瞎猜修法。
> 错误码可统计（高频码 = 流程哪步最容易走错 → 针对性优化流程）。

## 判断标准（加码前先过这关）

一个 check 失败时，「正确的下一步」能否指引为**「读具体文档 + 走具体工作流步骤」**？
- 能 → 加引导码（流程门）
- 报错已自解释（如「跑 deploy-fast」）→ 不加，避免重复
- 只是修代码/文档本身错（tsc、check-console…）→ 不加，无流程语义

## DOC-FLOW（文档域：写文档/新机制）

| 码 | 触发 | 读什么 | 走 doc-write 第几步 |
|----|------|--------|---------------------|
| DOC-FLOW-01 | 孤儿文档（无引用） | doc-maintenance §必挂引用点 | 第 4 步 |
| DOC-FLOW-02 | MUST 未登记（decisions/detail 没进正规入口） | decisions/README §纪律 或 本域契约头注 | 第 4 步 |
| DOC-FLOW-03 | 可生成内容漂移（gen-page-state-schema） | generateable-facts.md | 第 2 步 |
| DOC-FLOW-04 | 工具文档参数节漂移（gen-tool-docs） | generateable-facts.md | 第 2 步 |
| DOC-FLOW-05 | 权限映射未登记（gen-permission-map / BAR-PERM-01） | harness-permission-engine.md §映射 | 第 2 步 |
| DOC-FLOW-06 | 规则登记表漂移（gen-rules-map） | detail-rules.md | 第 2 步 |
| DOC-FLOW-07 | 加载类文档超预算线（check-doc-budget） | doc-architecture §读/存分区 | 第 1 步 |
| DOC-FLOW-08 | 新代码文件无文档家（check-doc-coverage） | 对应域 contract.md 文件清单 | 第 4 步 |

## TEST-FLOW（测试/账本纪律：bug-fix 流程）

| 码 | 触发 | 读什么 | 走哪步 |
|----|------|--------|--------|
| TEST-FLOW-01 | fix 提交未带回归钉（check-fix-tests） | testing.md（补钉/登记/revert 验证） | bug-fix.yaml 补钉步骤 |
| TEST-FLOW-02 | BAR 钉未在 ledger 登记（check-bar-ledger） | bugs.md 登记纪律 | bug-fix.yaml 登记步骤 |
| TEST-FLOW-03 | ledger commit 引用悬空（check-ledger-commits） | history.md 账本纪律 | bug-fix.yaml 或账本修正 |

## MECH-FLOW（机制登记/同步：契约/实验/状态）

| 码 | 触发 | 读什么 | 走哪步 |
|----|------|--------|--------|
| MECH-FLOW-01 | 变异锚点失效（check-mutation-anchors） | probe-matrix report + semantic-mutate 锚点维护 | discipline-mechanize.yaml |
| MECH-FLOW-02 | 工具压缩行为未登记（check-tool-compaction） | detail-tool-compaction.md §映射表 | contract-maintain.yaml |
| MECH-FLOW-03 | 域契约过时（check-contract-freshness） | 对应域 contract.md | contract-maintain.yaml |
| MECH-FLOW-04 | 实验引用不完整（check-experiment-index） | experiments/index.md 登记 | 实验登记流程 |
| MECH-FLOW-05 | 工作流引用失效（check-workflow-integrity） | doc-architecture §工作流约定 | doc-tree-sync.yaml |
| MECH-FLOW-06 | 路由表不一致（check-consistency） | 跑 gen-route-table 回写 | doc-tree-sync.yaml |
| MECH-FLOW-07 | 状态新鲜度违反（check-state-freshness） | doc-maintenance §时点标注 | doc-write.yaml 第 3 步 或 state-sync.yaml |
| MECH-FLOW-08 | STACK 与事实漂移（check-active-stack） | active/STACK.md | state-sync.yaml |
| MECH-FLOW-09 | STACK 状态词矛盾（check-stack-status） | active/STACK.md §状态词 | state-sync.yaml |
| MECH-FLOW-10 | 巡逻心跳停摆（check-inbox-heartbeat） | /var/log/semantic-chain.log + crontab -l | 排查后手动补跑 semantic-chain.mjs；runner bug 走 bug-fix.yaml |

## 新错误码规程

1. 过判断标准（能指引「读 X 走 Y」）——流程门才加；
2. 分配前缀 + 编号：文档域 `DOC-FLOW` / 测试账本 `TEST-FLOW` / 机制同步 `MECH-FLOW`；
3. 登记本表（触发/读什么/走哪步）；
4. 对应 check 报错尾部补 `⛳ <码>：…——读 <文档>，走 <工作流>` 引导行。
