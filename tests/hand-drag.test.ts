// BAR-HAND-DRAG-01：用户拖动「手」的命中测试（handHitTest）
// 2026-08-13 用户定稿：手不只 AI 能动，用户也能拖动它，松手 1.5s 后回归。
// 命中测试是「用户拖动接管」的门槛——指针落在核附近（半径 48px）才接管。
// 注意：harness 的 group(name) 只接收字符串（设置当前组名），不能包回调；
//       test 必须平铺注册（2026-08-13 事故：回调写法导致 4 个测试全未注册）。
import { test, group } from './runner.js';
import { handHitTest } from '../src/client/modules/hand-geometry.js';

group('hand 用户拖动命中测试（BAR-HAND-DRAG-01）');

test('落在核附近（<48px）→ 命中，可接管拖动', () => {
  // 核在 (100,100)，指针在 (130,120)——距离 ~36px < 48
  if (!handHitTest(130, 120, 100, 100)) throw new Error('36px 应命中');
});

test('落在半径边缘（=48px）→ 命中（含边界）', () => {
  // (148,100) 距 (100,100) 恰好 48px
  if (!handHitTest(148, 100, 100, 100)) throw new Error('48px 边界应命中');
});

test('落在半径外（>48px）→ 不命中，不接管', () => {
  // (150,100) 距 (100,100) 恰好 50px > 48
  if (handHitTest(150, 100, 100, 100)) throw new Error('50px 不应命中');
});

test('自定义半径生效（r=24 时 30px 不命中）', () => {
  if (handHitTest(130, 100, 100, 100, 24)) throw new Error('30px 超出 r=24 不应命中');
  if (!handHitTest(120, 100, 100, 100, 24)) throw new Error('20px 在 r=24 内应命中');
});
