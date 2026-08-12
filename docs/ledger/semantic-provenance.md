> 这是什么：语义审计试点（批 1.5）26 报 24 真发现的全量成因普查——修复批 31 处病灶点逐条考古。
> 方法：explore subagent git 考古（log -S/blame/log -L），写入 commit 取内容首次成文点（非迁移搬运点）。
> 基准：审计/修复 2026-07-29~30 · 考古 agent-118。日期均为 commit author date（+0800）。
> 姊妹篇：代码层漂移成因（A-F 分类）见 drift-provenance.md；本表 G 分类为文档语义层独立长出。

# 语义溯源档案（semantic-provenance）

## 成因分类学（G1-G6，批 1.5 从数据长出，不预设）

- **G1 出生即错**：表述写入那一刻就与现实不符（规划写成现状、注释与实现同 commit 却不一致、登记已落地事项为待办）。
- **G2 迁移只搬不核**：大迁移把已失真内容逐字搬运进新体系，无人对照现实核实。
- **G3 变更后引用面未同步**：代码/脚本/文件正当变更，引用它的文档未同 commit 追平（字面计数、行号、文件名、脚本名）。
- **G4 双份登记无对账**：两处账本记录同一事实却分叉（标签分歧、锚点写错），无机制强制对账。
- **G5 状态无同步机制**：状态变了（裁决落地、队列闭环、例外产生），登记处无回改机制。
- **G6 验证不严**：验证本身出错（过窄 grep 模式误判「无残留」），假绿。

## 成因分布

| 标签 | 含义 | 数量 | 占比 |
|---|---|---|---|
| G3 | 变更后引用面未同步 | 15 | 48.4% |
| G1 | 出生即错 | 9 | 29.0% |
| G5 | 状态无同步机制 | 3 | 9.7% |
| G2 | 迁移只搬不核 | 2 | 6.5% |
| G4 | 双份登记无对账 | 1 | 3.2% |
| G6 | 验证不严 | 1 | 3.2% |
| 合计 | | 31 | 100% |

**结论：G3（引用面未同步，15 处）占绝对主导近一半**——且全部机械可打（本次三件套即为其而生）；
G1（出生即错，9 处）居次，只能靠「写入时对照现实」的纪律与 e2e 冷启动测试拦截。

> 口径说明：审计立案 24 条，修复批展开为 31 处病灶点（一条立案可含多处 hunk；infra code-map
> 漂移 2/3/4 的底层病灶并入 #10/#11 不重复计行）。早期审计轮的粗分类（G1-G6 各 5/5/8/5/3/1）
> 被本表逐行考古数据取代。

## 三元观察（迁移病灶学的规律）

1. **迁移期是病灶制造厂**：31 处中 12 处写入于 v8.2 切换链（9e18d8d 骨架 → 97394bd/492b710 迁移填充
   → 68338c4 切换，2026-07-28/29 两天）——大迁移必须配语义审计（已写进 semantic-audit.yaml 触发条件）。
2. **文档腐烂滞后极短**：时间差 0-2 天的有 17 处——「文档慢慢过时」是错觉，主流死法是变更当天即死。
   新鲜度检查的窗口期必须按天计，不能按版本计。
3. **G3 全部机械可打**：字面计数/行号/脚本名/commit 锚点四类引用占 15 处——这正是三档阶梯里
   「消灭（引用式转述）> 编译（生成器产出）> 检查（对账兜底）」的升档空间。

## 提示词有效性数据（审计模式主产物）

- 第一波 5 组全量审计：26 报 24 真 1 假 1 半，**精确率 92%**。
- 第二波 prompt 加「漂移已登记不算新发现」豁免规则：**重复立案归零**——登记豁免是审计 prompt 必备条款。
- 拜占庭对策（LLM proposes, mechanics disposes）实测有效：1 例假发现死于 file:line 机械复核环节。

## 全量表（31 处病灶点）

