import { strict as assert } from 'assert';
import { toOpenAiMessages } from '../src/shared/chat-protocol/to-openai-messages.js';
import { regression, group } from './harness.js';

group('reasoning L2 剥离 — 远期不上行/近期保留（BAR-REASONING-L2-01）');

// 会话文件格式：ai + content[text块(带reasoning), tool块...]
// 投影：带 tool 块 → assistant+tool_calls+reasoning_content；纯文本 → 仅 content
// 真实分布（茉莉的测试会话实测）：reasoning 87 万字符，几乎全在带 tool 的消息里
function makeFarMsgs(nRounds = 10): any[] {
  const msgs: any[] = [];
  for (let i = 1; i <= nRounds; i++) {
    msgs.push({ role: 'user', content: [{ type: 'text', text: `q${i}` }], ts: 1_700_000_000_000 + i * 60_000 });
    msgs.push({
      role: 'ai',
      content: [
        { type: 'text', text: `想 ${i}`, reasoning: `思考过程${i}` },
        { type: 'tool', id: `t${i}`, name: 'bash', input: { command: `ls ${i}` }, result: { content: [{ type: 'text', text: 'ok' }], isError: false } },
      ],
    });
  }
  return msgs;
}

regression('BAR-REASONING-L2-01', 'chat-protocol', '远期(>8轮)带tools的 reasoning_content 剥离：不上行（L2 核心）', () => {
  const { apiMessages } = toOpenAiMessages(makeFarMsgs(10), { compact: true });
  const first = apiMessages.find(m => m.role === 'assistant' && (m as any).tool_calls && (m as any).content === '想 1');
  assert.ok(first, '远期带 tools 的 assistant 应在载荷');
  assert.strictEqual((first as any).reasoning_content, undefined, '远期 reasoning_content 应被剥离（载荷大头）');
});

regression('BAR-REASONING-L2-01', 'chat-protocol', '近期(≤8轮)带tools的 reasoning_content 保留：上行（工作记忆）', () => {
  const { apiMessages } = toOpenAiMessages(makeFarMsgs(10), { compact: true });
  const last = apiMessages.find(m => m.role === 'assistant' && (m as any).tool_calls && (m as any).content === '想 10');
  assert.ok(last, '近期带 tools 的 assistant 应在载荷');
  assert.strictEqual((last as any).reasoning_content, '思考过程10', '近期 reasoning_content 应保留');
});

regression('BAR-REASONING-L2-01', 'chat-protocol', '纯文本 reasoning 从不上行（既有设计回归钉：投影只取 text）', () => {
  const msgs: any[] = [
    { role: 'user', content: [{ type: 'text', text: 'q1' }], ts: 1 },
    { role: 'ai', content: [{ type: 'text', text: '纯回复', reasoning: '我不上行' }] },
    { role: 'user', content: [{ type: 'text', text: 'q2' }], ts: 2 },
  ];
  const { apiMessages } = toOpenAiMessages(msgs, { compact: false }); // 近期（不压）也不上行
  const ai = apiMessages.find(m => m.role === 'assistant' && m.content === '纯回复');
  assert.ok(ai, '纯文本 assistant 应在载荷');
  assert.strictEqual((ai as any).reasoning_content, undefined, '纯文本 reasoning 不上行（deepseek 官方：无工具时传了也被忽略）');
});
