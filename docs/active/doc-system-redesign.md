# 文档系统重构设计 — 从文档形态驱动到工作流驱动

> **状态**：对齐中（2026-07-28 唤醒：v8.1.1 已发布，本重构排期 v8.2.0；§十一 rebase 完成，待走查 + 用户确认决策点）
> **触发**：2026-07-28 文档系统审计（管线 warning→hard-fail 升级 + 结构性盲区分析）
> **执行前置**：§10.6 对齐清单完成 + 用户确认后，用 spec-driven 流程执行本设计

---

## 一、问题发现过程（推理链）

### 1.1 审计起点

对现有 18 个 check 脚本进行全面审计，发现：
- 12 处"应该失败但静默通过"的 silent-skip/warn-only 模式
- 3 处死代码（WORKBENCH_SPEC 路径错误、PROJECT_ASSESSMENT 悬空引用、pre-push hook 未激活）
- 结构性盲区：语义过时不可检测、新鲜度可绕过、测试计数模式绑定、链接只验存在性

**核心洞察**：warning 对 agent 等于不存在。agent 会合理化"这不是我造成的"然后永远忽略。必须全部改为 hard fail。

### 1.2 修完后的追问

修完 12 处 hard-fail 后，追问"为什么这些问题能存在这么久"→ 答案是管线只检查数字和路径，不检查语义。于是新增 3 个检查：
- `check-desc-freshness.mjs`：模块描述新鲜度（≥5 次代码提交未同步 → fail）
- `check-test-patterns.mjs`：测试计数模式完整性
- `check-superseded-coverage.mjs`：superseded_by 内容覆盖校验

### 1.3 更深层的问题

新增检查通过后，追问"文档系统还有什么问题"→ 发现：
- 82 个 md 文件，信息散布，同一知识碎片在 4-5 个文件里
- 交叉引用链条最长 5 跳
- 6/13 代码→文档引用已腐烂
- archive 60+ 文件大部分是噪音
- agent 的阅读路径是固定的但只有部分信息真正被看到

**核心洞察**：问题不是"检查不够"，而是**文档架构本身耦合、冗余、难以导航**。

---

## 二、第一版方案及其失败（为什么被否定）

### 2.1 第一版：按领域分治

```
docs/
├── INDEX.md
├── invariants.md
├── domains/
│   ├── ai-chat.md
│   ├── canvas-tree.md
│   ├── floating-card.md
│   ├── orb-ui.md
│   ├── server.md
│   └── infra.md
├── decisions/
└── history.md
```

原则：一个领域一个文件，读完就够。

### 2.2 被提出的四个致命问题

**问题 1：文件过长 / 信息污染**
如果 agent 只需要某个领域的一小部分信息，读到的却是一个完整的领域大文件，会造成上下文窗口污染。

→ 修正：摘要 + 细节分离。contract.md <150 行（必读），detail-*.md（按需 grep）。

**问题 2：System prompt 文档的位置**
心法、诊断手册等需要每次 API 请求都注入 system prompt。它们不属于任何领域，是跨领域约束。

→ 修正：独立的 runtime/constraints 层。

**问题 3：Handoff 如何解耦**
Handoff 是时间切片，不是领域知识。

→ 修正：handoff 变成 history.md 一条记录 + git tag。需要回溯时 `git show v7.2.0:docs/...`。

**问题 4：设计文档 SOP**
现有工作流是：讨论 → 写设计文档 → 按文档开发 → 修改 → 归档。这个流程在新架构里怎么走？

→ 这个问题引出了**工作栈机制**（见 §三）。

### 2.3 工作栈机制

真实的工作模式不是"最多 1 个活跃文档"，而是一个**工作栈**——大中小是同一个关注的不同缩放级别：

```
远景（大）→ 步骤 3 需要展开 → 功能设计（中）→ 步骤 2 比想象中难 → 实现设计（小）
                                                                    ↑ 你在这里
```

做完小的，pop 回中的继续推步骤；做完中的，pop 回大的继续拆下一个中。

结构：
```
docs/active/
├── STACK.md              ← 当前工作栈（<50 行）
├── vision.md             ← 大：远景 + 步骤清单 + 进度
├── feat-x.md             ← 中：当前功能设计 + 步骤
└── feat-x-impl-detail.md ← 小：当前卡点的具体方案
```

STACK.md 示例：
```markdown
# 工作栈
1. [vision.md] v9 上下文重构 — 步骤 3/7 进行中
2. [feat-x.md] 工具压缩器 — 步骤 2/4 进行中
3. [feat-x-impl-detail.md] ← 当前：流式分块压缩方案
```

生命周期规则：
- **下钻**：当前步骤比预期复杂 → 创建下一级文件 → STACK.md 追加一行
- **完成**：当前层做完 → 确认的知识写入 domain contract → 删除该文件 → STACK.md pop → 父级标记 ✅
- **放弃**：方案不可行 → 写一条 ADR → 删除 → pop

### 2.4 元层追问

设计到这里，被追问："你只是被问了一个 design SOP 就引出了工作栈机制，说明你并没有理解当前文档系统的全部工作模式。"

→ 这触发了对现有系统的完整工作流分析（见 §三）。

---

## 三、现有系统的真实工作流（灵魂分析）

### 3.1 发现的 15 个工作流

通过深度分析所有活跃文档 + git log 模式 + archive 生命周期，发现文档系统实际支撑着 15 个不同的工作流：

| # | 工作流 | 频率 | 触发条件 | 核心文档 |
|---|--------|------|---------|---------|
| 1 | 会话启动/路由 | 每次对话 | 新会话开始 | CLAUDE.md |
| 2 | 改代码前约束加载 | 每次改代码 | 准备修改 src/ | INVARIANTS + DIAGNOSTICS §1 |
| 3 | 大改动 spec-driven 流程 | 每周 1-2 次 | 跨 3+ 文件/多阶段/引入隐式契约 | SPEC_DRIVEN_WORKFLOW → design/ |
| 4 | Bug 修复 + 回归钉 | **最频繁** | 发现 bug | REGISTRY + tests/ + HANDBOOK |
| 5 | 纪律机械化 | 每批 bug 后 | 同一错误重复 3+ 次 | 新 check-*.mjs |
| 6 | 活跃状态同步 | 每次改代码 | 代码变更完成 | HANDBOOK §2/§3 |
| 7 | 设计提案生命周期 | 跟随 #3 | 设计完成/放弃 | AGENTS.md §三/§五 |
| 8 | 版本发布 | 每版本 | 准备发版 | AGENTS.md §六 |
| 9 | 卡片插件开发 | 加卡时 | 新增 .card.ts | CARD_DEV_GUIDE |
| 10 | Bug 诊断/分诊 | 遇 bug 时 | 异常行为出现 | DIAGNOSTICS |
| 11 | 文档树同步 | 新增/移动文档时 | 文件结构变化 | CLAUDE.md |
| 12 | 参考契约维护 | 改子系统时 | 修改已有子系统 | AI_CHAT_RUNTIME 等 |
| 13 | 文档-代码审计 | 周期性 | 版本间/感觉漂移时 | HANDBOOK §七 |
| 14 | 设计注释约定 | 改文件时 | 修改源文件 | 源文件头部 |
| 15 | 心法回溯 | 新功能时 | 新功能 step 3a | INVARIANTS §六 |

### 3.2 关键发现

**工作流才是文档系统的灵魂，文档只是工作流执行过程中的状态。**

现在的架构围绕文档形态组织（"这是设计文档"、"这是交接记录"），但真正驱动一切的是行为模式。把副产品当主体来组织，就是混乱的根源。

### 3.3 耦合痛点（引用图分析结果）

