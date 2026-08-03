# 工作栈

> **条目格式规范**（2026-08-01 立；冷启动实验教训：腿三「远期」标题+延续行才标 ✅ 落地，
> 快读误读率 4/6=67%）：
> **状态 = 条目标题行内的第一个标记，永不放在延续行**——`✅`（已落地，同行带日期）/
> `⏳`（远期/待建，同括号带说明）/ `⚠️`（有保留）。描述延续行只承载内容，不再以
> `——✅` 引导新状态；快读只需标题行即可确定条目状态。写新条目先定状态，再写内容。
1. [vision.md] v8.2 文档系统重构 — ✅ 完成（2026-07-29 切换提交）
   — 19 活跃迁移 + archive 65 份结算 + 压缩轮 + 管线 20 脚本新链；设计文档已自我分散
   （原理 → guides/doc-architecture.md，过程 → git show v8.1.1 考古）
2. 管线文档检查自动化体系再设计（2026-07-29 立项，主干 ✅ 完成）
   — 批 0 归拢 ✅ → 批 0.5 grammar ✅ → 批 1 机械四件套 ✅ → 批 2 schema+耦合门 ✅ → 批 3 仪表盘+分层 ✅
   — 原则：失效探测器 / 格式为消费者 / 精确率≈1（已进 doc-maintenance）
   — 批 5 ✅：check-probes 探针自检（8 检查注入 + 8 假树 + 突变自测闭环）
   — 耦合门定级 ✅（2026-07-30）：观察期数据（src/ 13/13 合规、scripts/ 34 提 3 漏）→
     hard fail + 口径扩 src/+scripts/ + 豁免收紧独立行 docs:na（防 prose 字面串误认）
   — 批 1.5 语义审计试点 ✅ 结案（2026-07-30：审计 26 报 24 真（精确率 92%）→ 溯源 G1-G6 分类学
     → 24 条修复 → 结晶三件套进确定区 → semantic-audit.yaml 制度化；账本 ledger/semantic-provenance.md，
     复盘与「编译≠检查」三档阶梯见 semantic-compiler-seed.md 末节）
   — 语义编译器体系（双区管线/SEM 错误码/冷启动 e2e/集群统计）→ [semantic-compiler-seed.md]，批 1.5 试点
