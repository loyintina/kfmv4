> 这是什么：构建管线、测试体系、检查脚本。
> 别的去哪找：测试方法论 → ../../guides/testing.md；服务端运行时 → ../server/。

# infra 域契约

## 构建（build.mjs）

- client：esbuild IIFE bundle + minify；`?v=` 缓存指纹（immutable 缓存头）。
- server：ESM bundle——**external 列表是生死线**（CJS 包打进去启动即崩）。
- 样式：`sass base.scss → base.css`（check 链内自动编译）。

## 检查管线（npm run check，31 脚本，顺序固定）

<!-- chain:auto 由 sync-counts 生成，禁止手改 -->
`check-uncommitted`（>3 未提交即中断，首位） → versions → checks → doc-coverage → sass → css-wiring →
tool-compaction → anim → as-any → card-meta → registry → zindex → console → docs → consistency →
active-stack → stack-status → code-doc-refs → workflow-integrity → cards → contract-freshness →
test-patterns → bar-ledger → ledger-commits → doc-budget → doc-symbols → doc-linerefs → doc-schema →
commit-docs → hooks → probes → release-radar → sync-counts → gen-code-inventory → tsc。
<!-- /chain:auto -->

## 硬规则

1. **新 check 一律 hard fail**——warning 对 agent 等于不存在。
   设计性例外须登记（语义审计 B1 修订）：check-release-radar（发版提醒，只 WARN）、
   check-uncommitted（≤3 文件只警告）。例外清单外新增 warning-only check = 中断。
2. **钩子接线脚本必须声明模式**——`.githooks/` 薄壳接线的脚本头部机器可读声明
   `MODE: hard-fail|warning`，壳注释模式词必须一致（check-hooks 第 4 条对账）。
   事故原型：耦合门升 hard fail 改脚本忘改壳，壳写死 exit 0 吞码，拦截虚掩（2026-07-30）。
2. **新增工具/卡片/模块必须过对应双向核对 check**（tool-compaction/cards/registry），
   不登记 = 构建中断。
3. **新增服务端依赖同步 build.mjs external 列表**。
4. **禁止 (as any)**（自 INVARIANTS §四.2）：新建代码零逃逸，check-as-any 扫描，
   新增逃逸构建中断；确因类型定义缺失必须 ① check-as-any WHITELIST 登记（注释原因）
   ② 代码行加 `// P2:` 备注根因。

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

## 文件清单

`build.mjs` `scripts/check/chain.mjs`（check 链唯一出处 STEPS）`scripts/check/check-*.mjs`（31 个）`scripts/deploy.sh`（构建→重启→版本握手闭环）
`scripts/agent/`（agent 脚本群：agent-runner.mjs 执行器 + 一号负载 tag-advisor.mjs
（发版建议，影子模式）+ 二号负载 semantic-audit.mjs/tasks.mjs（语义审计探针集群，
并发 10）+ semantic-mutate.mjs/bench.mjs（变异基准：沙盒注入已知缺陷测召回/误报，
四层取材 L1 git 矿 / L2 SEM×元素矩阵 / MID 盲区降级档 / L3 对抗负例，卷子只长不缩）+ exp-thinking.mjs（对照实验一次性脚本）；指南 → ../../guides/agent-runner.md）
`scripts/check/domain-src.mjs`（域→代码映射单一真相源：contract-freshness 与清单生成器共用）
`scripts/check/gen-code-inventory.mjs`（机械层清单 + 跨域 import 边生成器 → ../code-inventory.md，--check-only 已挂链）
`dist/build-info.json`（构建时生成的版本握手真相源）
`tests/`（regression.test.ts + smoke/ + probes/ 探针假树）
`public/css/`（scss 源）`package.json`（check 委托 chain.mjs）`.githooks/`（commit-msg/pre-push 薄壳）
测试分层与纪律 → ../../guides/testing.md