| # | 病灶 | 写入commit | 写入日期 | 失效commit | 失效日期 | Δ天 | G | 依据 |
|---|---|---|---|---|---|---|---|---|
| 01 | vision.md §1.3/§2.1「不做 Agent 框架」 | 40579ea | 2026-05-28 | 90d4b76 | 2026-07-14 | 47 | G2 | 90d4b76 首建服务端 agent 通路后表述失真；492b710→68338c4 逐字搬运未核 |
| 02 | vision.md §1.4 AI 手/适配层哲学 | ba3053e | 2026-05-28 | 90d4b76 | 2026-07-14 | 47 | G2 | 实际 AI 工具 = 服务端预注册工具集，适配层执行面始终未建；迁移搬运 |
| 03 | vision.md §1.5 布局图「随时呼叫 AI」 | ba3053e | 2026-05-28 | — | — | 62 | G1 | 全局输入栏从未实装——出生即把规划布局写成现状 |
| 04 | vision.md :106「22 条约束」 | 8565ad3 | 2026-07-08 | aeadcd5 | 2026-07-16 | 8 | G3 | aeadcd5 心法 20→24 条，字面计数失真（c2a47b3 再增至 31） |
| 05 | invariants.md :37「查 §八」 | c2a47b3 | 2026-07-28 | eb1ef11 | 2026-07-28 | 0 | G3 | 同天 eb1ef11 迁移注销 §八，引用未同步 |
| 06 | invariants.md :55-56「§七 步骤 7/SOP」 | c2a47b3 | 2026-07-28 | eb1ef11 | 2026-07-28 | 0 | G3 | 迁移同天注销 §七（新家 guides/spec-driven.md），旧指针残留 |
| 07 | invariants.md §3.3 HANDBOOK/HANDOFF_AUDIT | 847e988 | 2026-06-03 | 68338c4 | 2026-07-29 | 56 | G1 | HANDOFF_AUDIT 机制从未落地——出生即错；v8.2 切换注销 HANDBOOK |
| 08 | invariants.md :494 doc-system-redesign §10.3 引用 | c2a47b3 | 2026-07-28 | 68338c4 | 2026-07-29 | 1 | G3 | 切换提交将设计文档注销为规划产物，引用变死链 |
| 09 | workflows ×2 check-desc-freshness 4 处 | 9e18d8d | 2026-07-28 | 6b92b8c | 2026-07-29 | 1 | G3 | 6b92b8c 合并改名 check-contract-freshness，工作流卡未同步 |
| 10 | 硬规则 1 例外未登记（yaml + infra 契约） | 0124c4b | 2026-07-15 | — | — | 14 | G5 | check-uncommitted ≤3 只警告生于 0124c4b、release-radar warning-only 生于 8ce26fd，自引入起未登记 |
| 11 | tag-advisor.mjs 头注释 exit 1 / feat→minor | 8ce26fd | 2026-07-29 | 8ce26fd | 2026-07-29 | 0 | G1 | 出生即错：同 commit 代码只有 exit 0/2、floor=patch |
| 12 | agent-runner.md exit 1 协议 | 8ce26fd | 2026-07-29 | 8ce26fd | 2026-07-29 | 0 | G1 | 指南与实现同 commit 落地，exit 1 从未实现（重试耗尽归 exit 2） |
| 13 | README.md :19「服务端单写者」 | 5862516 | 2026-07-27 | — | — | 13 | G1 | 出生即错：客户端 saveMessages 已自 90d4b76（07-14）存在，双轨先于表述 13 天 |
| 14 | README.md :50「7 个子系统」 | 68338c4 | 2026-07-29 | 9e18d8d | 2026-07-28 | 1 | G1 | 出生即错：9e18d8d 骨架已定 6 域，README 仍写 7（旧规划口径残留） |
| 15 | ai-chat/contract.md orb-chat-host 缺失 | 97394bd | 2026-07-28 | def7656 | 2026-07-30 | 2 | G3 | def7656 拆出宿主后契约未追平（6bd6fd5 增文件使「5 文件」1 天后失真） |
| 16 | canvas-tree/contract.md :21「引擎层 14 文件」 | 97394bd | 2026-07-28 | 22654f0 | 2026-07-30 | 2 | G3 | 写入时属实；22654f0 死代码批次一删 text-layout 后 engine=8 文件 |
| 17 | server/contract.md :19 数据目录清单 | 97394bd | 2026-07-28 | 9479e89 | 2026-07-24 | 4 | G1 | 出生即漏：page-state.md（07-24）、restart-pending.json（07-26）写入时即漏 2 项 |
| 18 | detail-runtime.md :49 架构图 isIncomplete | 5862516 | 2026-07-27 | 0e30169 | 2026-07-30 | 3 | G3 | 0e30169 删函数，同 commit 只改一处表述，架构图漏改 |
| 19 | detail-runtime.md §4.7 orb.ts 监听器/_renderChat | 1404b15 | 2026-07-21 | def7656 | 2026-07-30 | 9 | G3 | 4601fdc 先废 _renderChat、def7656 再迁宿主，段内两处指称双失效 |
| 20 | detail-runtime.md §10.2「orb.ts 重连 IIFE」 | 1404b15 | 2026-07-21 | def7656 | 2026-07-30 | 9 | G3 | def7656 迁至 orb-chat-host tryAutoResume |
| 21 | detail-runtime.md §10.4 isIncomplete 服务端判据 | 5862516 | 2026-07-27 | 0e30169 | 2026-07-30 | 3 | G3 | 函数删除后判据实际在客户端，服务端职责段未同步 |
| 22 | detail-runtime.md 取消路径 _cancelPendingTools | 1404b15 | 2026-07-21 | 61fd7d4 | 2026-07-22 | 1 | G3 | 次日 61fd7d4 改名 settlePendingToolBlocks，文档未同步 |
| 23 | drift-provenance.md :286「待裁决」 | c7e13aa | 2026-07-29 | 42a137f | 2026-07-29 | 0 | G5 | 档案与 ADR-004 裁决同日落账，裁决后标注未回改 |
| 24 | bugs.md BAR-PROXY-01 引入锚 678c6d2 | 81aeeee | 2026-07-29 | fbcc0c7 | 2026-07-10 | 19 | G1 | 出生即错：登记的是迁移点，真实引入为 fbcc0c7（07-10 proxy 创建） |
| 25 | ai-chat/code-map.md :51-54 行号/过滤归属 | 03da8c9 | 2026-07-29 | 6bd6fd5 | 2026-07-29 | 0 | G3 | 测绘当日 6bd6fd5 收编 to-openai-messages 即移行改归属；def7656 次日再迁 |
| 26 | cross-domain.md :9「跨域 import 边 224 条」 | 3906707 | 2026-07-29 | def7656 | 2026-07-30 | 1 | G3 | 字面数字次日被 orb 拆分改边数（224→225）——转述写字面拷贝的必然死法 |
| 27 | cross-domain.md :31「orb.ts:779」 | 3906707 | 2026-07-29 | def7656 | 2026-07-30 | 1 | G3 | restart-count 随宿主迁至 orb-chat-host.ts:272 |
| 28 | STACK.md 后续队列已闭环项未标注 | c7e13aa | 2026-07-29 | d0b8632 | 2026-07-30 | 1 | G5 | 81aeeee/22654f0/def7656/d0b8632 相继闭环，队列未回标 |
| 29 | STACK.md #5 session-store 重命名项 | f253595 | 2026-07-28 | 95bad64 | 2026-07-27 | 1 | G1 | 出生即错：迁入 STACK 时 95bad64 前一天已落地 session-client.ts 重命名 |
| 30 | semantic-compiler-seed.md「首个实例已消除」 | a3c751f | 2026-07-30 | a3c751f | 2026-07-30 | 0 | G6 | 出生即错：vision 原文从未消除，首次验证 grep 模式过窄误判——语义验证必须宽模式+人工复核 |
| 31 | 条目 17/18 与 bugs.md 成因标签分歧（E4/E5） | c7e13aa | 2026-07-29 | — | — | 0 | G4 | 档案落账即与 code-map 标签分歧并存——双锚无对账至修复轮加互注 |