3. agent 任务执行器（agent-runner）设计（2026-07-29 立项，用户动议）
   — 通用运行模式：固定提示词 + 输出可控 + 独立任务——发版（版本判定/账本回写/tag）、
     语义审计（批 1.5）、集群冷启动 e2e 都是其实例，与 semantic-compiler-seed.md 双区管线一脉
   — 形态收敛：A=独立 agent 脚本（洁净室/可进 cron/exit code 语义，新建）；
     B=提示词文件由 agent 执行（存量：workflows 卡 + subagent）
   — 输出消费闭环 = 新 agent 会话（用户指正：不存在「人工」兜底，兜底是会话间接力的
     agent）——失败/审查产物必须格式化为 agent 可拾取（STACK/ledger 邮箱位）
   — 配套：provider 选择配置（providers.json 多 key 有过期/余额不足，agent 脚本用哪个
     必须显式可配；该设置未来进前端设置卡）
   — 试点负载：tag 升版检测器 ✅ 落地进入影子模式（2026-07-29，回放三轮 47→57→61%，
     调整后 83%；影子日志 ledger/tag-advisor-shadow.md）
   — 触发：check-release-radar 常驻雷达（commits≥30 或 feat≥10 提醒，阈值经 14 历史版本对论证）→
     agent 判定 → 人拍板
   — 测试协议：回放测试（14 历史版本对=黄金集，测一致率）→ 否定测试（周期中段切片须忍住）→
     影子模式（分歧记日志调 prompt）→ 投产仍只产建议（git mutation 人拍板）
   — 模型链：Opencode Go Google/deepseek_v4_flash → GitHub（429 兜底位）→ deepseek 官方
     → step-3.7-flash（2026-07-30 撤下 kimi 链首：端点过严；同日重排 opencode 优先）
   — 远期：agent 工具 prompt 管理卡（实体化管理 + 逐脚本微调，很久后）
   — 方向（2026-07-30 用户动议）：语义管线内置工具化——审计探针/变异基准/发版雷达
     做成 kfmv4 内置工具（前端可触发 + 触发表现与运行过程可视化，用户对触发层感兴趣），
     与 prompt 管理卡同族，落地时一并裁决形态
   — 待设计：触发方式（cron/事件/手动）、产出验证（LLM proposes, mechanics disposes）、
     成本预算、结果回写（tag/STACK/ledger）、失败兜底
   — 腿一：semantic-audit.mjs 探针集群 ✅ 落地（2026-07-30）——23 探针四轮实跑收敛
     （真发现归零=文档趋稳）+ 并发 10 定档（压测 conc40 全绿，成绩噪声带内不动）+
     增量哈希含 AUDIT_VERSION 版本盐 + 机械复核 + 登记豁免按域过滤；
     prompt v4 硬化（「check 不存在」类假发现一律不报，家族 6→2 残余）；
     v2 留 map-reduce 声明提取对账（任务清单先手写，对错从数据长出再谈编译）
     ——❌ 已枪毙（2026-07-30 深扫实验裁决）：强模型软标记直读 4/4 逮 MID-4，
     任务无需为弱模型改造，断言清单+保鲜机制整个不建
   — 深扫实验 ✅（2026-07-30，用户动议「只找可能矛盾不断言」）：10 subagent 盲测
     （4×MID-3 + 4×MID-4 + 2 干净对照，单突变夹具 tmp/exp-deepscan）——
     MID-4（推理级矛盾，便宜链四臂 0/20）强模型 4/4 全逮且全高置信；
     MID-3（状态词矛盾）强模型 0/4 全漏，恰被 check-stack-status.mjs 覆盖——
     两路盲区互补，双层架构获数据证明；对照组「疑似有意」自我过滤可靠，
     每文档 6-12 条软标记裁决量可承受。触发设想：release 雷达/大改后，非 per-commit
   — 深扫制度化 ✅（2026-07-30 用户拍板）：workflows/deep-scan.yaml 上岗 +
     CLAUDE.md 路由表登记 + release 雷达 WARN 附深扫提醒（带本周期 docs 变更计数）+
     semantic-compiler-seed.md 增记第三区——触发定稿为仅发版周期同步（用户砍掉大改触发），
     形态定稿为会话内 subagent（禁便宜链）
   — 变异基准 ✅（semantic-mutate/bench，2026-07-30 用户拍板）：首卷 10 条
     （L1 git 矿 5 + L2 矩阵 3 + L3 负例 2）；分数纪律：单轮 ±1 是采样噪声看趋势；
     副产物逮 5 条真漂移
   — 扩卷 ✅（2026-07-30）：19 条（+L2 矩阵填充 M11-M15 基线可逮层 + MID 中间难度档
     MID-1..4——四条稳定盲区各拆单一难点降级）。首测召回 9/16、NC 误报 1/3：
     ① L2 填充 3/4 逮到（基本功尺校准）② MID-1/2 逮到、MID-3/4 漏报——SEM005
     家族盲区不在假设因子（跨账本/代码知识），vision-vs-maps 与 stack-vs-ledger
     双探针报 0：组内自相矛盾不在 prompt 扫描语义内（硬化方向）③ 旧盲区 M02/M05
     本轮翻转为逮到、M03/M04 反漏——单轮方差 ±2，「稳定盲区」结论须多轮趋势
   — prompt v5 硬化 + v5.1 评分器修正（2026-07-30）：组内自矛盾扫描 + 措辞变体
     精确率条款进共享 prompt，三探针 question 扩写，AUDIT_VERSION 5；评分器
     hitMutation 双锚点（矛盾型发现可锚任一侧，MID-2 冤案平反）+ M15 迁址
     release.md（原锚距 M12 仅 3 行 ±5 容差必双中，出题事故）
   — 三轮趋势定案（v4/v5/v5.1 = 9/6/7 ×16）：稳定逮到 M01/M08/M11/M12；稳定盲区
     3/3 = M06/MID-3/MID-4；其余全在噪声带翻转——单轮成绩不作数，趋势才算
   — SEM005 机械化移民 ✅（2026-07-30 用户拍板）：stack-vs-ledger 四次连续零响应
     → check-stack-status.mjs 上岗（31 个 check）——R1 头行状态词矛盾 / R2 头活跃+
     详情完成，枚举型 + 探针夹具；诚实边界：M06 缺失型（已闭环忘标注）机械判不了，
     仍归语义层/人工。vision 探针重组 ✅（窄基线 4 份 + vision-internal 独立探针）
     ——v5.2 验证：vision-internal 首秀报 0，MID-4 四连败，LLM 路线此格子收益耗尽
   — 四臂根因实验 + 多采样 + quote 契约（2026-07-30 用户拍板，AUDIT_VERSION 6）✅：
     ① 四臂 ×5 样本（A 基线/C 去保守/E 脚手架/F 叠加）：MID-4 全臂 0/20、臂间无差异
     ——系统性保守根因被数据否决，任务形式错配坐实（开放矛盾判断超出模型链能力，
     map-reduce 断言提取对账是唯一出路）；② quote 引文契约 + recheckQuote 上岗
     （复核升内容级：编 quote=编行号同罪），掉落日志区分幻觉拦截 vs 误杀半逮；
     ③ bench --samples=N 并集聚合首秀：召回 11/16 历史最高（单样本 7/9/6，方差
     机制化）；④ 极限压测 conc=60/80 全绿零失败（108 调用 419s），provider 天花板
     未触；⑤ MID-4 在 6 样本并集下被 vision-internal 逮到 1 次——非不可能，
     是低概率事件（~15%），多采样并集是其唯一捕获路径
   — 复现型发现小裁决（2026-07-30）：真漂移 4 条修（infra code-map 计数快照改
     引用式 / contract sass 目录级 / STACK 三件→四件 / release 判例 v8.1 混装注记）
     + vision 文件树卡片隐喻澄清（§1.5 交互隐喻 vs §2.2 渲染例外，跨 4 臂复现）
   — 活树 v5 审计 10+1 条发现裁决 ✅（2026-07-30 subagent 轮）：真漂移 5 条全修
     （canvas-tree 契约集群：出口名/方向锁/3s 等锁语义/死符号 pushContext/只读
     tree-model，code-map 漂移 3/4/5/6/10 结案）+ 假阳性 3 条登记豁免 #32/33/34
     （README detail 计数/31 脚本 vs 35 步口径/v8.1.0 混装定级）+ 代码违例 1 条
     （theme.ts 颜色，漂移 2 早已登记另案）+ 陈旧快照措辞修正（provider 链漂移 12）；
     机制缺口发现：复核只查行号越界不查内容支撑（M14 被编行号半逮——语义对锚点假）
   — ✅ 腿三：semantic-chain.mjs 总 runner（落地 2026-07-30）——探针 verdict 聚合成单结论
     （过/N 条新发现），cron 化巡逻；verdict 门控注意力不门控合并（概率区纪律）；裁决与修复
     留会话内 agent，自动化边界 = 检测，结晶回路负责把反复发现移民确定区；落地内容：
     三态 verdict（✅/⚠️ N 条/💀 退化）+ 信箱 ledger/semantic-chain-inbox.md（append-only，
     CLAUDE.md 启动步 3 消费）+ --with-bench 周校准 + cron 装机（每日 4:17 巡逻 / 每周一 4:23 带基准）
   — 冰山工作量验证实验 ✅（2026-07-30）：scripts/agent/exp-iceberg.mjs，339 feat 全量
     统计——有设计沉淀 avg fix 链 1.58 vs 无沉淀 2.58（-39%，置换检验 p=0.004，pre/post-v7
     两时代方向一致，厚尾率 12.7% vs 21.0%）——心法 34 获数据支持，报告
     decisions/case-study-iceberg-experiment.md（三条新心法首次联合实战）
