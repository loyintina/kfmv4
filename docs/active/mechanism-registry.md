# 机制注册表（mechanism registry）

> **这是什么**：kfmv4 依赖的核心机制地图——让"机制生态"可见，让"机制死了"可被察觉。
> 2026-08-09 立项（external-sources 复盘 → 递归终止框架落地：用地图+条款+审计防腐烂，
> 不是加守护机制层——机制连现实，不连另一层机制）。
> 更新：新机制落地时登记一行（invariants §六 自检引导）；低频手工维护，无常驻自动化。

## 登记表

> 2026-08-17 契约 0/2 回填：七字段版（补「规约出处」「状态」两列）。
> 规约出处 = 规则书面所在（path；锚点为该文件相应机制节）；状态 ∈
> 登记 / 巡逻 / 失效显形 / 退役（契约 0 生命周期四态）。存量 20 行回填 +
> 补 secrets 漏行（分级处置早已提及但表无行）= 21 条，与 9.0 基线盘点对齐。

| 机制 | 类型 | 机械化 | 失效信号（现实怎么叫） | 探针 | 规约出处 | 状态 |
|---|---|---|---|---|---|---|
| 检查链 chain.mjs + check-checks（自指门） | 核心 | 全（hard fail；STEPS 清单 + 每脚本在链对账） | 任一步失败 = 构建中断，现实立即叫 | ✓（check-checks 夹具） | guides/onboarding.md（进门三验）+ nine-zero-phase2-contracts.md 契约 5 | 巡逻 |
| 探针自检 check-probes | 核心 | 全 | 检查器对负例不报错 → 探针报"已失效" | 运行器本身（24 夹具，2026-08-09 补 2 后回填订正） | guides/testing.md + nine-zero-phase2-contracts.md 契约 5 | 巡逻 |
| 工作流消费门（check-doc-orphans + check-doc-coverage + check-doc-scripts 三） | 核心 | 全（DOC-FLOW-12） | 规则文档无人消费 → 门报红 | ✓（doc-orphans 夹具） | guides/doc-maintenance.md | 巡逻 |
| 契约新鲜度（check-contract-freshness） | 核心 | 全 | 域代码比契约新 → 构建中断 | ✗ 无探针（候选） | domains/code-inventory.md | 巡逻 |
| 文档预算（check-doc-budget） | 核心 | 全 | 加载类文档超行数 → 中断 | ✓ | guides/doc-architecture.md | 巡逻 |
| 耦合门（check-commit-docs） | 核心 | 全（hard fail + docs:na） | src/scripts 改动无 docs → 提交被拦 | 豁免（git 历史型） | guides/doc-architecture.md | 巡逻 |
| 落成门（check-probe-state） | 核心 | 全 | 新功能无探头记录/陈旧 → 中断 | ✓ | experiments/docprobe/index.md（落成门节） | 巡逻 |
| BAR 钉制度（check-fix-tests + check-bar-ledger + check-test-patterns 计数模式） | 核心 | 全 | fix 无钉/未登记 → 报红 | ✓（bar-ledger 夹具） | guides/testing.md + ledger/bugs.md | 巡逻 |
| 错误码引导 error-codes | 核心 | 全（⛳ 引导） | 构建失败无引导码 → agent 瞎修 | 被 check 文本消费 | active/error-codes.md | 巡逻 |
| 权限引擎（gen-permission-map） | 核心 | 全 | 新工具无 RiskClass → DOC-FLOW-05 | ✓ | active/harness-permission-engine.md | 巡逻 |
| 读写监狱（path-utils sanitizePath） | 核心 | 全（运行时） | 路径逃逸 → 拒绝 + 日志 | 运行时 BAR 钉 | domains/code-inventory.md + ledger/bugs.md | 巡逻 |
| 测试隔离 env-test-isolation | 核心 | 全 | 测试污染生产区 → check-kfmv4-data 报红 | ✓（间接） | guides/testing.md | 巡逻 |
| 生成器族（gen-route-table / gen-capability-map / gen-code-inventory / gen-contract-lists / gen-experiments-list / gen-page-state-schema / gen-permission-map / gen-rules-map / gen-scripts-catalog / gen-tool-docs + sync-counts） | 核心 | 全（--check-only） | 生成物与源漂移 → 中断 | ✓（多数） | active/generateable-facts.md + nine-zero-phase2-contracts.md 契约 6 | 巡逻 |
| 数据区结构 check-kfmv4-data | 核心 | 全 | 账本回潮/结构违例 → 中断 | ✓（2026-08-09 补） | guides/kfmv4-data.md | 巡逻 |
| 工具压缩登记（check-tool-compaction） | 核心 | 全 | 新工具无压缩登记 → 中断 | ✓（2026-08-09 补） | domains/ai-chat/detail-tool-compaction.md | 巡逻 |
| 外部来源登记 external-sources | 外围 | 约定（pre-code-gate 清单） | 引外部代码没人登记 → 升级踩坑才知（滞后） | —（接受滞后+抽查） | ledger/external-sources.md | 巡逻 |
| 报错引导（撞墙含金量） | 核心 | 部分（29/54 带引导） | 报错无引导 → AI 反复不会改（墙倒） | 审计 2026-08-09 | active/error-codes.md（审计记录） | 巡逻 |
| 工作流系统 workflows | 核心 | 约定 + check-workflow-integrity + check-consistency | 工作流引用失效 → MECH-FLOW-05 | ✓（consistency） | guides/doc-maintenance.md | 巡逻 |
| 机械主人注入（semantic-audit prompt） | 外围 | 活源头现扫（机械）+ prompt 抑制（概率区，契约 0 修订注两区首例） | 注入失效 → 「机械主人」误报家族回潮进巡逻信箱（SEM001-1/SEM002-1 类发现再现） | ✓（BAR-SEMCHAIN-05 2 钉） | ledger/bugs.md（BAR-SEMCHAIN-05）+ 契约 0 修订注 | 巡逻 |
| 跨线评审信箱（docs/ledger/agent-inbox/，2026-08-15 自 dsh-na/inbox 迁入） | 外围 | 约定（append-only + 信头 `> 状态:` 字段更新）+ 巡逻心跳 check-inbox-heartbeat（2026-08-03 上线，机械化列滞后订正）+ 台账一致性 check-agent-inbox（2026-08-18 上线；同日晚 D3 转型：机读头 schema/命名/计数/索引覆盖四查，双向对应移交生成器）+ gen-agent-inbox（2026-08-18 D3 落地：台账投影生成器 + 归属行扫描器 `--for=<线名>` 一体，check-only 挂链）；契约 3 定稿机械件：信封四字段（机读头七字段含之）/归属行扫描器已落地，**代际戳待落地** | 信件状态列停滞（待回信不推进）→ 用户抽查/会话启动时发现；巡逻信箱沉默 → 心跳检查报红 | —（接受滞后+抽查） | ledger/agent-inbox/README.md + nine-zero-phase2-contracts.md 契约 3 + experiments/agent-mailbox/（代码世界事件面研究线，2026-08-18 立） | 巡逻 |
| 开源守门 check-secrets | 核心 | 全 | 工作树明文 key 泄露 → 硬失败（2026-08-01 三 key 事故催生；分级处置节早已提及，表漏行 2026-08-17 补） | ✗ 无探针（git 历史型豁免候选） | scripts/check/check-secrets.mjs 头注（规则与背景） | 巡逻 |


