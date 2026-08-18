/**
 * API 实测负载管道回归（2026-08-18 用户定稿：不估算，以 API 实测量精确算）
 *
 * 钉的契约：
 * 1. recordLastUsage 写入 meta.lastUsage → getLastUsage 能读回（往返）
 * 2. 无 usage 的会话 getLastUsage 返回 undefined（而不是脏数据）
 * 3. promptTokens 非数字的脏记录被拒绝（类型守卫）
 */
import { strict as assert } from 'assert';
import { regression, group } from './harness.js';
import { recordLastUsage, getLastUsage } from '../src/server/ai/session-store.js';

group('lastUsage 管道 — API 实测 token 落盘/读回（BAR-COMPACT-AUTO-01 配套）');

regression('BAR-COMPACT-AUTO-01', 'session-store', 'recordLastUsage 往返：写入后能读回', () => {
  const sid = '__test_usage_roundtrip__';
  recordLastUsage(sid, {
    promptTokens: 194532, completionTokens: 1200, totalTokens: 195732,
    model: 'k3-256k', ts: '2026-08-18T12:00:00.000Z',
  });
  const got = getLastUsage(sid);
  assert(got !== undefined, '写入后应能读回');
  assert(got.promptTokens === 194532, `promptTokens 应原样往返，得 ${got.promptTokens}`);
  assert(got.model === 'k3-256k', 'model 应原样往返');
});

regression('BAR-COMPACT-AUTO-01', 'session-store', 'getLastUsage 无记录会话返回 undefined', () => {
  const got = getLastUsage('__test_usage_never__');
  assert(got === undefined, `无记录应返回 undefined，得 ${JSON.stringify(got)}`);
});

regression('BAR-COMPACT-AUTO-01', 'session-store', 'getLastUsage 脏记录（promptTokens 非数字）被拒绝', () => {
  const sid = '__test_usage_dirty__';
  recordLastUsage(sid, { promptTokens: 'oops', completionTokens: 0, totalTokens: 0, model: 'x', ts: 't' } as never);
  const got = getLastUsage(sid);
  assert(got === undefined, `脏记录应被拒绝，得 ${JSON.stringify(got)}`);
});
