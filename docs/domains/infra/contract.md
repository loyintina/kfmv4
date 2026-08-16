> 这是什么：构建管线、测试体系、检查脚本。
> 别的去哪找：测试方法论 → ../../guides/testing.md；服务端运行时 → ../server/。

# infra 域契约

## 构建（build.mjs）

## 检查管线（npm run check，45 脚本，顺序固定）

（链步数多于脚本数：脚本数 = check-*.mjs 文件实数即标题数（sync-counts 派生，勿复述——手写「43」曾陈旧被打）；
deploy-freshness/doc-coverage 链上省前缀；sass/gen-* 验证步、sync-counts、npm test、tsc 非 check-* 不计入。2026-08-08 修订统一计数。）

**域映射纪律（2026-08-06 定稿）**：新增 src/ 文件必须登记 `scripts/check/domain-src.mjs`
对应域（client-shell 模块级枚举 / server·infra 目录级）——未登记的文件 check-contract-freshness
对它的文档同步永久失明（obs-hud.ts 首犯，2026-08-06 被链当场拦下）。

**文档工作流消费门（2026-08-09，doc-orphans 第三层门）**：active/guides/constraints 规则类
须被 workflows reads/check 脚本/CLAUDE-README 任一消费（仅 docs 互引不算；detail-* 例外走
invariants 链或工作流消费）。⛳ DOC-FLOW-12。

<!-- chain:auto 由 sync-counts 生成，禁止手改 -->
`check-uncommitted`（>3 未提交即中断，首位） → deploy-freshness → versions → checks → doc-coverage →
code-map-coverage → agent-script-docs → experiment-registry → sass → css-wiring → tool-compaction →
anim → as-any → card-meta → registry → zindex → console → secrets → state-freshness →
mutation-anchors → docs → consistency → active-stack → stack-status → inbox-heartbeat →
code-doc-refs → workflow-integrity → cards → contract-freshness → test-patterns → bar-ledger →
ledger-commits → doc-budget → doc-symbols → doc-scripts → doc-linerefs → doc-schema → commit-docs →
fix-tests → hooks → gen-page-state-schema → gen-tool-docs → gen-permission-map → gen-rules-map →
gen-experiments-list → gen-scripts-catalog → doc-orphans → probes → release-radar → experiment-index →
kfmv4-data → probe-state → sync-counts → gen-code-inventory → gen-contract-lists → gen-route-table →
gen-capability-map → npm test → tsc。
<!-- /chain:auto -->

**链外概率区自动化（2026-07-30 登记）**：`scripts/agent/semantic-chain.mjs`（语义巡逻，
cron 每日 04:17 + 每周一 04:23 带变异基准）与 tag-advisor/semantic-audit/bench 同属
agent 脚本层——检测归自动化，裁决归会话内 agent，**永远不进 check 链**（verdict 门控
注意力不门控合并，概率区纪律；指南见 ../guides/agent-runner.md）。

## 硬规则

1. **新 check 一律 hard fail**——warning 对 agent 等于不存在。
   设计性例外须登记（语义审计 B1 修订）：check-release-radar（发版提醒，只 WARN）、
   check-uncommitted（≤3 文件只警告）。例外清单外新增 warning-only check = 中断。
2. **钩子接线脚本必须声明模式**——`.githooks/` 薄壳接线的脚本头部机器可读声明
   `MODE: hard-fail|warning`，壳注释模式词必须一致（check-hooks 第 4 条对账）。
   事故原型：耦合门升 hard fail 改脚本忘改壳，壳写死 exit 0 吞码，拦截虚掩（2026-07-30）。
3. **新增工具/卡片/模块必须过对应双向核对 check**（tool-compaction/cards/registry），
   不登记 = 构建中断。
4. **fix 提交必须带回归钉**（BAR-FIX-TESTS-01，2026-07-30）：commit-msg 钩子 +
   构建链双执法点——`fix:` 提交未触及 `tests/` = 中断；确认无需补钉（纯配置/
   文案/构建修复）用独立行 `tests:na` 豁免。
5. **部署新鲜度硬门**（BAR-DEPLOY-01，2026-07-30）：`dist/build-info.json` 的
   buildTime 必须 ≥ max(HEAD 提交时间, src 最新 .ts mtime)——源码比包新 = 链红
   （防「修了源码验证旧包」）；`build.mjs` 内以 `--soft` 防自锁；`deploy-fast.sh`
   快通道（--fast 跳过全链）保提交节奏；version-watch 浏览器横幅比对 bundle 内嵌
   BUILD_TIME 与服务端 buildTime 同值判定旧包（单源：build.mjs 一处生成）。
