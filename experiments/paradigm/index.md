# paradigm · 研究线登记（范式包）

> 2026-08-03 立（原 behavior-injection 改名，用户定名 paradigm——希腊语
> 「旁边展示的范例」；谐音 Paladin 圣骑士——范式传承意象）。
> 构想：**把经过验证的高质量思维/行为范式（洛主思维模式/证据纪律/讨论启发式）
> 提炼成模块化「范式包」（示范性对话上下文），问题提出时拼进上下文——弱/中
> 模型通过范例同化涌现出接近强模型的行为**。范式包 = 示范性上下文（AI 被同化
> 到范式），非规定性指令注入（与 prompt 词源不同：paradigm 展示范例 vs prompt
> 预先拿出）。定位：研究设计（.kfmv4 面孵化），成熟后结晶进 kfmv4 正式机制
> （config 卡 paradigmFile 字段 + .kfmv4/paradigms/ 已落地 UI）。

## 范式定义与判定标准（2026-08-03 概念澄清）

**约束 vs 示范**——evidence-discipline 不算范式包（它是规则包）：

| | 约束（规则） | 范式（示范） |
|---|---|---|
| 内容 | 「禁止编造、断言要有依据」 | 一段完整的高质量思维过程（对话节选） |
| 机制 | AI 服从规则（改行为遵守度） | AI 模仿示范（改能力结构） |
| 效果 | 该做的不做（纪律） | 学会怎么做（能力迁移） |
| 长度 | 几百字就够 | 需足够思维过程才可模仿 |
| 例子 | evidence-discipline | 洛主的决策对话节选 |

**判定标准**：范式包 = 内容构成「可模仿的示范」（思维过程/行为模式节选），
AI 从示范中**抽象出模式并泛化**（改变能力），而非逐条遵守规则（约束）。
evidence-discipline 重新定位为「规则包」（约束层）——可作为范式包的约束层
（范式包 = 示范 + 约束），但不是范式本身。
「太小不算范式包」：示范需要完整的思维过程才有可模仿性——长度是
「示范可模仿性」的前提，不是装饰。

## 范式包类型清单（2026-08-03 讨论，按使用场景）

| 范式包 | 让 AI 学会什么 | 示范素材来源 | 优先级 |
|--------|---------------|-------------|--------|
| 决策范式（洛主式） | 类比驱动/找反例/拆轴/数据先行/推演≠结论 | 范式级讨论（意图解释器/范式包本身）+ discussion-log | ① 最优先 |
| 讨论范式 | 范式级讨论怎么参与（追问本质/反驳修正/概念统一） | 设计讨论的来回 | ② |
| 实验方法论范式 | 数据先行/对照/测量/分阶段 | 实验方法论讨论（控制变量/析因/消融） | ③ |
| 文档体系范式 | 活文档维护（读/存分区/生成器思维/引用纪律） | kfmv4 文档维护讨论 | ④ |
| 工程决策范式 | 正确性优先/最小改动/回归 | bug-fix/审查类讨论 | ⑤ |

**制作方式**：同一素材可切成多个范式包（按思维模式类型切片，非按对话切）。
先做①②③（数据源最富 + 效果最可测）。

## 研究假设（待实验验证）

H1 **补强假设**：同模型下，「有范式包」的讨论/任务质量显著高于「无范式包」。
H2 **差距弥合假设**：弱模型 + 好范式包 ≈ 强模型 + 空上下文（行为质量 = 模型 × 上下文）。
   **→ 分层成立（2026-08-06 纯分析，results-h2-h4-analysis.md）**：35B+8.1k 包摸平
   opus 空基线（16.50 vs 16.25）；27B/M2.5 超过 luna/g3p/g2.5p 空基线；V3/R1 未弥合。
   弥合不对称——强模型自挂包后差距重开；范式包是中模型性价比武器，非拉平顶配工具。
H3 **模块化假设**：范式包可组合（证据纪律 + 讨论模式 + 领域规则 叠加），组合
   效果可测量、可优化。
H4 **退化边界**：范式包对强模型收益递减甚至负收益（Anthropic「减法」信号——
   强模型被硬规则过度约束）。
   **→ 修订（2026-08-06 纯分析，results-h2-h4-analysis.md）**：强模型无负收益
   （opus 全格 +0.4~+3.5），收益递减亦未观察到（仅相对增幅随基线自然收窄）；
   真负收益全在中弱模型 × 高占用稀释与特定体质（Step 小包毒性）——
   该方向被 H8 + 体质谜题吸收，不再是独立方向。
H5 **长度假设**（2026-08-03 用户提出）：范式包效果与长度呈**倒 U 形**——
   <12k 弱（话题对齐，同化不足）、32k-128k 甜蜜区（完整思维轨迹，同化最彻底）、
   256k-512k 回落（context rot 注意力稀释，范式退化为「档案」——从同化退化为
   RAG 式检索，且成本高）。
