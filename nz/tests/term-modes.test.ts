/**
 * tests/term-modes.test.ts — 终端模式位记账 A 档考题（2026-09-13 滚轮
 * 手感案：核重建只吃屏面字节不吃模式序列，鼠标位一丢壳就不再翻译
 * 触摸=滚轮浏览死亡且随机复活。修=服务端逐管道记账+重建后回放。）
 *
 * 三枚钉：
 *   ①h/l 翻转：DECSET 记账、DECRESET 摘账，未知模式（?9999h）忽略；
 *   ②跨 chunk 劈开：?1000h 被切成两半仍要记账（carry 首尾拼接）；
 *   ③序列化：升序、只含活跃位、DECSET h 串形态（可直接喂核）。
 *
 * 变异靶子：scanModes 删 carry 拼接 → 钉②红；serializeModes 降序/漏位 → 钉③红。
 */
import { test, group, assert } from './runner.ts';
import { scanModes, serializeModes } from '../src/server/term-connection.ts';

group('term-modes（终端模式位记账）');

test('①h/l 翻转记账+未跟踪模式忽略', () => {
  const active = new Set<number>();
  const carry = { s: '' };
  scanModes(active, carry, '\x1b[?1006h\x1b[?1000h');
  assert(active.has(1006) && active.has(1000), 'h 记账: ' + [...active].join(','));
  scanModes(active, carry, '\x1b[?1000l');
  assert(active.has(1006) && !active.has(1000), 'l 摘账: ' + [...active].join(','));
  scanModes(active, carry, '\x1b[?9999h\x1b[?1049h');
  assert(!active.has(9999) && active.has(1049), '未跟踪忽略+1049 记账: ' + [...active].join(','));
});

test('②序列跨 chunk 劈开仍记账', () => {
  const active = new Set<number>();
  const carry = { s: '' };
  scanModes(active, carry, 'hello\x1b[?10');
  assert(!active.has(1000), '半截序列不误记');
  scanModes(active, carry, '00h world');
  assert(active.has(1000), '拼接后记账: ' + [...active].join(','));
});

test('③序列化：升序+只含活跃位+DECSET h 串', () => {
  const active = new Set<number>([1006, 1000, 1049]);
  const s = serializeModes(active);
  assert(s === '\x1b[?1000h\x1b[?1006h\x1b[?1049h', '升序 h 串: ' + JSON.stringify(s));
  const empty = serializeModes(new Set());
  assert(empty === '', '空账=空串');
});