- **INVARIANTS 是 god-hub**：12 条入边（9 文档 + 3 代码文件）。心法编号是隐式 API。
- **HANDBOOK 既是 hub 又最易变**：8 条入边指向特定章节，但每次改代码都要动。
- **CLAUDE.md 和 HANDBOOK 路由功能重叠**：agent 从不同入口得到重复/冲突指引。
- **Bug 修复要读 3 个文档**：INVARIANTS（心法 24）+ DIAGNOSTICS（隐性契约）+ REGISTRY（登记表）。
- **代码→文档引用 6/13 已腐烂**：指向已删除的 docs/notes/、已归档的 spec。
- **最长引用链 5 跳**：CLAUDE → SPEC_DRIVEN → AGENTS → HANDBOOK → DIAGNOSTICS → AI_CHAT_RUNTIME。
- **Draft 文档近乎孤儿**：AI_ARCHITECTURE、CONTEXT_ASSEMBLY_SPEC 无有意义入边。

### 3.4 Git log 揭示的隐式工作流

| Commit 模式 | 揭示的工作流 |
|---|---|
| `test+docs: 第N批 X 钉 + 登记 + HANDBOOK` | 回归钉 SOP（最频繁） |
| `fix:` 后紧跟 `test+docs:` | 修复和文档刻意分离提交 |
| `feat(check):` | 纪律机械化 SOP |
| `chore: check 自动同步` | 管线自动回写文档 |
| `docs: 注册 X 到 CLAUDE.md` | 文档树同步规则 |
| `release: vX.Y.Z` + tag | 发版 SOP |

### 3.5 文档生命周期（三种终态）

从 archive frontmatter 分析出三种归档终态：
1. **任务型**（status: completed）：计划全部完成 → 归档。如 REGRESSION_TESTING_SYSTEM.md。
2. **教训型**（status: completed）：作为证据永久保留。如 CASE_STUDY_MODEL_CHOICE.md。
3. **被覆盖型**（status: superseded）：内容合并入活跃文档。如 DEBUG_SOP.md → DIAGNOSTICS.md。

---

## 四、最终架构设计

### 4.1 核心原则

1. **工作流是一等公民**，文档是工作流的状态/资源
2. **按变更频率 + 消费模式分层**，不按文档类型分
3. **一个工作流定义 = 读什么 + 写什么 + 退出条件**
4. **最长引用链 ≤2 跳**：INDEX → 目标（完事）
5. **结构从工作流需求中涌现**，不预先规划

### 4.2 目录结构

```
docs/
├── workflows/              ← 灵魂：标准化工作流定义（一等公民）
│   ├── _template.yaml      ← 新工作流模板
│   ├── _retired/           ← 退役工作流（保留历史）
│   ├── session-start.yaml
│   ├── pre-code-gate.yaml
│   ├── bug-fix.yaml
│   ├── spec-driven.yaml
│   ├── card-dev.yaml
│   ├── release.yaml
│   ├── discipline-mechanize.yaml
│   ├── state-sync.yaml
│   ├── diagnostics.yaml
│   ├── doc-tree-sync.yaml
│   ├── contract-maintain.yaml
│   ├── audit.yaml
│   └── ...
│
├── INDEX.md                ← 唯一路由：任务类型 → 工作流匹配
│
├── constraints/            ← 永变层：跨领域约束，每次注入 system prompt
│   ├── invariants.md       ← 心法（编号稳定，是隐式 API，只追加不重排）
│   └── diagnostics.md      ← 纯排查流程（隐性契约迁回领域 contract）
│
├── domains/                ← 慢变层：已确认的领域知识
│   ├── ai-chat/
│   │   ├── contract.md     ← 架构+契约+陷阱+文件清单（<150行，必读）
│   │   └── detail-*.md     ← 细节（按需读）
│   ├── canvas-tree/
│   │   ├── contract.md
│   │   └── detail-*.md
│   ├── floating-card/
│   │   └── contract.md
│   ├── orb-ui/
│   │   └── contract.md
│   ├── server/
│   │   └── contract.md
│   └── infra/
│       ├── contract.md     ← 构建管线+测试体系
│       └── detail-checks.md
│
├── active/                 ← 快变层：正在进行的工作
│   ├── STACK.md            ← 工作栈（当前在哪，<50 行）
│   └── *.md                ← 各层级活跃设计文档
│
├── ledger/                 ← 追加层：只增不改的追踪记录
│   ├── bugs.md             ← 回归登记表
│   └── history.md          ← 压缩时间线（替代 archive + handoff）
│
├── guides/                 ← 稳态层：操作手册
│   ├── spec-driven.md      ← 大改动流程（含纪律路由表）
│   ├── card-dev.md         ← 卡片开发
│   ├── release.md          ← 发版 SOP
│   └── doc-maintenance.md  ← 文档维护规则
│
└── decisions/              ← 不可变层：ADR
```

### 4.3 工作流定义格式

```yaml
# workflows/bug-fix.yaml
id: bug-fix
name: Bug 修复 + 回归钉
trigger: 发现 bug / 用户报告异常
frequency: 最高频（git log 主体）
reads:
  - constraints/invariants.md#心法24
  - domains/{affected}/contract.md#陷阱
  - ledger/bugs.md (查是否已有相关条目)
steps:
  1. 定位根因（参考 constraints/diagnostics.md 排查流程）
  2. 修复代码
  3. 写 regression() 钉子
  4. revert 验证（revert fix → 钉子必须红）
  5. 登记 ledger/bugs.md
  6. 如果发现新陷阱 → 写入 domains/{affected}/contract.md#陷阱
  7. 提交（fix: 和 test+docs: 分开）
writes:
  - src/ (fix)
  - tests/ (nail)
  - ledger/bugs.md (登记)
  - domains/{affected}/contract.md (新陷阱)
exit_condition: nail 通过 revert 验证 + 登记表有行 + npm run check 通过
```

### 4.4 各层职责与约束

| 层 | 变更频率 | 消费方式 | 约束 |
|---|---|---|---|
| workflows/ | 极少（新模式诞生时） | 每次任务开始时匹配 | 是架构本身，不是文档 |
| constraints/ | 极少（新心法追加） | 每次 API 注入 system prompt | 总计 <500 行；编号永不重排 |
| domains/ | 慢（知识确认时） | 工作流 reads 指定时 | contract <150 行；detail 按需 |
| active/ | 快（工作期间每天） | 当前工作栈内 | STACK.md 必须与实际文件一致 |
| ledger/ | 中（每次 fix/release） | 工作流 reads 指定时 | 只追加不修改不删除 |
| guides/ | 极少（流程变更时） | 特定工作流触发时 | 是 SOP 不是知识 |
| decisions/ | 极少（重大取舍时） | 追溯时 | 不可变 |

### 4.5 关键设计决策及理由

