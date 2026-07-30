// ==========================================================================
// tests/to-openai-messages.test.ts — OpenAI 载荷唯一构造函数（BAR-ORB-RESUME-01）
//
// 背景：tryAutoResume 曾在 orb.ts 内联复制 doSend 的格式转换简化版——无压缩、
// 不过滤空壳、塞 content:null，严格端点（kimi）400「assistant must not be empty」。
// 修复：载荷构造收编 src/shared/chat-protocol/to-openai-messages.ts 唯一入口，
// doSend 与 tryAutoResume 同投影。本文件钉住函数行为 + 两处调用点不许再手写。
// ==========================================================================

import assert from 'assert';
import { readFileSync } from 'fs';
import { group, test, regression } from './runner.js';
import { toOpenAiMessages } from '../src/shared/chat-protocol/to-openai-messages.js';
import { todoResultAnnotation, failRepeatAnnotation, FAIL_REPEAT_MIN } from '../src/shared/tool-compaction/index.js';
import type { ChatMessage, ToolBlock } from '../src/shared/chat-protocol/messages.js';

// ========== 构造帮手 ==========

const user = (text: string): ChatMessage => ({ role: 'user', content: [{ type: 'text', text }] });
const aiText = (text: string): ChatMessage => ({ role: 'ai', content: [{ type: 'text', text }] });
const aiEmpty = (): ChatMessage => ({ role: 'ai', content: [{ type: 'text', text: '', reasoning: '想了很多但没正文' }] });
const aiTool = (id: string, name: string, input: Record<string, unknown>, resultText: string, isError = false): ChatMessage => ({
  role: 'ai',
  content: [{
    type: 'tool', id, name, input,
    result: { content: [{ type: 'text', text: resultText }], isError },
  } satisfies ToolBlock],
});
const chars = (n: number): string => 'x'.repeat(n);

// ========== 严格端点形态（BAR-PROVIDER-02 同款病灶） ==========

group('载荷唯一构造函数 — 严格端点形态');

test('空壳 assistant（零正文零工具）不进载荷', () => {
  const { apiMessages } = toOpenAiMessages([user('问'), aiEmpty(), aiText('答')], { compact: true });
  assert.strictEqual(apiMessages.length, 2, '空壳应被过滤，只剩 user + 真 assistant');
  assert.strictEqual(apiMessages[1]!.content, '答');
});

test('带工具的 assistant 允许 content:null 且必有 tool_calls；tool 消息成对', () => {
  const { apiMessages } = toOpenAiMessages([user('问'), aiTool('t1', 'read', { path: '/a' }, '内容')], { compact: true });
  const assistant = apiMessages.find(m => m.role === 'assistant')!;
  const tool = apiMessages.find(m => m.role === 'tool')!;
  assert.strictEqual(assistant.content, null, '无正文的工具调用 assistant content 为 null（合法）');
  assert(assistant.tool_calls && assistant.tool_calls.length === 1, 'null content 必须带 tool_calls');
  assert.strictEqual(tool.tool_call_id, assistant.tool_calls![0]!.id, 'tool_calls/tool 必须按 id 配对');
});

test('不变量：任何 assistant 要么非空字符串、要么带 tool_calls（kimi 严格端点）', () => {
  const msgs = [user('a'), aiEmpty(), aiTool('t1', 'bash', { command: 'ls' }, 'ok'), aiEmpty(), aiText('b')];
  const { apiMessages } = toOpenAiMessages(msgs, { compact: true });
  for (const m of apiMessages) {
    if (m.role !== 'assistant') continue;
    const ok = (typeof m.content === 'string' && m.content.length > 0) || (m.tool_calls && m.tool_calls.length > 0);
    assert(ok, `非法空 assistant: ${JSON.stringify(m)}`);
  }
});

// ========== 压缩投影（tryAutoResume 曾缺失） ==========

group('载荷唯一构造函数 — 压缩投影');

