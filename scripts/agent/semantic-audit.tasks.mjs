/**
 * semantic-audit.tasks.mjs — 语义审计探针任务清单（腿一，v1 手写）
 *
 * 设计（STACK #3 腿一，2026-07-30 用户拍板）：
 * - 一个探针只问一个问题（单一职责），feeds 按需取最小文档集
 * - kind=intra：组内探针——单文档/单层 vs 基准层对账
 * - kind=inter：组间探针——文档对文档对账，种子来自 ledger/semantic-provenance.md
 *   实测冲突对（G4 双份登记 + SEM002/004 发现）——不打笛卡尔积，冲突对是稀疏的
 * - 清单是活文档：新冲突对冒头 → 补登；任务划分对错从 per-任务精确率数据长出，
 *   长够了再谈编译生成（三档阶梯）
 *
 * 字段：
 *   id       唯一标识（增量哈希与记账的键）
 *   kind     intra | inter
 *   sem      该探针追的 SEM 错误码（见 active/semantic-compiler-seed.md）
 *   feeds    喂给 agent 的文档（相对仓库根）
 *   baseline 基准层文档（对账参照，不逐行审计）
 *   tools    可选：工具白名单（read/grep/glob 等读类）。给了 = 该任务走工具流探针
 *            （runAgentTooled，服务端通道）；不给 = 纯文本探针（runAgent，现状）。
 *            巡逻边界 = 检测：只允许读类工具，禁止 write/edit/bash（修复留给会话 agent）。
 *   question 探针问题（prompt 核心，必须单一）
 */

const DOMAINS = ['ai-chat', 'canvas-tree', 'client-shell', 'floating-card', 'server', 'infra'];

const codeMaps = DOMAINS.map(d => `docs/domains/${d}/code-map.md`);
const contracts = DOMAINS.map(d => `docs/domains/${d}/contract.md`);

