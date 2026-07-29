# 工作栈
1. [vision.md] v8.2 文档系统重构 — ✅ 完成（2026-07-29 切换提交）
   — 19 活跃迁移 + archive 65 份结算 + 压缩轮 + 管线 20 脚本新链；设计文档已自我分散
   （原理 → guides/doc-architecture.md，过程 → git show v8.1.1 考古）
2. 管线文档检查自动化体系再设计（2026-07-29 立项，主干 ✅ 完成）
   — 批 0 归拢 ✅ → 批 0.5 grammar ✅ → 批 1 机械四件套 ✅ → 批 2 schema+耦合门 ✅ → 批 3 仪表盘+分层 ✅
   — 原则：失效探测器 / 格式为消费者 / 精确率≈1（已进 doc-maintenance）
   — 遗留：耦合门 warning 观察期后定级（含豁免语法收紧：prose 字面串误认）；批 1.5 语义审计试点
   — 批 5 候选：检查探针自检（负例夹具——种已知违规，检查必须报红，报不出 = 检查坏了）；西瓜效应观测
   — 语义编译器体系（双区管线/SEM 错误码/冷启动 e2e/集群统计）→ [semantic-compiler-seed.md]，批 1.5 试点
3. 手势系统研究与全局交互区域分权（P3，自 HANDBOOK 活跃待办迁入）
   — 浮卡/卡片堆/设置卡内容区与全局左右滑的边界
   （touch-action 分区策略已文档化 → domains/client-shell/contract.md #陷阱 7，2026-07-29 关闭该子项）
4. v8 审计遗留 LOW 项（P3，自 V8_AUDIT_REPORT 迁入，2026-07-27 审计）
   — session-store.ts（客户端）命名/职责模糊（重命名 session-client 或合并 orb.ts）
   — tool_result 状态（orb-chat _applyEvent）与渲染（chat-dom patchEvent）两处分散
   — flushSync 每事件同步写盘：当前可接受；多用户/长对话时改「text_delta 防抖+其余同步」
5. archive (b) 结算发现的两个活缺口（2026-07-29，素材考古行已标注）
   — CARD_REGISTRY_SPEC §6 AI 卡片三命令（focus-card/close-card/send-to-card）：设计了未实施，
     现行无实现。要么实现，要么正式否决记 decisions/
   — CONTEXT_ASSEMBLY_SPEC §7 两开放问题（多角色卡同载、工具卡工具定义来源）：
     detail-runtime 未覆盖，需裁决或补文档
6. archive (a) 结算发现的三个真遗留（2026-07-29，旧审计开放项在新文档系统失联）
   — v6.8 审计 #10：服务端 console.log 残留 ~12 处（ws-server.ts/index.ts/ai/chat.ts），
     应统一为 warn/error（客户端侧已清，debug-tools.md:115 有服务端惯例）
   — HANDOFF_2026-06-03_AUDIT_FIX_DEEP「留给下一轮」三项：_rowIndex 显式接口化
     （代码仍 88 处直引）/ RafHandleSet 封装（canvas-scroll 5 个 rAF 循环散布读写）/
     L._savedScrollY 迁移入 saveSidebarScrollState()
   — file-tree 命令缺口：AI 能看文件树但不能操作，expand-dir/collapse-dir/select-file
     从未实现（ws-channel.ts:379 注释留有设想；与第 5 项 CARD_REGISTRY 三命令同属
     「AI 之手」家族，可一并裁决）