8. 卡片类需求四件（2026-07-29 记，优先级后排）
   — 工作流实体卡片插件：workflows/ 的实体卡进卡片堆（形态参照现有 tool 卡）
   — 中央面板网格线升级 + 实时统计信息
   — 会话卡逻辑修复（具体病灶待补充）
   — 审查文件卡代码高亮问题修正（具体病灶待补充）
9. server 会话/prompts 域 bug 池（2026-07-29 记；初始主题=提示词注入约束修复，病灶待补充；后收编 bug 见子项）
   — 另：面板发送消息无响应（2026-07-29 记，用户反馈的活 bug，具体病灶待补充——复现后进 bug-fix 流程）
   — 另：会话删除后服务端串档（2026-07-30 记，冷启动实验 terra 臂尸检发现）：删除会话卡只删
     磁盘文件，`server/ai/session-store.ts` 的 `_sessions` 缓存（`_get` 缓存优先）不失效 →
     同名新会话 `appendUserMessage` 接续旧 ctx，flush 以旧 meta 落盘 → 会话文件合并两个独立
     会话的历史（createdAt 是旧会话的），「会话文件=全量真相源」契约被污染——文件 ≠ 模型所见。
     用户可见症状：刷新面板后被删会话的消息在新会话上方「复活」、会话卡统计错。
     **✅ 已修复（2026-08-01，BAR-SESSION-01）**：flash-10 臂实测实锤（turn1 载荷 5.7× 膨胀），
     invalidateSession + delete/rename/move 三路由接线，4 钉（tests/session-invalidate.test.ts）
   — 另：sessionId 路径穿越 P0（2026-07-31 记，冷启动实验 gpt-5.6-sol 臂发现，已登记
     BAR-SEC-14）：routes 只查 truthy + session-store join 无格式校验 → `../` 逃逸。
     修复方向：格式白名单全入口统一校验 + containment 复查 + 恶意 id 否定钉
   — 另：tag-advisor shell 注入 P0（2026-07-31 记，同臂发现，已登记 BAR-SEC-15）：
     argv ref 直插 execSync 模板串。修复方向：execFileSync 参数数组化 + ref 格式校验
     + 恶意 ref 否定测试
