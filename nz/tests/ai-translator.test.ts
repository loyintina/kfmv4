/**
 * tests/ai-translator.test.ts — A 档钉 A2/A3/A4/A5：上游 OpenAI chunk 翻译器
 *
 * 语义基准 = na src/brain.rs OpenAiTranslator + error_event_from_http +
 * kfmv4 chat.ts 错误语义（§1.4 表即法），判卷输入 =
 * tests/fixtures/ai-chat/upstream-*.sse（双 provider 真流实录）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①thinking↔text 换轨（deltaType 互换）→ A2「thinking/text 分流」钉红；
 *   ②归位删除（displayBody 不归位）→ A3「reasoning 归位 R3」钉红；
 *   ③流内错误块静默 → A4「流内错误块不静默」钉红。
 */
import { test, group, assert } from './runner.ts';
import { readFileSync } from 'node:fs';
import { SseParser } from '../src/server/ai/sse-parser.ts';
import { OpenAiTranslator, errorEventFromHttp } from '../src/server/ai/openai-translator.ts';
import { reduceEvents } from '../src/shared/chat-protocol/reducer.ts';
import { displayBody } from '../src/shared/chat-protocol/display.ts';
import type { StreamEvent } from '../src/shared/chat-protocol/events.ts';
import type { TextBlock } from '../src/shared/chat-protocol/messages.ts';

const KIMI_THINKING = 'We need reply with exactly one word: PONG. No extra punctuation? User asks "reply with exactly one word: PONG". We should output exactly PONG. Ensure no quotes.';
const GLM_THINKING = 'The user asked me to reply with exactly one word: PONG. This is a simple ping-pong style test. I should just reply with "PONG" and nothing else.';

function translateFixture(name: string): { events: StreamEvent[]; translator: OpenAiTranslator } {
  const raw = readFileSync(new URL(`./fixtures/ai-chat/${name}`, import.meta.url), 'utf-8');
  const p = new SseParser();
  p.feed(raw);
  const t = new OpenAiTranslator();
  const events: StreamEvent[] = [];
  for (const frame of p.drainFrames()) events.push(...t.translatePayload(frame));
  return { events, translator: t };
}

/** 事件序列形状：start → block_start → deltas → block_stop → message_stop → done */
function assertSeqShape(events: StreamEvent[], label: string): void {
  const types = events.map(e => e.type);
  assert(types[0] === 'message_start', `${label}: 首事件应 message_start，实得 ${types[0]}`);
  assert(types[1] === 'content_block_start', `${label}: 次事件应 content_block_start`);
  assert(events[1].index === 0 && events[1].blockType === 'text', `${label}: text 块恒 index=0`);
  const last3 = types.slice(-3).join(',');
  assert(last3 === 'content_block_stop,message_stop,done', `${label}: 尾部应 stop→message_stop→done，实得 ${last3}`);
  const deltas = events.filter(e => e.type === 'content_block_delta');
  assert(deltas.length > 2 && deltas.every(d => d.index === 0), `${label}: delta 应全部落 index=0（同块混排）`);
  const firstText = deltas.findIndex(d => d.deltaType === 'text_delta');
  const lastThinking = deltas.map(d => d.deltaType).lastIndexOf('thinking_delta');
  assert(firstText > lastThinking && lastThinking >= 0, `${label}: thinking_delta 应全部先于 text_delta`);
}

function mergeDeltas(events: StreamEvent[], deltaType: string): string {
  return events
    .filter(e => e.type === 'content_block_delta' && e.deltaType === deltaType)
    .map(e => e.deltaText || '')
    .join('');
}

group('ai-translator（A2：双 upstream fixture → 九事件序列）');

test('A2 Kimi 真流：事件形状 + thinking/text 分流 + delta 归并', () => {
  const { events, translator } = translateFixture('upstream-kimi-k2.7-highspeed-20260830.sse');
  assertSeqShape(events, 'kimi');
  assert(mergeDeltas(events, 'thinking_delta') === KIMI_THINKING, 'kimi thinking 归并应与实录一致');
  assert(mergeDeltas(events, 'text_delta') === 'PONG', 'kimi 正文归并应为 PONG');
  assert(translator.usage !== null && translator.usage.promptTokens === 15
    && translator.usage.completionTokens === 43, 'kimi usage 应记账（15/43）');
  assert(!events.some(e => JSON.stringify(e).includes('prompt_tokens')), 'usage 不许进事件流');
});

test('A2 GLM 真流（第二路方言互证）：role 每帧重复不产生多余事件', () => {
  const { events, translator } = translateFixture('upstream-glm-5.3-flash-20260830.sse');
  assertSeqShape(events, 'glm');
  assert(mergeDeltas(events, 'thinking_delta') === GLM_THINKING, 'glm thinking 归并应与实录一致');
  assert(mergeDeltas(events, 'text_delta') === 'PONG', 'glm 正文归并应为 PONG');
  assert(translator.usage !== null && translator.usage.promptTokens === 20
    && translator.usage.completionTokens === 41, 'glm usage 应记账（20/41）');
  assert(events.filter(e => e.type === 'message_start').length === 1, 'role 每帧重复不应重复 message_start');
});

group('ai-translator（A3：reasoning 归位 R3，显示层规则）');