H6 **纯度假设**：同等长度下，高思维密度对话节选 > 完整对话（含噪音稀释范式信号）。
H7 **结构假设**（2026-08-03 用户提出）：同素材不同结构包装，同化效果不同——
   见「结构类型学」。
H8 **占用率假设**（2026-08-05 用户提出）：范式包效果随「包长 / 模型上下文窗口」
   的占用率变化——同一绝对长度的包，在不同窗口模型上占用率不同（如 89.8k 包 =
   131K 窗口的 69% vs 262K 窗口的 34%），接近占满时曲线形状可能变质（注意力
   稀释加速 / context rot 提前 / 重复效应放大）。推论：**分析时必须按占用率
   分桶，不能只按绝对长度分桶**；实验设计应记录每个模型×每档的占用率。
   标准模型池 v3 已普查全池窗口（见 model-pool.md）。

## 结构类型学（S1-S8，2026-08-03 设计）

两个维度：**显式程度**（AI 是否感知范式包存在）+ **组织形态**（范式怎么组织）。

| 结构 | 形态 | 机制 | 预期 |
|------|------|------|------|
| S1 显式宣言 | 宣言+示范+规则 | AI 显式知道按此范式 | 稳定，可能「出戏」 |
| S2 无缝拼接 | 高纯度自然对话 | AI 隐式模仿「对话历史」 | 同化最自然，可能被当历史 |
| S3 问答对集 | 多场景 Q&A 点 | 每 Q&A 一个思维示范 | 多场景范式 |
| S4 单链思考 | 单人完整思维过程 | 展示推理路径 | 推理范式 |
| S5 对比对 | 错误 vs 正确示范 | 反例强化边界 | 行为范式最强 |
| S6 复盘叙事 | 走错→修正→复盘 | 从错误中学习 | 血泪案例（BAR 教训） |
| S7 身份锚定 | 「你是 X 范式者」+ 示范 | 身份一致性 | 长任务稳定 |
| S8 渐进序列 | 难度递增示范 | 模仿逐步加深 | 学习型范式 |

**实验设计**：同素材（同一批高思维对话）× 结构（S1-S8）× 任务 → 行为质量。
内容与结构解耦：同一对话素材可做成 8 种包装——结构是独立变量。

## 数据源（范式提取的矿）

- **kimicode 长会话**：范式级讨论（意图解释器/涌现式结构/范式包本身）——高级
  元思考富矿（本会话即样本）
- **qoderclicn / omp / opencode 长会话**：不同 harness 长对话，各有思维风格
- **discussion-log.jsonl**：思维模式标签（10 类）可直接映射范式骨架
- 提取路径：长会话 → 抽高思维密度节选 → 标范式类型 → 提炼「原则+示范+反例」
  → 入 .kfmv4/paradigms/

## 范式包分类（三维）

```
思维范式（怎么想）：决策/推理/元认知
行为范式（怎么做）：证据纪律/工程纪律/沟通
领域范式（在哪想）：文档体系/实验方法论/架构思维
```

与现有机制边界：不是角色卡（不是你是谁）、不是工作流（不是做什么）、不是
全局预设（不是默认都有）——是可选挂载的「思维方式」（首条 user 消息示范）。

## 复用基础设施（已实战验证，2026-08-03 161 臂判卷）

| 能力 | 现成组件 | 本研究的用法 |
|------|---------|-------------|
| 自动化 agent 批跑 | `agent-runner.mjs`（provider 兜底链）+ subagent 集群（AgentSwarm） | 同模型 × 有/无范式包 × N 任务 批量跑 |
| 脚本化管线 | `experiments/coldstart/tools/*.mjs`（batch 模式/并发/断点续跑） | 范式包变体生成 → 批跑 → 判卷 |
| 判卷尺 | coldstart 判卷体系 | 需新「行为质量判卷尺」（范式同化维度） |
| 数据分层 | `.kfmv4/experiments/<线>/` | 同构 |
| 观测 | `obs-aggregate.mjs` | 可扩展范式包效果周报 |
| 会话驱动内核 | design-session-runner.md（runSession 待实现） | configId 解析 + paradigm 拼接 |

## 实验方法论（总实验指导，2026-08-03 定稿）

### 研究方法工具箱

| 方法 | 干什么 | 范式包研究用法 |
|------|--------|---------------|
| 控制变量法 | 固定其他、变一个 | 单因素筛选（只变长度/结构/纯度…） |
| 析因设计 | 多变量同时变，测主效应+交互 | 结构 × 长度 2×2——测交互效应 |
| 消融实验 | 去掉组件看效果 | 去宣言/去示范/去规则——组件作用 |
| 配对/A-B | 同输入两条件对比 | 有/无范式包（H1） |
| 重复测量 | 同条件多次取统计 | **必须**——模型随机性，N 次取均值/方差 |
| 敏感性分析 | 参数微调看变化 | 长度梯度曲线（验证 H5 倒 U 形） |
| 正交实验 | 多因素少组合 | L9 正交表——变量多时降组合 |
| 盲判 | 判卷者不知条件 | 判卷尺不知道臂的条件——防判卷偏见 |

