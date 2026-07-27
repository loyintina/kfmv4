# 文档系统重构设计 — 从文档形态驱动到工作流驱动

> **状态**：设计完成，待执行
> **触发**：2026-07-28 文档系统审计（管线 warning→hard-fail 升级 + 结构性盲区分析）
> **执行前置**：另一个 agent 正在进行的 design 工作流完成后，用 spec-driven 流程执行本设计

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
