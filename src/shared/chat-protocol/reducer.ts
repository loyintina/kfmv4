/**
 * 纯状态转换：(messages, msgIdx, event) → msgIdx。
 *
 * 从 orb-chat.ts _applyEvent 抽取的状态逻辑，剥离全部 UI 副作用
 * （动画/等待提示/文件树刷新/todo 面板/滚动）。双端共享：
 * - 服务端可用它验证事件序列的消息结构正确性
 * - 客户端用它驱动 DOM 投影前的状态更新
 * - 测试用它做协议级 fixture（事件序列 → 消息结构）
 *
 * 语义：原地 mutate messages（流式性能要求），返回更新后的 msgIdx。
 * 幂等性注意：同一事件重复 apply 会产生重复内容（非幂等），
 * 调用方负责 cursor 管理（run-manager 的 fromIndex 机制）。
 */

import type { ChatMessage, TextBlock, ToolBlock, RuleWarningBlock } from './messages.js';
import type { StreamEvent } from './events.js';

export interface ReduceContext {
  messages: ChatMessage[];
  msgIdx: number;
}

export function applyEvent(ctx: ReduceContext, event: StreamEvent): void {
  const { messages } = ctx;
  const msgIdx = ctx.msgIdx;

  switch (event.type) {
    case 'message_start': {
      messages.push({ role: 'ai', content: [] });
      ctx.msgIdx = messages.length - 1;
      break;
    }
    case 'message_stop': {
      break;
    }
    case 'content_block_start': {
      if (msgIdx < 0) break;
      const { index, blockType, toolUseId, toolName } = event;
      if (index === undefined) break;
      if (blockType === 'text') {
        messages[msgIdx].content[index] = { type: 'text', text: '', reasoning: '' };
      } else if (blockType === 'tool_use') {
        messages[msgIdx].content[index] = { type: 'tool', id: toolUseId || '', name: toolName || 'unknown', input: {} };
      }
      break;
    }
    case 'content_block_delta': {
      if (msgIdx < 0) break;
      const { index, deltaType, deltaText } = event;
      if (index === undefined) break;
      const block = messages[msgIdx].content[index];
      if (!block) break;
      if (deltaType === 'text_delta' && block.type === 'text') {
        (block as TextBlock).text += deltaText || '';
      } else if (deltaType === 'thinking_delta' && block.type === 'text') {
        (block as TextBlock).reasoning = ((block as TextBlock).reasoning || '') + (deltaText || '');
      } else if (deltaType === 'input_json_delta' && block.type === 'tool') {
        const tb = block as ToolBlock & { _jsonBuf?: string };
        tb._jsonBuf = (tb._jsonBuf || '') + (deltaText || '');
      }
      break;
    }
    case 'content_block_stop': {
      if (msgIdx < 0) break;
      const { index } = event;
      if (index === undefined) break;
      const block = messages[msgIdx].content[index];
      if (block?.type === 'tool') {
        const tb = block as ToolBlock & { _jsonBuf?: string };
        if (tb._jsonBuf) {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tb._jsonBuf); } catch { /* malformed JSON → empty input */ }
          tb.input = parsed;
          delete tb._jsonBuf;
        }
      }
      break;
    }
    case 'tool_result': {
      if (msgIdx < 0) break;
      const toolBlock = messages[msgIdx].content.find(
        (b): b is ToolBlock => b?.type === 'tool' && b.id === event.toolUseId
      );
      if (toolBlock) {
        toolBlock.result = event.toolResult;
      }
      break;
    }
    case 'rule_warning': {
      if (msgIdx < 0) break;
      messages[msgIdx].content.push({ type: 'rule_warning', content: event.content || '' } as RuleWarningBlock);
      break;
    }
    case 'error': {
      if (msgIdx < 0) {
        messages.push({ role: 'ai', content: [{ type: 'text', text: '[错误: ' + event.content + ']' }] });
        ctx.msgIdx = messages.length - 1;
        break;
      }
      const tb = messages[msgIdx].content.find((b): b is TextBlock => b?.type === 'text');
      if (tb) tb.text += '\n\n[错误: ' + event.content + ']';
      else messages[msgIdx].content.push({ type: 'text', text: '[错误: ' + event.content + ']' });
      break;
    }
    case 'done': {
      break;
    }
  }
}

/**
 * 将完整事件序列 reduce 为消息数组（冷恢复 / 测试用）。
 * 幂等前提：事件序列不重复（由 cursor 保证）。
 */
export function reduceEvents(events: StreamEvent[]): ChatMessage[] {
  const ctx: ReduceContext = { messages: [], msgIdx: -1 };
  for (const event of events) {
    applyEvent(ctx, event);
  }
  return ctx.messages;
}