6. **新增服务端依赖同步 build.mjs external 列表**。
7. **禁止 (as any)**（自 INVARIANTS §四.2）：新建代码零逃逸，check-as-any 扫描，
   新增逃逸构建中断；确因类型定义缺失必须 ① check-as-any WHITELIST 登记（注释原因）
   ② 代码行加 `// P2:` 备注根因。
8. **明文 key 禁止入库**（BAR-SEC-16，2026-08-01）：check-secrets 扫描 git 跟踪
   工作树，命中 `sk-{20+}` / `tp-{20+}` / `AIza{20+}` 形态即构建中断。真实 key
   一律走 `.kfmv4/.env` 代字（`${KFM_PROVIDER_*}`，agent-runner 与 server
   env-store 同语义 resolveKey 解析；事故原型：1e5897d 曾把真实 apiKey 当默认
   示例提交，三个 key 入公开历史已注销，用户裁决不重写历史只守门）。
9. **agent 脚本 key 读取**（2026-08-01）：一律从 `~/.kfmv4/providers.json` 按
   providerId 读取，`${VAR}` 代字经 resolveKey 解析（process.env 优先、
   `.kfmv4/.env` 其次）；禁止在脚本内硬编码 apiKey。
10. **状态新鲜度纪律**（2026-08-02，check-state-freshness）：状态类条目必须自带
    失效触发器（哈希/日期/门/巡逻），否则禁止落盘——豁免表必带哈希+临时
    review-by、bugs 无钉必带复核日、STACK 状态词同行日期；测量工具刻度同样
    适用（check-mutation-anchors：变异锚点失效即中断——2026-08-02 事故）。
11. **慢 LLM 检查归 cron**（2026-08-02）：语义巡逻每日 04:17、入口文档体检每日
    04:47、变异基准校准每周一 04:23——会话不主动调慢检查，只消费信箱结果；
    发版门（routine 入口体检，臂数单源 = release.yaml 步骤 0 命令）是唯一人工例外。
    阈值按 22 臂池化校准（质疑软指标）。
12. **史官制度**（2026-08-02，观测台 v0.1）：agent-runner 每次 LLM 调用必落
    ~/.kfmv4/ledger/agent-calls.jsonl（provider/耗时/成败）——观测台聚合器
    scripts/agent/obs-aggregate.mjs 周报（周一 04:37 投信箱）；工具调用审计
    permission-audit.jsonl（权限引擎影子模式）同源；新增数据流必须登记观测台。
    （2026-08-06 登记：SYS 监控面板数据面——routes/obs.ts collectSys 现场采集
    硬盘/内存/负载/进程 RSS（含 used/total 实值对）+ 监听端口（ss -tlnp +
    established 连接数）+ crontab 清单；30s 独立采样器环形 40 点落
    ~/.kfmv4/ledger/sys-metrics.json 供面板历史柱状图；cron 成败判据 = 逐脚本标记表
    CRON_MARKERS 末位对比，通用关键字实测三处误判已弃用；端口 30s/cron 5min
    缓存，新增 cron 条目只需在标记表/别名表登记）
    （2026-08-07 登记①：RSS 参照改自身 cgroup memory.high（800M 墙），按 /proc/self/cgroup 相对路径拼读——根路径是根 cgroup 的 max，直读必失效；
    rss 历史下发前转占限额百分比，柱状图口径统一「样本值=百分比」）
    （2026-08-13 登记②：viewport-visibility.ts 登记 ai-chat 域——装配点 ws-channel 在 ai-chat，新增模块按装配点登记 domain-src.mjs）
    （2026-08-07 登记②：星轨数据面 collectArchive——读 ~/.kfmv4/sessions/*.json
    顶层字段（title/createdAt/updatedAt/messageCount/tokenCount），msgs≤2 测试
    残留过滤、缺 count 旧会话以 messages.length 兜底，按 tokenCount 降序 TOP8 +
    其余聚合「其他 ×N」轨，30s 缓存；sessions/script/ 分流目录不读）
    （2026-08-08 登记③：kimi-code 长会话上轨——~/.kimi-code/sessions/*//session_*/
    agents/main/wire.jsonl ≥1MB 入选（当前=研究臂+主线两条）；token 口径=新处理
    token（inputOther+cacheCreation+output）**不含 cacheRead**（含它研究臂 4.77G
    会压扁 kfm 轨道）；增量扫描 offset 只读新增尾部，轮转截断归零重扫）
    （2026-08-08 登记④：脉搏数据面 collectPulse——agent-calls/tool-exec/
    check-failures/build-metrics 四条 jsonl 滚动 24h 聚合，尾部限扫
    （200/200/100/100KB）+ 60s 缓存；permission-audit 暂缓（87% allow 分布单一，
    等 8.5.1 审批通道连同 ask 流一起做）——史官制度「落盘→上屏」闭环首批）
