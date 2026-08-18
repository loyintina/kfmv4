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
| DOC-FLOW-09 | 新部件无 code-map 家（check-code-map-coverage：main.ts 直挂部件未入图） | 对应域 code-map.md（实然测绘） | 第 4 步 |
| DOC-FLOW-10 | 新 agent 脚本无发现路径（check-agent-script-docs：scripts/agent/*.mjs 未登记，exp-* 豁免） | guides/agent-runner.md 负载登记节 | 第 4 步 |
| DOC-FLOW-11 | 实验产物无发现路径（check-experiment-registry：tools/specs/results/design 等未入实验登记面，数据区豁免） | experiments/paradigm/index.md 产物登记面节 | 第 4 步 |
| DOC-FLOW-12 | 规则/机制类文档无工作流消费（check-doc-orphans 第三层门：active/guides/constraints 须被 workflow reads/check 脚本/CLAUDE-README 任一引用，仅 docs 互引不算） | doc-architecture §结构原则 #5（执法缝隙注记） | 第 4 步 |
| DOC-FLOW-13 | 文档内路径引用断链（check-doc-links：markdown 链接/反引号路径目标不存在） | doc-maintenance（目录迁移后同步引用） | 第 4 步 |

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
| MECH-FLOW-08 | STACK 与事实漂移（check-active-stack） | active/stack.yaml | state-sync.yaml |
| MECH-FLOW-09 | STACK schema/编号/bug 入口违例（check-stack-status） | active/stack.yaml 头注规范 | state-sync.yaml |
| MECH-FLOW-10 | 巡逻心跳停摆（check-inbox-heartbeat） | /var/log/semantic-chain.log + crontab -l | 排查后手动补跑 semantic-chain.mjs；runner bug 走 bug-fix.yaml |
| MECH-FLOW-11 | 功能未过落成门探头/记录缺失陈旧（check-probe-state） | experiments/docprobe/index.md §落成门 | 跑 probe-capability.mjs 补探测；修路后重跑 |
| MECH-FLOW-12 | 信箱文件命名违例（check-agent-inbox b：非 ASCII/前缀/类型词出格；台账双向对账自 D3 起由 gen-agent-inbox 生成保证，不再属本码） | ledger/agent-inbox/README.md 规则节 | 按命名规则改名（仅新信；存量 7 封 LEGACY 豁免） |
| MECH-FLOW-13 | 信件计数声称滞后（check-agent-inbox c：「N 封信」≠ 目录实际数） | 00-index.md / nine-zero-decision-index.md | 改数字追平目录 |
| MECH-FLOW-14 | 已落定决策未入索引（check-agent-inbox d：已裁决/终审/已落地/已验证信件未被 decision-index 提及） | nine-zero-decision-index.md 维护注 | 索引表补一行（出处信必填） |
| MECH-FLOW-15 | 信件机读头 schema 违例（check-agent-inbox a：七字段缺失/日期非法/流型出四流型集/「致」线名出表/状态词前缀出词表） | ledger/agent-inbox/README.md 规则节「机读头 schema」条 | 补全或改正信头字段，跑 gen-agent-inbox 回写台账 |
| MECH-FLOW-16 | 信件停滞（check-agent-inbox e：「待*」状态 + 发信超 7 天） | ledger/agent-inbox/README.md 规则节「阅信纪律」条 | 归属线按阅信纪律处理或回信说明；阈值为执行层参数（改 check-agent-inbox.mjs STALE_DAYS） |

## 新错误码规程

1. 过判断标准（能指引「读 X 走 Y」）——流程门才加；
2. 分配前缀 + 编号：文档域 `DOC-FLOW` / 测试账本 `TEST-FLOW` / 机制同步 `MECH-FLOW`；
3. 登记本表（触发/读什么/走哪步）；
4. 对应 check 报错尾部补 `⛳ <码>：…——读 <文档>，走 <工作流>` 引导行。