## 备考

- 「出生即错」类（#03/#07/#11-14/#17/#24/#29/#30）失效 commit 与写入同体或先于写入，
  Δ天列给出的是表述写入时已陈旧的跨度。
- 2 处带推断保留：#07 HANDOFF_AUDIT 精确写入点只收窄到 207e73b–4cb0e8c 区间；
  #18/#21 isIncomplete 进文档的写入点 5862516 系 -S 证据推断，未逐行 blame 复核。
- 审计各组「存疑断言」清单未在本轮分流（见审计轮 subagent 回报），留第二轮。

## 假阳性豁免登记（裁决：非病灶，不计入上方 31 处统计）

活树审计轮探针误报，裁决为假阳性后登记于此（registeredFindings 解析本表第二列，
防探针重复立案）。编号续全量表。

| # | 病灶 | 裁决依据 |
|---|---|---|
| 32 | README「ai-chat detail 3 份」被探针称实际仅 1 份——假阳性：实有 detail-browser/detail-runtime/detail-tool-compaction 恰 3 份，探针漏数 | 2026-07-30 人工裁决：ls docs/domains/ai-chat/ 实证 |
| 33 | infra 契约「31 脚本」与链枚举步数不一致——假阳性：口径不同，链枚举含 sass/sync-counts/gen-code-inventory/tsc 非 check-* 步骤 | 2026-07-30 人工裁决：chain.mjs STEPS 实证；契约检查管线节已加口径注 |
| 34 | v8.1.0 混装打 minor 与「混装以已完成主题定级」规则冲突——假阳性：minor 依上下文压缩主题闭环（release.md 版本语义判例），问题轮随行，双侧已注记混装窗口 | 2026-07-30 人工裁决：release.md 节奏节 + history.md v8.1.0 行注记自洽 |
| 35 | vision「一切皆卡片」与 §2.2 文件树不迁卡片系统——假阳性：§1.5 行内已括注「交互隐喻；渲染层例外见 §2.2」，例外条款明示 | 2026-07-30 语义巡逻裁决：复现型发现（跨深扫 4 臂 + 巡逻探针双路复现），vision.md 行 100/165 实证 |
| 36 | README「统一的浮动卡片引擎」与实现层重复（hexToRgba 多份/卡头骨架多份）——假阳性：「统一」指引擎架构统一（成立），实现层重复实现群是已登记技术债 | 2026-07-30 语义巡逻裁决：归口 STACK #10 ⑥ 重复实现群（仍活队列项），grep hexToRgba 实证 5 文件 |