14. **语义生成**（2026-08-02，登记表 P0 完成）：契约清单生成器
    gen-contract-lists（6 域清单单一出处）、路由表生成器 gen-route-table
    （工作流行从 workflows/ 生成）——生成区标记 gen:xxx，幂等 + --check-only
    漂移门；**新增可生成事实必须先问「能否从活源头推导」，能则登记生成**。
    （设计 active/semantic-generation.md + 登记表 active/generateable-facts.md）
15. **权限引擎**（2026-08-02，8.5.0 影子模式）：工具 RiskClass 四类映射
    （src/server/ai/permissions.ts TOOL_RISK），所有工具调用过 evaluate 判定 +
    审计（影子模式不拦截）；加新工具必须在此登记 RiskClass（BAR-PERM-01 钉）。
    8.5.1 审批通道待数据成熟（观测台基线）。
16. **sessions 目录卫生**（2026-08-06，script 分流配套）：实验脚本会话由服务端
    直写 `~/.kfmv4/sessions/script/`（sessionClass:'script' 登记分流），面板区
    根目录只放人手会话；`scripts/sweep-sessions.sh` 兜底回收——根目录 24h 未动
    的已知 script 前缀文件移入 script/ 加 `.stranded` 后缀，script/ 下 14 天
    `.stranded` 残卷删除、14 天 `sandbox-*` 臂沙箱目录删除（沙箱唯一用途是
    脚本判卷 diff，产出已落盘 meta-pool，超期老臂判卷标 skip）；挂在
    `kfm-restart.sh` 服务恢复后自动执行。新增实验
    脚本前缀须同步 sweep 白名单（patrol- 属主线巡逻，永远排除）。

## #陷阱

1. **改 `.css` 前查有无同名 `.scss` 源**——有源的（现况 base/sidebar）直接改 .css
   会被下次 sass 编译覆盖；无源的（tmux-card/xterm/z-index）是手写件，直接改即可。
   案例：2026-07-06 全屏卡 touch-action 被覆盖。
2. **esbuild nullish-coalescing 降级**：源码大量 `??`，TS 编译需确保正确降级。
3. **GSAP mock 时序**：`tl.call(cb)` 同步执行回调，改变动画时序——测试不用墙钟计时器。
4. **计数同步**：增删 check 脚本/测试后跑 `npm run sync-counts` 一键回写各文档计数（check 链 `sync-counts --check-only` 拦截未同步；check-test-patterns 验证模式完整性）。
5. **清理死代码必须连它的测试一起删**——测试引用会掩护死代码躲过零引用检测。
   案例：text-layout 2292 行、getFileColor 各有两轮「清死代码」被自家测试挡住
   （2026-07-29 批次才发现）；判断死代码以**生产引用**为准，tests 引用不算活口。
6. **check-registry 能力层暂缺**：CAPABILITY_MANIFEST 已随 ADR-004 追加裁决摘除
   （无执行面的注册会误导 AI）——「AI 之手」落地时在 check-registry.mjs 重建
   能力清单 + 检查块，勿提前补注册。
7. **agent 脚本执行外部命令禁 shell 插值**（BAR-SEC-15，2026-08-01）：
   模板串（`git log ${ref}`）会被 shell 元字符注入——agent 脚本层
   同样受安全约束：必须 execFileSync 参数数组 + 输入白名单
   （先例：tag-advisor REF_RE `^[A-Za-z0-9._/-]{1,256}$`）。