AI 场景核心三件：**A/B、消融、重复测量**（单次跑可能是噪音）。

### 变量清单（10 因素）

```
1. 范式内容（决策/讨论/文档体系…）   6. 任务类型（探索/讨论/编码）
2. 结构（S1-S8）                    7. 注入位置（首条 user/中间/system）
3. 长度（12k/128k/512k）            8. 范式包数量（单/组合）
4. 纯度（高密度节选 vs 完整）        9. 采样参数（温度等）
5. 模型（强/弱）                   10. 语言（中/英）
```

全析因组合爆炸 → 分阶段。

### 分阶段策略（总实验指导）

```
阶段 1 筛选（控制变量法）：单因素逐个找最佳点
  长度梯度（H5 倒 U 形）→ 结构对比（S1-S8 top3）→ 纯度对比
阶段 2 析因（交互）：最佳点附近 2×2
  结构(top2) × 长度(best±) → 结构 × 模型
阶段 3 消融（组件验证）：最佳组合去组件
  去宣言/去示范/去规则 → 每组件作用
阶段 4 稳定（重复测量）：最终组合多模型多任务 N 次
  效应量 + 置信区间 → 结论
```

**第一阶段首选：长度梯度（H5 倒 U 形验证）**——最干净的单一变量实验，
直接回答「范式包该多长」。

### 研究路线决策（2026-08-05 用户拍板）

**先通用特性，后模型专项**。当前阶段只做与具体模型无关的通用特性研究：
边界地图（基线分布/残留半衰期）、疲劳区、行为纪律包、包结构变量、
机制黑箱分析（推理通道×范式、harness 伪影）。
**deepseek-v4-flash 专项（用户主力模型入池+定向实验）押后**，
待通用特性研究完结再开——避免在通用规律未明时把结论锚死在单一模型上。

### 判卷纪律（2026-08-05 用户拍板）

0. **判卷通道**：默认 judge-llm.mjs API 直调。判卷员可选 deepseek-v4-flash
   （provider `deepseek`，默认）或 k3-256k（provider `Kimi`，key 源自 Kimi Code
   计划，2026-08-05 探针实测通）——与 AgentSwarm 集群同宗，集群麻烦时直接 API，
   二者视为同一判卷员，量尺可比。

1. **判卷模型统一：deepseek-v4-flash（官方 provider `deepseek`）**——与实验模型池
   同源同系，跨实验判卷尺一致（e11/e12 起执行；此前 e7 为 AgentSwarm 集群判）。
2. **自我判卷回避（2026-08-05 实测修订）**：flash 是被测对象时允许自判，
   但结果文档须标注实测 Δ（量表场景实测 Δ=+0.19/12 ≈ 1.6%，可忽略，
   见 results-judge-bias.md）。**真风险是判官×风格交互（±1 分）**：
   跨模型比绝对分须谨慎，主分析一律做模型内部比。
3. 判卷尺：metaRe 词频尺（meta-density.py，e7 标定）只作粗筛；
   **主尺 = judge-llm.mjs `--rubric v2` 锚定四维盲判（0-5×4=0-20，2026-08-05 起）**——
   v1 尺（0-3×4）满分率 51% 封顶严重，v2 降至 10.3%，且证明「强模型满分饱和」
   部分是 v1 尺子伪影（opus 在 v2 下增益明确可见，见 results-rubric-v2.md）。
   v1 尺仅用于对照历史数据。已知盲区：think 块不落盘，思考型模型的内部推理不可测。
4. **推理模型通道适配（2026-08-05 GLM-Z1-9B 探针实测）**：推理模型正文可能全空、
   元认知全在 reasoning 通道——只读正文会判出全场 0 分假数据。judge-llm /
   audit-arms / recompute-cells 三脚本均已做回落：正文空时读 reasoning 块，
   判卷归档记 `chan` 字段（text/reasoning/empty）。分析时按通道分桶，
   reasoning 通道样本与正文样本的可比性未标定，跨通道比绝对分须注明。

### 工具权限纪律（2026-08-05 用户拍板，红线）

实验臂的工具流跑在**服务端**，权限与运维者本人等同——实证事故：
e7c 臂 write 四份文件进 repo 根、pl 臂 `sed -i` 直改 src/server、pl 臂 `rm -f` 删会话文件、
e4 臂改 tree-model/tree-perf 源码（后被 qoder agent 当自己的工作提交）。

1. **判行为质量的跑批：一律只读白名单** `--tools read,grep,glob`（e11 起强制执行）
2. **工具行为本身是测量对象时：在 lab 副本跑**（kfmv4-lab 或临时 scratch 仓），
   永不指向真仓库——臂写坏 lab 可以重建，写真仓库是污染，杀服务器是断链
3. **bash 权限 = 红线**：实验臂可 `kill` 面板服务器（整批断链）/`rm` 素材库/改 git 历史。
   除非实验主题就是 bash 行为，任何跑批不得放行 bash
