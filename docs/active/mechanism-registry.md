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
| 检查链 chain.mjs（59 步） | 核心 | 全（hard fail） | 任一步失败 = 构建中断，现实立即叫 | ✓（check-checks 夹具） | guides/onboarding.md（进门三验）+ nine-zero-phase2-contracts.md 契约 5 | 巡逻 |
| 探针自检 check-probes | 核心 | 全 | 检查器对负例不报错 → 探针报"已失效" | 运行器本身（24 夹具，2026-08-09 补 2 后回填订正） | guides/testing.md + nine-zero-phase2-contracts.md 契约 5 | 巡逻 |
| 工作流消费门（doc-orphans 三） | 核心 | 全（DOC-FLOW-12） | 规则文档无人消费 → 门报红 | ✓（doc-orphans 夹具） | guides/doc-maintenance.md | 巡逻 |
| 契约新鲜度 contract-freshness | 核心 | 全 | 域代码比契约新 → 构建中断 | ✗ 无探针（候选） | domains/code-inventory.md | 巡逻 |
| 文档预算 doc-budget | 核心 | 全 | 加载类文档超行数 → 中断 | ✓ | guides/doc-architecture.md | 巡逻 |
| 耦合门 commit-docs | 核心 | 全（hard fail + docs:na） | src/scripts 改动无 docs → 提交被拦 | 豁免（git 历史型） | guides/doc-architecture.md | 巡逻 |
| 落成门 probe-state | 核心 | 全 | 新功能无探头记录/陈旧 → 中断 | ✓ | experiments/docprobe/index.md（落成门节） | 巡逻 |
| BAR 钉制度（fix-tests/bar-ledger） | 核心 | 全 | fix 无钉/未登记 → 报红 | ✓（bar-ledger 夹具） | guides/testing.md + ledger/bugs.md | 巡逻 |
| 错误码引导 error-codes | 核心 | 全（⛳ 引导） | 构建失败无引导码 → agent 瞎修 | 被 check 文本消费 | active/error-codes.md | 巡逻 |
| 权限引擎（gen-permission-map） | 核心 | 全 | 新工具无 RiskClass → DOC-FLOW-05 | ✓ | active/harness-permission-engine.md | 巡逻 |
| 读写监狱（path-utils sanitizePath） | 核心 | 全（运行时） | 路径逃逸 → 拒绝 + 日志 | 运行时 BAR 钉 | domains/code-inventory.md + ledger/bugs.md | 巡逻 |
| 测试隔离 env-test-isolation | 核心 | 全 | 测试污染生产区 → check-kfmv4-data 报红 | ✓（间接） | guides/testing.md | 巡逻 |
| 生成器族 gen-* | 核心 | 全（--check-only） | 生成物与源漂移 → 中断 | ✓（多数） | active/generateable-facts.md + nine-zero-phase2-contracts.md 契约 6 | 巡逻 |
| 数据区结构 check-kfmv4-data | 核心 | 全 | 账本回潮/结构违例 → 中断 | ✓（2026-08-09 补） | guides/kfmv4-data.md | 巡逻 |
| 工具压缩登记 tool-compaction | 核心 | 全 | 新工具无压缩登记 → 中断 | ✓（2026-08-09 补） | domains/ai-chat/detail-tool-compaction.md | 巡逻 |
| 外部来源登记 external-sources | 外围 | 约定（pre-code-gate 清单） | 引外部代码没人登记 → 升级踩坑才知（滞后） | —（接受滞后+抽查） | ledger/external-sources.md | 巡逻 |
| 报错引导（撞墙含金量） | 核心 | 部分（29/54 带引导） | 报错无引导 → AI 反复不会改（墙倒） | 审计 2026-08-09 | active/error-codes.md（审计记录） | 巡逻 |
| 工作流系统 workflows | 核心 | 约定 + workflow-integrity | 工作流引用失效 → MECH-FLOW-05 | ✓（consistency） | guides/doc-maintenance.md | 巡逻 |
| 机械主人注入（semantic-audit prompt） | 外围 | 活源头现扫（机械）+ prompt 抑制（概率区，契约 0 修订注两区首例） | 注入失效 → 「机械主人」误报家族回潮进巡逻信箱（SEM001-1/SEM002-1 类发现再现） | ✓（BAR-SEMCHAIN-05 2 钉） | ledger/bugs.md（BAR-SEMCHAIN-05）+ 契约 0 修订注 | 巡逻 |
| 跨线评审信箱（docs/ledger/agent-inbox/，2026-08-15 自 dsh-na/inbox 迁入） | 外围 | 约定（append-only + 状态列更新）+ 巡逻心跳 check-inbox-heartbeat（2026-08-03 上线，机械化列滞后订正）；契约 3 定稿：信封四字段/归属行扫描器/代际戳待落地 | 信件状态列停滞（待回信不推进）→ 用户抽查/会话启动时发现；巡逻信箱沉默 → 心跳检查报红 | —（接受滞后+抽查） | ledger/agent-inbox/README.md + nine-zero-phase2-contracts.md 契约 3 | 巡逻 |
| 开源守门 check-secrets | 核心 | 全 | 工作树明文 key 泄露 → 硬失败（2026-08-01 三 key 事故催生；分级处置节早已提及，表漏行 2026-08-17 补） | ✗ 无探针（git 历史型豁免候选） | scripts/check/check-secrets.mjs 头注（规则与背景） | 巡逻 |

## 分级处置

- **核心机制**（上表 18 行，2026-08-17 补 secrets 后）：失效必须立即显形——探针 ✗ 的
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