| 文档质量门族（check-docs + check-doc-schema + check-doc-links） | 核心 | 全 | 文档质量/结构违例/路径断链 → 中断 | ✓（docs 夹具） | guides/doc-architecture.md | 巡逻 |
| 语义审计机械化族（check-doc-symbols / check-doc-linerefs / check-doc-scripts / check-ledger-commits / check-code-doc-refs / check-mutation-anchors） | 核心 | 全 | 符号/行号/脚本引用失效 → 中断（v8.3 语义审计 M1/M3 + SEM001 收割） | ✓（多数） | ledger/history.md（v8.3 机械化记录） | 巡逻 |
| 工作栈族（check-active-stack + check-stack-status + check-state-freshness） | 核心 | 全 | 栈条目漂移/状态停滞 → 中断 | ✓ | active/stack.yaml（schema 即规约）+ guides/onboarding.md | 巡逻 |
| 卡片完整性族（check-cards + check-card-meta + check-registry + check-css-wiring + check-zindex） | 核心 | 全 | 卡注册/类型逃逸/CSS 接线/z 层级违例 → 中断 | 部分 | domains/floating-card/contract.md + domains/client-shell/contract.md | 巡逻 |
| 代码卫生族（check-as-any + check-anim + check-console） | 核心 | 全 | as any/动画导入/console 残留 → 中断 | — | scripts/check/check-as-any.mjs 头注（脚本头注即规约，secrets 先例） | 巡逻 |
| 覆盖门族（check-doc-coverage + check-code-map-coverage） | 核心 | 全 | 文档/部件级 code-map 裸奔 → 中断（HUD 裸奔事故机械化） | — | guides/doc-maintenance.md | 巡逻 |
| 部署运河（check-deploy-freshness + check-versions + check-release-radar，契约 7 两行之一） | 核心 | 全 | 旧包部署/版本不一致/tag 缺失 → 中断 | 豁免（git 历史型，部分） | nine-zero-phase2-contracts.md 契约 7 + guides/release.md | 巡逻 |
| 数据卫生（契约 7 两行之二；机械=check-kfmv4-data + sweep-sessions/session-retention 非检查脚本） | 核心 | 全 | 账本回潮/数据区违例 → 中断 | ✓（间接） | nine-zero-phase2-contracts.md 契约 7 | 巡逻 |
| 实验登记族（check-experiment-index + check-experiment-registry，契约 9） | 核心 | 全 | 实验区黑户/索引违例 → 中断 | — | nine-zero-phase2-contracts.md 契约 9 | 巡逻 |
| 迁移验证线（check-migration-baseline，M1 基线矩阵） | 核心 | 全（--record 发布录 / verify 挂链） | 8.x 换心缩水 → 基线门报红 MIG-BASE-01 | ✓（check-migration-baseline 夹具） | nine-zero-dev-task-map.md 迁移验证线节 + guides/release.yaml | 巡逻 |
| agent 脚本发现性门（check-agent-script-docs） | 核心 | 全 | agent 脚本文档缺失 → 中断 | — | guides/agent-runner.md | 巡逻 |
| git 提交卫生族（check-hooks + check-uncommitted） | 核心 | 全 | 钩子缺失/未提交改动 → 中断 | 豁免（git 历史型，uncommitted） | CLAUDE.md（构建与运行） | 巡逻 |
| 注册表守卫 broker（check-mechanism-registry，守卫五件本体） | 核心 | 全（完备性/同名/出处存在/死后访问/链步数咬合） | 黑户脚本/同名机制/死链规约/僵尸引用/链步数漂移 → 中断 MECH-GUARD-01~05 | ✓（check-mechanism-registry 夹具） | nine-zero-phase2-contracts.md 契约 2 | 巡逻 |