## 2026-08-02 信箱裁决轮（8-02 巡逻 11 条，裁决人：主会话 + 用户拍板）

| 探针任务 | 裁决 | 处置 | 详情 |
|---------|------|------|------|
| guides-testing-vs-infra ×3 | testing.md:6 已解决 / :7 豁免 / :9 豁免 | 重跑刷新 | :6「489」已被 sync-counts 回写为 490（加钉后）；:7「11 条冒烟」实测 11 个 check() 调用=真；:9「L1 不变量」是 testing.md 方法论自有分层（L1-L4），自洽无需 contract 定义 |
| readme-vs-maps | 豁免（README 对，基准旧） | 修 code-map + 重跑 | README「35 个 check-*」= 真（34 检查+check-checks）；code-map 曾记 31 陈旧，已改引用式 |
| guides-release-vs-history | 修复 | 已修 release.md:27 | 「v8.3.1 起严格执行主题分离」过强——8.3.1 同批含语义地基混装；改为「8.3.2 起单主题为主，个别版含基建伴生」 |
| contract-vs-map-canvas-tree ×2 | 修复 ×2 | 已修 contract:61/82 | rAF「必须」→「应，现实 ||295 兜底（漂移 14）」；文件清单手写 25 vs 实 31 → 改引用式指向 code-inventory |
| contract-vs-map-infra | 豁免（contract 对，基准旧） | 修 code-map + 重跑 | contract「35 脚本」= 真；同 code-map 陈旧根因 |
| crossdomain-vs-inventory ×3 | anim 豁免 / HTTP 豁免待复核 / WS 修复 | 已修 :67 + 豁免 | anim「三个域」= 真（client-shell/floating-card/canvas-tree 三域，探针误数）；HTTP「10 vs 9」计数口径分歧，登记待人工复核；WS「跨两域」→ 实为 floating-card 域内双写者（terminal-card-04 × tmux-card），已修正 |

## 2026-08-03 接手裁决轮（积压 13 + 巡逻刷新 10，裁决人：QoderCN 冷启动审计）