10. 全量代码分析 → domains 填充（2026-07-29 提前完成，用户动议）
   — ✅ 六域 code-map + cross-domain.md（2026-07-29，99 条漂移带 file:line，0cecc62/3906707）
   — ✅ 机械层：gen-code-inventory.mjs（2026-07-29，已移 scripts/check/ 并 --check-only 挂链，鲜度不再靠人）
   — ✅ 溯源审计（2026-07-29）：22 subagent 考古 → ledger/drift-provenance.md（105 行普查 + 8 案深潜）
     分布：E 机制没人走 21.9% · A 过时 20% · C 权宜 17.1% · F 文档 16.2% · B 接力 14.3% · D 复制 9.5%
   — 后续队列（按堆）：① 真 bug 10 条（ai-chat#2 冷恢复载荷优先）② 安全面 3 条核实
     ③ 死代码 ~30 处（text-layout 2292 行整目录居首）④ 契约失真 ~35 条（→批 1.5）
     ⑤ 协议制度缺口（localStorage 登记/多写者锁/scope 裁决）⑥ 架构议题（orb 归属/
     重复实现群/check 链单源化）
   — 队列结算注（2026-07-29 语义审计 E1）：①②③⑥-orb 归属已闭环（bug 堆 9 条已钉见
     bugs.md；安全面 3 条 server 漂移 7/8/9 结案；text-layout 整目录已删；orb 宿主
     已拆 orb-chat-host）；④ 与 ⑤-localStorage 登记/多写者锁、⑥-重复实现群/check
     链单源化仍活
   — 深潜 3 分歧已裁决（adr-004，2026-07-29 用户拍板）：orb.ts **拆**（专项，
     消息窗口卡前置，一切皆卡片愿景）/ anim scope 废弃泛化声称 / ai-tools 端点整删
   — 制度化：随修溯源（修每条漂移必带成因标签 + 引入 commit，进 bug-fix 流程）
