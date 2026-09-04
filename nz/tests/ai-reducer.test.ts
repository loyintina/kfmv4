/**
 * tests/ai-reducer.test.ts — A 档钉 A7：共享 reducer 过 probe 真流 fixture
 *
 * 判卷基准 = tests/fixtures/ai-chat/probe-*.sse（kfmv4 服务端吐出的九事件
 * 真流实录：kimi 44 事件 / glm 40 事件 + __end__ 终结帧）。信封 index =
 * 重连 cursor，必须连续递增。
 *
 * 注意（§二 fixture 分工诚实登记）：probe-* 与 upstream-* 模型不同、内容
 * 不同，只能对拍形状不能逐帧对拍内容——本卷不断言与 upstream 相同的
 * thinking 文本。
 */
import { test, group, assert } from './runner.ts';
import { readFileSync } from 'node:fs';
import { SseParser } from '../src/server/ai/sse-parser.ts';
import { reduceEvents, applyEvent, type ReduceContext } from '../src/shared/chat-protocol/reducer.ts';
import { createClientIdxMapper } from '../src/shared/chat-protocol/block-idx.ts';
import type { StreamEvent } from '../src/shared/chat-protocol/events.ts';
import type { TextBlock, ToolBlock } from '../src/shared/chat-protocol/messages.ts';

const PROBE_KIMI_THINKING = 'We need answer user request exactly one word: PONG. Need final exactly PONG. No extra. Need be careful system says user message timestamp metadata not in reply. Do it.';
const PROBE_GLM_THINKING = 'The user is asking me to reply with exactly one word: PONG.\n\nThis is a simple connectivity test. I should reply with exactly one word: PONG.';

interface ProbeRun { events: StreamEvent[]; sawEnd: boolean; }

function runProbe(name: string): ProbeRun {
  const raw = readFileSync(new URL(`./fixtures/ai-chat/${name}`, import.meta.url), 'utf-8');
  const p = new SseParser();
  p.feed(raw);
  const events: StreamEvent[] = [];
  let sawEnd = false;
  let expectedIdx = 0;
  for (const frame of p.drainFrames()) {
    const env = JSON.parse(frame) as { index?: number; event?: StreamEvent; type?: string };
    if (env.type === '__end__') { sawEnd = true; continue; }
    assert(env.index === expectedIdx, `信封 index 应连续（cursor 语义）：期望 ${expectedIdx} 实得 ${env.index}`);
    expectedIdx++;
    events.push(env.event!);
  }
  return { events, sawEnd };
}

group('ai-reducer（A7：probe fixture 44/40 事件 → messages 结构）');

test('probe-kimi（44 事件）：流式混排归约为单消息单块，thinking/text 分字段', () => {
  const { events, sawEnd } = runProbe('probe-kimi-k3-256k-20260830.sse');
  assert(events.length === 44, `应为 44 事件，实得 ${events.length}`);
  assert(sawEnd, '应有 __end__ 终结帧');
  const messages = reduceEvents(events);
  assert(messages.length === 1 && messages[0].role === 'ai', '单条 ai 消息');
  assert(messages[0].content.length === 1, '单 content 块（thinking+正文同块混排）');
  const block = messages[0].content[0] as TextBlock;
  assert(block.type === 'text' && block.text === 'PONG', '正文 PONG');
  assert(block.reasoning === PROBE_KIMI_THINKING, '思考链归并一致');
});

test('probe-glm（40 事件）：第二路互证，形状同判', () => {
  const { events, sawEnd } = runProbe('probe-glm-5.3-flash-20260830.sse');
  assert(events.length === 40, `应为 40 事件，实得 ${events.length}`);
  assert(sawEnd, '应有 __end__ 终结帧');
  const messages = reduceEvents(events);
  const block = messages[0].content[0] as TextBlock;
  assert(block.text === 'PONG' && block.reasoning === PROBE_GLM_THINKING, 'glm 归约一致');
});

test('error 事件收流成消息：有活跃块追加，无活跃块成新消息（占位符形态）', () => {
  const withActive = reduceEvents([
    { type: 'message_start' },
    { type: 'content_block_start', index: 0, blockType: 'text' },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: '半截正文' },
    { type: 'error', content: '网络错误' },
  ]);
  const tb = withActive[0].content[0] as TextBlock;
  assert(tb.text.includes('半截正文') && tb.text.includes('[错误: 网络错误]'), '错误追加进活跃 text 块');
  const noActive = reduceEvents([{ type: 'error', content: 'Provider 不存在' }]);
  assert(noActive.length === 1 && (noActive[0].content[0] as TextBlock).text === '[错误: Provider 不存在]',
    '无活跃消息时 error 自成消息（P5：不许静默断流）');
});

test('工具事件容忍（P8）：tool_use/input_json_delta/tool_result/rule_warning 归约不炸不断流', () => {
  const messages = reduceEvents([
    { type: 'message_start' },
    { type: 'content_block_start', index: 0, blockType: 'text' },
    { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: '调用工具' },
    { type: 'content_block_start', index: 1, blockType: 'tool_use', toolUseId: 'c1', toolName: 'bash' },
    { type: 'content_block_delta', index: 1, deltaType: 'input_json_delta', deltaText: '{"command":"ls"}' },
    { type: 'content_block_stop', index: 1 },
    { type: 'tool_result', toolUseId: 'c1', toolResult: { content: [{ type: 'text', text: 'ok' }] } },
    { type: 'rule_warning', content: '规则提醒' },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_stop' },
    { type: 'done' },
  ]);
  const tool = messages[0].content[1] as ToolBlock;
  assert(tool.type === 'tool' && tool.name === 'bash', 'tool 块归约');
  assert((tool.input as { command?: string }).command === 'ls', 'input_json 碎片应解析进 input');
  assert(tool.result?.content[0].text === 'ok', 'tool_result 回填');
  assert(messages[0].content.some(b => b.type === 'rule_warning'), 'rule_warning 入 content（数据在，UI 不渲染）');
});

test('block-idx 映射器：text 恒 0，工具块连续编号且幂等（BAR-106）', () => {
  const { clientIdx } = createClientIdxMapper();
  assert(clientIdx(1) === 1, '首个工具 provider idx → 1');
  assert(clientIdx(5) === 2, '跳号 provider idx 也连续 → 2（不留 undefined 空洞）');
  assert(clientIdx(1) === 1, '同一 providerIdx 重复映射幂等');
  assert(clientIdx(0) === 3, 'provider idx 0 的工具也不与 text 块撞号');
});

test('applyEvent 原地 mutate 语义：同一 messages 引用被更新（流式性能契约）', () => {
  const ctx: ReduceContext = { messages: [], msgIdx: -1 };
  const ref = ctx.messages;
  applyEvent(ctx, { type: 'message_start' });
  applyEvent(ctx, { type: 'content_block_start', index: 0, blockType: 'text' });
  applyEvent(ctx, { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'a' });
  assert(ctx.messages === ref && ctx.msgIdx === 0, '原地 mutate，msgIdx 推进');
  assert((ref[0].content[0] as TextBlock).text === 'a', 'delta 原地追加');
});