| 探针任务 | 裁决 | 处置 | 详情 |
|---------|------|------|------|
| contract-vs-map-floating-card / client-shell / infra 清单类 | 修复（真身是生成器 bug） | BAR-GENLIST-01/GENINV-01/SYNCCOUNTS-01 三钉 | 「清单缺文件」三条发现同根：机械层静默丢事实家族——\Z 当字面 Z 截断域节、CODE_EXT 蒸发显式登记文件、chain:auto 映射吞 gen-* 步；共性「check-only 与生成共享坏解析，体检者与被体检者同病相认」，三例各带钉/探针 |
| workflows-vs-guides（阈值） | 修复 | release.yaml 改指 THRESHOLDS 单源 | 文档复述 LCA≥1/硬破界≥1 与校准脚本（LCA≤1、守界≥5/6）相悖——「勿复述数字」教训再验证 |
| workflows-vs-guides（探针数 17/18） | 修复 | agent-runner.md 改指 tasks.mjs 单源 | 实 18+6（24 任务）；手写计数又一次漂——同教训 |
| inter-workflows-infra（tests:na ×3） | 修复 | bug-fix.yaml 步骤 4/7/exit 补豁免例外 | fix/test 分开提交与硬规则 4 的钩子冲突，文档未载 tests:na 通道——本会话提交时被钩子现场拦截，裁决即亲历 |
| contract-vs-map-infra（陷阱 1 scss） | 修复 | 陷阱改「有同名 .scss 才防覆盖」 | 实 5 css 仅 2 有 scss 源（base/sidebar），绝对化措辞失真 |
| crossdomain-vs-inventory（anim 状态互搏） | 修复 | 风险矩阵行改 ✅【已结案】指 ADR-004 | 结案只改了漂移清单节、漏同步风险矩阵——「修复必须同步全部引用面」教训再验证 |
| guides-release-vs-history（v8.1.0） | 豁免 EX-005 | 登记表 + 重跑 | release.md 判例行自带「实为混装窗口」内联注，探针未读到——误报 |
| 臂数口径（3/6/22） | 修复 | 双端删数字改指单源 | release.yaml 臂数指 crontab、契约硬规则 11 指 release.yaml 步骤 0；22 臂是池化校准数据集非运行臂数——探针曾把三者当互斥 |
| workflows-vs-guides（尾批 4 条） | 修复 ×4 | 四份 workflow yaml 落账 | release.yaml exit 补「步骤 0 入口体检 PASS」；contract-maintain「<150」→「≤150」对齐预算线；audit.yaml 步骤 1 分机械/语义两层信号（semantic-chain 在链外）；spec-driven exit 补「npm run check 绿」 |
| crossdomain-vs-inventory（漂移 #10 归属） | 修复 | cross-domain.md #10 重写 | 读方实为 ai-chat（orb-chat-run.ts:184）+ floating-card（role.card.ts:158,166），被读方是 client-shell 的 KFMState——原句「ai-chat 直读 canvas-tree」双错归属 + 陈旧行号 |
| guides-release-vs-history（v8.5.1 跳号） | 豁免 EX-006 | 登记表 + 重跑 | v8.5.1 即 8.5 主题加冕版，8.4→8.5.1 直跳合规，探针误读「加冕」为须先有 x.0——误报 |
| inter-workflows-infra（39 vs 链步数） | 豁免 EX-007 | 登记表 + 重跑 | 39 = check-* 脚本数，chain:auto 枚举含非 check-* 步，标题下括号注已说明口径——误报 |
| 提示词有效性 | — | — | 本轮幻觉拦截 5；机械层 bug 三条全为真发现（精确率高的轮次）；新病灶学条目：生成器与校验器共享解析 = 全绿放行型盲区，预防 = 探针负例构造「buggy 版恰好绿」 |

## 2026-08-04 夜巡刷新轮（04:17 巡逻刷出 5 条，裁决人：QoderCN）

| 探针任务 | 裁决 | 处置 | 详情 |
|---------|------|------|------|
| stack-vs-ledger ×3 | 修复 ×3 | STACK 条目 4/9/16 落账 | 4/16 唯一子项已闭环而标题未标 ✅ → 标题行补 ✅（状态=标题首标记规范现场执法）；9 标题「提示词注入约束修复」与子项全是别的 bug 矛盾 → 改题「server 会话/prompts 域 bug 池」 |
| guides-release-vs-history（v8.5.1 复发） | 豁免 EX-006 放宽 | 目标改文件级 + 关键词留空 | 同根误报换 claim 行号再来：「主题继续」注指后续 patch 收尾，正合节奏节；新病灶学：claim 为裸 file:行号时关键词匹配永空转——EX 登记要么文件级要么 claim 含词，登记前先验匹配路径 |
| guides-testing-vs-infra（499 写死） | 豁免 EX-008 | 登记表 + 重跑 | testing.md 测试总数是 sync-counts 自动回写位（subs 在案），非手写死数——探针不知数字有机械主人 |
| 提示词有效性 | — | — | 本轮 5 条：3 真（STACK 卫生）2 误报（精确率 60%）；误报共性=探针不知某数字/版本有机械或判例主人 |

