# 9.0 第二阶段基线：基建层（工坊）盘点

> 这是什么：9.0 线第二阶段（基建层插件化）的开工基线——对 kfmv4 工坊层
> （不跑在 app 运行时里的全部设施）的全量盘点，地位等同第一阶段对
> v8 src/ 36,012 行的盘点。
> 别的去哪找：拍板依据 → nine-zero-preface.md「拍板修订：基建层插件化归 9.0 线」；
> 归属 → nine-point-zero.md 域外节；运行时 16 契约 → 同目录。
> 2026-08-16 立，机械盘点（explore agent 全量扫描）。

## 总貌

| 区 | 文件 | 行数 | 角色 |
|----|------|------|------|
| scripts/ | 86 | ~9,554 | 检查链 + 生成器 + agent 脚本 + 部署运维 |
| docs/ | 124 | ~16,610 | 文档系统七层 + 规则文件 |
| tests/ | 163 | ~9,546 | 自研 harness + 回归 + 探针夹具 |
| experiments/ | 5 线 | 规则面 ~5.4k（paradigm 数据 ~188k 另计） | 研究线 + 通用实验契约 |

合计约 4.0–4.5 万行（不含实验数据与 venv）。粗分**六族**：

## 族一：检查链族（最大族，一切纪律的机械化落点）

- 入口 `scripts/check/chain.mjs`（132 行）：STEPS 清单 **59 项**统一执行，
  `--soft` 可降级指定步骤；`npm run check` 全链硬失败；失败记
  `~/.kfmv4/ledger/check-failures.jsonl`。
- **45 个检查器**（4,237 行），按功能分五群：
  - 链自洽：check-checks（每个 check 都在链上——自指门）；
  - 代码质量：as-any / console / anim / css-wiring / card-meta；
  - 注册表完整性：cards / registry / zindex / tool-compaction；
  - 文档系统门（最大群 14 个）：docs / doc-coverage / doc-schema /
    doc-budget / doc-orphans / doc-symbols / doc-scripts / doc-linerefs /
    code-doc-refs / code-map-coverage / contract-freshness / consistency /
    workflow-integrity；
  - 状态/纪律门：uncommitted / commit-docs / fix-tests / bar-ledger /
    ledger-commits / active-stack / stack-status / state-freshness /
    mutation-anchors / versions / hooks / secrets / release-radar
    （deploy-freshness 已于 2026-08-21 随 v8 冻结部署拍板退役）；
  - 机制/实验门：probes / probe-state / experiment-index /
    experiment-registry / inbox-heartbeat / kfmv4-data /
    agent-script-docs / test-patterns。
- 探针夹具 `tests/probes/` 24 个子目录：每个检查器的失效假件（正/负例）。
- git 钩子 `.githooks/`：commit-msg（薄壳调 commit-docs+fix-tests 硬门）、
  pre-push（警告 + 全链 check）。无外部 CI。

## 族二：生成器族（"可生成事实单一出处"）

10 个 gen-*（1,128 行），全部支持 `--check-only` 只读校验，回写走
`regenerate.sh` 一键化：route-table / capability-map / code-inventory /
contract-lists / experiments-list / page-state-schema / permission-map /
rules-map / scripts-catalog / tool-docs。
登记 manifest 2 份：scripts-catalog.manifest.json（permission/prompt/effect
三栏）、capability-map.manifest.json。

## 族三：文档系统族

docs/ 七层（设计原理 `guides/doc-architecture.md`，维护规则
`guides/doc-maintenance.md`——每条格式规则必须有机械消费者）：

| 层 | 内容 |
|----|------|
| workflows/ | 19 张工作流卡 yaml + 模板；CLAUDE.md 路由表由此生成 |
| constraints/ | invariants.md（539 行心法，编号永不重排）+ 5 detail |
| domains/ | 6 域 contract+code-map+detail；跨域 capability-map / code-inventory |
| active/ | stack.yaml / mechanism-registry.md / vision / error-codes / nine-zero/ |
| ledger/ | history / bugs / 语义审计 state / agent-inbox（信箱） |
| guides/ | 10 份 SOP（onboarding/testing/release/card-dev/agent-runner/spec-driven…） |
| decisions/ | 4 ADR + 4 case-study（不可变） |

规范中枢：CLAUDE.md（59 行，预算线 ≤60）+ 根 AGENTS.md（仅转发）。

## 族四：agent 运行时族（scripts/agent/ 16 个，2,982 行）

- agent-runner.mjs（325）：洁净室 agent 运行时（机械组装输入→LLM→机械校验）；
- browser-relay.mjs（334）：浏览器守视 daemon；
- 语义审计五件套：semantic-audit（516，探针集群编排）/ tasks（17+6 探针）/
  chain（巡逻总 runner，verdict 投信箱）/ mutate（变异基准卷）/ bench；
- 其余：obs-aggregate / tag-advisor / session-retention 等。

## 族五：实验/研究族

experiments/README.md 定义**通用实验契约**（协议/环境/地面真相/评判/数据/
索引/报告七角色）。五线：paradigm（范式包，已拍板远期）/ coldstart /
docprobe / dsh-na（产物=独立项目 kfm-na）/ harness-studies。
（注：session-runner 非独立目录，是 paradigm 线工具脚本。）

## 族六：部署运维族

deploy.sh（构建→重启→版本握手闭环）/ deploy-fast.sh / kfm-restart.sh
（HTTP 端点安全重启）/ auto-push.sh / sweep-sessions.sh / clean-npm-temp.cjs
+ 数据区结构门 check-kfmv4-data。

## 横向两个登记面

- **机制注册表** `docs/active/mechanism-registry.md`：21 机制，核心/外围两级，
  每条带失效信号与分级处置规则——回答"机制死没死"；
- **能力登记 manifest**（capability-map + scripts-catalog）——回答"东西在哪"。

## 盘点观察（设计素材）

1. **chain.mjs + check-checks + 机制注册表已经是一个原始插件系统**：
   检查器经 STEPS 注册、check-checks 机检"每个 check 都在链上"（注册完整性）、
   机制注册表给每个机制配失效信号（活性监控）。第二阶段不是从零发明，
   是把这个自发长成的系统按契约纪律扶正。
2. **生成器族 = 投影思想的运维版**："可生成事实单一出处 + --check-only 校验"
   与 №12 投影链同构。
3. **实验契约七角色已是插件契约雏形**：experiments/README 的七角色与
   契约模板九字段神似，可直接对齐。
4. **信箱 = 文档系统的 ctx**（已拍板方向）在本盘点中可落实：
   信箱是 docs/ledger/ 下唯一承担"跨实体通信"的件，其余文档层都是
   静态知识——通信面与知识面的分离，正是 ctx 与插件的分离。
