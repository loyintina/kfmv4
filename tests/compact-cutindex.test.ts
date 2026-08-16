import { strict as assert } from 'assert';
import { pickCompactCutIndex } from '../src/server/routes/files.js';
import { parseSessionItem } from '../src/client/modules/session-client.js';
import { regression, group } from './harness.js';

group('compactCutIndex 全链透传（BAR-COMPACT-L4-01g）');

// 契约：会话的 L4 裁剪边界（compactCutIndex）必须从真相源（会话文件 compacts 数组）
// 全链透传到客户端 Session 对象——doSend 靠它让 L4 裁剪真正生效。
// 曾 bug：window.__kfmLastCompact 只有读取点没有赋值点（L4 裁剪从未生效，
// 真实请求载荷 297k tokens 超 256k 模型上限）——改走接口透传。
regression('BAR-COMPACT-L4-01g', 'files', 'pickCompactCutIndex：取最后一条 compact 的 cutIndex', () => {
  // 正常：有 compacts，取最后一条
  assert.strictEqual(
    pickCompactCutIndex({ compacts: [{ cutIndex: 100 }, { cutIndex: 200 }] }), 200,
    '应取最后一条 compact 的 cutIndex');
  // 单条
  assert.strictEqual(pickCompactCutIndex({ compacts: [{ cutIndex: 1042 }] }), 1042);
  // 空数组 → undefined
  assert.strictEqual(pickCompactCutIndex({ compacts: [] }), undefined);
  // 无字段 → undefined
  assert.strictEqual(pickCompactCutIndex({}), undefined);
  // compacts 非数组 → undefined
  assert.strictEqual(pickCompactCutIndex({ compacts: 'bad' }), undefined);
  // 最后一条缺 cutIndex → undefined
  assert.strictEqual(pickCompactCutIndex({ compacts: [{ summary: 'x' }] }), undefined);
});

regression('BAR-COMPACT-L4-01g', 'session-client', 'parseSessionItem：compactCutIndex 透传', () => {
  const s = parseSessionItem({ id: 'x', title: 't', compactCutIndex: 1042 });
  assert.strictEqual(s!.compactCutIndex, 1042, 'compactCutIndex 应透传进 Session');
  // 无字段时不注入
  const s2 = parseSessionItem({ id: 'y', title: 't2', tokenCount: 100 });
  assert.strictEqual(s2!.compactCutIndex, undefined, '无字段时不应注入');
  // 非 number 不透传
  const s3 = parseSessionItem({ id: 'z', title: 't3', compactCutIndex: '1042' });
  assert.strictEqual(s3!.compactCutIndex, undefined, '非 number 不透传');
});
