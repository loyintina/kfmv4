# 工作栈
1. [vision.md] v8.2 文档系统重构 — 逐份迁移中（映射表：docs/active/doc-system-redesign.md §十三）
   ← 当前：archive (c) 3 份 ✅、(b) 素材型 21 份 ✅（素材考古行散进 5 域 contract + guides/testing）。下一：archive (a) 纯历史 41 份（按组压 history 行）
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