## 2026-08-05 裁决轮（8-05 04:17 巡逻 18 条，裁决人：主会话 + 用户拍板；8-04 欠账补还 + 根因研究立项）

> 背景：8-04 夜巡裁决轮记录了「STACK 4/9/16 补 ✅」等裁决但**修复未落盘**（STACK.md 无提交、
> 哈希未变）→ 8-05 同款复发——裁决流步骤 6 警告的「滞留僵尸」实证，修复/裁决必须当场验证。
> 处置原则：真发现 → 修复 + 同步引用面；口径/误报 → 豁免登记 + 单跑刷新。

| 探针任务 | 裁决 | 处置 | 详情 |
|---------|------|------|------|
| stack-vs-ledger ×6（SEM001×4 已闭环未标注 + SEM005×2 自相矛盾） | 修复 ×6 + 迭代 ×4 | STACK 卫生 | 4/16 子项闭环 → 标题加状态注（4→⏳ 1/4 闭环、16→1/3 已定性非债）；9→⏳（资产入库 ≠ 机制闭环，探针误读）；17-F3 → ✅（BAR-STACKNUM-01）；5/6 → ✅（池内 4 bug 全闭环 / 主体完成）。首轮重跑又报 4 条（3/4/5/6 状态标注不到位）→ 补齐 3✅ 4⏳ 5✅ 6✅ 后重跑清零 |
| inter-workflows-infra ×1（SEM002 40 vs 38） | 豁免 EX-009 | 口径注 + 登记表 | 40 = check-*.mjs 文件数，链上 38 个 check- 前缀名（deploy-freshness/doc-coverage 省前缀），与 EX-007 同根「探针不知口径有机械主人」；contract.md 括号注已补 |
| code-map-vs-src ×3（SEM001 行锚） | 修复 ×3 | infra/code-map.md | F4 陈旧声明「每次构建变脏」→ 已结案（BAR-BUILD-06）；renderTemplate 锚 :32→:75；sync-counts 计数锚 :37→:40 |
| code-map-vs-src-ai-chat ×3（SEM001 行锚） | 修复 ×3 + 顺手 2 | ai-chat/code-map.md | 并行执行锚 :382→:475（Promise.all 实测）；50 轮上限 :188→:253（MAX_TURNS）；system 组装 :151-178→:193-241。顺手修同源 2 处：streamChat 锚 :116→:139、content 归一/空 assistant 锚 :156/:165→:202/:213-215 |
| code-map-vs-src-client-shell ×5（SEM001 行锚） | 修复 ×5 + 顺手 1 | client-shell/code-map.md | currentRoot :99→:122；_handleStart :224→:189；break :281→:242（+ 不变量表 :281→:242）；clampOrbPosition :171-183→:112；漂移 1 条目 main.ts:72-73 vs :129-134 → :87-88 + loadFileTree 异步 :123（:129-134 越界，文件 125 行） |
| 探针验证 | 5/5 清零 | 单跑刷新 | stack + 3 code-map 探针重跑全部报 0；inter-workflows-infra 两次失败（旧链 opencode fetch failed → 新链 deepseek 空响应×3）→ 根因：纯文本分支 maxTokens 16000 被思考链吃光（21 文件大 prompt）→ 升 32000 + thinking enabled + reasoning_effort low（官方标配）后一次成功报 0——B 组 EX-009 豁免 + 口径注生效 |

**根因研究（用户动议「现象如何出现 + 一劳永逸」）**——18 条（另顺手挖出同源 4 条）的机制性缺口：

