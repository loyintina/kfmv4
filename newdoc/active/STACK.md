# 工作栈
1. [vision.md] v8.2 文档系统重构 — 逐份迁移中（映射表：docs/active/doc-system-redesign.md §十三）
   ← 当前：archive (c) 3 份 ✅。下一：archive (b) 素材型 19 份（素材考古行散进各域 contract）
2. 手势系统研究与全局交互区域分权（P3，自 HANDBOOK 活跃待办迁入）
   — 浮卡/卡片堆/设置卡内容区与全局左右滑的边界；touch-action 分区策略待文档化
3. v8 审计遗留 LOW 项（P3，自 V8_AUDIT_REPORT 迁入，2026-07-27 审计）
   — session-store.ts（客户端）命名/职责模糊（重命名 session-client 或合并 orb.ts）
   — tool_result 状态（orb-chat _applyEvent）与渲染（chat-dom patchEvent）两处分散
   — flushSync 每事件同步写盘：当前可接受；多用户/长对话时改「text_delta 防抖+其余同步」
