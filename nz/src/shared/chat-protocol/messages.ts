/**
 * 消息规范化结构 — 双端共享的唯一类型来源。
 *
 * 服务端用它落盘（session JSON），客户端用它驱动 DOM 投影。
 * v8 宪法第一条：服务端拥有内容语义——这些类型定义"内容是什么"。
 */

export interface TextBlock {
  type: 'text';
  text: string;
  reasoning?: string;
}

export interface ToolBlock {
  type: 'tool';
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
    details?: Record<string, unknown>;
  };
  color1?: string;
  color2?: string;
}

export interface RuleWarningBlock {
  type: 'rule_warning';
  content: string;
}

export type ContentBlock = TextBlock | ToolBlock | RuleWarningBlock;

export interface ChatMessage {
  role: 'user' | 'ai';
  content: ContentBlock[];
  /** 消息创建时刻（ISO 8601，写入侧一次性盖章，之后永不改变）。
   *  投影层据此渲染 [MM-DD HH:MM] 前缀给 AI 时间感；旧消息无此字段 = 不渲染（向后兼容）。
   *  与 G6 不冲突：G6 禁的是投影时现生成时间戳，ts 是真相源的一部分，确定不变。 */
  ts?: string;
}
