# 压缩时间线
> 只追加不改写，一行一事。文件本体在 git tag 中永远可取回（`git show vX.Y.Z:路径`）。

## 版本线（自 HANDBOOK 历史版本表迁入，2026-07-28）

- v4.1.0 卡片配色 + 浮卡系统 + BR 守卫（archive/handoffs/v4.1.0.md）
- v5.0.0 CSS 语法安全 + SCSS 迁移（archive/handoffs/v5.0.0.md）
- v5.1.0 root-picker 交互修复（archive/handoffs/v5.1.0.md）
- v5.2.0 RenderContext 上下文隔离（archive/handoffs/v5.2.0.md）
- v6.0.0 UI Element Registry + 代码审计（archive/handoffs/v6.0.0-*）
- v6.1.0 Registry 全面接入 + 三层 MANIFEST 验证（25a295e）
- v6.2.0 文件树 AI 命令 + 对称操作（87a025d）
- v6.3.x 三轮深度审计 + 心法 LEVEL + CI 基线（847e988）
- v6.6.0 交互共享层 + overlay 根解（6006949）；v6.6.1 Box 位置映射 + 死代码 ~300 行（96508b5）
- v6.7.0 浮卡模板化 + ✓/✗ 投放撤销（0b47b2e）
- v6.8.0 模式系统 + 传送门液体粒子 + 方向锁简化 + as any 零逃逸（5585967）；v6.8.1 代码质量审计（0061bb5）
- v6.9.x Phase 7 长按抽屉栏 + 滚动轴锁定重构（0d43f00/5b9d0b8）
- v6.10.x 键盘避让 + card04 tmux + card.meta 类型化（6bc4741/8be2f27）
- v6.11.x 双指处理跳过 + 心法重组 22 条 + 终端 aux bar（53dcf21/fedab31/c386da3）
- v7.0.0 进入 Agent 阶段（9de2a8c）
- v7.1.0 orb/floating-card 拆分 + server 路由拆分 + 214 测试 + 2 ADR（3deb88b）
- v7.2.0 content block 协议修复 + 流式统一 + 等待提示（16b374b）；v7.2.1 工具卡两区滚动 + 渲染三层优化（ff5173b）
- v7.3.0 后台挂机 run-manager + WS 真心跳 + AI_CHAT_RUNTIME（1404b15）
- v7.3.1~v7.3.3 会话保存迁服务端 + 分段传输 + nginx/systemd 修复（0f240ec 等）
- v8.0.0 所有权分离架构：renderChatContent 删除 + chat-dom 增量 DOM + SessionStore 单写者 + kfm-restart 冷恢复（v8.0.0 tag）
- v8.1.0 光球面板性能根洽（持久化/窗口化/content-visibility/minify+gzip）+ v7 丢失细节全量恢复 18 项 + 工具 I/O 上下文压缩（v8.1.0 tag；注：历史唯一双主题混装窗口——性能/细节问题轮与压缩器主题同版，v8.3.1 起按主题分离，见 guides/release.md）
- v8.1.1 逐工具压缩细化五批 + 失败模式标注 + kfm-snapshot/kfm-exec 删除 + INVARIANTS 修宪（v8.1.1 tag，452 测试）
- v8.2.0 文档系统重构：新六层体系（constraints/domains/guides/ledger/workflows/active）+ 19 活跃迁移 + archive 65 份结算 + 压缩轮 + 管线 20 脚本新链 + 切换提交（v8.2.0 tag）
- v8.3.0 文档管线再设计（STACK #2，批 0-5）：27 个 check 脚本（新增 bar-ledger/doc-budget/doc-symbols/doc-schema/commit-docs/hooks/probes）+ sync-counts 计数 SSOT + commit-msg 钩子 + 探针自检 + grammar/检查设计宪法定稿（v8.3.0 tag）
- v8.3.1 审计闭环（问题轮）：漂移测绘 99 条溯源 + ADR-004 三裁决+追加裁决 + bug 堆 9 条结案 + 死代码清理 ~2800 行 + orb.ts 拆分（orb-chat-host 宿主归位）（v8.3.1 tag；同批含语义编译地基——agent-runner + tag-advisor + 部署版本握手，主题未完成不抬级）
- v8.3.2 语义审计体系落地（问题轮）：批 1.5 试点结案（审计 26 报 24 真）→ 语义机械化三件套（doc-linerefs/workflow-integrity 扩展/ledger-commits）→ 腿一探针集群（23 探针并发 10 + 增量哈希版本盐 + 机械复核 + 登记豁免按域过滤）+ 变异基准卷（mutation testing 首卷 10 条，召回 2-4/8）+ 压测定档（conc40 全绿）+ prompt v4 硬化；agent 工具群：tag-advisor 主题分大小判据（影子首记录，minor 只给大主题闭环）+ 回放器全并发化（25min→2min）；耦合门定级 hard fail（口径扩 scripts/ + 独立行 docs:na）；check 链单源化 + 漂移 8 条修复（v8.3.2 tag；语义编译大主题持续推进，v2/腿三在队列）
- v8.3.3 实验与深扫轮：心法 #32/33/34 入典（测量优先/实验优先/庙算优先）→ 冰山工作量验证实验（1787 提交统计：有设计沉淀 feat 平均 fix 链 1.58 vs 无沉淀 2.58，p=0.004，两时代方向一致）→ 深扫实验（10 subagent 盲测：推理级矛盾 4/4 全逮、状态词矛盾 0/4 归机械层，map-reduce 路线裁决不建）→ 语义深扫制度化（deep-scan.yaml 工作流 + release 雷达深扫提醒 + 深扫区登记为第三区）+ probe-diagnosis SOP 固化（修尺→定标噪声→假设因子化→足样本对照→分层处置）（v8.3.3 tag；语义编译大主题剩腿三总 runner 与语义编译器本体）

