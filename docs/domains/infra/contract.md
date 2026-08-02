> 这是什么：构建管线、测试体系、检查脚本。
> 别的去哪找：测试方法论 → ../../guides/testing.md；服务端运行时 → ../server/。

# infra 域契约

## 构建（build.mjs）

- client：esbuild IIFE bundle + minify；`?v=` 缓存指纹（immutable 缓存头）。
- server：ESM bundle——**external 列表是生死线**（CJS 包打进去启动即崩）。
- 样式：`sass public/css/:public/css/`（目录级全量编译，check 链内自动执行）。

## 检查管线（npm run check，37 脚本，顺序固定）

（下方生成区枚举的链步数多于标题脚本数：sass/sync-counts/gen-code-inventory/npm test/tsc
为非 check-* 步骤，不计入脚本数。）

<!-- chain:auto 由 sync-counts 生成，禁止手改 -->
`check-uncommitted`（>3 未提交即中断，首位） → deploy-freshness → versions → checks → doc-coverage → sass →
css-wiring → tool-compaction → anim → as-any → card-meta → registry → zindex → console → secrets →
state-freshness → mutation-anchors → docs → consistency → active-stack → stack-status →
code-doc-refs → workflow-integrity → cards → contract-freshness → test-patterns → bar-ledger →
ledger-commits → doc-budget → doc-symbols → doc-linerefs → doc-schema → commit-docs → fix-tests →
hooks → probes → release-radar → experiment-index → sync-counts → gen-code-inventory → npm test →
tsc。
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
    发版门（routine 6 臂）是唯一人工例外。阈值按 22 臂池化校准（质疑软指标）。
12. **史官制度**（2026-08-02，观测台 v0.1）：agent-runner 每次 LLM 调用必落
    ~/.kfmv4/agent-calls.jsonl（provider/耗时/成败）——观测台聚合器
    scripts/agent/obs-aggregate.mjs 周报（周一 04:37 投信箱）；工具调用审计
    permission-audit.jsonl（权限引擎影子模式）同源；新增数据流必须登记观测台。
13. **权限引擎**（2026-08-02，8.5.0 影子模式）：工具 RiskClass 四类映射
    （src/server/ai/permissions.ts TOOL_RISK），所有工具调用过 evaluate 判定 +
    审计（影子模式不拦截）；加新工具必须在此登记 RiskClass（BAR-PERM-01 钉）。
    8.5.1 审批通道待数据成熟（观测台基线）。

## #陷阱

1. **改 `.css` 前查 `.scss` 源**——直接改 .css 会被下次 sass 编译覆盖。
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
   （每次 bash 漏 ~2 fd）。换芯：`/bin/bash -c` + `detached: true` 进程组 +
   超时/abort 负 pid SIGKILL 杀树 + 1MB 输出截断；omp 升级勿回退后端；
   泄漏取证待反馈上游（STACK #15）。配套：run-manager 停摆看门狗 360s
   （生成器零事件即中止，兜一切「悬挂不抛错」类）。
## 文件清单

<!-- gen:contract-list 自动生成，禁止手改（源：code-inventory） -->
`tests/client-logic.test.ts` `tests/regression.test.ts` `tests/tool-compaction.test.ts` `scripts/agent/semantic-audit.mjs` `tests/preload.mjs` `tests/cards.test.ts` `tests/visual-baseline.test.ts` `tests/server-routes.test.ts` `tests/box.test.ts` `tests/mocks/gsap.ts` `tests/run-manager.test.ts` `scripts/check/check-registry.mjs` `tests/gesture-registry.test.ts` `tests/invariants.test.ts` `scripts/check/check-css-wiring.mjs` `tests/path-utils.test.ts` `tests/renderer.test.ts` `scripts/agent/semantic-mutate.mjs` `tests/smoke/smoke.mjs` `scripts/check/gen-code-inventory.mjs` `tests/to-openai-messages.test.ts` `tests/chat-protocol.test.ts` `scripts/agent/semantic-chain.mjs` `tests/protocol-reducer.test.ts` `scripts/agent/agent-runner.mjs` `scripts/agent/semantic-audit.tasks.mjs` `scripts/agent/semantic-bench.mjs` `scripts/check/check-docs.mjs` `scripts/check/check-bar-ledger.mjs` `scripts/check/sync-counts.mjs` `tests/provider-env.test.ts` `scripts/agent/exp-iceberg.mjs` `scripts/check/check-checks.mjs` `scripts/check/check-tool-compaction.mjs` `tests/session-security.test.ts` `scripts/agent/tag-advisor.mjs` `tests/liquid-geometry.test.ts` `scripts/agent/exp-probe-decompose.mjs` `scripts/check/check-doc-linerefs.mjs` `tests/harness.ts` `scripts/check/check-doc-coverage.mjs` `scripts/check/check-zindex.mjs` `scripts/agent/exp-vision-internal.mjs` `build.mjs` `scripts/check/check-cards.mjs` `scripts/check/check-contract-freshness.mjs` `scripts/check/check-test-patterns.mjs` `tests/session-invalidate.test.ts` `scripts/check/check-anim.mjs` `scripts/check/check-state-freshness.mjs` `scripts/check/check-versions.mjs` `scripts/agent/obs-aggregate.mjs` `scripts/check/check-probes.mjs` `scripts/agent/exp-probe-matrix.mjs` `tests/engine.test.ts` `scripts/check/chain.mjs` `scripts/check/check-deploy-freshness.mjs` `scripts/check/check-hooks.mjs` `scripts/agent/exp-thinking.mjs` `scripts/check/check-experiment-index.mjs` `scripts/check/check-console.mjs` `tests/tag-advisor.test.ts` `scripts/check/check-as-any.mjs` `scripts/check/docs-status.mjs` `scripts/check/check-doc-symbols.mjs` `scripts/check/check-workflow-integrity.mjs` `scripts/check/check-stack-status.mjs` `scripts/check/check-code-doc-refs.mjs` `scripts/check/check-card-meta.mjs` `scripts/check/check-ledger-commits.mjs` `tests/floating-state.test.ts` `scripts/agent/test-tag-advisor.mjs` `scripts/check/check-fix-tests.mjs` `scripts/check/domain-src.mjs` `scripts/check/check-active-stack.mjs` `scripts/check/check-doc-schema.mjs` `scripts/check/check-commit-docs.mjs` `tests/omp-glob.test.ts` `tests/tool-schema.test.ts` `scripts/check/check-secrets.mjs` `scripts/check/check-uncommitted.mjs` `scripts/check/check-consistency.mjs` `scripts/check/check-mutation-anchors.mjs` `tests/permissions.test.ts` `scripts/check/check-doc-budget.mjs` `scripts/check/check-release-radar.mjs` `tests/reset-hooks.ts` `tests/runner.ts` `tests/gsap-hook.mjs` `tests/mocks/xterm.ts` `scripts/check/docs-root-const.mjs` `tests/register-hook.mjs` `tests/mocks/xterm-addon-fit.ts` `tests/probes/doc-linerefs/src/fake.ts` `tests/probes/checks/build.mjs` `tests/probes/bar-ledger/tests/probe.ts` `tests/probes/checks/scripts/check/chain.mjs` `tests/probes/doc-symbols/src/probe.ts` `tests/probes/sync-counts/scripts/check/check-a.mjs` `tests/probes/sync-counts/scripts/check/check-b.mjs` `tests/probes/sync-counts/tests/probe.ts` `tests/probes/checks/scripts/check/check-alpha.mjs` `tests/probes/checks/scripts/check/check-beta.mjs`
<!-- /gen:contract-list -->