| 决策 | 理由 |
|------|------|
| 心法编号永不重排 | 代码里写死了"心法 14"、"心法 24"，是隐式 API |
| 回归钉路径独立（ledger/bugs.md） | 最高频工作流，路径必须极短，不能嵌入领域文档 |
| 参考契约 = domains/*/contract.md | 实现完了还要永远活着，和任务型设计文档是不同物种 |
| 任务文档 = active/*.md（临时） | 知识归宿是被 contract 吸收，不是被"保存" |
| 隐性契约迁入领域 contract | 它本质是领域知识，散布在 DIAGNOSTICS 里是因为没有更好的家 |
| DIAGNOSTICS 只保留排查流程 | 知识仓库功能被领域 contract 接管后，它只需要做"怎么查" |
| INDEX.md 是唯一路由 | 消除 CLAUDE.md 和 HANDBOOK 的路由重叠 |
| 工作流自进化（_template + 3 次升级） | 项目已证明会自然产生新模式，需要显式吸收机制 |
| archive 压缩成 history.md | 60+ 文件大部分是噪音；代码和测试是细节的真相源 |
| 最长链 ≤2 跳 | 5 跳链条是信息丢失的根因 |

### 4.6 自进化机制

**模式诞生的信号**：同一类 ad-hoc 操作重复 3 次以上。

规则：
- agent 执行任务时没有匹配的工作流 → 完成后创建 `_draft.yaml`
- draft 被使用 3 次 → 升级为正式工作流
- 工作流 60 天没被触发 → 标记候选退役
- 每个工作流的 reads/writes 是文档结构的**唯一需求来源**
- 如果一个文档没有任何工作流 read 或 write 它 → 它不该存在

**现有模式诞生案例**：
- 心法 24（回归钉）：一条原则 → 反复执行 → 固化 SOP → 专属登记表 → check 脚本
- check-css-wiring：一批 bug → 系统性问题 → 机械化

---

## 五、管线适配策略

### 5.1 路径变了但逻辑不变

check-versions、check-css-wiring、check-anim、check-as-any、check-card-meta、check-zindex、check-console、check-cards、check-uncommitted

→ 只改路径常量。

### 5.2 逻辑要简化/重写

| 现有脚本 | 新逻辑 |
|---------|--------|
| check-handbook-sync | → 检查每个 domains/*/contract.md 的 frontmatter 新鲜度 |
| check-doc-coverage | → 检查每个 src/ 模块在对应 domain contract 中有提及 |
| check-superseded-coverage | → 删除（不再有 superseded 机制） |
| check-docs（链接检查） | → 简化（不再有 archive frontmatter） |
| check-consistency（文档树） | → 检查 INDEX.md 路由表 vs 实际文件 |
| check-desc-freshness | → 检查 domain contract 新鲜度（逻辑不变，路径变） |

### 5.3 新增

| 脚本 | 职责 |
|------|------|
| check-active-stack | STACK.md 引用的文件都存在；active/ 里没有孤儿文件 |
| check-code-doc-refs | 代码中的 @see/文档引用全部有效（解决 6/13 腐烂问题） |
| check-workflow-integrity | 工作流 yaml 的 reads/writes 路径全部有效 |

---

## 六、迁移计划（概要）

### 阶段 1：建骨架（不动现有文件）

1. 创建新目录结构
2. 写 15 个工作流 yaml
3. 写 INDEX.md 路由表
4. 写 guides/（从现有 AGENTS.md、SPEC_DRIVEN_WORKFLOW、CARD_DEV_GUIDE 提取）

### 阶段 2：迁移活跃知识

5. 从现有 design/*.md 提取 → domains/*/contract.md + detail
6. 从 DIAGNOSTICS §1 提取隐性契约 → 对应 domain contract
7. 从 HANDBOOK §1 提取架构速查 → 对应 domain contract
8. INVARIANTS → constraints/invariants.md（基本不动）
9. DIAGNOSTICS 排查流程 → constraints/diagnostics.md
10. BUG_REGRESSION_REGISTRY → ledger/bugs.md
11. HANDBOOK §2/§3 → active/STACK.md（当前状态）

### 阶段 3：压缩历史

12. archive/ 60+ 文件 → ledger/history.md（每文件压缩成 1-3 行）
13. 教训型文档（CASE_STUDY 等）→ decisions/ 或 history.md 详注
14. 删除 archive/

### 阶段 4：管线切换

15. 更新所有 check 脚本路径
16. 新增 check-active-stack、check-code-doc-refs、check-workflow-integrity
17. 删除 check-superseded-coverage
18. 更新代码中 6 处腐烂的文档引用
19. 全量 npm run check 通过

### 阶段 5：验证

20. 用每个工作流走一遍真实任务，验证 reads/writes 路径正确
21. 确认 system prompt 注入的 constraints/ 总量 <500 行

---

## 七、未解决的问题

1. **system prompt 注入机制**：现在 base.md 里硬编码了 INVARIANTS 路径。新架构下需要改成注入 constraints/ 下所有文件。这涉及 src/server/prompts/ 的改动。
2. **CLAUDE.md 的命运**：它是 qoderclicn 的入口文件（工具自动读取）。不能完全删除，但可以缩减为"请读 docs/INDEX.md"的一行指引。
3. **domain contract 的粒度**：ai-chat 领域目前有 AI_CHAT_RUNTIME + TOOL_IO_COMPACTION + AI_ARCHITECTURE 三个活跃文档，合并成一个 contract 可能超 150 行。需要判断是拆成两个 domain 还是允许 detail 文件。
4. **工作流匹配的自动化程度**：INDEX.md 是给人/agent 手动匹配的，还是可以做成语义路由（根据任务描述自动推荐工作流）？初期建议手动，稳定后再考虑自动化。

---

## 八、本文档自身的归宿