## 事件线

- 2026-06-08 文档-代码全量审计 16 项全完成（审计表随 HANDBOOK 迁移注销）
- 2026-07-18 Browser 工具自 omp 移植（踩坑记录 → domains/ai-chat/detail-browser.md）
- 2026-07-28 v8.2 文档系统重构启动：骨架立（newdoc/），HANDBOOK 首份迁移完成（本文件即其版本表转世）
- 2026-07-28 VISION_AND_ROADMAP 迁移：Phase 0-II（v4.1-v7.x，基础设施/卡片系统/Agent 基础设施）全完成，原文 693 行进度表注销；远景核心进 active/vision.md
- 2026-07-27 v8 全量审计（QoderCN，213 行时点快照随迁移注销）：主要发现已全部解决——chat.ts/orb-chat.ts 死代码 ~160 行已删、auto-resume restartCount 防护已实现（orb.ts:665）；文档同步性问题由 v8.2 迁移逐份结算；LOW 遗留 3 项进 active/STACK.md
- 2026-07-26/27 v8 所有权分离架构：v7 六病灶（全量 innerHTML 重建/八个状态补丁/三份消息镜像/双写竞争/重启即死亡/两段加载竞态）→ Phase 0-4+6 ✅、Phase 5 服务端语义渲染推迟（客户端增量渲染已够用）；效果 O(n)→O(1) patch、补丁 8→0、写者 2→1、重启自动恢复。V8_ARCHITECTURE 原文 187 行按 §11.1 四分注销（视觉契约+不变清单 → ai-chat contract；t0-t10 时序 → detail-runtime §10.5）
- 2026-07-29 archive (c) 教训型 3 份结算：CASE_STUDY_MODEL_CHOICE 整份进 decisions/（15 提交补丁链 vs 1 提交重写）；UNIFICATION_SPEC 蒸馏详注（adr-002 第二次尝试的计划文档，元教训：流程正确≠方向正确）；REFACTOR_THESIS_FULL 蓝图对照详注（LeaferJS/Yoga/DOM Island 证伪，标记系统设计留考古钩）——原文均可 git show v8.1.1:docs/archive/design/ 挖
- 2026-07-29 archive (b) 素材型 21 份结算：素材考古行散进 5 域 contract（canvas-tree 5 / floating-card 9 / ai-chat 3 / server 1 / client-shell 1）+ guides/testing 2；发现两个活缺口进 STACK（CARD_REGISTRY §6 三命令未实施、CONTEXT_ASSEMBLY §7 开放问题未关闭）；§13.3 计数勘误 19→21（WB_PHASE1/7 归 canvas-tree、ANIMATION_REFINEMENT 归 canvas-tree）；原文均可 git show v8.1.1:docs/archive/design/ 挖
- 2026-07-29 archive (a) 纯历史 41 份结算：38 份确认 pure-history、3 份翻出真遗留进 STACK 第 5 项（v6.8 审计 #10 服务端 console.log / AUDIT_FIX_DEEP 三项体系化建议 / file-tree 命令缺口）；版本线各行（v4.1.0-v6.8.1 handoff、三轮审计、v8 审计）此前已就位，本批确认有效；原文均可 git show v8.1.1:docs/archive/ 挖
  - (a) 组-legacy 4 份：AI_COLLABORATION_PRINCIPLES + BUG_FIXING_PHILOSOPHY（通用方法论雏形，已被 INVARIANTS 31 条心法全面超越吸收）+ CLAUDE_v2（v2 引擎时代总览，实质内容逐条已进各域 contract）+ 目录 README
  - (a) 组-standards 5 份：BUG_AUDIT_REGISTRY（11 隐性契约→域 contract、7 案例→constraints/detail-cases、根因索引→diagnostics、B.A.R. 命名→ledger/bugs）+ DEBUG_SOP（→diagnostics）+ PRINCIPLES_INDEX（纯指针表）+ TESTING（17 项手动清单→guides/testing 扩 18 项）+ 目录 README
  - (a) 组-bugs 2 份 + 根 2 份：HANDOFF_BRORB_FIX（v4 时代死代码替换指令，对象函数已消亡）+ bugs/README + KFM_V4_INVARIANTS_v6.10（19 条心法快照，已被 31 条宪法版取代）+ archive/README
  - (a) 组-handoffs 杂项 4 份：appendix-b-c（2026-05 审计评审-回应表，processClickQueue 栈风险已闭环）+ SESSION_MEMORY + PROJECT_ASSESSMENT_2026-06-02（P0 WS 通道已建成）+ AUDIT_2026-07-12（/tmp 补丁遗留审计 10 项全闭环）
  - (a) 组-design 其余 12 份：ARCHITECTURE / DOC_CODE_ALIGNMENT（snapshot ordering 无契约，P3 观察未关闭）/ HANDOFF_2026-06-03×3 / HANDOFF_P3_REMAINING / P3_RENDER_CONTEXT_REFACTOR×2 / RACE_CONDITION_PLAN（Phase 2/3/5 未采纳，现行代码明确否决）/ REGISTRY_AUDIT_2026-06-03 / REGISTRY_NEXT_AGENT_DISCUSSION / design/README——教训均已吸收或为一次性过程记录