11. 校验逻辑改动前必查生产数据分布（2026-08-01 记，BAR-SEC-14 中文 sessionId 误杀事故）
   — 事故：安全修复加 ASCII 白名单技术判断全对，但不知道生产会话 id 是中文标题，
     回归钉还把「中文」钉在拒绝侧——463 测试全绿拦不住「测试亲自钉死的误杀」
   — 教训候选进 pre-code-gate 自查清单（或心法）：改任何校验/过滤/白名单逻辑前，
     先看生产真实数据的分布（ls 数据目录/抽样真实记录），再定合法集
   — 同类风险面：凡「合法/非法」二分的校验器（provider 参数、路径、ref、id 类）
12. 测试先行（测试设计先于实现）理念候选（2026-08-01 用户动议，外部经验引入）
   — 内容：开发功能前先讨论设计出「测试怎么写」，再写实现代码——目标降低 feat 后
     fix 提交占比（历史一半时间在修 bug 的病灶直指此处）
   — 与冰山实验同源：feat 前投入转移 feat 后 fix 工作量（有沉淀 avg fix 链 1.58 vs
     无沉淀 2.58，p=0.004 已证「前置投入有效」）——测试先行是前置投入的具体形态
   — 现状锚点：bug-fix 流程已有「先钉回归测试再修」先例（BAR 系列 revert 钉），
     feat 流程无对应约束——讨论适配形态后候选进 workflows feat 类卡 / 心法
13. 冷启动试卷体系长期化（2026-08-01 用户动议）
   — 现状：同一提示词 + lab 基线的多 harness 对照实验已产出 100+ 臂带尸检数据，
     资产已入库 experiments/coldstart/（2026-08-01 起，sessions 在 .kfmv4 私有区）
   — 方向：① 定期复测对照（模型版本迭代/harness 演进后的行为漂移追踪）
     ② 新 harness 接入即测 ③ 远期：agent-runner 形态自动跑臂+尸检入库，
     挂机后台持久化（与 #3 agent 任务执行器会合）
14. 实验体系迁入源码仓 + 数据重构（2026-08-01 用户动议）
   — 现状：已入库 experiments/coldstart/（index.md + reports + tools），sessions/
     原始答卷在 .kfmv4/experiments/coldstart/ 私有区——数据重构已完成主体
   — 时机：随 #13 试卷体系固化成工作流时一并收尾（sessions 存档格式定型 +
     index 入 ledger 或邻接层）
   — 方法论（#12 测试先行在实验基建上的同源应用）：先摸索实验机制和流程（试卷/
     基线/尸检/评分口径），产物是实验结论——结论用来推动决策和方向设计；
     设计不能脱离实际，决策需要真实数据支撑
15. 稳定代码逐渐 Rust 化方向研究（2026-08-01 用户动议，远景方向）
   — 契机：BAR-BASH-HANG-01 调研发现 pi-natives 全栈源码可得（MIT，vendored
     brush-core/uutils 同仓可改），服务器已有 rustup——Rust 化有现成土壤
   — 方向：稳定下来的热路径/性能敏感模块逐步 Rust 化（形态未定：napi  addon /
     sidecar 进程 / wasm——需先做选型研究，不预设）
   — 前置：先积累自己的 Rust 工程能力（小型试点），再谈迁移；不为此引入
     新的构建链复杂度到主仓
   — 附属待办：pi-natives 进程替换 fd 泄漏（brush-core interp.rs
     setup_process_substitution 写端未回收，/proc 级取证在本会话）整理成
     issue 反馈上游 can1357/oh-my-pi——开源回馈，也防 omp 升级带回同类问题