export const TASKS = [
  // ========== 组内探针：单层 vs 基准层 ==========
  {
    id: 'vision-vs-maps', kind: 'intra', sem: ['SEM001', 'SEM005'],
    feeds: ['docs/active/vision.md'],
    // 2026-07-30 重组：6 份全量 code-map 大基线注意力稀释（四轮连续零响应）——
    // 收窄到与远景宏观声称直接相关的 4 份（子系统划分/agent 通路/检查管线）；
    // 组内矛盾职责拆给 vision-internal
    baseline: ['docs/domains/code-inventory.md', 'docs/domains/cross-domain.md',
      'docs/domains/infra/code-map.md', 'docs/domains/server/code-map.md'],
    question: '找出 vision 中被代码现状（code-map 基准）直接反驳的断言、与累积现状方向相悖的路线图表述',
  },
  {
    // 2026-07-30 新增：vision 内部一致性独立探针——不喂基线，专扫自打架
    //（MID-4 决策翻转 3/3 漏报定案：内部矛盾被大基线稀释，独立出来零干扰）
    id: 'vision-internal', kind: 'intra', sem: ['SEM001', 'SEM005'],
    feeds: ['docs/active/vision.md'],
    baseline: [],
    question: '找出 vision 文档内部自相矛盾处：相邻断言互搏、决策记录与后文叙述打架、同一主题前后表述方向相悖（against 指向同文件另一处行号）',
  },
  {
    id: 'invariants-vs-maps', kind: 'intra', sem: ['SEM001', 'SEM003'],
    feeds: ['docs/constraints/invariants.md'],
    baseline: codeMaps,
    question: '找出 invariants 中被 code-map 现状反驳的断言，以及围绕已消亡概念（已删机制/文件/章节）的不变量',
  },
  {
    id: 'diagnostics-vs-maps', kind: 'intra', sem: ['SEM003'],
    feeds: ['docs/constraints/diagnostics.md'],
    baseline: codeMaps,
    question: '找出 diagnostics 中围绕已消亡代码/机制的陷阱条目（悬垂指针的概念版）',
  },
  {
    id: 'readme-vs-maps', kind: 'intra', sem: ['SEM001'],
    feeds: ['README.md'],
    baseline: codeMaps,
    question: '找出 README 中与子系统现状（数量/职责/计数/结构）不符的声称',
  },
  {
    id: 'claude-vs-docs', kind: 'intra', sem: ['SEM001', 'SEM003'],
    feeds: ['CLAUDE.md'],
    baseline: ['docs/workflows/', 'docs/guides/', 'docs/domains/'],
    question: '找出 CLAUDE.md 路由表/约束中与 workflows、guides、domains 实际内容不符的条目',
  },
  {
    id: 'workflows-vs-guides', kind: 'intra', sem: ['SEM001'],
    feeds: ['docs/workflows/'],
    baseline: ['docs/guides/', 'docs/domains/infra/contract.md'],
    question: '找出工作流卡步骤/退出条件中与 guides 和 infra 契约描述的管线现实不符的断言',
  },
  {
    id: 'guides-testing-vs-infra', kind: 'intra', sem: ['SEM001'],
    feeds: ['docs/guides/testing.md'],
    baseline: ['docs/domains/infra/code-map.md', 'docs/domains/infra/contract.md'],
    question: '找出 testing 指南中与测试基建现状（分层/计数/探针体系）不符的断言',
  },
  {
    id: 'guides-release-vs-history', kind: 'intra', sem: ['SEM001', 'SEM005'],
    feeds: ['docs/guides/release.md'],
    baseline: ['docs/ledger/history.md'],
    question: '找出 release 指南的版本语义与 history 账本实际版本演进实践相悖的表述',
  },
  {
    id: 'doc-maintenance-vs-pipeline', kind: 'intra', sem: ['SEM001'],
    feeds: ['docs/guides/doc-maintenance.md'],
    baseline: ['docs/domains/infra/code-map.md'],
    question: '找出文档维护指南中 grammar/家规与检查管线实际能力（check 清单）不符的声称',
  },
  {
    id: 'stack-vs-ledger', kind: 'intra', sem: ['SEM001', 'SEM005'],
    feeds: ['docs/active/STACK.md'],
    baseline: ['docs/ledger/bugs.md', 'docs/ledger/semantic-provenance.md'],
    question: '找出 STACK 队列中已闭环但未标注、或与账本状态矛盾的条目（状态无同步机制类），以及条目状态词与同条目详情自相矛盾处（如标「进行中」但下行全是完成结算语气——against 指向同条目详情行）',
  },
  // 六域：契约（应然）↔ code-map（实然）逐域对账
  ...DOMAINS.map(d => ({
    id: `contract-vs-map-${d}`, kind: 'intra', sem: ['SEM001', 'SEM002'],
    feeds: [`docs/domains/${d}/contract.md`, `docs/domains/${d}/code-map.md`],
    baseline: [],
    question: `对账 ${d} 域 contract（应然）与 code-map（实然）：找出两份文档对同一事实（文件清单/职责/机制/陷阱）断言不兼容之处`,
  })),
  {
    id: 'crossdomain-vs-inventory', kind: 'intra', sem: ['SEM001', 'SEM002'],
    feeds: ['docs/domains/cross-domain.md'],
    baseline: ['docs/domains/code-inventory.md'],
    question: '对账 cross-domain 语义层解读与 code-inventory 机械层数据：找出计数/归属/边界断言不一致之处',
  },

  // ========== 组间探针：种子来自 semantic-provenance 实测冲突对 ==========
  {
    id: 'inter-vision-invariants', kind: 'inter', sem: ['SEM002', 'SEM004'],
    feeds: ['docs/active/vision.md', 'docs/constraints/invariants.md'],
    baseline: [],
    question: '对账 vision 与 invariants：找出两份文档对同一主题（产品定位/AI 角色/架构方向/长期记忆定位）断言不兼容或争夺权威之处。历史冲突案例：两者曾各自表述「kfmv4 是否做自己的 agent」且不一致（已修），重点核同类主题',
  },
  {
    id: 'inter-readme-codemap', kind: 'inter', sem: ['SEM002'],
    feeds: ['README.md', 'docs/domains/code-inventory.md'],
    baseline: codeMaps,
    question: '对账 README 声称与机械清单/测绘：找出计数、子系统划分、写者模型等断言冲突。历史案例：README 曾写「7 个子系统」（实为 6）、「服务端单写者」（实为双轨），重点核同类声称',
  },
  {
    id: 'inter-workflows-infra', kind: 'inter', sem: ['SEM002'],
    feeds: ['docs/workflows/', 'docs/domains/infra/contract.md'],
    baseline: ['docs/domains/infra/code-map.md'],
    question: '对账工作流卡与 infra 契约：找出对检查管线行为（阻断语义/例外/脚本名）断言冲突之处。历史案例：check 改名后卡未同步、warning 例外未登记，重点核同类',
  },
  {
    id: 'inter-agentrunner-infra', kind: 'inter', sem: ['SEM002'],
    feeds: ['docs/guides/agent-runner.md', 'docs/domains/infra/contract.md'],
    baseline: ['docs/domains/infra/code-map.md'],
    question: '对账 agent-runner 指南与 infra 契约/测绘：找出对 exit 协议、provider 链、重试语义断言冲突之处。历史案例：exit 1 幽灵协议（实为 exit 0/2），重点核同类',
  },
  {
    id: 'inter-provenance-bugs', kind: 'inter', sem: ['SEM002', 'SEM004'],
    feeds: ['docs/ledger/drift-provenance.md', 'docs/ledger/bugs.md'],
    baseline: [],
    question: '对账两份账本：找出同一病灶/bug 在两份账本中成因标签、commit 锚点、状态断言分叉之处（双份登记无对账类）。历史案例：条目 17/18 标签分歧、BAR-PROXY-01 锚点写错，重点核同类',
  },
  {
    id: 'inter-detail-contract-aichat', kind: 'inter', sem: ['SEM002'],
    feeds: ['docs/domains/ai-chat/detail-runtime.md', 'docs/domains/ai-chat/contract.md'],
    baseline: ['docs/domains/ai-chat/code-map.md'],
    question: '对账 ai-chat 细节文档与契约：找出对运行时机制（取消路径/冷恢复/会话存储）断言冲突或归属矛盾之处',
  },

  // ========== 工具流试点（2026-08-04 用户拍板：巡逻探针工具化） ==========
  // 与 *-vs-maps 的本质区别：对账对象是【源码】（不是另一份文档）。
  // 纯文本探针没看过源码，「声称 vs 代码现状」只能靠模型先验猜（幻觉率高，靠机械复核拦截）；
  // 工具流探针现场 read/grep 证伪——只报可验证的断言，从源头降幻觉。
  // 试点先上 1 份 code-map（infra，最小），跑通后逐任务推广覆盖全部 6 份。
  {
    id: 'code-map-vs-src', kind: 'intra', sem: ['SEM001'],
    feeds: ['docs/domains/infra/code-map.md'],
    baseline: [],
    tools: ['read', 'grep', 'glob'],
    question: '抽查 code-map 中声称的具体文件路径/机制/计数/脚本名，用 read/grep/glob 现场验证是否与源码现状一致。只报可被工具证伪的断言（路径不存在/机制已删/计数不符/脚本已更名），每条 finding 必须附上工具验证证据（读到的实际内容或 grep 无命中说明）。不确定的不要报。',
  },
];
