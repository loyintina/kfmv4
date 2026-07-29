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

test('G1 豁免期外的旧工具结果被压缩，compactSaved > 0', () => {
  const msgs = [
    user('开始'),
    aiTool('r1', 'read', { path: '/a.ts' }, chars(1000)), // mi=1 < 豁免线 → 应被压
    aiTool('r2', 'read', { path: '/b.ts' }, chars(1000)), // mi=2 = 豁免线（倒数第 2 条 AI）
    aiText('收尾'),
  ];
  const { apiMessages, compactSaved } = toOpenAiMessages(msgs, { compact: true });
  const firstTool = apiMessages.find(m => m.role === 'tool' && m.tool_call_id === 'r1')!;
  const secondTool = apiMessages.find(m => m.role === 'tool' && m.tool_call_id === 'r2')!;
  assert(firstTool.content!.length < 1000, '旧 read 结果应被压缩');
  assert.strictEqual(secondTool.content!.length, 1000, 'G1 豁免期内的结果一个字不动');
  assert(compactSaved > 0, '应统计出省下的字符');
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

// ========== 源码钉：两处调用点不许再手写转换 ==========

group('BAR-ORB-RESUME-01 — 载荷构造唯一入口');

regression('BAR-ORB-RESUME-01', 'orb/orb-chat-run', '载荷构造唯一入口 toOpenAiMessages，禁止第三份手写转换', () => {
  const run = readFileSync('src/client/modules/orb-chat-run.ts', 'utf-8');
  const orb = readFileSync('src/client/modules/orb.ts', 'utf-8');
  assert(run.includes("from '../../shared/chat-protocol/to-openai-messages.js'"),
    'doSend 必须走共享构造函数');
  assert(orb.includes('toOpenAiMessages(chatMessages'),
    'tryAutoResume 必须走共享构造函数（冷恢复曾无压缩/不过滤空壳 → kimi 400）');
  assert(!orb.includes('mainText'), 'orb.ts 不得残留手写转换逻辑');
  assert(!run.includes('mainText'), 'orb-chat-run.ts 不得残留手写转换逻辑');
});