1. **G3 行锚漂移是绝对大头（11+4/18+）**——code-map 是测绘快照无保鲜机制；机械层双盲区：`check-doc-linerefs` 只拦「行号越界」不拦「锚点错位」（:32 存在即放行），`check-doc-symbols` 只查反引号符号而 code-map 大量引用无反引号（infra 域 0 个）→ 锚点落在两检查盲区交集；LLM 探针每任务只抽样 3-6 条（6 域每轮 ≤30 条 vs 191 处锚点，覆盖率 ~15%）→ 唯一防线是抽样，必然漏。
2. **G5 状态未回标（4 条）**——闭环动作（BAR 钉/裁决落地）与 STACK 标题无机械连接；8-04 裁决只记 provenance 未落盘 = 裁决流执行无「当场验证+提交」强制。
3. **G1 标题出生即错（2 条）**——标题措辞模糊（「提前完成」「bug 池」），低频靠写时纪律。
4. **口径误报（1 条）**——「探针不知数字有机械主人」家族第 4 例（EX-007/008 同根）。

**机制落地方案（A 线，用户拍板推进）**：
- check-doc-linerefs 升级：对「符号名（file:line）」模式锚点校验该行含符号名（拦错位）；
- semantic-audit.yaml 加硬规则：裁决轮结束条件 = 受影响探针当场单跑清零 + 修复当场提交（8-04 欠账教训写入）；
- G5 闭环回标机械化为研究线（STACK↔bugs.md 对账，追溯引用误报风险需先研究）；
- 配套基建：semantic-audit.mjs `--task` 支持多任务并发（内部并发池，单进程写 state 无竞态）；provider 链收敛为 deepseek 官方单臂（opencode 两臂额度耗尽 + 阶跃星辰顺位撤下，失败原地重试 2 次 + 显式报错透传）。

## 2026-08-12 裁决轮（8-12 04:17 巡逻 4 条，裁决人：kimi-code 会话）

| 探针任务 | 裁决 | 处置 | 详情 |
|---------|------|------|------|
| stack-vs-ledger（SEM005：#17 done vs F5 待裁决） | 修复 | stack.yaml #17 注 + 拆出条目 20 | F1-F4 闭环而 F5「低优先先登记」悬在 done 条目内——状态与未完成事项矛盾；F5 拆为独立 todo 条目 20「语义巡逻成本闸门」（信箱周报数据：738 调用/平均 97s），#17 五缺口全部结案 |
| contract-vs-map-floating-card（SEM001：27 vs 31 文件） | 修复 | code-map.md:9 改引用式 | 测绘元数据手写快照「27 文件」（基准 07-29）vs code-inventory 实报 31——G3 快照漂移家族；改引用式指 code-inventory（infra code-map:28 同款先例） |
| contract-vs-map-infra（SEM001：45 vs 43） | 修复 | contract.md 括号注删手写数 | 标题「45」由 sync-counts 派生（正确），括号注手写「43 = check-*.mjs 文件数」无机械主人、8-08 修订后新增 2 脚本即陈旧——与 EX-007/009 反向：这次是真漂移，且根因正是「复述了有机械主人的数」；注改指标题数勿复述 |
| inter-workflows-infra（SEM002：'checks' 步 vs 清单无 check-checks.mjs） | 豁免 EX-012 | 登记表 + 重跑 | 误报：chain:auto 短名剥 check- 前缀（sync-counts 从 STEPS 生成），gen:contract-list 实含 check-checks.mjs——探针不知短名映射，SEM001-1 同家族 SEM002 侧首例 |

**变体登记（注册表首开）**：SEM001-1「派生计数误报」（EX-007/008/009/010/011 五判例，≥3 → 结晶回路提案机械化：探针 prompt 注入 sync-counts 管理面/gen 区清单，或裁决预管线机械过滤命中机械主人的发现——待用户拍板）；SEM002-1「生成区映射误报」（EX-012 首例）。

**提示词有效性**：本轮 4 条：3 真 1 误报（精确率 75%）；误报仍属「探针不知机械主人」家族（第 6 例）。

**机械化落地（2026-08-12，用户拍板，BAR-SEMCHAIN-05）**：SEM001-1/SEM002-1 结晶收割——buildPrompt 注入【机械主人】节（sync-counts TARGETS 源码现扫 + chain:auto 短名映射说明 + docs/CLAUDE/README/提示词目录 gen: 生成区现扫），清单零写死文件（写死 = 同根病）；AUDIT_VERSION 6→7 旧哈希全失效，下一轮巡逻全量重跑建立带新 prompt 的基线（一次性成本，信箱随后周报可观察误报率变化）；2 钉（tests/semantic-audit.test.ts）。
