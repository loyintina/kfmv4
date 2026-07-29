# 工作栈
1. [vision.md] v8.2 文档系统重构 — 逐份迁移中（映射表：docs/active/doc-system-redesign.md §十三）
   ← 当前：archive (c) 3 ✅、(b) 21 ✅、(a) 41 ✅。下一：收尾三件套（统一压缩轮 → 管线适配 → 切换提交）
2. 手势系统研究与全局交互区域分权（P3，自 HANDBOOK 活跃待办迁入）
   — 浮卡/卡片堆/设置卡内容区与全局左右滑的边界；touch-action 分区策略待文档化
3. v8 审计遗留 LOW 项（P3，自 V8_AUDIT_REPORT 迁入，2026-07-27 审计）
   — session-store.ts（客户端）命名/职责模糊（重命名 session-client 或合并 orb.ts）
   — tool_result 状态（orb-chat _applyEvent）与渲染（chat-dom patchEvent）两处分散
   — flushSync 每事件同步写盘：当前可接受；多用户/长对话时改「text_delta 防抖+其余同步」
4. archive (b) 结算发现的两个活缺口（2026-07-29，素材考古行已标注）
   — CARD_REGISTRY_SPEC §6 AI 卡片三命令（focus-card/close-card/send-to-card）：设计了未实施，
     现行无实现。要么实现，要么正式否决记 decisions/
   — CONTEXT_ASSEMBLY_SPEC §7 两开放问题（多角色卡同载、工具卡工具定义来源）：
     detail-runtime 未覆盖，需裁决或补文档
5. archive (a) 结算发现的三个真遗留（2026-07-29，旧审计开放项在新文档系统失联）
   — v6.8 审计 #10：服务端 console.log 残留 ~12 处（ws-server.ts/index.ts/ai/chat.ts），
     应统一为 warn/error（客户端侧已清，debug-tools.md:115 有服务端惯例）
   — HANDOFF_2026-06-03_AUDIT_FIX_DEEP「留给下一轮」三项：_rowIndex 显式接口化
     （代码仍 88 处直引）/ RafHandleSet 封装（canvas-scroll 5 个 rAF 循环散布读写）/
     L._savedScrollY 迁移入 saveSidebarScrollState()
   — file-tree 命令缺口：AI 能看文件树但不能操作，expand-dir/collapse-dir/select-file
     从未实现（ws-channel.ts:379 注释留有设想；与第 4 项 CARD_REGISTRY 三命令同属
     「AI 之手」家族，可一并裁决）