4. ~~长期方向（待设计）：服务端会话权限档案~~ **已实装（2026-08-05，BAR-SESSION-PROFILE-01）**：
   /ai/chat/start 按 `sessionClass` 分档——`script` 未显式传 tools 时服务端默认只读白名单
   read/grep/glob，panel 全量不变；session-runner 固定带 `sessionClass:'script'`，
   batch-run 缺省 tools 同白名单。工具级审计由 8.5.0 权限引擎（BAR-PERM-01..03）覆盖

### 脚本基建角色

batch-run（计划中）：批量跑所有组合臂（并发+断点续跑）+ 判卷后自动统计
（均值/方差/置信区间）——「数据说话」的机械执行，不是「看着像有效」。

## 数据区臂清单

| 臂 | 文件 | 状态 |
|----|------|------|
| bi-verify-001（2026-08-03 23:42，deepseek-v4-flash，kfmv4-lab 接手会话） | sessions/bi-verify-001.json | ⏳ 未策展——产出方会话待补臂语义；QoderCN 08-04 仅代入库防孤儿，勿当结论数据用 |

## 边界（已知）

- 模仿 ≠ 内化：范式包是「行为租借」，每次问题提出时拼入，不改变模型权重
- 负迁移风险：弱模型忠实模仿范式包错误 → 范式包质量须经 check 级检验
- 上下文成本：范式包必须精选（必读清单越长越被跳读）；长度倒 U 形（H5）
- 价值递减：模型代际变强后范式包收益下降（定位：经济模型 × 中低能力区间）

## 素材库状态（2026-08-04 第一性原理落地）

- **全量数据**：5 源 351 会话 / 27,930 消息（含 AI 侧）/ 32,175 reasoning / 32,215 tool_calls
  —— operit（kfm 早期 02-25 起）/ omp（05-27）/ opencode（06-11）/ kimi（07-27，当前）/ qoder
- **切片**：560 段 episodes（operit 90 / omp 203 / opencode 155 / kimi 65 / qoder 47），pattern 94%
- **存储**：~/.kfmv4/materials/materials.db（全量 + 段索引 + FTS trigram；切片=引用不复制）
- **导航**：slices-summary.md（560 段按源分类摘要）+ patterns.md（模式库）+ pack-list.md（审核清单）
- **工具链**：extract-{operit,omp,omp-jsonl,omp-db,kimi-full,convo}.py/mjs（5 源提取）
  + annotate-pattern.py（模式标注）+ annotate-operit.py（范式候选筛选）+ gen-slices-summary.py（摘要生成）
- **研究可用**：跨 harness 对比 / 决策路径分析 / AI 思考链研究 / FTS 模式检索——历史消息研究的现成基础设施

## 范式包批次 2（2026-08-04 数据库级素材）

- **root-cause-first.md**（8.7k token，S2 无缝，5 段）——「补丁 vs 根因」范式：
  边框救场（alpha 混合数学证据）/文字渐变（别硬编码）/幽灵卡现场（git 还原逐行加回）/
  终端缩放（纯 CSS 布局根因）/手势注册表（最笨但最有效）。
  素材来自素材库 560 段（omp/opencode 真实会话），第一批 H1 复验实验用包。

## 范式包批次 3：元认知长度梯度（2026-08-05，e7 实验用）

- **metacognition.md**（v1，8.1k token，S2 无缝，5 段）——实验 5 验证有效（mm3 2.6 倍）
- **metacognition-32k/48k/64k/96k.md**（实际 30.1/47.4/64.5/89.8k token）——
  严格嵌套（32⊂48⊂64⊂96=v1+87 元块），唯一变量是长度
- **素材管线**：63 段（pattern 含元认知/复盘/反思/方法论）→ 446 块（按用户消息切）
  → AgentSwarm 14 批逐块判断「是否元认知」（每块给理由，落盘 meta-pool/judgments.json）
  → 87 元块 → 清洗（剔 think/tool 标签防判卷污染）→ 敏感扫描（无 key 泄露）
- **纯度标准**：元认知 = 反思思考过程本身（思维模式复盘/概念再审视/流程失效反思/
  能力边界意识/方法抽象）；不含一般技术复盘、UI 修改、开发流水
- **128k 档缺口**：全部元素材仅 89.8k token（87 块）——FTS 宽面检索未筛 321 会话
  仅 2 条命中，chat-backups 27 会话已全部入库——纯度优先，128k 档待素材库扩充

## 范式包批次 4：浓缩与重复包（2026-08-05，e11 重复效应实验用）

- **密度打分**：87 元块按「元认知密度」0-3 打分（AgentSwarm 8 批逐块评，每块一句话理由，
  落盘 meta-pool/density-scores.json；批次文件在 meta-pool/density/）。标准沿用批次 3
  纯度定义。分布：3 分 19 块 / 2 分 33 块 / 1 分 27 块 / 0 分 8 块。