- 2026-07-29 v8.2 文档系统重构完成：切换提交（newdoc→docs，旧体系注销）；19 活跃迁移 + archive 65 份 (a)41/(b)21/(c)3 全结算 + 压缩轮四步 + 管线 20 脚本新链；doc-system-redesign.md 原理层进 guides/doc-architecture.md，44 节过程记录 git 考古（`git show v8.1.1:docs/active/doc-system-redesign.md` 及 master 历史）；根 CLAUDE.md 为 agent 唯一入口（AGENTS.md stub 重定向），下一议题：管线文档检查自动化体系再设计（STACK #2）
- 2026-07-29 管线再设计批 0-1 完成（STACK #2）：check 脚本归拢 scripts/check/（20→23 个）；各层 grammar 定稿（机器消费区严格/散文区自由/格式为消费者）；新增 check-bar-ledger（首轮抓 16 项真漂移：12 钉补登记 + 4 行假已钉修正）/ check-doc-budget（CLAUDE 60/contract 150）/ check-doc-symbols（124 符号存在性，修 3 处漂移）/ sync-counts（计数派生回写，消灭四处手同步）
- 2026-07-29 管线再设计批 2-3 完成（STACK #2 主干收官，25 个 check 脚本）：check-doc-schema（契约必备章节 + workflows 9 字段）/ check-commit-docs（耦合门 warning 观察期，豁免语法 docs:na）/ sync-counts 升级（infra 链枚举 <!-- chain:auto --> 生成区，顺手修「20 脚本」漂移）/ docs-status 仪表盘（npm run docs:status，非阻断观测）/ 生命周期分层（frozen/active-tracked/generated/working）/ 管线两原则定稿（失效探测器 + 格式为消费者）；遗留：耦合门观察期后定级、批 1.5 语义审计试点（semantic-compiler-seed.md）
- 2026-07-29 管线批 4（快照病四洞，26 个 check 脚本）：域映射双向健康（上岗即抓 waiting-hints.ts 盲区）/ 豁免防腐（css-wiring + console 白名单自证）/ commit-msg 钩子（耦合门 --staged 犯罪现场拦截，薄壳原则）/ check-hooks（hooksPath+可执行位+薄壳引用）/ 检查设计宪法进 doc-maintenance；批 5 探针自检登记 STACK
- 2026-07-29 管线批 5（探针自检，27 个 check 脚本）：check-probes 运行器（双断言：报红 + 含 expect.txt 病因字串）+ 8 检查 KFM_PROBE_ROOT 注入 + 8 棵负例假树；突变自测闭环（治愈夹具 → 运行器报「检查已失效」）；git 历史型检查豁免；探针条款进宪法——「绿色可信」从此可验证
- 2026-07-30 耦合门定级（STACK #2 批 5 遗留收官）：观察期数据（src/ 口径 13/13 全合规；scripts/ 口径 34 提交 3 例漏同步——真实腐化在 src/ 之外）→ hard fail + 口径扩 src/+scripts/ + 豁免收紧独立行 `docs:na`（防 prose 字面串误认）；git 历史型检查免探针条款维持
- 2026-07-30 exit 0 吞码事故修复 + 制度化防线：commit-msg 壳写死 exit 0 吞掉耦合门 hard fail 退出码（升 hard fail 时改脚本忘改壳，拦截虚掩一天多，触发讲解管线触发机制时现场发现）→ 壳修复透传 + check-hooks 第 4 条模式对账（被接线脚本头部机器可读声明 MODE: hard-fail/warning，壳注释模式词必须一致）+ 宪法模式对账条款——「壳语义 vs 脚本模式」从此机械对账
- 2026-07-30 变异基准扩卷 10→19 条：L2 SEM×元素矩阵系统填充（M11-M15，基线可逮层）+ MID 中间难度档（MID-1..4，四条稳定盲区各拆单一难点降级可逮）。首测召回 9/16、NC 误报 1/3、额外发现 0：L2 填充 3/4 逮到；MID-3/4 漏报揭示 SEM005 家族盲区根因——vision-vs-maps/stack-vs-ledger 探针 prompt 不扫描组内自相矛盾（硬化方向）；M02/M05 翻转逮到 + M03/M04 反漏 → 单轮方差 ±2，盲区结论须多轮趋势
- 2026-07-30 prompt v5 硬化 + v5.1 评分器修正 + SEM005 机械化移民：共享 prompt 补组内自矛盾扫描 + 措辞变体精确率条款（AUDIT_VERSION 5）；评分器 hitMutation 双锚点（矛盾型发现可锚任一侧）；M15 迁址 release.md 消除双中假警。三轮趋势（9/6/7 ×16）定案：稳定盲区 M06/MID-3/MID-4（stack-vs-ledger/vision-vs-maps 四次连续零响应）→ 按结晶回路移民机械层：check-stack-status.mjs 上岗（31 个 check，R1 头行矛盾/R2 头活跃+详情完成，缺失型仍归语义层）。活树 v5 审计 10 条保留发现进裁决队列（canvas-tree 契约 6 连中为最大真漂移集群）
- 2026-07-30 v5.2 轮 + 裁决轮收官：vision 探针重组（窄基线 + vision-internal）验证失败——vision-internal 首秀报 0，MID-4 四连败，LLM 路线收益耗尽（多次采样投票 vs 强模型专项 vs 归人工层待裁决）；活树 10+1 条发现裁决：真漂移 5 条修复（canvas-tree 契约集群，漂移 3/4/5/6/10 结案）、假阳性 3 条登记豁免 #32-34、代码违例 1 条早已登记；机制缺口：复核只查行号越界不查内容支撑（M14 编行号半逮）；bench 加复核掉落日志（区分幻觉拦截 vs 误杀真发现）
- 2026-07-30 语义审计 v6 + 大样本实验轮（用户拍板）：quote 引文契约 + recheckQuote（复核升内容级，AUDIT_VERSION 6）；bench --samples=N 并集聚合机制化（首秀 11/16 历史最高，单样本 7/9/6 方差可视化）；四臂根因实验 ×5 样本定案——MID-4 全臂 0/20，系统性保守被否决、任务形式错配坐实（开放矛盾判断超出模型链，出路 = map-reduce 断言提取对账）；MID-4 实为低概率事件（~15%/轮），6 样本并集首逮；极限压测 conc=60/80 全绿（108 调用 419s，provider 天花板未触）；复现型发现小裁决 5 条（计数快照/sass 目录级/三件→四件/v8.1 混装注记/vision 文件树卡片隐喻澄清）
- 2026-07-30 三条心法入典 + 冰山实验 + 深扫实验（STACK #3）：invariants 心法 #32 测量优先/#33 实验优先/#34 庙算优先（冰山工作量讨论：质量工作量守恒，前移有界可自动化 vs 后移无界厚尾）→ 冰山工作量验证实验（exp-iceberg.mjs，339 feat 统计：有设计沉淀 avg fix 链 1.58 vs 无沉淀 2.58，置换检验 p=0.004，pre/post-v7 两时代方向一致，报告 decisions/case-study-iceberg-experiment.md）→ 深扫实验（用户动议「只找可能矛盾不断言」：10 explore subagent 单突变盲测，推理级矛盾 MID-4 4/4 全高置信逮到——便宜链四臂 0/20 的钉子；状态词矛盾 MID-3 0/4 全漏，恰被 check-stack-status 覆盖，三区盲区互补；map-reduce 断言提取路线按赛前约定裁决不建）
- 2026-07-30 v8.3.3 发版：语义深扫制度化（workflows/deep-scan.yaml + CLAUDE.md 路由 + release 雷达 WARN 附深扫提醒带 docs 变更计数 + semantic-compiler-seed 登记深扫区为第三区；触发定稿仅发版周期同步，形态定稿会话内 subagent 禁便宜链）+ probe-diagnosis.yaml SOP 固化（修尺→定标噪声→假设因子化→足样本对照→分层处置）