16. ✅ 测试环境污染生产数据目录（2026-08-01 记，蔚然五测尸检发现；2026-08-01 根治）
   — **✅ 已根治（2026-08-01，BAR-TEST-ENV-01）**：preload.mjs 头部把 KFM_ROOT
     重定向到 mkdtemp 临时目录（path-utils import 时读 env，preload 先于一切
     被测模块）；两枚假设根=HOME 的旧钉一并解除；全量跑后生产 sessions
     零增长实测；存量 11 个已手工清理
4. ✅ 手势系统研究与全局交互区域分权（P3，自 HANDBOOK 活跃待办迁入；唯一子项 2026-07-29 关闭）
   — 浮卡/卡片堆/设置卡内容区与全局左右滑的边界
   （touch-action 分区策略已文档化 → domains/client-shell/contract.md #陷阱 7，2026-07-29 关闭该子项）
5. v8 审计遗留 LOW 项（P3，自 V8_AUDIT_REPORT 迁入，2026-07-27 审计）
   — session-store.ts（客户端）命名/职责模糊（重命名 session-client 或合并 orb.ts）
     —— 重命名已落地 session-client.ts；职责双轨残留见 ai-chat code-map 漂移 1（语义审计 E2）
   — tool_result 状态（orb-chat _applyEvent）与渲染（chat-dom patchEvent）两处分散
   — flushSync 每事件同步写盘：当前可接受；多用户/长对话时改「text_delta 防抖+其余同步」
6. archive (b) 结算发现的两个活缺口（2026-07-29，素材考古行已标注）
   — CARD_REGISTRY_SPEC §6 AI 卡片三命令（focus-card/close-card/send-to-card）：设计了未实施，
     现行无实现。要么实现，要么正式否决记 decisions/
   — CONTEXT_ASSEMBLY_SPEC §7 两开放问题（多角色卡同载、工具卡工具定义来源）：
     detail-runtime 未覆盖，需裁决或补文档
7. archive (a) 结算发现的三个真遗留（2026-07-29，旧审计开放项在新文档系统失联）
   — v6.8 审计 #10：服务端 console.log 残留 ~12 处（ws-server.ts/index.ts/ai/chat.ts），
     应统一为 warn/error（客户端侧已清，debug-tools.md:115 有服务端惯例）
   — HANDOFF_2026-06-03_AUDIT_FIX_DEEP「留给下一轮」三项：_rowIndex 显式接口化
     （代码仍 88 处直引）/ RafHandleSet 封装（canvas-scroll 5 个 rAF 循环散布读写）/
     L._savedScrollY 迁移入 saveSidebarScrollState()
   — file-tree 命令已实现（v6.2.0 expand-dir/collapse-dir/select-file，见 tree-render.ts
     工具卡）；残留缺口是「AI 之手」家族的卡片操作（CARD_REGISTRY 三命令等）
   — ⚠ 2026-07-29 ADR-004 追加裁决（已定性，非债）：`command` 通道（客户端 19 个
     handler + WS 协议面）保留为「AI 之手」预留基础设施——未来做 AI 操作页面时重建
     服务端触发即可，不算技术债；同日幽灵能力注册（file-search/file-read/file-write，
     无执行面误导 AI）已删，能力管道留空待 AI 之手重建