- **块重建**：从 96k 原档反解块边界并字节级验证（清洗规则复现：剔 think/tool/tool_result
  标签 + 3+ 连续换行归并为 2）——86/87 块与原档逐字节一致；**偏差**：909:11（25 字符，
  单行提问）在 judgments.json 里但从未进入原五档包，浓缩包构建将其排除（密度分补打 1 分）。
- **浓缩包（C 组素材，5 档嵌套）**：86 块按分数降序排（同分按原档块序；「优先原 8.1k 档块」
  的平局规则落空——87 块无一出现在 v1 8.1k 里），按目标 token 取前缀：
  metacognition-h4k.md（4.00k tok，4 块，全 3 分）⊂ h15k（15.51k，17 块，全 3 分）⊂
  h24k（24.33k，27 块 = 19×3分+8×2分）⊂ h32k（32.54k，33 块 = 19+14）⊂
  h45k（45.77k，40 块 = 19+21）。h4k 因块粒度（第 8 块 3.2k 字符）无法按纯前缀贴近 4k，
  改从 h15k 的 17 块内做子集选优（2^17 穷举），命中目标 100.0%，集合嵌套仍严格成立。
  拼接格式与原档完全一致（`\n\n---\n\n`，无宣言/标题/尾换行）。
- **重复包**：C 组 = 浓缩包×2（metacognition-h4k-x2.md 8.00k / h15k-x2 31.03k /
  h24k-x2 48.66k / h32k-x2 65.09k / h45k-x2 91.55k，对齐原五档 8.1/30.1/47.4/64.5/89.8k）；
  D 组 = 原档×2（metacognition-8k-dup.md 16.28k / 32k-dup 60.21k / 48k-dup 94.89k /
  64k-dup 128.96k / 96k-dup 179.54k）。两遍之间用原档块间分隔符连接，无任何重复标记。
- **token 计数**：与原梯度同法——字符数 × 0.75（见 tools/build-length-paradigms.py）。
- **重合度**：h4k 与原 8.1k 档共享 0 块（87 块全系 v1 之外素材；最长公共片段仅 60 字符）。
- **敏感扫描**：15 个新包正则扫描（sk-/api_key/password/私钥/AWS/GitHub token 等模式）
  零命中，无剔除块。

## 实验 7：长度梯度（H5 验证，2026-08-05）——已完成，见 results-e7-length.md

- 设计：任务（老项目优化+说出思考过程）× 6 档（无/v1-8k/32k/48k/64k/96k）
  × 2 模型（mm3/flash）× 8 臂 = 96 会话（并发 12，前缀 e7-，96/96 全绿 523s）
- **结论：8k 已饱和**——mm3 有包各档 4.8-6.9 平坦（v1-8k 6.3 达峰值 91%），
  H5「<12k 弱」证伪；曲线 = 阶跃后平坦，非倒 U；flash 零响应（模型差异 >> 长度差异）
- 工程含义：元认知范式包经济最优 8-32k，主战场转向纯度（H6）/结构（H7）

## 实验 11 设计：重复效应矩阵（2026-08-05 完成，见 results-e11-repeat.md）

- **结论速览**：opus/luna 满分饱和无信息（强模型别再烧臂）；Q1 重复效应弱阳性
  （D≥B 占 8/10 可比槽，D-16.3k 全场最强）；Q2 浓缩×2 不能稳定补偿纯度（模型依赖）；
  最强信号 = g2.5-pro 长单遍包稀释惩罚（B-89.8k 6.50 < 基线 8.62），而 D-179.5k
  重复版 9.12 反超——重复部分抵消长上下文稀释（H8 候选）
- **进度**：504/504 全绿（批1 192 + 批2 160 + 批3 152）；flash 四维盲判 632 臂归档
  meta-pool/judge-e11-e12-flash.json；metaRe 词频尺全条件贴零仅存档
- **基建事故与修复（2026-08-05，批2 首发）**：batch-run 臂 id 纯下标编码
  （`前缀+t任务+p范式+m模型+r重复`），同前缀不同批次下标对齐即撞名——批2 全部
  160 臂被断点续跑误判「已归档」跳过（0 臂实跑），若强行重跑还会覆盖批1 归档。
  修复：臂 id 加 `md5(task|paradigm|model)` 6 位哈希后缀，跨批次天然唯一；
  批1 归档为旧无哈希命名，分析解析需兼容两种命名（哈希段可选）。

- **问题**：① 复制追加（同内容×2）是否提升表现？② 同长度下「浓缩×2」vs「原档×1」，
  重复效应能否补偿纯度差异？
- **任务**：无提示任务 `/tmp/exp8-task.txt`（老项目优化，**无**「说出思考过程」——测纯自发显式化，
  回应 e7 局限第一条）
