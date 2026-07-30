# 工作栈
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
     仍归语义层/人工。vision 探针重组（拆 codeMaps 大基线）待做
   — 活树 v5 审计 10 条保留发现待裁决：canvas-tree 契约 6 连中（出口名/方向锁/
     超时释放等真漂移集群）+ README detail 计数 + infra「30 脚本 vs 35 步」
     （疑似单位不同误报）+ cross-domain 行号差 1 + provider 链描述分叉
   — 腿三（远期）：semantic-chain.mjs 总 runner——探针 verdict 聚合成单结论（过/N 条新发现），
     cron 化巡逻；verdict 门控注意力不门控合并（概率区纪律）；裁决与修复留会话内 agent，
     自动化边界 = 检测，结晶回路负责把反复发现移民确定区
8. 卡片类需求三件（2026-07-29 记，优先级后排）
   — 工作流实体卡片插件：workflows/ 的实体卡进卡片堆（形态参照现有 tool 卡）
   — 中央面板网格线升级 + 实时统计信息
   — 会话卡逻辑修复（具体病灶待补充）
   — 审查文件卡代码高亮问题修正（具体病灶待补充）
9. prompts 提示词注入约束修复（2026-07-29 记，src/server/prompts/，具体病灶待补充）
   — 另：面板发送消息无响应（2026-07-29 记，用户反馈的活 bug，具体病灶待补充——复现后进 bug-fix 流程）
10. 全量代码分析 → domains 填充（2026-07-29 提前完成，用户动议）
   — ✅ 六域 code-map + cross-domain.md（99 条漂移带 file:line，0cecc62/3906707）
   — ✅ 机械层：gen-code-inventory.mjs（已移 scripts/check/ 并 --check-only 挂链，鲜度不再靠人）
   — ✅ 溯源审计：22 subagent 考古 → ledger/drift-provenance.md（105 行普查 + 8 案深潜）
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
4. 手势系统研究与全局交互区域分权（P3，自 HANDBOOK 活跃待办迁入）
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
   — file-tree 命令缺口：AI 能看文件树但不能操作，expand-dir/collapse-dir/select-file
     从未实现（ws-channel.ts:379 注释留有设想；与第 6 项 CARD_REGISTRY 三命令同属
     「AI 之手」家族，可一并裁决）
   — ⚠ 2026-07-29 ADR-004 追加裁决（已定性，非债）：`command` 通道（客户端 19 个
     handler + WS 协议面）保留为「AI 之手」预留基础设施——未来做 AI 操作页面时重建
     服务端触发即可，不算技术债；同日幽灵能力注册（file-search/file-read/file-write，
     无执行面误导 AI）已删，能力管道留空待 AI 之手重建