test('G1（用户回合口径）：最近 8 轮用户回合豁免，之外的旧工具结果被压缩', () => {
  // 豁免单位是用户回合（EXEMPT_USER_ROUNDS=8）而非 AI 消息数——
  // 一轮多工具调用产生多条 AI 消息，按 AI 消息计数会让跨回合证据 1~2 轮蒸发。
  const msgs: ChatMessage[] = [user('第1轮'), aiTool('r1', 'read', { path: '/a.ts' }, chars(1000))]; // 第1轮，豁免线外 → 应被压
  for (let i = 2; i <= 9; i++) msgs.push(user(`第${i}轮`), aiText(`答${i}`));
  msgs.push(aiTool('r2', 'read', { path: '/b.ts' }, chars(1000))); // 第9轮内 → 豁免
  const { apiMessages, compactSaved } = toOpenAiMessages(msgs, { compact: true });
  const firstTool = apiMessages.find(m => m.role === 'tool' && m.tool_call_id === 'r1')!;
  const secondTool = apiMessages.find(m => m.role === 'tool' && m.tool_call_id === 'r2')!;
  assert(firstTool.content!.length < 1000, '豁免线外的旧 read 结果应被压缩');
  assert.strictEqual(secondTool.content!.length, 1000, 'G1 豁免期内的结果一个字不动');
  assert(compactSaved > 0, '应统计出省下的字符');
});

test('G1 用户回合口径：一轮内 5 次工具调用全部豁免（多工具回合证据不蒸发）', () => {
  const msgs: ChatMessage[] = [user('开始')];
  for (let i = 0; i < 5; i++) msgs.push(aiTool(`t${i}`, 'read', { path: `/${i}.ts` }, chars(1000)));
  msgs.push(aiText('收尾'));
  const { apiMessages } = toOpenAiMessages(msgs, { compact: true });
  for (const m of apiMessages.filter(x => x.role === 'tool')) {
    assert.strictEqual(m.content!.length, 1000, '同一用户回合的所有工具结果必须全量保留');
  }
});

test('时间戳前缀：有 ts 的消息渲染 [ts MM-DD HH:MM:SS]，无 ts 不渲染（向后兼容）', () => {
  const { apiMessages } = toOpenAiMessages([
    { role: 'user', content: [{ type: 'text', text: '老消息' }] },
    { role: 'user', content: [{ type: 'text', text: '新消息' }], ts: '2026-07-30T12:05:00.000Z' },
    aiText('答复'),
  ], { compact: true });
  assert.strictEqual(apiMessages[0]!.content, '老消息', '无 ts 一个字不动');
  assert(/^\[ts \d{2}-\d{2} \d{2}:\d{2}:\d{2}\] 新消息$/.test(String(apiMessages[1]!.content)),
    `有 ts 应带秒级 ts 标签前缀，得 ${apiMessages[1]!.content}`);
  assert.strictEqual(apiMessages[2]!.content, '答复', '无 ts 的 AI 消息不带前缀');
});

test('ts 前缀只盖 user 侧：带 ts 的 assistant 消息一律不渲染前缀（BAR-TS-MIMIC-01）', () => {
  const { apiMessages } = toOpenAiMessages([
    { role: 'user', content: [{ type: 'text', text: '问' }], ts: '2026-07-30T12:05:00.000Z' },
    { role: 'assistant', content: [{ type: 'text', text: '答' }], ts: '2026-07-30T12:05:05.000Z' },
  ], { compact: true });
  assert.strictEqual(apiMessages[1]!.content, '答',
    `assistant 侧盖前缀 = AI 学成行文格式复读，得 ${apiMessages[1]!.content}`);
});

test('客户端产物占位符不进载荷：[错误:…]/[未收到回复] 过滤，[已取消] 保留', () => {
  const { apiMessages } = toOpenAiMessages([
    user('问1'), aiText('[错误: API 请求失败: 400 — {"error":{"message":"x"}}]'),
    user('问2'), aiText('[未收到回复，请重试]'),
    user('问3'), aiText('[已取消]'),
    user('问4'), aiText('正文\n\n[错误: 混在正文后的错误保留]'),
  ], { compact: true });
  const texts = apiMessages.map(m => m.content);
  assert(!texts.some(c => String(c).includes('API 请求失败')), '纯错误占位符应被过滤');
  assert(!texts.some(c => String(c).includes('未收到回复')), '空响应占位符应被过滤');
  assert(texts.some(c => c === '[已取消]'), '[已取消] 是用户信号，必须保留');
  assert(texts.some(c => String(c).startsWith('正文')), '混有真实正文的不过滤');
});