## 豁免区

> 契约 2：与机制同文件，一眼对账。格式：| 脚本名 | 豁免理由 |。当前零豁免。

| 脚本 | 理由 |
|---|---|

## 分级处置

- **核心机制**（上表 31 行）与**外围机制**（3 行），共 34 条（2026-08-18 守卫四件收编 13 群后）：失效必须立即显形——探针 ✗ 的
  2 个（contract-freshness / secrets）是**探针补强候选**；kfmv4-data 与
  tool-compaction 已于 2026-08-09 补夹具（本表探针列 ✓，分级处置原文滞后订正）。
- **外围机制**：接受滞后失效信号 + 用户抽查兜底，不设守护（external-sources 即此类）。
- **退役规则**：外围机制失效信号长期无法验证 + 无真实使用 → 退役候选（doc-architecture
  §退役）。

## 历史

- 2026-08-09 立项：机制注册表（递归终止框架落地第一步）。盘点 17 个机制，
  4 个核心检查器无探针。
- 2026-08-09 体检：17 机制失效信号全部可验证或合理豁免（report：
  harness-studies/mechanism-audit-2026-08-09.md）；补 kfmv4-data + tool-compaction
  探针（22→24）；contract-freshness/secrets 为 git 历史型豁免（有据）。
- 2026-08-09 报错引导审计：54 脚本 29 带引导 / 25 无（自解释豁免/半引导可后补/待核实）；
  标准=病因+位置+修正路径；存量不批量补，撞墙倒再补（反预设）。
