// ==========================================================================
// tests/protocol-reducer.test.ts — shared/chat-protocol reducer 协议级测试
//
// 验证 reduceEvents 将事件序列正确转换为消息结构。
// 这是 v8 双端共享 reducer 的正确性基准——服务端落盘和客户端投影
// 都依赖同一个 reduce 逻辑，任何分歧都是 P0 bug。
// ==========================================================================

import assert from 'assert';
import { group, test } from './runner.js';
import { reduceEvents, applyEvent, type ReduceContext } from '../src/shared/chat-protocol/reducer.js';
import type { StreamEvent } from '../src/shared/chat-protocol/events.js';
import type { TextBlock, ToolBlock } from '../src/shared/chat-protocol/messages.js';

group('protocol reducer — 基本事件序列');

test('message_start 创建空 AI 消息', () => {
  const msgs = reduceEvents([{ type: 'message_start' }]);
  assert(msgs.length === 1, '应创建 1 条消息');
  assert(msgs[0].role === 'ai', '应为 AI 消息');
  assert(msgs[0].content.length === 0, '内容应为空');
});

test('text block 完整生命周期：start → delta → stop', () => {
  const events: StreamEvent[] = [
    { type: 'message_start' },
    { type: 'content_block_start', index: 0, blockType: 'text' },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'Hello ' },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'World' },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_stop' },
  ];
  const msgs = reduceEvents(events);
  assert(msgs.length === 1);
  const tb = msgs[0].content[0] as TextBlock;
  assert(tb.type === 'text');
  assert(tb.text === 'Hello World', `应拼接文本，得 "${tb.text}"`);
});

test('thinking + text 合并到同一 text block', () => {
  const events: StreamEvent[] = [
    { type: 'message_start' },
    { type: 'content_block_start', index: 0, blockType: 'text' },
    { type: 'content_block_delta', index: 0, deltaType: 'thinking_delta', deltaText: '让我想想' },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: '答案是42' },
    { type: 'content_block_stop', index: 0 },
  ];
  const msgs = reduceEvents(events);
  const tb = msgs[0].content[0] as TextBlock;
  assert(tb.reasoning === '让我想想', 'reasoning 应累积');
  assert(tb.text === '答案是42', 'text 应累积');
});

test('tool_use block：start → input_json_delta → stop → tool_result', () => {
  const events: StreamEvent[] = [
    { type: 'message_start' },
    { type: 'content_block_start', index: 1, blockType: 'tool_use', toolUseId: 'call_1', toolName: 'bash' },
    { type: 'content_block_delta', index: 1, deltaType: 'input_json_delta', deltaText: '{"command":' },
    { type: 'content_block_delta', index: 1, deltaType: 'input_json_delta', deltaText: '"ls"}' },
    { type: 'content_block_stop', index: 1 },
    { type: 'tool_result', toolUseId: 'call_1', toolResult: { content: [{ type: 'text', text: 'file.ts' }] } },
    { type: 'message_stop' },
  ];
  const msgs = reduceEvents(events);
  const tb = msgs[0].content[1] as ToolBlock;
  assert(tb.type === 'tool');
  assert(tb.name === 'bash');
  assert(tb.id === 'call_1');
  assert.deepStrictEqual(tb.input, { command: 'ls' }, 'JSON 应在 stop 时解析');
  assert(tb.result !== undefined, '应有 result');
  assert(tb.result!.content[0].text === 'file.ts');
});

test('rule_warning 追加到当前消息', () => {
  const events: StreamEvent[] = [
    { type: 'message_start' },
    { type: 'rule_warning', content: '[规则警告: 危险] 此操作不可逆' },
  ];
  const msgs = reduceEvents(events);
  assert(msgs[0].content.length === 1);
  assert(msgs[0].content[0].type === 'rule_warning');
});

test('error 无消息时创建新消息', () => {
  const msgs = reduceEvents([{ type: 'error', content: 'API 超时' }]);
  assert(msgs.length === 1);
  const tb = msgs[0].content[0] as TextBlock;
  assert(tb.text.includes('API 超时'));
});

test('error 有消息时追加到已有 text block', () => {
  const events: StreamEvent[] = [
    { type: 'message_start' },
    { type: 'content_block_start', index: 0, blockType: 'text' },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: '正文' },
    { type: 'error', content: '中断' },
  ];
  const msgs = reduceEvents(events);
  const tb = msgs[0].content[0] as TextBlock;
  assert(tb.text.includes('正文'));
  assert(tb.text.includes('[错误: 中断]'));
});

test('多轮工具循环：message_start × 2', () => {
  const events: StreamEvent[] = [
    { type: 'message_start' },
    { type: 'content_block_start', index: 1, blockType: 'tool_use', toolUseId: 'c1', toolName: 'read' },
    { type: 'content_block_stop', index: 1 },
    { type: 'tool_result', toolUseId: 'c1', toolResult: { content: [{ type: 'text', text: 'ok' }] } },
    { type: 'message_stop' },
    { type: 'message_start' },
    { type: 'content_block_start', index: 0, blockType: 'text' },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: '完成了' },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_stop' },
    { type: 'done' },
  ];
  const msgs = reduceEvents(events);
  assert(msgs.length === 2, `应有 2 条 AI 消息，得 ${msgs.length}`);
  assert(msgs[0].content[1] !== undefined, '第一条应有工具块');
  assert((msgs[1].content[0] as TextBlock).text === '完成了', '第二条应有正文');
});

group('protocol reducer — 幂等/边界');

test('空事件序列 → 空消息', () => {
  const msgs = reduceEvents([]);
  assert(msgs.length === 0);
});

test('content_block_delta 无 msgIdx 时安全忽略', () => {
  const events: StreamEvent[] = [
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'orphan' },
  ];
  const msgs = reduceEvents(events);
  assert(msgs.length === 0, '无 message_start 时 delta 应被忽略');
});

test('malformed JSON input → empty object', () => {
  const events: StreamEvent[] = [
    { type: 'message_start' },
    { type: 'content_block_start', index: 1, blockType: 'tool_use', toolUseId: 'c1', toolName: 'x' },
    { type: 'content_block_delta', index: 1, deltaType: 'input_json_delta', deltaText: '{invalid' },
    { type: 'content_block_stop', index: 1 },
  ];
  const msgs = reduceEvents(events);
  const tb = msgs[0].content[1] as ToolBlock;
  assert.deepStrictEqual(tb.input, {}, 'malformed JSON 应 fallback 为空对象');
});

test('applyEvent 原地 mutate（性能语义）', () => {
  const ctx: ReduceContext = { messages: [], msgIdx: -1 };
  applyEvent(ctx, { type: 'message_start' });
  applyEvent(ctx, { type: 'content_block_start', index: 0, blockType: 'text' });
  applyEvent(ctx, { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'a' });
  applyEvent(ctx, { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'b' });
  assert(ctx.messages.length === 1);
  assert((ctx.messages[0].content[0] as TextBlock).text === 'ab');
  assert(ctx.msgIdx === 0);
});