- **矩阵**：5 档 × 4 条件 × 4 模型 × 8 臂（D 组 opus 跳过 180k 档，上下文化）：
  - A 无包（对照）；B 原档（8.1/30.1/47.4/64.5/89.8k）
  - C 浓缩×2（h4k-x2 8.0k / h15k-x2 31.0k / h24k-x2 48.7k / h32k-x2 65.1k / h45k-x2 91.5k——同长度槽位对 B）
  - D 原档×2（16.3/60.2/94.9/129.0/179.5k——同素材双倍对 B）
- **模型**（聚光）：[codex]gpt-5.6-luna、[酒馆专用0.9刀/次]gemini-2.5-pro、
  [kiro]claude-opus-4-8、[1刀/次]gemini-3-pro-preview-think
- **判卷尺**：① 元认知密度（metaRe 同 e7，无提示任务下才是真自发值）；
  ② 结构评分（自我拆解完整度 / 边界标注准确度，盲判补 e7 局限第二条）；
  ③ 按上下文占用率分层分析（96k-dup 对 200k 窗口模型占用率 ~90%，稀释效应单列）
- **批次命令**（只读白名单，前缀 e11-，断点续跑可串联）：
  ```
  # A+B 组（192 臂）
  node experiments/paradigm/tools/batch-run.mjs --task-file /tmp/exp8-task.txt \
    --paradigms "无,metacognition,metacognition-32k,metacognition-48k,metacognition-64k,metacognition-96k" \
    --models "<4 模型>" --provider "聚光" --arms 8 --concurrency 6 --prefix "e11-"
  # C 组（160 臂）：paradigms 换 metacognition-h4k-x2,...,h45k-x2
  # D 组（152 臂）：paradigms 换 metacognition-8k-dup,...,96k-dup；opus 单列跳 96k-dup
  ```

## 实验 12 设计：包装结构实验（2026-08-05 完成，见 results-e12-wrappers.md）

- **结论速览**：出戏率全零（四模型全程入戏）；最大发现 = g2.5-pro 复述癖
  （W1 无缝下 60 个 8-gram 照抄，W2 轻标记压到 10.4）——**范式包默认 W2 轻标记包装**；
  显式宣言止不住复述，结构标记比指令约束有效

- **问题**：同素材不同包装，哪种让范式「被模仿」而非「被引用/出戏」？
- **矩阵**：4 包装 × 同素材 32k（h32k 浓缩包为底）× 4 模型（同 e11）× 8 臂 = 128 臂
  - W1 纯无缝（e12-w1-seamless.md）：直接 `**用户：**` 块开场，无任何标记
  - W2 现轻标记（e12-w2-lightmark.md）：v1 同款标题+定位引语，无指令
  - W3 显式宣言（e12-w3-declaration.md）：明指令「请学习并模仿这种思维方式」
  - W4 边界声明（e12-w4-boundary.md）：声明无关 + 要求提取模式不引用内容
- **判卷尺**（在 e11 双尺基础上加）：③ **出戏率**——回复提及「上述对话/示范/材料」
  等把范式当外部对象的表述（正则+盲判双通道）；④ **内容污染率**——回复逐字复述
  范式包原句（n-gram 重合检测）
- **批次命令**：paradigms "e12-w1-seamless,e12-w2-lightmark,e12-w3-declaration,e12-w4-boundary"
  × 同 4 模型 × 8 臂，前缀 e12-，余同 e11

## e11/e12 全矩阵 v2（2026-08-06 完成，见 results-e11-e12-matrix-v2.md）

- 14 模型 1778 臂全量 v2 判卷（0-20 主尺），**升级替代 v1 两文档**
- 结论速览：占用率 65% 内效应 +0.4 平台、≥65% 转负（45% 假拐点 = 伪影污染警告）；
  **H8 成立**（重复救稀释 +4.00×2：M2.5/R1）；主战场 = 35B 画像
  （+3.62 且长档不衰减）；opus 饱和别再烧；e12 包装无通用赢家、W3 最频繁登顶
- 伪影纪律：Ling-mini/GLM-Z1 只作存活率（results-harness-artifacts.md），
  不进效应分析
- 硅基 D 高档补臂进行中（tools/run-e11-gapfill.sh 重试到齐循环，
  主线部署杀风暴对策）——齐后刷新 ≥65% 占用桶

## px 三足实验（2026-08-06 完成，见 results-px-tripod.md + results-px-baseline-halflife.md）

- px-base（永不挂载）/ px-hl（attach@2,detach@5）/ px-ft（attach@2 永不摘除），
  固定时刻表消除教官×挂载耦合，盲判 v3（judge-px1-blind.mjs 轮号对齐终版）
- 结论速览：基线 13.47/15 高而稳（无挂载也有 R1→R3 自然升温——px-1 时代
  「挂载跳变」最大混淆源已钉死）；挂载 +2.62、摘除残留 +1.40 十轮不衰减；
  **持续挂载 13 轮无疲劳**；摘除晃动实锤与摘除事件相关（同模型同轮位对照）；
  产品含义「挂上就别频繁摘」

