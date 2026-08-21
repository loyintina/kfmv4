# 实验流水史 e1~e16（2026-08-07 自 index.md 抽出）

> 本文是 index.md 重组时抽出的历史流水：范式包批次制作记录 + e7/e11/e12/px/
> e14-e16 的逐实验设计与事故记录。**e17 起不再写流水节**，每个实验的设计与结论
> 直读 design/ 与 results/ 对应文档。各实验的正式结论以 results/ 文档为准，
> 顶层综合见 results/results-synthesis.md。
>
> 存档注记：本文提及的 meta-pool/e16-blocks/、meta-pool/density/、
> meta-pool/e16-scores/、meta-pool/episodes/ 四个中间产物目录已于 2026-08-07
> 打包归档至 archive/meta-pool-intermediates-20260807.tar.gz（可再生，见 archive/README.md）。

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
  落盘 meta-pool/density-scores.json；批次文件曾在 meta-pool/density/，已归档）。
  标准沿用批次 3 纯度定义。分布：3 分 19 块 / 2 分 33 块 / 1 分 27 块 / 0 分 8 块。
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

## 实验 7：长度梯度（H5 验证，2026-08-05）——已完成，见 results/results-e7-length.md

- 设计：任务（老项目优化+说出思考过程）× 6 档（无/v1-8k/32k/48k/64k/96k）
  × 2 模型（mm3/flash）× 8 臂 = 96 会话（并发 12，前缀 e7-，96/96 全绿 523s）
- **结论：8k 已饱和**——mm3 有包各档 4.8-6.9 平坦（v1-8k 6.3 达峰值 91%），
  H5「<12k 弱」证伪；曲线 = 阶跃后平坦，非倒 U；flash 零响应（模型差异 >> 长度差异）
- 工程含义：元认知范式包经济最优 8-32k，主战场转向纯度（H6）/结构（H7）

## 实验 11 设计：重复效应矩阵（2026-08-05 完成，见 results/results-e11-repeat.md）

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

## 实验 12 设计：包装结构实验（2026-08-05 完成，见 results/results-e12-wrappers.md）

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

## e11/e12 全矩阵 v2（2026-08-06 完成，见 results/results-e11-e12-matrix-v2.md）

- 14 模型 1778 臂全量 v2 判卷（0-20 主尺），**升级替代 v1 两文档**
- 结论速览：占用率 65% 内效应 +0.4 平台、≥65% 转负（45% 假拐点 = 伪影污染警告）；
  **H8 成立**（重复救稀释 +4.00×2：M2.5/R1）；主战场 = 35B 画像
  （+3.62 且长档不衰减）；opus 饱和别再烧；e12 包装无通用赢家、W3 最频繁登顶
- 伪影纪律：Ling-mini/GLM-Z1 只作存活率（results/results-harness-artifacts.md），
  不进效应分析
- 硅基 D 高档补臂进行中（tools/legacy/run-e11-gapfill.sh 重试到齐循环，
  主线部署杀风暴对策）——齐后刷新 ≥65% 占用桶

## px 三足实验（2026-08-06 完成，见 results/results-px-tripod.md + results/results-px-baseline-halflife.md）

- px-base（永不挂载）/ px-hl（attach@2,detach@5）/ px-ft（attach@2 永不摘除），
  固定时刻表消除教官×挂载耦合，盲判 v3（judge-px1-blind.mjs 轮号对齐终版）
- 结论速览：基线 13.47/15 高而稳（无挂载也有 R1→R3 自然升温——px-1 时代
  「挂载跳变」最大混淆源已钉死）；挂载 +2.62、摘除残留 +1.40 十轮不衰减；
  **持续挂载 13 轮无疲劳**；摘除晃动实锤与摘除事件相关（同模型同轮位对照）；
  产品含义「挂上就别频繁摘」

## 范式包第二家族：行为纪律包（2026-08-06 设计+初稿，见 design/design-behavior-discipline-pack.md）

- `.kfmv4/paradigms/behavior-discipline.md`（7.2k，六节真实切片：
  补丁vs根因/验证诚实/回归钉/可回退铁律/边界控制/复盘沉淀）
- 元认知包管「怎么想」、本包管「怎么做」；e13 陷阱任务实验设计已预留（不烧臂待排期）

## 路线图 e14-e16（2026-08-06 晚，见 design/design-roadmap-e14-e16.md）

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
  登记表），3679 臂回填；旧 occupancy 列废弃；登记纪律入 experiments/paradigm/model-econ.md
- **batch-run 语义查重**：断点续跑改 prefix+内容哈希+rep 三键（臂 id 含批次内
  下标，矩阵形状一变就漏查的事故修复）
- **会话泄漏兜底**：session-runner 失败路径根目录副本搬 script/ 残卷；
  服务端根治（sessionClass 分流）属主线域，见 results/results-session-leak-rootcause.md
- **px 臂入库**：tools/legacy/migrate-px-to-db.mjs，25 臂（px-1/px-base/px-hl/px-ft）
