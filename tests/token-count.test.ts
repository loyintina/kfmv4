import { strict as assert } from 'assert';
import { _computeStats } from '../src/server/ai/session-store.js';
import { regression, group } from './harness.js';

group('tokenCount 口径 — 含 reasoning_content（真实 API 载荷参考，BAR-REASONING-L2-01 配套）');

// 差分断言：两组消息只差 reasoning 有无，tokenCount 差值必须反映 reasoning 长度。
// 用差分而非绝对复算——免疫 ts 前缀/tool_calls 序列化等无关细节的耦合。
function makeMsgs(withReasoning: boolean): any[] {
  return [
    { role: 'user', content: [{ type: 'text', text: 'q1' }], ts: 1 },
    {
      role: 'ai',
      content: [
        { type: 'text', text: '', reasoning: withReasoning ? 'R'.repeat(200) : '' },
        { type: 'tool', id: 't1', name: 'bash', input: { command: 'ls' } },
      ],
    },
    { role: 'user', content: [{ type: 'text', text: 'q2' }], ts: 2 },
  ];
}

regression('BAR-REASONING-L2-01', 'session-store', 'tokenCount 包含带 tools 的 reasoning_content（真实 API 载荷）', () => {
  const withR = _computeStats(makeMsgs(true)).tokenCount;
  const withoutR = _computeStats(makeMsgs(false)).tokenCount;
  const expectedDiff = Math.round(200 / 3);
  assert.ok(withR > withoutR, '带 reasoning 的 tokenCount 应更大');
  // 两边各自 Math.round(tc/3)，独立舍入会让差值差 ±1——放宽到 ±1（契约：差值≈reasoning/3）
  assert.ok(Math.abs((withR - withoutR) - expectedDiff) <= 1, `差值应 ≈ reasoning 200/3 = ${expectedDiff}，实测 ${withR - withoutR}`);
});

regression('BAR-REASONING-L2-01b', 'session-store', '纯文本 reasoning 不计入 tokenCount（投影层本就不上行）', () => {
  const msgs: any[] = [
    { role: 'user', content: [{ type: 'text', text: 'q1' }], ts: 1 },
    { role: 'ai', content: [{ type: 'text', text: 'hello', reasoning: 'R'.repeat(200) }] }, // 纯文本：reasoning 不上行
    { role: 'user', content: [{ type: 'text', text: 'q2' }], ts: 2 },
  ];
  const { tokenCount, fullTokenCount } = _computeStats(msgs);
  const noToolMsgs: any[] = [
    { role: 'user', content: [{ type: 'text', text: 'q1' }], ts: 1 },
    { role: 'ai', content: [{ type: 'text', text: 'hello' }] }, // 无 reasoning
    { role: 'user', content: [{ type: 'text', text: 'q2' }], ts: 2 },
  ];
  const base = _computeStats(noToolMsgs).tokenCount;
  assert.strictEqual(tokenCount, base, '纯文本 reasoning 不上行 → tokenCount 不应变');
  // fullTokenCount（真相源全量）含全部 reasoning
  const fcBase = _computeStats(noToolMsgs).fullTokenCount;
  assert.ok(fullTokenCount > fcBase, 'fullTokenCount 含纯文本 reasoning（真相源口径）');
});

// ===== L4 /compact 三数字（a/b/c）：tokenCount 反映 cutIndex + compactToken（BAR-COMPACT-L4-01 配套）=====
regression('BAR-COMPACT-L4-01c', 'session-store', '有 compact 时 tokenCount 反映 cutIndex（a 变小）+ compactToken 正确（b）', () => {
  const msgs: any[] = [
    { role: 'user', content: [{ type: 'text', text: 'Q1 远期' }], ts: 1 },
    { role: 'ai', content: [{ type: 'text', text: 'A1 远期长答案'.repeat(20) }] },
    { role: 'user', content: [{ type: 'text', text: 'Q2 近期' }], ts: 2 },
    { role: 'ai', content: [{ type: 'text', text: 'A2 近期' }] },
  ];
  const compacts = [{ cutIndex: 2, summary: 'S'.repeat(99), model: 'deepseek/deepseek-v4-flash', createdAt: '' }];
  const without = _computeStats(msgs);                    // 无 compact：全量投影
  const withC = _computeStats(msgs, compacts);            // 有 compact：跳过 cutIndex 前
  // a：tokenCount 应明显变小（远期消息被摘要代表，不再进载荷）
  assert.ok(withC.tokenCount < without.tokenCount, `compact 后 tokenCount 应变小：${without.tokenCount} → ${withC.tokenCount}`);
  // b：compactToken = summary/3（±1 舍入容差）
  const expectedB = Math.round(99 / 3);
  assert.ok(Math.abs(withC.compactToken - expectedB) <= 1, `compactToken 应 ≈ ${expectedB}，实测 ${withC.compactToken}`);
  // c：fullTokenCount 不变（真相源全量，摘要不删原文）
  assert.strictEqual(withC.fullTokenCount, without.fullTokenCount, 'fullTokenCount 不受 compact 影响（真相源不动）');
  // 无 compact 时 compactToken = 0（旧会话向后兼容）
  assert.strictEqual(without.compactToken, 0, '无 compact 时 compactToken = 0');
});