## 范式包第二家族：行为纪律包（2026-08-06 设计+初稿，见 design-behavior-discipline-pack.md）

- `.kfmv4/paradigms/behavior-discipline.md`（7.2k，六节真实切片：
  补丁vs根因/验证诚实/回归钉/可回退铁律/边界控制/复盘沉淀）
- 元认知包管「怎么想」、本包管「怎么做」；e13 陷阱任务实验设计已预留（不烧臂待排期）

## 路线图 e14-e16（2026-08-06 晚，见 design-roadmap-e14-e16.md）

- **A1/A2 纯分析**（零 token）：H2 差距弥合（35B+B-8.1k 16.50 ≥ opus 基线 16.25，
  现有数据已可答）+ H4 退化边界修订（强模型是饱和非负收益，真负收益 = Step 体质）
- **e14 组合挂载**（H3）：{无/bd/meta/bd+meta} × 2 任务 × 4 硅基中模型 × 8 = 256 臂，
  顺带触「包 × 任务类型」匹配效应；零基建依赖，e13 收工后点火
  （spec 已备：specs/e14a.json 陷阱任务 + specs/e14b.json 讨论任务，exp-driver 驱动）
- **e15 注入位置**（变量 7）：system / 首条 user / 任务前 user 三位置 × 96 臂；
  前置 = session-runner `--position` 参数（e13 跑数期间禁改，收工后动）
- **e16 结构 S5/S6**：对比对 + 复盘叙事；长杆是制包（materials.db 筛成对片段），
  排在 e14/e15 后
- 纪律：烧 token 实验同时只跑一个；点火前逐次报预算

## 基建与事故修复（2026-08-06）

- **arms.occ_ratio**：真实占用率列（包标称尺寸÷模型窗口，tools/occupancy.mjs
  登记表），3679 臂回填；旧 occupancy 列废弃；登记纪律入 experiments/model-econ.md
- **batch-run 语义查重**：断点续跑改 prefix+内容哈希+rep 三键（臂 id 含批次内
  下标，矩阵形状一变就漏查的事故修复）
- **会话泄漏兜底**：session-runner 失败路径根目录副本搬 script/ 残卷；
  服务端根治（sessionClass 分流）属主线域，见 results-session-leak-rootcause.md
- **px 臂入库**：migrate-px-to-db.mjs，25 臂（px-1/px-base/px-hl/px-ft）

## 产物登记面（DOC-FLOW-11 机械门，check-experiment-registry）

> 本目录新产物（tools/*.{mjs,py,sh}、specs/*.json、results-*/design-*/proposal-*/pack-*/spec-*.md）
> 必须在本节留纯文件名——发现路径的机械主人。数据区（meta-pool/、arm-artifacts/、
> fixtures/、scenarios/、instructors/）豁免。质量归人，存在归机械。

### 跑批与判卷（常驻内核）

- 跑批内核：batch-run.mjs（矩阵×重复×并发，语义三键幂等续跑）/ session-runner.mjs
  （会话驱动内核：configId 解析+包拼接+直写归档）/ arm-store.mjs（arms.db 存储层）
  / occupancy.mjs（占用率登记表，arms.occ_ratio 写入+回填）
- 编排：exp-driver.mjs（spec JSON 驱动跑数重试循环+自动判卷，--check 干跑校验；
  2026-08-06 起新实验不再手写 run-*.sh）/ specs/e14a.json / specs/e14b.json（e14 双前缀 spec）
  / specs/e15.json（注入位置：system+pre-task-user 双 run，first-user 档复用 e14b）
  / specs/e16.json（S5/S6 结构矩阵，同 e13-t2 尺）
  / specs/e17.json（复盘质量线专项：纯 S6 × e8，预注册主终点 self_dissection）
  / specs/e18a.json / specs/e18b.json / specs/e18c.json（e18 v4-flash 专项：
  e8 四类包 32 臂 / T2 陷阱 16 臂 / 长度梯度 24 臂，DS 官方并发 16）
  / specs/e19.json（e19 拥挤区占用率：同源嵌套 32/128/256/512k + 512k-dup，
  40 臂，pre-task-user 位）
  / specs/e20.json（e20 版本半衰期锚点：e18a 四格 + e19 峰值格，40 臂冻结矩阵；
  每 wave 复制为 e20w{N}.json 仅改波号，见 design-e20-half-life.md）
- 判卷：judge-llm.mjs（LLM 盲判主通道，rubric v1/v2）/ judge-e13-script.mjs
  （e13 零成本脚本判卷：沙箱 diff+工具痕迹）/ judge-px1-blind.mjs（px 轮号对齐盲判）
  / bench-score.mjs / blind-anonymize.py（盲判匿名化）