8. **bash 工具后端是 `node:child_process`，不是 pi-natives executeShell**
   （BAR-BASH-HANG-01，2026-08-01）：brush 进程内 shell 的进程替换实现
   （`brush-core interp.rs setup_process_substitution`）把管道写端泄漏进
   node 进程——急性（`comm <(sort …)` 死锁 100 分钟挂死整轮 run）+ 慢性
   （每次 bash 漏 ~2 fd）。换芯：`/bin/bash -c` + `detached: true` 进程组 + 超时/abort 负 pid SIGKILL 杀树 + 1MB 输出截断；omp 升级勿回退后端；
   泄漏取证待反馈上游（STACK #11）。配套：run-manager 停摆看门狗 360s
   （生成器零事件即中止，兜一切「悬挂不抛错」类）。
9. **新增 NodeWorker 入口：独立 esbuild 产物 + 复制资产（BAR-107）**：dist 单文件不含入口——单独 build + cpSync 资产；漏打包 = 30s 超时。
## 文件清单

<!-- gen:contract-list 自动生成，禁止手改（源：code-inventory） -->
`tests/client-logic.test.ts` `tests/regression.test.ts` `experiments/coldstart/tools/normalize-arms.mjs` `scripts/agent/semantic-audit.mjs` `tests/tool-compaction.test.ts` `tests/server-routes.test.ts` `tests/preload.mjs` `tests/cards.test.ts` `tests/visual-baseline.test.ts` `scripts/agent/browser-relay.mjs` `scripts/agent/agent-runner.mjs` `tests/box.test.ts` `tests/mocks/gsap.ts` `tests/run-manager.test.ts` `scripts/check/check-registry.mjs` `tests/gesture-registry.test.ts` `scripts/agent/semantic-mutate.mjs` `tests/invariants.test.ts` `scripts/check/check-css-wiring.mjs` `scripts/agent/obs-aggregate.mjs` `scripts/agent/semantic-audit.tasks.mjs` `tests/path-utils.test.ts` `tests/renderer.test.ts` `tests/to-openai-messages.test.ts` `tests/smoke/smoke.mjs` `scripts/agent/semantic-chain.mjs` `scripts/check/gen-code-inventory.mjs` `tests/chat-protocol.test.ts` `tests/provider-env.test.ts` `experiments/coldstart/tools/hallucinate-batch.mjs` `tests/protocol-reducer.test.ts` `experiments/coldstart/tools/routine-entry-validation.mjs` `scripts/check/gen-scripts-catalog.mjs` `scripts/check/sync-counts.mjs` `build.mjs` `scripts/check/check-doc-orphans.mjs` `scripts/agent/semantic-bench.mjs` `tests/probes/gen-page-state-schema/src/server/ai/page-state.ts` `scripts/check/check-docs.mjs` `scripts/check/check-bar-ledger.mjs` `scripts/check/check-doc-scripts.mjs` `scripts/check/check-doc-linerefs.mjs` `tests/viewport-visibility.test.ts` `experiments/coldstart/tools/judge-batch.mjs` `scripts/agent/exp-iceberg.mjs` `scripts/check/chain.mjs` `scripts/check/check-checks.mjs` `scripts/check/check-tool-compaction.mjs` `scripts/check/check-mutation-anchors.mjs` `scripts/check/gen-permission-map.mjs` `scripts/check/gen-capability-map.mjs` `tests/session-security.test.ts` `scripts/agent/tag-advisor.mjs` `scripts/check/gen-tool-docs.mjs` `tests/liquid-geometry.test.ts` `scripts/agent/exp-probe-decompose.mjs` `tests/harness.ts` `scripts/check/gen-page-state-schema.mjs` `scripts/check/check-doc-coverage.mjs` `scripts/check/check-zindex.mjs` `experiments/coldstart/tools/gen-hallucination-inputs.mjs` `scripts/agent/exp-vision-internal.mjs` `tests/semantic-chain.test.ts` `tests/obs-roles.test.ts` `scripts/check/check-cards.mjs` `scripts/check/check-contract-freshness.mjs` `scripts/check/check-test-patterns.mjs` `scripts/check/gen-rules-map.mjs` `tests/session-invalidate.test.ts` `scripts/check/check-anim.mjs` `scripts/check/check-stack-status.mjs` `scripts/check/check-versions.mjs` `scripts/check/check-deploy-freshness.mjs` `scripts/check/check-workflow-integrity.mjs` `scripts/check/check-kfmv4-data.mjs` `scripts/check/check-probes.mjs` `scripts/agent/exp-probe-matrix.mjs` `tests/engine.test.ts` `scripts/check/check-state-freshness.mjs` `scripts/check/gen-experiments-list.mjs` `scripts/check/check-experiment-index.mjs` `scripts/check/check-hooks.mjs` `scripts/agent/exp-thinking.mjs` `scripts/check/check-probe-state.mjs` `scripts/check/check-as-any.mjs` `scripts/check/check-console.mjs` `scripts/check/gen-contract-lists.mjs` `tests/tag-advisor.test.ts` `scripts/check/check-experiment-registry.mjs` `scripts/check/docs-status.mjs` `scripts/check/check-doc-symbols.mjs` `experiments/coldstart/tools/theme-code.mjs` `tests/token-count.test.ts` `scripts/check/check-code-doc-refs.mjs` `scripts/check/check-card-meta.mjs` `scripts/check/check-ledger-commits.mjs` `scripts/check/domain-src.mjs` `tests/floating-state.test.ts` `scripts/agent/session-retention.mjs` `scripts/agent/test-tag-advisor.mjs` `scripts/check/check-code-map-coverage.mjs` `scripts/check/check-fix-tests.mjs` `scripts/check/check-active-stack.mjs` `tests/browser-tool.test.ts` `tests/stack-numbering.test.ts` `scripts/check/check-doc-schema.mjs` `scripts/check/check-commit-docs.mjs` `tests/omp-glob.test.ts` `scripts/check/check-inbox-heartbeat.mjs` `tests/tool-schema.test.ts` `scripts/check/check-secrets.mjs` `tests/compact-l4.test.ts` `tests/gen-pipeline.test.ts` `scripts/check/check-agent-script-docs.mjs` `scripts/check/check-consistency.mjs` `scripts/check/check-uncommitted.mjs` `tests/doc-scripts.test.ts` `tests/permissions.test.ts` `tests/reasoning-l2.test.ts` `scripts/check/gen-route-table.mjs` `package.json` `tests/semantic-audit.test.ts` `tests/session-flush.test.ts` `scripts/kfm-restart.sh` `scripts/check/check-doc-budget.mjs` `scripts/clean-npm-temp.cjs` `scripts/check/check-release-radar.mjs` `tests/obs-track-time.test.ts` `tests/reset-hooks.ts` `tests/obs-audit-pending.test.ts` `tests/runner.ts` `tests/session-card-parser.test.ts` `tests/session-parse.test.ts` `tests/hand-drag.test.ts` `scripts/deploy.sh` `.githooks/pre-push` `tests/compact-list.test.ts` `tests/check-deploy-freshness.test.ts` `tests/env-test-isolation.mjs` `tests/probes/gen-permission-map/src/server/ai/tools/index.ts` `tests/probes/tool-compaction/src/server/ai/tools/index.ts` `tests/gsap-hook.mjs` `tests/probes/gen-permission-map/src/server/ai/tools/fake.ts` `tests/probes/gen-tool-docs/src/server/ai/tools/fake.ts` `tests/probes/tool-compaction/src/server/ai/tools/fake.ts` `tests/mocks/xterm.ts` `tests/probes/gen-tool-docs/src/server/ai/tools/index.ts` `tests/probes/sync-counts/scripts/agent/semantic-mutate.mjs` `tests/probes/gen-permission-map/src/server/ai/tools/types.ts` `tests/probes/gen-tool-docs/src/server/ai/tools/types.ts` `tests/probes/tool-compaction/src/server/ai/tools/types.ts` `.githooks/commit-msg` `scripts/check/docs-root-const.mjs` `tests/register-hook.mjs` `tests/probes/gen-page-state-schema/src/client/modules/ui-registry.ts` `tests/mocks/xterm-addon-fit.ts` `tests/probes/gen-permission-map/src/server/ai/permissions.ts` `tests/probes/tool-compaction/src/shared/tool-compaction/index.ts` `tests/probes/doc-linerefs/src/fake.ts` `tests/probes/checks/build.mjs` `tests/probes/doc-scripts/scripts/check/check-real.mjs` `tests/probes/bar-ledger/tests/probe.ts` `tests/probes/checks/scripts/check/chain.mjs` `tests/probes/doc-symbols/src/probe.ts` `tests/probes/sync-counts/scripts/check/check-a.mjs` `tests/probes/sync-counts/scripts/check/check-b.mjs` `tests/probes/sync-counts/tests/probe.ts` `tests/probes/checks/scripts/check/check-alpha.mjs` `tests/probes/checks/scripts/check/check-beta.mjs`
<!-- /gen:contract-list -->