- 2026-08-12 登记：机械主人注入（BAR-SEMCHAIN-05，SEM001-1/SEM002-1 结晶机械化）——
  概率区机制，失效信号 = 误报家族回潮进巡逻信箱。
- 2026-08-17 契约 0/2 回填（茉莉·本体线，A 组落地清单）：五列升七字段（补规约出处/
  状态），存量 20 行回填；补 secrets 漏行（21 条与 9.0 基线盘点对齐）；订正三处滞后
  （探针夹具 22→24 / secrets 无表行 / 信箱行缺 check-inbox-heartbeat 机械化注）。
  状态列首填全部「巡逻」（无退役/失效显形中条目）。契约 2 守卫四件上线后本表进入
  机械对账时代。
- 2026-08-18 守卫四件落地（茉莉·本体线，A 组收尾）：契约 5 点名的 30 黑户按机制群
  收编 13 行（文档质量/语义审计机械化/工作栈/卡片完整性/代码卫生/覆盖门/部署运河/
  数据卫生/实验登记/迁移验证线/agent 发现性/git 卫生/broker 守卫自身）；3 行机械清单
  扩展（检查链+自指门 / BAR 钉+计数模式 / 工作流+consistency）；豁免区立档（零豁免）。
  check-mechanism-registry.mjs 守卫四件挂链——注册表从「低频手工维护」转机械对账时代。
- 2026-08-18 九零审计机械化收尾（同日晚）：check-doc-links 收编进文档质量门族行、
  check-agent-inbox 收编进信箱行（均按契约 5 机制群归行，不新增行数）；守卫四件升
  五件——补 ⑤ 链步数咬合（MECH-GUARD-05，注册表「N 步」声称对账 chain.mjs STEPS
  源码计数，堵审计抓到的 59→60 漂移类）。
- 2026-08-18 信箱行规约出处增补：experiments/agent-mailbox/ 研究线立项
  （用户拍板；评审会话主理；议题 6 送审五问迁入解挂 + Q6 事件面/Q7 传输探针），
  信箱机制「账本 → 事件面」演进有了正式承接位。
- 2026-08-18 信箱台账生成化落地（评审会话，agent-mailbox 研究线 D3，用户拍板）：
  43 封存量信回填机读头七字段（日期/致/流型/预期表态方/收敛判据/回/状态，
  对齐契约 3 四字段）；gen-agent-inbox 上线（台账投影生成器 + 归属行扫描器
  `--for=<线名>` 一体，--check-only 挂链紧跟 check-agent-inbox）；check-agent-inbox
  转型——双向对应检查删除（生成器保证），新增机读头 schema 校验（状态词表从
  README 规则区解析，唯一出处），命名/计数/索引覆盖三查保留（覆盖信号源换机读头）。
  契约 3 点名机械件三件落地其二，代际戳留「待落地」。
