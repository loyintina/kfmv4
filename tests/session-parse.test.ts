import { strict as assert } from 'assert';
import { parseSessionItem } from '../src/client/modules/session-client.js';
import { regression, group } from './harness.js';

group('session-client parseSessionItem compactToken 透传（BAR-COMPACT-L4-01e）');

// 契约：客户端解析 sessions/list 响应时，compactToken 必须透传进 Session 对象。
// 曾 bug：sessions/list 接口已透传 compactToken（BAR-COMPACT-L4-01d 修复），但客户端
// 解析层只处理 fullTokenCount 没处理 compactToken → 会话卡三数字 b 拿不到 → 显示双数字。
regression('BAR-COMPACT-L4-01e', 'session-client', 'parseSessionItem：有 compactToken 透传、无则省略、非法 id 返回 null', () => {
  // 有 compactToken（茉莉的测试压缩后形态）
  const withC = parseSessionItem({ id: '茉莉的测试', title: 't', compactToken: 339, tokenCount: 84760, fullTokenCount: 915404 });
  assert.ok(withC, '应解析成功');
  assert.strictEqual(withC!.compactToken, 339, 'compactToken 应透传');
  assert.strictEqual(withC!.tokenCount, 84760, 'tokenCount 应透传');
  assert.strictEqual(withC!.fullTokenCount, 915404, 'fullTokenCount 应透传');

  // 无 compactToken（未压缩旧会话）——不注入字段
  const withoutC = parseSessionItem({ id: '旧会话', title: 't2', tokenCount: 5227 });
  assert.ok(withoutC, '应解析成功');
  assert.strictEqual(withoutC!.compactToken, undefined, '无 compactToken 时不应注入字段');
  assert.strictEqual(withoutC!.tokenCount, 5227, 'tokenCount 应透传');

  // compactToken 非数字——不注入
  const badType = parseSessionItem({ id: 'x', title: 't3', compactToken: '339' });
  assert.strictEqual(badType!.compactToken, undefined, 'compactToken 非 number 时不应透传');

  // 非法 id/title——返回 null
  assert.strictEqual(parseSessionItem({ id: 123, title: 't' }), null, 'id 非 string 返回 null');
  assert.strictEqual(parseSessionItem({ id: 'x', title: 456 }), null, 'title 非 string 返回 null');
  assert.strictEqual(parseSessionItem({}), null, '空对象返回 null');
});
