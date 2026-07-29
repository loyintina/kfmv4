# 工作栈
1. [vision.md] v8.2 文档系统重构 — ✅ 完成（2026-07-29 切换提交）
   — 19 活跃迁移 + archive 65 份结算 + 压缩轮 + 管线 20 脚本新链；设计文档已自我分散
   （原理 → guides/doc-architecture.md，过程 → git show v8.1.1 考古）
2. 管线文档检查自动化体系再设计（2026-07-29 立项，主干 ✅ 完成）
   — 批 0 归拢 ✅ → 批 0.5 grammar ✅ → 批 1 机械四件套 ✅ → 批 2 schema+耦合门 ✅ → 批 3 仪表盘+分层 ✅
   — 原则：失效探测器 / 格式为消费者 / 精确率≈1（已进 doc-maintenance）
   — 批 5 ✅：check-probes 探针自检（8 检查注入 + 8 假树 + 突变自测闭环）；遗留：耦合门 warning 观察期后定级（含豁免语法收紧：prose 字面串误认）；批 1.5 语义审计试点
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
   — 模型链：kimi-for-code-highspeed（256k）→ deepseek_v4_flash → step-3.7-flash 有序兜底
   — 远期：agent 工具 prompt 管理卡（实体化管理 + 逐脚本微调，很久后）
   — 待设计：触发方式（cron/事件/手动）、产出验证（LLM proposes, mechanics disposes）、
     结果回写（tag/STACK/ledger）、失败兜底
8. 卡片类需求三件（2026-07-29 记，优先级后排）
   — 工作流实体卡片插件：workflows/ 的实体卡进卡片堆（形态参照现有 tool 卡）
   — 中央面板网格线升级 + 实时统计信息
   — 会话卡逻辑修复（具体病灶待补充）
   — 审查文件卡代码高亮问题修正（具体病灶待补充）
9. prompts 提示词注入约束修复（2026-07-29 记，src/server/prompts/，具体病灶待补充）
   — 另：面板发送消息无响应（2026-07-29 记，用户反馈的活 bug，具体病灶待补充——复现后进 bug-fix 流程）
10. 全量代码分析 → domains 填充（2026-07-29 提前完成，用户动议）
   — ✅ 六域 code-map + cross-domain.md（99 条漂移带 file:line，0cecc62/3906707）
   — ✅ 机械层：gen-code-inventory.mjs（212 文件 + 224 跨域边，鲜度挂接待办）
   — ✅ 溯源审计：22 subagent 考古 → ledger/drift-provenance.md（105 行普查 + 8 案深潜）
     分布：E 机制没人走 21.9% · A 过时 20% · C 权宜 17.1% · F 文档 16.2% · B 接力 14.3% · D 复制 9.5%
   — 后续队列（按堆）：① 真 bug 10 条（ai-chat#2 冷恢复载荷优先）② 安全面 3 条核实
     ③ 死代码 ~30 处（text-layout 2292 行整目录居首）④ 契约失真 ~35 条（→批 1.5）
     ⑤ 协议制度缺口（localStorage 登记/多写者锁/scope 裁决）⑥ 架构议题（orb 归属/
     重复实现群/check 链单源化）
   — 深潜 3 分歧已裁决（adr-004，2026-07-29 用户拍板）：orb.ts **拆**（专项，
     消息窗口卡前置，一切皆卡片愿景）/ anim scope 废弃泛化声称 / ai-tools 端点整删
   — 制度化：随修溯源（修每条漂移必带成因标签 + 引入 commit，进 bug-fix 流程）
4. 手势系统研究与全局交互区域分权（P3，自 HANDBOOK 活跃待办迁入）
   — 浮卡/卡片堆/设置卡内容区与全局左右滑的边界
   （touch-action 分区策略已文档化 → domains/client-shell/contract.md #陷阱 7，2026-07-29 关闭该子项）
5. v8 审计遗留 LOW 项（P3，自 V8_AUDIT_REPORT 迁入，2026-07-27 审计）
   — session-store.ts（客户端）命名/职责模糊（重命名 session-client 或合并 orb.ts）
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
   — ⚠ 2026-07-29 ADR-004 加码：ai-tools 整删后，`command` WS 消息的唯一服务端触发
     （POST /ui/command）消失，客户端 19 个 command handler 全部成孤儿——「AI 之手」
     家族从「设计了未实施」升级为「客户端有 handler 但永远无人触发」，裁决更紧迫
