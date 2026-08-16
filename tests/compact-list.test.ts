import { strict as assert } from 'assert';
import { pickSessionCompactToken } from '../src/server/routes/files.js';
import { regression, group } from './harness.js';

group('sessions/list compactToken 透传（BAR-COMPACT-L4-01d）');

// 契约：会话卡三数字的 b（摘要 token）必须从 sessions/list 接口透传到客户端。
// 曾 bug：_computeStats 已写 compactToken 进会话文件，但 sessions/list 接口
// 没读顶层 compactToken 字段 → 客户端拿不到 b → 会话卡显示不到三数字。
regression('BAR-COMPACT-L4-01d', 'session-store', 'pickSessionCompactToken：有 compactToken 返回数值、无则 undefined（旧会话向后兼容）', () => {
  // 有 compactToken（茉莉的测试压缩后形态）
  const withC = pickSessionCompactToken({ compactToken: 339, tokenCount: 84760 });
  assert.strictEqual(withC, 339, '有 compactToken 时应返回数值');
  // 无 compactToken（未压缩的旧会话）
  const withoutC = pickSessionCompactToken({ tokenCount: 5227 });
  assert.strictEqual(withoutC, undefined, '无 compactToken 时应返回 undefined（不注入字段）');
  // 非数字（脏数据防御）
  const badType = pickSessionCompactToken({ compactToken: '339' });
  assert.strictEqual(badType, undefined, 'compactToken 非 number 时不应透传');
  // 空对象
  assert.strictEqual(pickSessionCompactToken({}), undefined, '空对象返回 undefined');
});