- 制包：build-e14-combo.mjs（e14 组合包构建器，幂等）/ build-length-paradigms.py（长度梯度档）
  / build-e16-packs.mjs（e16 S5/S6 精选制包：e16-scores 纯度过滤+预算贪心，幂等，
  产出 paradigms/e16-s5-contrast.md / e16-s6-retro.md + meta-pool/e16-packs-manifest.json）
  / build-e19-packs.mjs（e19 语料组装+同源嵌套切包：5 线 cleanHistory →
  32k⊂128k⊂256k⊂512k + 512k-dup 平铺对照，轮边界切档，尺寸回填 occupancy）
- 部署守卫：check-active-runs.sh（kfm-restart 前拦在跑实验）
- 历史手写循环（exp-driver 时代不再新增，留存考古）：run-e13.sh / run-e11-gapfill.sh /
  run-judge-v2.sh / run-px-baseline.sh / run-px-fatigue.sh / run-px-halflife.sh /
  run-px-matrix.sh / run-silicon-backfill.sh / run-silicon-backfill.round1.sh
- 考官-考生：plugin-exam.mjs（px 三足实验驱动，instructors/ 提示词配套；
  e19 复用为语料生成管线：instructors/e19-corpus-gen-line{1..5}.md 大纲驱动教官
  + instructors/e19-corpus-gen-cyc{2,3}.md（实战演示/反例边界通用教官）
  + instructors/e19-corpus-gen-cyc4.md（真实工作流应用篇，512k 档补产）
  + fixtures/e19-corpus-outline.md 40 节大纲 + scenarios/e19-line{1..5}-open.txt
  与 scenarios/e19-cyc{2,3}-line{1..5}-open.txt 开场，
  考生挂 metacognition 种子包 schedule attach@1，角色卡 ~/.kfmv4/roles/e19-corpus.json）

### 素材库管线（提取/标注/摘要，多为一次性，留存考古）

- 提取：extract-all.py / extract-operit.py / extract-omp.py / extract-omp-jsonl.py /
  extract-omp-db.py / extract-kimi-full.py / extract-convo.mjs / extract-session.py
- 标注与切片：annotate-pattern.py / annotate-pattern.mjs / annotate-operit.py /
  build-episodes.py / review-episodes.py / restore-annotations.py / restore-from-history.py
- 索引与摘要：gen-slices-summary.py / material-index.py

### 分析与迁移

- recompute-cells.py（判卷归档→格均值，DB 版）/ meta-density.py（metaRe 词频粗筛尺）
  / aggregate-e13.mjs（e13 汇总：脚本判卷+LLM 盲判按键名归一化合并出格均值，
  产出 meta-pool/aggregate-e13.json）/ aggregate-e14.mjs（e14 H3 汇总：组合对照
  Fisher/MWU 直接可引，幂等随跑数重跑，产出 meta-pool/aggregate-e14.json）
  / aggregate-e15-e16.mjs（e15 位置哈希分辨 + e16 结构对照，一器双析，
  产出 meta-pool/aggregate-e15-e16.json）
  / aggregate-e17.mjs（e17 复盘质量线：预注册主终点 S6 vs 无包 dissect MWU，
  产出 meta-pool/aggregate-e17.json）
  / aggregate-e18.mjs（e18 v4-flash 专项：e18a 四类包对照 + e18b T2-d +
  e18c 长度梯度趋势一器三析，产出 meta-pool/aggregate-e18.json）
  / aggregate-e19.mjs（e19 占用率曲线：断崖检验（相邻档降幅 >2× 且 p<0.05）
  + 512k vs dup 占位对照，产出 meta-pool/aggregate-e19.json）
  / cost-stats.py / audit-arms.py（臂审计+通道分桶）/ bug-scan.py
  / migrate-arms-to-db.mjs / migrate-px-to-db.mjs（px 臂入库）
  / e16-mine.mjs（e16 S5/S6 素材开矿：错误信号+复盘标签粗筛，产出 meta-pool/e16-candidates.json）
  / e16-cut.mjs（e16 候选切块：按用户消息切，产出 meta-pool/e16-blocks/ + 索引）

### 设计与结果文档

- 设计：design-arm-store.md / design-behavior-discipline-pack.md / design-e13-trap-tasks.md /
  design-roadmap-e14-e16.md / design-session-runner.md / proposal-sentinel-layer.md /
  pack-behavior-discipline-notes.md / spec-v1.md / design-e20-half-life.md
- 结果（各实验节有正文，此处纯登记）：results-e1.md / results-e4-matrix.md / results-e5.md /
  results-e7-length.md / results-e11-repeat.md / results-e12-wrappers.md /
  results-e11-e12-matrix-v2.md / results-flash-calibration-01.md / results-h1-paradigm.md /
  results-h2-h4-analysis.md / results-h5-length.md / results-harness-artifacts.md /
  results-judge-bias.md / results-px1-plugin.md / results-px-baseline-halflife.md /
  results-px-tripod.md / results-rubric-v2.md / results-session-leak-rootcause.md /
  results-e13-trap.md / results-e14-combination.md / results-e15-position.md /
  results-e16-structure.md / results-e17-retro-quality.md / results-e18-v4flash.md /
  results-e19-occupancy.md / results-e20-w1.md
