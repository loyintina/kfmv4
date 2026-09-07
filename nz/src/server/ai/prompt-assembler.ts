/**
 * prompt-assembler.ts — system 装配（2026-09-07 方向转向冻结版）。
 *
 * 原 A2a.5 §三「角色激活→promptFiles 拼装」随 prompt/角色系统退役（用户
 * 拍板：AI 对话冻结在「能用的聊天客户端」形态，单一出厂对话提示词即全部
 * 人格；A2b 眼睛挂载点一并冻结）。角色数据文件留在 ~/.kfmv4/agents/roles/
 * 盘上不删；总账 roleFile 字段 schema 保留但**不再消费**（writeActive 兼容
 * 旧客户端写路径，读侧归零）。
 *
 * 出厂 system = 时间戳声明基线（BAR-TS-MIMIC-01 补阙，保留）+ 对话人格一行。
 * 保留函数名 assembleRoleSystemPrompt（route.ts 调用点零改；语义=「出厂
 * system 装配」）。
 */

/** v8 chat.ts:245 出厂基线（ts 前缀声明——nz 简版投影给 user 消息盖 [ts]
 *  前缀但 A1 从未声明，BAR-TS-MIMIC-01 的复读风险在此补上声明半阙） */
const BASELINE_TS_DECLARATION = '用户消息前的 [ts MM-DD HH:MM:SS] 是系统加盖的时间元数据，不是用户说的话的一部分；你的回复从不带这个前缀，也不要模仿或复述它。';

/** 出厂对话提示词（2026-09-07 用户拍板「只预设一个简单的对话提示词」） */
const FACTORY_DIALOGUE_PROMPT = '你是一个简洁、直接、诚实的中文对话助手：先给结论再给理由，回答尽量短；不确定就说不确定，不编造；不需要寒暄和免责声明。';

/**
 * 组装 system（每次 /ai/chat/start 调用一次）：基线+出厂提示词，\n\n 连接。
 * 恒非空（不再有「无角色就不返回 system」分支——对话人格出厂即定）。
 * 摘要段位（§3.3 原预留）随压缩冻结一并取消。
 */
export function assembleRoleSystemPrompt(): string {
  return [BASELINE_TS_DECLARATION, FACTORY_DIALOGUE_PROMPT].join('\n\n');
}
