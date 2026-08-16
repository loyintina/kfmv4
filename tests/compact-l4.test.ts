import { strict as assert } from 'assert';
import { toOpenAiMessages } from '../src/shared/chat-protocol/to-openai-messages.js';
import { regression, group } from './harness.js';

group('L4 会话压缩（/compact）— 投影跳过远期 + 边界正确（BAR-COMPACT-L4-01）');

// 构造：3 条用户消息 + 各自 AI 回复（第 1 轮远期，第 2/3 轮近期）
function mkMsgs(): any[] {
  return [
    { role: 'user', content: [{ type: 'text', text: 'Q1 远期问题' }], ts: '2026-08-16T01:00:00Z' },
    { role: 'ai', content: [{ type: 'text', text: 'A1 远期答案' }] },
    { role: 'user', content: [{ type: 'text', text: 'Q2 中期问题' }], ts: '2026-08-16T02:00:00Z' },
    { role: 'ai', content: [{ type: 'text', text: 'A2 中期答案' }] },
    { role: 'user', content: [{ type: 'text', text: 'Q3 近期问题' }], ts: '2026-08-16T03:00:00Z' },
    { role: 'ai', content: [{ type: 'text', text: 'A3 近期答案' }] },
  ];
}

regression('BAR-COMPACT-L4-01', 'chat-protocol', 'compactCutIndex 跳过远期消息（投影不含 cutIndex 前的内容）', () => {
  const { apiMessages } = toOpenAiMessages(mkMsgs(), { compact: true, compactCutIndex: 2 });
  const texts = apiMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
  assert.ok(!texts.includes('Q1 远期问题'), '远期 Q1 应被跳过');
  assert.ok(!texts.includes('A1 远期答案'), '远期 A1 应被跳过');
  assert.ok(texts.includes('Q3 近期问题'), '近期 Q3 应保留');
  assert.ok(texts.includes('A3 近期答案'), '近期 A3 应保留');
});

regression('BAR-COMPACT-L4-01', 'chat-protocol', '重复 compact 时 cutIndex 前移（滚动蒸馏——第 2 次压缩覆盖更深）', () => {
  const msgs = mkMsgs();
  // 第 1 次 compact：cutIndex=2（覆盖 Q1+A1）
  const r1 = toOpenAiMessages(msgs, { compact: true, compactCutIndex: 2 });
  const t1 = r1.apiMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
  assert.ok(!t1.includes('Q1'), '第 1 次后 Q1 不进载荷');
  // 第 2 次 compact：cutIndex=4（覆盖到 Q2+A2）——滚动蒸馏场景
  const r2 = toOpenAiMessages(msgs, { compact: true, compactCutIndex: 4 });
  const t2 = r2.apiMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
  assert.ok(!t2.includes('Q2'), '第 2 次后 Q2 也不进载荷');
  assert.ok(t2.includes('Q3'), '近期 Q3 始终保留');
});

regression('BAR-COMPACT-L4-01', 'chat-protocol', '无 cutIndex 时全量投影（向后兼容——没有 compact 的会话不受影响）', () => {
  const { apiMessages } = toOpenAiMessages(mkMsgs(), { compact: true });
  const texts = apiMessages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
  assert.ok(texts.includes('Q1 远期问题'), '无 cutIndex 时全量保留');
});

regression('BAR-COMPACT-L4-01', 'chat-protocol', 'cutIndex 超出消息数时安全降级（不越界）', () => {
  const { apiMessages } = toOpenAiMessages(mkMsgs(), { compact: true, compactCutIndex: 999 });
  // l4From = min(999, 6) = 6 → 无消息（空载荷），不抛错
  assert.ok(apiMessages.length === 0 || apiMessages.every(m => !m.content), '越界时安全降级为空/无内容');
});
