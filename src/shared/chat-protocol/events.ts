/**
 * SSE 事件协议类型 — 双端共享。
 *
 * 协议结构（按 SSE 顺序）：
 *   message_start                        ← 新一轮 LLM 消息开始
 *   content_block_start  index type      ← 创建 block（text / tool_use）
 *   content_block_delta  index delta     ← 增量更新 block 内容
 *   content_block_stop   index           ← block 完成
 *   tool_result          toolUseId       ← 工具执行结果
 *   message_stop                         ← 本轮消息结束
 *   done                                 ← 全部结束
 *   error                                ← 错误
 *   rule_warning                         ← 规则引擎警告
 */

export interface StreamEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'tool_result'
    | 'message_stop'
    | 'error'
    | 'done'
    | 'rule_warning';
  // content_block_start
  index?: number;
  blockType?: 'text' | 'tool_use';
  toolUseId?: string;
  toolName?: string;
  // content_block_delta
  deltaType?: 'text_delta' | 'thinking_delta' | 'input_json_delta';
  deltaText?: string;
  // tool_result
  toolResult?: {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
    details?: Record<string, unknown>;
  };
  filesChanged?: boolean;
  // error / rule_warning
  content?: string;
}