17. 接手审计五缺口（2026-08-03 记，QoderCN 冷启动审计；F1 已修 ✅，F2-F5 待裁决，裁决后拆解）
   — 共性：「反复出现的失败类还没有机械化主人」——责任真空型缺口
   — 08-03 追加：语义审计积压裁决完成——13 条逐条落账，牵出机械层「静默丢事实」
     家族三 bug（BAR-GENLIST-01 \Z 截断 / BAR-GENINV-01 CODE_EXT 蒸发 / BAR-SYNCCOUNTS-01
     枚举吞 gen-* 步，共性：check-only 与生成共享坏解析、全绿放行），均已钉；
     明细 → ledger/semantic-provenance.md「2026-08-03 接手裁决轮」
   — F1 语义巡逻静默死亡（BAR-SEMCHAIN-01）：921f6744 新增 checkExemptions
     引用未定义 ROOT（模块定义的是 REPO）→ 08-03 04:17 cron 崩，state 已写信箱未投；
     runner 崩溃无信箱通道、/var/log 无人读、agent 脚本不在任何检查覆盖内
     ——✅ 已修（2026-08-03）：ROOT→REPO + 崩溃投信箱 💀（沉默不允许）+
     check-inbox-heartbeat.mjs 挂链（MECH-FLOW-10，上岗即逮现役停摆 42h）+
     3 钉（tests/semantic-chain.test.ts）+ 探针夹具；补跑巡逻回填当日欠班
   — F2 bug 入口无强制通道：面板发送无响应 bug 以「另:」散文挂 STACK #9，未进 BAR
     登记 → 修完无人追状态（用户 08-03 确认早已修复，STACK 未更新）；入口路由可机械化
   — F3 STACK 编号碰撞：主列表 1,2,3,8..16,4..7 插入序混乱，研究参考区 0./0b./9./10.
     与主列表 #9/#10 撞号，引用歧义；check-stack-status 切分正则也会吞研究参考条目
   — F4 构建自产永久脏树：build.mjs 每次 Date.now() 重写 git 跟踪的 public/index.html
     （bundle.js 在 .gitignore 而 index.html 不在）→ 「未提交=危险」铁律被噪声稀释
   — F5 巡逻无成本闸门：77% 失败率/111s 每次的统计在信箱，但对巡逻自身消耗无预算
     /熔断（openclaw 教训「成本高」无对应度量衡）；低优先，先登记

## 研究参考（2026-08-02 起登记，未立项，内化备查）

0. **错误码总表（2026-08-03 落地）**——流程引导错误码（DOC-FLOW×8 / TEST-FLOW×3 /
   MECH-FLOW×9）总表 `active/error-codes.md`：构建失败时 check 报错带 ⛳ 引导，
   把处理者引回「读 X 走 Y」；20 个流程门 check 已覆盖。
0b. **思维模式记录（2026-08-03 立）**——洛主在范式级讨论中的思维模式提炼
   `active/thinking-patterns.md`（10 类 + 出处），原始数据 `.kfmv4/discussion-log.jsonl`；
   记录流程见 workflows/discussion-study.yaml（双触发：agent 主动提议/用户发起复盘）。


9. **语义生成（2026-08-02 立项：语义单源+生成呈现）**——设计 `active/semantic-generation.md`；
   可生成事实登记表 `active/generateable-facts.md`；已落地：契约清单生成器
   （gen-contract-lists，6 域清单单一出处）、路由表覆盖门（check-workflow-integrity）。
   纪律：写文档前先问能否从活源头推导——能→生成器，不能→手写。
10. **harness 权限引擎（远景后备，2026-08-02 重定题）**——8.5 主题改为「观测与度量（史官制度）」；本项 8.5.0 骨架已落地（影子模式长跑），审批通道待观测台数据成熟后重启。设计文档
    `docs/active/harness-permission-engine.md`（主战场）；蓝图 OpenWorker 报告
    `experiments/harness-studies/openworker.md`。核心：工具执行层加
    PermissionEngine.evaluate 拦截点（fail-closed）+ RiskClass 四类分级 +
    roots 硬边界 + shell 白名单 + 无人值守 fail-closed + 审计日志（破界率观测仪）。
    小版本：8.5.0 骨架+审计 → 8.5.1 审批通道 → 8.5.2 roots/白名单 → 8.5.3
    allowlist+回归。原研究参考：
    `experiments/harness-studies/openworker.md`（吴恩达团队完整 agent 实现，
    286 行含文件:行号索引）。核心结论：把边界纪律从提示词挪进代码——
    PermissionEngine fail-closed / RiskClass 四类分级 / roots 写路径硬边界 /
    shell 元字符白名单 / 无人值守 Inbox 挂起。对治 124 臂实验 20% 破界
    （16 臂 edit 修复者，提示词劝诫失效）。立项时机：语义编译器主线收尾后
    或 kfmv4 工具暴露面扩增前。（用户裁决 2026-08-02：结论内化文档即可，不着急立项；
    different-ai/openwork 误研报告已删除）