test('A3 正常流：reducer 数据 text/reasoning 分字段存，displayBody 不归位', () => {
  const { events } = translateFixture('upstream-kimi-k2.7-highspeed-20260830.sse');
  const messages = reduceEvents(events);
  assert(messages.length === 1 && messages[0].role === 'ai', '应归约为单条 ai 消息');
  const block = messages[0].content[0] as TextBlock;
  assert(block.type === 'text' && block.text === 'PONG', '正文应在 text 字段');
  assert(block.reasoning === KIMI_THINKING, '思考链应在 reasoning 字段（数据不动）');
  const d = displayBody(block);
  assert(d.text === 'PONG' && d.relocated === false, 'text 非空 → 正文显示 text，不归位');
});

test('A3 纯思考残流：text 空且 reasoning 非空 → 显示层归位为正文（数据层不动）', () => {
  const t = new OpenAiTranslator();
  const events: StreamEvent[] = [];
  events.push(...t.translatePayload('{"choices":[{"delta":{"reasoning_content":"只想不说"}}]}'));
  events.push(...t.translatePayload('{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}'));
  events.push(...t.translatePayload('[DONE]'));
  const messages = reduceEvents(events);
  const block = messages[0].content[0] as TextBlock;
  assert(block.text === '' && block.reasoning === '只想不说', 'reducer 数据层：text 空 reasoning 存（归位不许改数据）');
  const d = displayBody(block);
  assert(d.relocated === true && d.text === '只想不说', '显示层：reasoning 应归位为正文');
});

group('ai-translator（A4：方言容忍）');

test('A4 空 delta:{} / choices:[] usage 帧 / system_fingerprint 有无 / 未知字段 → 零事件不炸', () => {
  const t = new OpenAiTranslator();
  const silent = [
    '{"choices":[{"delta":{}}],"system_fingerprint":"fp"}',          // 空 delta
    '{"choices":[],"usage":{"prompt_tokens":9,"completion_tokens":9,"total_tokens":18}}', // Kimi 方言 usage-only
    '{"choices":[{"delta":{"role":"assistant"}}]}',                  // role-only
    '{"choices":[{"delta":{"role":"assistant","content":""}}]}',     // 空 content
    '{"id":"x","unknown_field":{"nested":[1,2]},"choices":[{"delta":{}}]}', // 未知字段
  ];
  for (const payload of silent) {
    assert(t.translatePayload(payload).length === 0, `静默帧应零事件: ${payload}`);
  }
  assert(t.usage !== null && t.usage.promptTokens === 9, 'choices:[] usage 帧应记账');
});

test('A4 流内错误块（chunk.error / type:error，无 choices）→ error 事件，不许静默结束', () => {
  const t = new OpenAiTranslator();
  const e1 = t.translatePayload('{"error":{"message":"配额耗尽","type":"rate_limit"}}');
  assert(e1.length === 1 && e1[0].type === 'error' && (e1[0].content || '').includes('配额耗尽'),
    'chunk.error 应出 error 事件人话');
  const e2 = t.translatePayload('{"type":"error","message":"内部错误"}');
  assert(e2.length === 1 && e2[0].type === 'error' && (e2[0].content || '').includes('内部错误'),
    'type:error 块应出 error 事件人话');
});

test('A4 坏 JSON 帧 → error 事件入流（不例外不静默）；delta.tool_calls 期 0 容忍不炸', () => {
  const t = new OpenAiTranslator();
  const bad = t.translatePayload('{"choices":[{"delta":');
  assert(bad.length === 1 && bad[0].type === 'error', '坏 JSON 帧应出 error 事件');
  const tc = t.translatePayload('{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"bash","arguments":"{}"}}]}}]}');
  assert(tc.every(e => e.type !== 'error'), 'tool_calls 碎片应容忍忽略，不许炸');
});

group('ai-translator（A5：上游 HTTP 错误语义，双路 401 实录）');

test('A5 双路 401 异形错误体 → 统一取 error.message 人话', () => {
  const txt = readFileSync(new URL('./fixtures/ai-chat/upstream-error-cases-20260830.txt', import.meta.url), 'utf-8');
  const bodies = txt.split('\n').filter(l => l.startsWith('{'));
  assert(bodies.length === 2, '实录应含两条 401 错误体');
  const kimi = errorEventFromHttp(401, bodies[0]); // {error:{message,type}}
  assert(kimi.type === 'error' && kimi.content === 'API 请求失败: 401 — The API Key appears to be invalid or may have expired. Please verify your credentials and try again.',
    `Kimi 401 应取 message，实得: ${kimi.content}`);
  const glm = errorEventFromHttp(401, bodies[1]); // {error:{code:"401",message}}（code 是字符串）
  assert(glm.type === 'error' && glm.content === 'API 请求失败: 401 — 令牌已过期或验证不正确',
    `智谱 401 应取 message，实得: ${glm.content}`);
});

test('A5 非 JSON 巨型错误体 → 原样截断 300 字；空错误体 → 只报状态码', () => {
  const big = '<html>' + 'x'.repeat(500) + '</html>';
  const e = errorEventFromHttp(500, big);
  const detail = (e.content || '').replace('API 请求失败: 500 — ', '');
  assert([...detail].length === 300, `截断应为 300 字，实得 ${[...detail].length}`);
  assert((e.content || '').startsWith('API 请求失败: 500 — <html>'), '截断保留头部');
  const empty = errorEventFromHttp(502, '');
  assert(empty.content === 'API 请求失败: 502', `空错误体只报状态码，实得: ${empty.content}`);
  // 多字节字符截断按字符不按字节（na chars().take(300) 同语义）
  const cjk = '汉'.repeat(400);
  const e2 = errorEventFromHttp(500, cjk);
  assert([...(e2.content || '').split('— ')[1]].length === 300, 'CJK 截断应按字符计');
});
