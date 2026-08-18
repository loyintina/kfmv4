/**
 * compact-core computeCutIndex 回归（2026-08-18 用户定稿：压缩工具 + 90% 自动 + 溢出恢复）
 *
 * 钉的契约：最近 12 个完整用户回合之外即压缩区（第 12 个 user 消息处开切）；
 * 不足 12 轮返回 0（无需压缩）。
 */
import { strict as assert } from 'assert';
import { regression, group } from './harness.js';
import { computeCutIndex } from '../src/server/ai/compact-core.js';

group('compact-core — computeCutIndex 切点（BAR-COMPACT-AUTO-01）');

function mkSeq(userRounds: number): Array<{ role: string }> {
  const msgs: Array<{ role: string }> = [];
  for (let i = 0; i < userRounds; i++) {
    msgs.push({ role: 'user' }, { role: 'ai' }, { role: 'ai' }); // 每轮 1 user + 2 ai（工具轮）
  }
  return msgs;
}

regression('BAR-COMPACT-AUTO-01', 'compact-core', 'computeCutIndex 不足 12 轮返回 0', () => {
  assert(computeCutIndex(mkSeq(11)) === 0, '11 轮 → 0');
  assert(computeCutIndex(mkSeq(0)) === 0, '0 轮 → 0');
  assert(computeCutIndex([]) === 0, '空 → 0');
});

regression('BAR-COMPACT-AUTO-01', 'compact-core', 'computeCutIndex 第 12 个 user 处开切', () => {
  const msgs = mkSeq(13); // 13 轮，每条 3 消息
  const cut = computeCutIndex(msgs);
  // 从后数第 12 个 user = 正数第 2 轮的第一个 user（索引 3）
  assert(cut === 3, `13 轮切点应为 3，实际 ${cut}`);
  assert(msgs[cut].role === 'user', '切点必须是 user 消息');
});

regression('BAR-COMPACT-AUTO-01', 'compact-core', 'computeCutIndex 恰好 12 轮在第一个 user 处切', () => {
  const msgs = mkSeq(12);
  const cut = computeCutIndex(msgs);
  assert(cut === 0, `12 轮切点应为 0（全压缩），实际 ${cut}`);
});