本文档是 active/ 里的设计文档。执行完毕后：
- 架构知识 → 已体现在新结构本身
- 工作流定义 → workflows/*.yaml
- 迁移决策理由 → ledger/history.md 一条
- 本文档 → 删除（知识已被吸收）

如果执行过程中发现本设计有遗漏（大概率），按工作栈机制下钻：创建子文档处理具体问题，完成后 pop 回本文继续推进。

---

## 九、设计过程复盘：提取的原则

> 本节记录设计对话中涌现的元认知，供执行者理解设计意图的来源，
> 并作为心法/约束层候选条目。

### 9.1 候选心法：先枚举行为，再画格子

**来源**：第一版方案（按领域分治）被一个 SOP 问题击穿。原因是从"文档应该长什么样"出发设计，而不是从"人/agent 实际会做什么"出发。

**表述**：设计任何结构之前，先穷举这个结构需要支撑的所有行为模式。结构是行为的投影，不是行为是结构的填充。

**适用范围**：文档架构、UI 布局、API 设计、模块拆分——任何"分类/分层"决策。

**机械化方式**：spec-driven 工作流的 exit condition 增加一步——"设计完成后，用 5 个真实工作场景压力测试，通过后才进入实施。"

### 9.2 设计文档必须包含"被否定的方案及原因"

**来源**：对话中坚持不用模板、保留推理链。这不是偏好，是工程判断：执行者遇到边界情况时，需要知道约束是怎么发现的，才能做出符合设计意图的决定。只给结论，执行者会在第一个意外面前偏离。

**对 active/ 设计文档的影响**：每份设计文档应有一个正文节（不是附录）记录被否定的方案及否定原因。本文档 §二 就是这个原则的实例。

### 9.3 工作流不是被设计的，是被观察的

**来源**：心法 24（回归钉）不是谁坐下来写的 SOP，是从几十次 `test+docs:` commit 里长出来的。check-css-wiring 也不是预先规划的，是一批 bug 之后才机械化的。

**对自进化机制的影响**：核心不是"创建模板让人填"，而是降低观察门槛。INDEX.md 的路由逻辑需要 fallback："如果没有匹配的工作流，记录这次执行，事后审视是否该固化。" 重复 3 次的 ad-hoc 操作就是未诞生的工作流。

### 9.4 对话作为压力测试工具

**来源**：本次设计没有先写代码再发现不对——用问题把错误提前了。这测试的是设计假设而不是实现正确性，比任何 check 脚本都有效。

**对 spec-driven 工作流的影响**：在"设计完成"和"开始实施"之间，显式加入一个反例压力测试步骤。不是可选的，是 exit condition。

### 9.5 对执行者的提醒

本设计经历了三轮否定才到达当前形态：
1. 第一版（按领域一个大文件）→ 被信息污染/SOP/system prompt 三个问题否定
2. 第二版（摘要+细节分离+工作栈）→ 被"你没有理解全部工作模式"否定
3. 第三版（工作流驱动+15 个模式显化）→ 当前形态

如果你在执行中发现第四轮否定的理由，不要犹豫——按工作栈机制下钻，修正设计，然后继续。设计文档的权威来自推理链的完整性，不来自"已经写好了所以不能改"。

---

## 十、平行讨论的第三方评审（2026-07-28，kimi 轨收尾追加）

> 本节是应 §9.5 邀请写入的第四轮否定。评审依据：本文档全文 + qoder 轨
> 聊天记录真相源（本机 ~/.qoder-cn/projects/-root-kfmv4/ 下会话
> 1a83caf2-f9d3-4162-9a55-bbf55a424827，906 行摘要，不入库）。
> 结论：**设计不执行，休眠待用户决定**；执行前必须先完成 §10.6 对齐清单。

### 10.1 第四轮否定：15 个工作流漏掉了正在发生的第 16 个

本设计写作当晚，现实中正在运行一个清单外的工作流——**平行多轨讨论**：
用户同时驱动两个 agent 在同一代码库做两场高强度设计讨论，互相知情、
各自提交（本文档的「执行前置」就是证据）。它不在 15 个模式里，且违反
STACK.md 的单线程栈假设。这是「枚举永远不完备」的活证据——本设计真正
承重的不是 15 个 yaml，而是 9.3 与自进化机制。第 16 工作流应走 draft→固化
通道显式化，作为自进化机制的首次实战。

### 10.2 第 16 工作流草案（平行多轨讨论——慎用）

```yaml
id: parallel-tracks
name: 平行多轨讨论（慎用——对人脑消耗极大）
trigger: 两个及以上 agent 在同一代码库并行推进独立设计/开发轨
cost_warning: 双倍的决策点与上下文切换。触发前自问：这两轨真的不能串行吗？
rules:
  - 每轨有明确文件边界，不交叉编辑同一文件
  - 通过 git log 同步（不看对方聊天记录，看 commit）
  - 收尾单轨汇总：一轨先结束，另一轨 agent 负责合并双方产物
  - 合并点必须 check/test 全绿
exit_condition: 只剩一条活跃轨 + 双方产物已合并提交
```

### 10.3 压力测试问题库（对 9.4 的具体化）

9.4 说「用 5 个那 X 怎么办反例压力测试」——本库回答「那 5 个问题具体长
什么样」。从两场讨论的真相源蒸馏的用户质疑五母型 + 度量三问，已固化进
`../KFM_V4_INVARIANTS.md` §七 步骤 3b（agent 在设计定稿前逐条自问）：

1. 反例击穿：那 X 怎么办？（X = 最普通的真实形态，不是理想样例）
2. 流程走查：现有每个 SOP/工作流在新设计里怎么走？
3. 消费追问：谁会读它？读多长？注入哪里？信息污染在哪？
4. 递归上升：这个机制之上还有没有一层？那层成立吗？
5. 信息损耗审计：压缩/模板化/归一会丢什么？需要时谁找得回？
6. 真实数据：命中率/误报率是多少？7. 成本不对称：错报漏报各什么代价？
8. 代理指标：我在优化目标还是目标的代理？

### 10.4 两场讨论的收敛对照（原则正确性的最强证据）

两个互不知情的讨论独立得出同一组元原则：

| kimi 轨（工具压缩讨论） | qoder 轨（本文档） |
|---|---|
| 沉淀五问（INVARIANTS §七 步骤 7） | §九 复盘原则 + _draft.yaml 自进化 |
| 设计讨论 SOP 质疑步（步骤 3b） | 9.4 对话作为压力测试 |
| 心法 25 真实数据形态 | 9.1 先枚举行为再画格子 |
| 宁漏勿错（成本不对称） | warning→hard-fail 洞察 |

两个 agent 对用户的思维模式画像亦一字不差（直觉先行/反例测试/递归上升/
拒绝信息损耗）——该模式已被独立复现两次，即可成文的资产（§10.3）。

### 10.5 评审发现的设计缺陷（执行前必须处理）

1. **未按自己的标准验证**：§九.1 要求定稿前 5 场景压力测试，但 §六 把
   走查排在迁移第 20/21 步。补法：纸面走查 15+1 个工作流的 reads/writes。
2. **hop 数学乐观**：CLAUDE→INDEX→yaml→文档实为 3-4 跳；CLAUDE.md 缩成
   一行会让最高频的会话启动每次白付两跳。
3. **迁移窗口真相源悬空**：阶段 1-4 之间新旧结构并存，权威源未指定。
4. **删除 archive/ 会砍断活引用**：CLAUDE.md 现引用 4 个 archive 文档；
   压缩成 1-3 行后 grep 可发现性丢失。
5. **自进化缺少机械化**：draft 创建/60 天退役全靠 agent 自觉——按本文档
   自己的「warning=不存在」洞察，没有 check 脚本就会烂。
6. **与 2026-07-28 修宪撞车**：INVARIANTS 已新增宪法栏目+组7/组8（~700 行，
   破 constraints <500 行约束）；CLAUDE.md/HANDBOOK 挂载点已变。执行前
   必须 rebase 到修宪后的现实。

### 10.6 执行前对齐清单（休眠唤醒条件）

未来若启动本重构，第一步不是阶段 1，而是：①完成 10.5 全部六项处理；
②纸面压力测试 15+1 工作流并记录 hop/文档数对比；③把 §10.2 的第 16
工作流纳入 workflows/ 清单；④经用户确认后再进 spec-driven 流程。

---

## 十一、2026-07-28 rebase（休眠唤醒对齐）

> 唤醒条件①处理记录：§10.5 六项缺陷逐条处理 + 修宪后现实基线。
> 唤醒条件②（15+1 工作流纸面走查）随后进行，结果追加为 §十二。

### 11.1 现实基线变化（设计写作时 → 唤醒时）

- **INVARIANTS 已 734 行**（宪法 5 条 + 31 心法 + SOP 步骤 3b/7）——
  §4.4「constraints 总计 <500 行」约束已被修宪撑破，见缺陷 6 处理。
- **`docs/design/TOOL_IO_COMPACTION.md`（369 行）已是事实上的 domain contract**：
  逐工具映射表 + 决策树 + 禁令清单 + check-tool-compaction 双向核对——
  §4.2 domains 模型的可行性证据，迁移时作为 ai-chat 域 detail 级素材。
- **`decisions/` 已存在**（adr-001/002），不可变层部分落地。
- **检查管线 18 → 20 个**（新增 check-tool-compaction、check-test-patterns），
  全部位于仓库根目录；§五管线适配表按此 rebase。
- **第 16 工作流已半固化**：讨论文化侧（质疑五母型、沉淀五问、设计讨论 SOP）
  已进 INVARIANTS §七 步骤 3b/步骤 7；§10.2 yaml 待补的只剩平行多轨规则本身
  （文件边界 / git log 同步 / 单轨收尾）。
- **文档体量**：VISION_AND_ROADMAP 893 行（全库最大）、DIAGNOSTICS 787、
  HANDBOOK 783、CARD_DEV_GUIDE 715、BUG_REGRESSION_REGISTRY 166。
- **V8_ARCHITECTURE 归宿**：宪法展开论述 → constraints/invariants 附录；
  §四视觉契约 + §五 restart 判据 + §七不变清单 → 对应 domain contract；
  §二/§三/§六/§八战报 → ledger/history.md 一条。不再单独迁移。

### 11.2 §10.5 六项缺陷的处理

1. **走查提前**：§六阶段 5 的「验证」走查提前为迁移前置（即 §10.6 ②），
   纸面走查 15+1 工作流并记录 hop/文档数对比，不过不进阶段 1。
2. **hop 数学**：承认 CLAUDE→INDEX→yaml→文档实为 3 跳。修正：CLAUDE.md
   不缩成一行——最高频的会话启动工作流在 CLAUDE.md 内联自包含（1 跳）；
   INDEX.md 只做任务→工作流匹配；yaml 的 reads 直接写文档全路径。
   目标：会话启动 1 跳，其余 ≤2 跳。（决策点 D1）
3. **迁移窗口真相源**：写入 §六——阶段 1-4 期间旧结构是唯一权威，
   新结构为影子；阶段 4 管线切换提交即权威切换点，此前新结构不承载引用。
4. **archive 活引用**（唤醒时复核仍在）：CLAUDE.md 4 处
   （ENGINE_ARCHITECTURE、CARD_SYSTEM_UNIFICATION_SPEC、
   REGRESSION_TESTING_SYSTEM、WORKBENCH_SPEC）+ HANDBOOK 1 处
   （REGRESSION_TESTING_SYSTEM）。处理顺序：先迁引用再压缩 archive——
   ENGINE_ARCHITECTURE → domains 引擎域 contract 素材；
   CARD_SYSTEM_UNIFICATION_SPEC（失败教训指针）→ decisions/ ADR 化后移除引用；
   REGRESSION_TESTING_SYSTEM → guides/ 测试方法论一节；
   WORKBENCH_SPEC 死活待确认（决策点 D3）。删除 archive/ 永远排在最后。
5. **自进化机械化**：§五新增 check-workflow-integrity（yaml reads/writes
   路径全有效）之外，补 check-workflow-freshness（draft 超期未升级 /
   正式工作流 60 天未触发 → 候选退役，hard fail）。
6. **修宪撞车**：constraints 注入层重新分层——system prompt 注入 =
   宪法 5 条全文 + 31 心法索引（一行一条），INVARIANTS 全文按需读；
   constraints/ 总量约束相应改为「注入层 <200 行」。（决策点 D2）

### 11.3 待用户确认的决策点

- **D1**：CLAUDE.md 形态——会话启动自包含（推荐）vs 一行指针。
- **D2**：constraints 注入拆分——摘要注入 + 全文按需（推荐）vs 全量注入。
- **D3**：WORKBENCH_SPEC 死活——归档注记迁移 vs 仍有活内容。
- **D4**：第 16 工作流 yaml 只补平行多轨规则（推荐，讨论文化已在心法）。

### 11.4 迁移执行的物理方案：newdoc 影子目录（用户提案，采纳）

§六 的「阶段 1-4 新旧并存」具体化为影子目录方案：

1. 仓库根新建 `newdoc/`（git 跟踪），按 §4.2 结构从旧 `docs/` 逐份迁移：
   骨架（workflows/ + INDEX.md + guides/）→ 知识层（constraints/ + domains/）
   → ledger/ → decisions/（已有，直接搬）。
2. **窗口期文档冻结**：迁移期间旧 `docs/` 只读（代码改动照常，文档同步
   攒到切换前一次增量 diff 补迁）；`newdoc/` 不受现有 check 管线约束，
   但切换前必须用改造后的检查手动全量过一遍。
3. 权威源：`docs/` 直到切换提交为止永远是唯一权威——缺陷 3 由口头约定
   变为物理事实。
4. **切换提交**（单独一次，只干两件事）：`git mv` 删除旧 `docs/` +
   `newdoc/` 改名 `docs/`，同提交切换全部 check 路径常量与文档引用；
   `npm run check` 全绿才允许落。
5. 回退路径：切换前任何时刻删除 `newdoc/` 即放弃，旧结构零损伤。

### 11.5 决策点落锤（2026-07-28 用户裁定）

- **D1 → 会话启动自包含**：CLAUDE.md 内联最高频 reads，不再多跳。
- **D2 → 不拆分注入层**。734 行在 1M 上下文时代可接受；且新结构的提示词
  文件届时是新写的一套，旧文档注入形态随迁移自然消解，现在纠结是空转。
  constraints 注入量约束不预设上限，届时按新文档实际体积评估。
- **D3 → WORKBENCH_SPEC 只读归档**，按任务型终态处理（自行查证落锤）。
- **D4 → 第 16 工作流 yaml 只补平行多轨规则**（文件边界 / git log 同步 /
  单轨收尾 / 慎用警告），讨论文化不重复承载（已在 INVARIANTS §七）。
- **§11.4 修正**：大爆炸点与窗口冻结顾虑撤销——迁移期唯一工作流就是
  重构本身，无并发开发内容；管线重写随迁移在 newdoc/ 内渐进完成，
  改名提交只剩 git mv + 开关切换。影子目录与权威源物理化两个核心保留。

---

## 十二、15+1 工作流纸面走查（唤醒条件②③，2026-07-28）

> 方法：逐工作流从入口走到 exit_condition。hop = 一次文件打开；
> CLAUDE.md 是工具自动读取的入口，计 0。
> 结论先行：**16 个工作流全部走通**；走查发现 5 个适配点（F1-F5），反馈进设计。

### 12.1 统一入口与 hop 模型

采纳 D1 后，CLAUDE.md 自包含：内联会话启动 reads + 任务→工作流路由表。
hop 模型：CLAUDE.md(0) → workflow.yaml(1) → 目标文档(2)，全部工作流 ≤2 跳。
（若 INDEX.md 独立存在则全员 3 跳——这是 F1 合并的直接理由。）

### 12.2 逐工作流走查

| # | 工作流 | yaml | reads（hop 2） | writes | 走通 |
|---|--------|------|----------------|--------|------|
| 1 | 会话启动/路由 | （CLAUDE.md 内联） | active/STACK.md + ledger/history.md 尾部 | — | ✅ 1 跳 |
| 2 | 改代码前约束加载 | pre-code-gate | constraints/invariants.md 目标节 + domains/{x}/contract.md | — | ✅ |
| 3 | spec-driven 大改动 | spec-driven | guides/spec-driven.md + active/STACK.md | active/*.md | ✅ |
| 4 | bug 修复+回归钉 | bug-fix | invariants#心法24 + domains/{x}/contract.md#陷阱 + ledger/bugs.md | src/、tests/、bugs.md、contract#陷阱 | ✅ |
| 5 | 纪律机械化 | discipline-mechanize | ledger/bugs.md（重复模式）+ guides/doc-maintenance.md | check-*.mjs + guides | ✅ |
| 6 | 活跃状态同步 | state-sync | — | ledger/history.md + active/STACK.md | ✅ 见 F3 |
| 7 | 设计提案生命周期 | （并入 spec-driven） | active/STACK.md | active/*.md 增删 | ✅ |
| 8 | 版本发布 | release | guides/release.md | package.json + history.md + tag | ✅ 见 F2 |
| 9 | 卡片插件开发 | card-dev | guides/card-dev.md + domains/floating-card/contract.md | cards/ + contract | ✅ |
| 10 | bug 诊断/分诊 | diagnostics | constraints/diagnostics.md（纯排查流程） | — | ✅ |
| 11 | 文档树同步 | doc-tree-sync | — | CLAUDE.md 路由表一行 | ✅ 见 F1 |
| 12 | 参考契约维护 | contract-maintain | domains/{x}/contract.md | 同左 | ✅ |
| 13 | 文档-代码审计 | audit | guides/doc-maintenance.md 审计节 + check 输出 | guides/contract 修正 | ✅ 见 F2 |
| 14 | 设计注释约定 | （并入 pre-code-gate） | constraints/invariants.md §九 | 源文件头注释 | ✅ |
| 15 | 心法回溯 | （并入 spec-driven 步骤 3a/3b） | constraints/invariants.md §六/§七 | — | ✅ |
| 16 | 平行多轨讨论 | parallel-tracks | git log（不看对方聊天记录） | 各自文件边界内 | ✅ 见 F5 |

### 12.3 新旧对比

| 指标 | 旧结构 | 新结构 |
|------|--------|--------|
| 最长引用链 | 5 跳（CLAUDE→SPEC_DRIVEN→AGENTS→HANDBOOK→DIAGNOSTICS→AI_CHAT_RUNTIME） | 2 跳 |
| bug 修复单次阅读量 | 3 文档 / 潜在 1687 行（INVARIANTS 734 + DIAGNOSTICS 787 + REGISTRY 166） | 3 处定点读 / <400 行 |
| 路由入口 | 3 处重叠（CLAUDE.md / HANDBOOK / AGENTS.md） | 1 处（CLAUDE.md 路由表） |
| 活跃文档数 | 17 活跃 + 65 archive | ~16 yaml + 2 constraints + 6 domain + 4 guides + 2 ledger + STACK.md；archive → history.md |
| 工作流定义 | 隐式（靠 git log 考古） | 显式 yaml + 自进化机制 |

### 12.4 走查发现的适配点（反馈进设计）

- **F1（结构修正）**：INDEX.md 并入 CLAUDE.md 路由表——否则全员 3 跳且
  路由仍两处重叠。§4.2 删 INDEX.md；§4.5「INDEX 唯一路由」改为
  「CLAUDE.md 内联路由表」。
- **F2（管线依赖）**：check-versions / check-handbook-sync /
  check-desc-freshness 深度耦合 HANDBOOK（版本表、last_reviewed、§2/§3）。
  新结构里版本表入 ledger/history.md、当前态入 STACK.md——三脚本随 §五
  重写，列入切换提交的验收条件。
- **F3（成本承认）**：state-sync 从写一处（HANDBOOK §2/§3）变写两处
  （history.md + STACK.md）——每次改代码多写一行，换职责单一。接受。
- **F4（遗留确认）**：system prompt 注入（src/server/prompts/base.md 硬编码
  INVARIANTS 路径）必须改指 constraints/——§七未解决问题 1 走查后确认
  仍是迁移必要项；按 D2 不预设行数上限，按新文档实际体积评估。
- **F5（机制限度）**：parallel-tracks 的触发无机械信号（靠人判断），
  自进化机制管不了它——接受；yaml 的 cost_warning 就是设计意图本身。
  唤醒条件③随之完成（第 16 工作流入清单）。

### 12.5 走查结论

16 工作流在新结构的 reads/writes 全部有物理路径，无悬空。现存活跃文档
各有归宿（示例：VISION_AND_ROADMAP → active/vision.md，工作流 3；
TOOL_IO_COMPACTION → domains/ai-chat/ detail，工作流 4/12；V8_ARCHITECTURE
按 §11.1 归宿拆分；完整映射表随迁移阶段 2 产出）。
唤醒条件②③完成。下一步：唤醒条件④用户确认 → newdoc/ 骨架（§11.4）。

---

## 十三、完整映射表：每个现存文档的归宿（2026-07-28）

> 本节是迁移阶段 2 的核对清单：每迁一份打一个勾。
> **切换提交前的机械验收**：旧 `docs/` 全量文件清单 ↔ 本表，无未映射文件才允许改名。

### 13.1 骨架（F1 修正后）

```
newdoc/
├── workflows/            # 16 个 yaml + _template.yaml + _retired/
├── constraints/          # invariants.md（心法，编号不重排）+ diagnostics.md（纯排查流程）
├── domains/              # ai-chat/ canvas-tree/ floating-card/ orb-ui/ server/ infra/
│   └── {domain}/         #   contract.md（<150行）+ detail-*.md
├── active/               # STACK.md + vision.md + 进行中的设计文档
├── ledger/               # bugs.md + history.md
├── guides/               # spec-driven / card-dev / release / doc-maintenance（含测试方法论）
└── decisions/            # adr-*.md（不可变）
```
仓库根：`CLAUDE.md`（自包含路由表，D1）+ `README.md`（门面）保留。

### 13.2 活跃文档逐文件映射（19 份）

| 现存文件 | 归宿 | 备注 |
|---------|------|------|
| `CLAUDE.md` | 仓库根保留，重写 | 内联会话启动 reads + 16 行路由表 |
| `README.md` | 仓库根保留 | 版本/测试计数标记随 check-versions 重写适配 |
| `docs/KFM_V4_INVARIANTS.md` | `constraints/invariants.md` | 基本不动；编号永不重排（隐式 API） |
| `docs/DIAGNOSTICS.md` | **拆分** | §1 隐性契约 → 各 `domains/{x}/contract.md#陷阱`；排查流程 → `constraints/diagnostics.md` |
| `docs/HANDBOOK.md` | **拆分** | §1 模块速查 → 各 contract 文件清单；§2 状态+版本史 → `ledger/history.md` + `active/STACK.md`；§3 待办 → `active/vision.md`/STACK；§五/§七 → `guides/doc-maintenance.md` |
| `docs/BUG_REGRESSION_REGISTRY.md` | `ledger/bugs.md` | 只追加不改写 |
| `docs/AGENTS.md` | **拆分** | 路由功能并入 CLAUDE.md（F1）；维护规则 → `guides/doc-maintenance.md` |
| `docs/AGENT_PROMPT_REFERENCES.md` | `constraints/`（注入层素材） | 迁移时精读，按 D2 新写提示词挂载 |
| `docs/V8_AUDIT_REPORT.md` | `ledger/history.md` 一条 | 未处理项（如 §六 Phase 状态）进 STACK 或随 V8_ARCHITECTURE 归宿处理 |
| `docs/design/VISION_AND_ROADMAP.md` | `active/vision.md` | 远景 + 步骤清单 + 进度 |
| `docs/design/AI_CHAT_RUNTIME.md` | `domains/ai-chat/` contract + detail 素材 | 隐性时序契约是 contract 核心内容 |
| `docs/design/TOOL_IO_COMPACTION.md` | `domains/ai-chat/detail-tool-compaction.md` | 已是 contract 形态，基本直接搬 |
| `docs/design/V8_ARCHITECTURE.md` | **拆分**（§11.1 既定） | 宪法展开 → invariants 附录；§四/§五/§七 → 对应 domain contract；§二/§三/§六/§八 → history 一条 |
| `docs/design/AI_AGENT_DEBUG_TOOLS.md` | `active/`（进行中设计） | 当前焦点，完成后知识进 domains/server |
| `docs/development/CARD_DEV_GUIDE.md` | `guides/card-dev.md` | |
| `docs/development/SPEC_DRIVEN_WORKFLOW.md` | `guides/spec-driven.md` | 含纪律路由表 |
| `docs/decisions/adr-001/002` | `decisions/` | 直接搬 |
| `docs/active/doc-system-redesign.md` | `active/` 暂住，完成后删除 | §八既定：知识已被新结构吸收即删 |

### 13.3 archive 65 文件三分类映射

归宿 ≠ 文件搬家，归宿 = 信息的下一步载体。三类：

**(c) 教训型 → `decisions/` 详注（3 份）**
`design/CASE_STUDY_MODEL_CHOICE.md`、`design/CARD_SYSTEM_UNIFICATION_SPEC.md`
（统一化失败，CLAUDE.md 现引用即此教训指针）、`design/REFACTOR_THESIS_FULL.md`

**(b) domain contract 写作素材 → history 一行 + 素材标记（19 份）**
- canvas-tree：`ENGINE_ARCHITECTURE.md`、`BOX_LOCATION_MAP_SPEC.md`
- floating-card：`CARD_REGISTRY_SPEC.md`、`CARD-STACK-HANDOFF.md`、
  `CARD_SYSTEM_DESIGN.md`、`FULLSCREEN_CARD_SPEC.md`、`STACK_CARDS_DESIGN.md`、
  `TERMINAL_CARD_SPEC.md`、`UI_ELEMENT_REGISTRY_SPEC.md`、`WORKBENCH_SPEC.md`、
  `WORKBENCH_PHASE1/4/7.md`
- ai-chat：`AI_ARCHITECTURE.md`、`CONTEXT_ASSEMBLY_SPEC.md`、`AI_OPERATION_PROTOCOL.md`
- server：`WEBSOCKET_CHANNEL_PROPOSAL.md`
- orb-ui：`GESTURE_ARCHITECTURE_SPEC.md`、`ANIMATION_REFINEMENT_PLAN.md`
- infra：`REGRESSION_TESTING_SYSTEM.md`（兼 guides 测试方法论素材）、
  `TEST_INFRASTRUCTURE_SPEC.md`

**(a) 纯历史 → `ledger/history.md` 一行（43 份）**
audits/ 3、bugs/ 2、handoffs/ 12、legacy/ 4、standards/ 5、
`KFM_V4_INVARIANTS_v6.10.md`、archive 根 `README.md`、
design/ 其余 14（`ARCHITECTURE`、`DOC_CODE_ALIGNMENT_*`、`HANDOFF_*` 4、
`P3_RENDER_CONTEXT_REFACTOR*` 2、`RACE_CONDITION_PLAN`、`REGISTRY_AUDIT_*` 2、
`REGISTRY_NEXT_AGENT_DISCUSSION`、`design/README`）。
其中 legacy 两原则文档与 standards/PRINCIPLES_INDEX 的实质内容已吸收进
INVARIANTS（组2/7/8 标注「新吸收自」），history 行注明吸收关系；
`standards/DEBUG_SOP` → 已被 DIAGNOSTICS 覆盖（§3.5 既定）。

### 13.4 完整性保证

1. 本表即核对清单：阶段 2 每迁一份打勾。
2. 切换提交前机械验收：`find docs/ -name '*.md'` 全量 ↔ 本表比对，
   无未映射、无未打勾，才允许 `git mv newdoc docs`。
3. history.md 一行不是信息删除：文件本体在 git 历史与版本 tag 里永远可
   `git show` 取回（§10.5 缺陷 4 的 grep 可发现性损失，由 (b) 类的
   contract 素材化与 (c) 类的 decisions 详注补偿）。

---

## 十四、逐份过 1/19：HANDBOOK.md 拆分定稿（2026-07-28）

> 逐块盘点 → 归宿 → 决策点。结构：§一 架构速查 / §二 当前会话状态（含已知陷阱）/
> §三 当前待办 / §五 回归测试 / §六 约束指针 / §七 文档-代码审计 / §八 Browser 移植记录
>（无 §四，历史缺号）。frontmatter 与 check-versions/check-doc-coverage 耦合见 F2。

### 14.1 通用映射规则（本次沉淀，后续文档复用）

**批次记录三分法**：版本批次/完成记录类内容一律拆三份——
一句话进 `ledger/history.md`；机制描述（根因/修复原理/回归钉编号）进对应
`domains/{x}/contract.md`；「放弃/推迟」进 `decisions/` 或 contract 有意推迟节。
纯 history 化会丢活知识，纯 contract 化会淹没契约，三分各得其所。

**跨领域架构块的家**：H1 裁定——orb-ui 改名为 **client-shell**（第七个 domain），
承载注册中心/手势优先级/动画状态机/依赖方向/关键调用链等跨领域客户端架构。
orb 专属内容仍在该域内。domains/ 共 7 域：client-shell / canvas-tree /
floating-card / ai-chat / server / infra / decisions 不变。

### 14.2 逐块归宿

| 块 | 归宿 | 备注 |
|----|------|------|
| frontmatter + 头部路由段 | 消亡 | 路由由 CLAUDE.md 接管；文档规范说明 → guides/doc-maintenance.md；frontmatter 新鲜度机制由 check-desc-freshness 重写后管 domain contracts（F2） |
| §一 注册中心/手势优先级/动画状态机/依赖方向/关键调用链 | `domains/client-shell/contract.md` | 跨领域块，H1 |
| §一 模块职能分组（51 模块） | 拆分进各 contract 文件清单 | 去「行数/被导入」易腐列（行数归 check-linecount，导入关系归代码） |
| §一 服务端模块（15 个） | `domains/server/contract.md` | 含 ai/ 子系统树，与 AI_CHAT_RUNTIME 素材合并 |
| §一 关键客户端模块详述 | theme/style-registry → canvas-tree；floating-card → floating-card；sibling-switcher → canvas-tree | 「唯一来源」规则是各 contract 的核心条款 |
| §二 版本批次记录（v6.x~v8.1.1） | **三分法** | 例：v8.1.0 根洽五机制 → client-shell/ai-chat contract；「未做（评估后放弃）」→ decisions；每批一行 → history |
| §二 已知陷阱 1-20 | 各 `contract.md#陷阱`（按域分发） | trap 16（立即提交）与心法 14 重复→删；trap 12（补丁链=模型错）与心法 5 重复→留案例指针 |
| §二 当前焦点（AI 调试能力体系） | `active/vision.md` 或 STACK.md | 与 VISION_AND_ROADMAP 汇合 |
| §三 已完成待办（全划线） | history 一条 | |
| §三 活跃待办（手势系统 P3）+ 持续观察 | `active/STACK.md` | |
| §三 历史版本归档表 | `ledger/history.md` | 版本表本体，check-versions 重写后的验证目标（F2） |
| §五 回归测试 | `guides/testing.md`（第五个 guide，H2） | 与 archive/REGRESSION_TESTING_SYSTEM 素材合并；纪律指针留心法 24 |
| §六 约束与原则 | 消亡 | 纯指针，constraints/ 接管 |
| §七 2026-06-08 审计清单（16 项全完成）+ 死代码检查 | history 一条 | 时点快照 |
| §七 客户端模块完整审计表 | 拆分进各 contract 文件清单 | 同 §一 分组表，去易腐列 |
| §七 引擎层清单（14 文件） | `domains/canvas-tree/detail-engine.md`（H3） | 与 archive/ENGINE_ARCHITECTURE 素材合并 |
| §八 Browser 工具移植记录 | `domains/ai-chat/detail-browser.md`（H4） | 踩坑 5 条进 ai-chat contract#陷阱 |

### 14.3 决策点落锤

- **H1 → orb-ui 改名 client-shell**（第七 domain），跨领域架构块有家。
- **H2 → 测试方法论独立 `guides/testing.md`**。
- **H3 → 引擎层为 canvas-tree 的 detail-engine.md**（保持 6 域 + client-shell）。
- **H4 → §八 → domains/ai-chat/detail-browser.md**。

---

## 十五、git 考古：工作流衔接链验证（2026-07-28）

> 方法：1656 个提交（2026-04-21 → 07-28，98 天，日均 17 提交）按类型
> 做转移矩阵 + 版本区间分类 + check 诞生前溯。类型分布：fix 785（47%）、
> feat 297（18%）、docs 154、refactor 120、chore 77。
> 粒度警告：commit 相邻 ≠ 因果，下列「验证」均指模式重复出现 ≥3 次。

### 15.1 已验证的衔接链（natural_next 的数据基础）

| 衔接 | 证据 | 强度 |
|------|------|------|
| **feat → fix（实施生虫）** | feat 后紧跟 fix 占 47%；refactor→fix 45%；debug→fix 54% | 全库最粗的边 |
| **fix → fix（修复成串）** | 61% 的 fix 后面还是 fix——回归窗口/批次模式真实存在 | 479 次 |
| **docs 成串 → feat（设计→实施）** | docs→docs 36%（讨论/设计成批），docs→feat 19%；实例：TOOL_IO_COMPACTION 定稿→细化五批、V8_ARCHITECTURE→Phase 0-6 | spec-driven 循环真实 |
| **重复错误 → 机械化（check 诞生）** | check-css-wiring 生于「v7 丢失细节」批次；3 个新 check 生于管线审计；check-handbook-sync 生于状态同步 fix | 逐例吻合 |
| **发版窗口 fix 主导** | v7.2.0 窗口 101 fix/32 feat；v7.3.3 窗口 46/16；v8.1.0 窗口 18/4——每个版本的开发期都被 fix 淹没 | 逐版本吻合 |
| **文档漂移 → 审计重构（月度节奏）** | 06-02 文档体系重构 → 07-07 check-handbook-sync → 07-28 管线审计 + 文档系统重构——约两月一次 | 3 次 |

### 15.2 修正与异类

- **fix→docs 仅 6%**：修完立刻写文档比例低——但纪律已被「test+docs 合并提交」
  绑定（登记 SOP），实际靠 commit 规约而非自觉。
- **v8.1.1 窗口 feat:9 fix:0 是异类**：纯设计/压缩工作流窗口，无 fix 尾随——
  设计讨论前置（步骤 3b 压力测试）可能确实压住了返工，单样本，继续观察。
- **release 11 次 / 1656 提交**：约每 150 提交一版，发版是 fix 收集期的中点
  而非终点。

### 15.3 大循环（已验证形态，衔接图的底稿）

```
灵感/需求 → [docs 成串：讨论+设计] → feat 实施
    ↑                                    ↓ (47% 生虫)
    ← 真机使用 ← release ← 攒批 ← 钉子+登记 ← fix 长尾(61% 成串)
                                              ↓ (同模式≥3)
                                        check 机械化 → 管线加固 → 下轮 feat 更稳
月度旁路：文档漂移感 → 审计 → 重构/机械化（本设计即此环产物）
```

### 15.4 对 natural_next 字段的裁定

yaml 增加 `natural_next`（提醒不强制，扳机在人）：
- feat/spec-driven 完成 → 「预期 fix 尾随（47%），预留批次修复窗口」
- release 完成 → 「真机回归窗口开启：fix 高发期，可主动 smoke」
- bug-fix 登记时同模式 ≥3 → discipline-mechanize（已有机械化信号）
- 每月末 → 「文档漂移审计候选」（约两月一次，check-workflow-freshness 管）
衔接图随 CLAUDE.md 路由表落地（guides/ 一张状态机图），不做时间触发。

---

## 十六、度量触发器与 SOP→prompt 集群化（2026-07-28 用户提案，铺路记录）

> 定位：未来大版本方向，本次重构只铺路不实现。

### 16.1 触发器三级分类

| 级 | 判定方式 | 实例 | 现状 |
|----|---------|------|------|
| 机械可判 | check 直接拦截 | 代码 ≥5 提交未同步描述；>3 文件未提交 | 已有（check-desc-freshness / check-uncommitted），即度量触发器雏形 |
| 度量提醒 | 计数+阈值，人判断 | ≥30 fix since release → 发版候选；≥60 天 → 审计候选 | 本次铺路：yaml 预留 metric 字段 |
| 永不机械化 | 人 | 灵感 / 讨论 / parallel-tracks | — |

### 16.2 阈值校准（§十五 历史分布）

版本窗口 fix 13~101、发版约每 150 提交、审计间隔约两月——初始阈值取中位，
按误报率调整。警戒：阈值是代理指标（心法 27），提醒类宁缺勿滥（心法 26，
误报过多的提醒=不存在）。

### 16.3 SOP→prompt→subagent 集群（未来大版本）

workflow yaml 四要素（trigger/reads/steps/writes/exit）天然是结构化 prompt——
骨架质量标准即「每份 yaml 可机械渲染成 subagent 任务书」（上下文指针 +
验证命令 + exit condition 齐备）。

下放边界：机械验证类（审计/计数同步/断链/映射表核对）可下放；
判断类（设计讨论/架构决策）永不下放。
铁律：**subagent 产物不过 check 管线不算数**——管线是集群时代的质量地基。

### 16.4 本次铺路清单（随骨架落地）

1. yaml 模板增加 `natural_next`（§15.4）与 `metric`（度量触发）字段；
2. 已有度量触发器盘点登记进对应 yaml（check-desc-freshness 等）；
3. 本节迁移时进 `active/vision.md` 未来方向区。

---

## 十七、质量工程（2026-07-28 讨论定稿，重构后任务）

> 触发：feat→fix 47%、fix 占全库 47% 的复盘。记录于此，迁移时进 vision.md 未来方向区。

**北极星指标换轨**：不盯 fix 数（AI 时代 fix 尾巴长是速度的正常代价），盯
**缺陷逃逸率**——到达用户/真机的 fix vs 管线自己抓住的 fix。目标：逃逸率→0。
（心法 27：fix 数是代理指标，逃逸率接近目标本身。）

科学基础：Boehm 缺陷成本曲线（发现点越晚越贵，本项目发现点在最右端「用户真机」）；
DORA《Accelerate》（高效能=检测快而便宜，变更失败率 CFR 30-50% 为低效能档）；
poka-yoke 防错（check 脚本已是，需扩到不可静态检查的病）；ODC 缺陷分类
（按病源归类，攻击最大的一类，而非见一个修一个）。

重构后任务清单（按杠杆排序）：
1. **浏览器冒烟扩充**——v8.1 全部真机发现的病翻成行为断言（面板展开响应/
   拖拽/思考框折叠/摸鱼提示位置），挂 release 工作流的真机回归窗口。
2. **发版窗口缺陷分类节奏**——每个 release 后按病源归类本窗口 fix
   （迁移回归/契约丢失/静态可防/交互不可防），最大一类立项预防；
   10 分钟级，可下放 subagent；接 metric 触发器。
3. **feat 出口 verify 关**——完成时拿 domains/{域}/contract.md#陷阱 对照 diff
   过一遍；现在是清单，将来是 subagent 集群的 verify-agent。

## 十八、外部理论审计：世界上有没有更好的结构（2026-07-28，子代理调研）

> 调研五方向 + 专项，来源 URL 在调研记录。结论：**没有可直接搬用的更优结构；
> 本设计方向与最强证据吻合；采纳四个补丁 + 预期校准。**

### 18.1 证据分级

**强证据（受控实验/量化）**：
- Lost in the Middle（Liu et al., TACL）+ Context Rot（Chroma，18 模型 19 万次
  调用）：上下文是稀缺资源，中部信息丢失，「相关但非答案」内容比无关内容更有害
  → 文档必须短、单文件数千 token 内、路由信息置顶部。
- AGENTS.md 专项（ETH/SWE-bench）：**指令类内容被遵守且有用；「仓库概览」类
  写了大概率白写还 +20% 推理成本**；效率收益确定（时间 -28%、token -16%，
  Lulla et al.），**成功率收益不显著**（Gloaguen et al.）。
- Probe-and-Refine（SWE-bench Verified）：迭代调优的 guidance 33.0% vs 静态
  28.3% vs 无文档 25.5%——guidance 文件要用真实任务回归评测、持续调优。
- 清单实证：Haynes 2009 死亡率近腰斩 vs Urbach 2014 强制推行效果消失——
  清单效果取决于执行依从性；**agent 无依从性衰减，工作流卡在 agent 场景比
  人类场景更有理由成立**（推理，非已发表实验）。

**弱/无证据**：Diátaxis（分类学可借用，零效果数据，对象是人类读者）；
PARA/Zettelkasten（纯个人知识管理，零工程数据）；IFT（只余类推效力）。

### 18.2 采纳的四个补丁

- **P1 指令密度优先**：contract 写法约束——条款/陷阱/非常规约定/怎么验证/
  文件指针，不写叙事性概览（「仓库概览无帮助」是本审计最贵的一条证据）。
- **P2 guidance 评测回路**：迁移完成后，用真实 agent 任务抽样测量
  hop 数/token 消耗/查找失败率，迭代调优文档——把文档系统本身纳入
  「可评测可回归」的对象（Probe-and-Refine 方法论）。
- **P3 smell 审计**：contract-maintain 的 exit 增加三条——无 lint 规则照抄
  （62% 仓库的病）、无内容膨胀（42%）、无技能泄漏（35%）。
- **P4 路由头**：每个 contract/detail 开头两行「这是什么/别的去哪找」——
  lost-in-the-middle 位置效应，首尾权重最高。

### 18.3 预期校准（诚实条款）

新结构买到的是**效率和成本**（更少跳数、更少 token、更快定位），
**买不到**「agent 不犯错」（成功率收益不显著是跨模型跨 agent 的一致结论）。
§12.3 新旧对比表的卖点（阅读量 1687→400 行）恰好是效率型收益——方向正确，
但对外表述不得承诺正确性提升。

### 18.4 D2 附注（不推翻，加约束）

Context Rot 证据提示注入体积有真实成本。D2 裁定（不拆 INVARIANTS）维持，
但加写法约束：迁移后 constraints/ 新写时保持精简，注入层只放
「必须逐字遵守的指令」，论述性内容进 detail。