test('逃生门 compact:false 全量保留、不压缩', () => {
  const msgs = [user('开始'), aiTool('r1', 'read', { path: '/a.ts' }, chars(1000)), aiText('x'), aiText('y')];
  const { apiMessages, compactSaved } = toOpenAiMessages(msgs, { compact: false });
  const tool = apiMessages.find(m => m.role === 'tool')!;
  assert.strictEqual(tool.content!.length, 1000, '逃生门必须发全量');
  assert.strictEqual(compactSaved, 0);
});

test('G4：最新 todo 结果豁免压缩且 dismiss 标注附加', () => {
  const resultText = 'todo 列表原文';
  const msgs = [
    user('开始'),
    aiTool('td1', 'todo', { todos: [{ content: '做事', status: 'pending' }] }, resultText),
    aiText('好'),
  ];
  const { apiMessages } = toOpenAiMessages(msgs, { compact: true, isTodoDismissed: () => true });
  const tool = apiMessages.find(m => m.role === 'tool')!;
  assert.strictEqual(tool.content, resultText + todoResultAnnotation({ dismissed: true, aiRoundsAfter: 1 }),
    '原文不动 + dismiss 标注逐字符相等');
});

test('失败模式重复标注：同错误第 N 次附加 failRepeatAnnotation', () => {
  const msgs: ChatMessage[] = [user('开始')];
  for (let i = 0; i < FAIL_REPEAT_MIN; i++) {
    msgs.push(aiTool(`f${i}`, 'read', { path: '/x' }, 'ENOENT: no such file or directory', true));
  }
  msgs.push(aiText('收尾'));
  const { apiMessages } = toOpenAiMessages(msgs, { compact: true });
  const last = apiMessages.filter(m => m.role === 'tool').pop()!;
  assert(last.content!.endsWith(failRepeatAnnotation(FAIL_REPEAT_MIN)),
    '第 N 次同错误应带重复标注');
});

// ========== 投影文本不得回写真相源（ts 泄漏病灶） ==========

group('投影/存储分离 — 落盘必须走原文通道');

regression('BAR-CHAT-TS-01', 'ai/routes', '落盘用户消息用 userText 原文，不用投影文本（前缀叠加污染）', () => {
  const routes = readFileSync('src/server/ai/routes.ts', 'utf-8');
  const run = readFileSync('src/client/modules/orb-chat-run.ts', 'utf-8');
  assert(routes.includes('userText'), '服务端必须接收并使用 userText 原文落盘');
  assert(run.includes('userText: text'), '客户端必须发送未投影的用户原文');
  // 病灶回顾：投影给 user 文本加 [MM-DD HH:MM] 前缀后，服务端从 apiMessages
  // 提取文本落盘 → 会话文件长出前缀，下轮投影再盖一层，真相源被投影污染。
});

group('BAR-ORB-RESUME-01 — 载荷构造唯一入口');

regression('BAR-ORB-RESUME-01', 'orb-chat-host/orb-chat-run', '载荷构造唯一入口 toOpenAiMessages，禁止第三份手写转换', () => {
  const run = readFileSync('src/client/modules/orb-chat-run.ts', 'utf-8');
  const orb = readFileSync('src/client/modules/orb-chat-host.ts', 'utf-8');
  assert(run.includes("from '../../shared/chat-protocol/to-openai-messages.js'"),
    'doSend 必须走共享构造函数');
  assert(orb.includes('toOpenAiMessages(chatMessages'),
    'tryAutoResume 必须走共享构造函数（冷恢复曾无压缩/不过滤空壳 → kimi 400）');
  assert(!orb.includes('mainText'), 'orb-chat-host.ts 不得残留手写转换逻辑');
  assert(!run.includes('mainText'), 'orb-chat-run.ts 不得残留手写转换逻辑');
});
