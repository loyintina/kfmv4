/**
 * tests/pool-swipe.test.ts — 配置池 A2a 考卷 A7：手势方向裁决纯函数
 *
 * 语义基准 = 设计清单 §1.2-4/P1：方向裁决后置（松手期判定），
 *   左滑成立 ⇔ dx < -64px 且 |dx| > 2|dy|；右滑返回对称（§1.2-5）；
 *   阈值是具名常量（POOL_SWIPE_MIN_PX / POOL_SWIPE_AXIS_RATIO），
 *   皮内禁魔法数；不满足 = 零动作零副作用（null）。
 *
 * 本钉只考 §1.2 三重判定里可抽纯逻辑的部分（方向裁决）；condition 门与
 * targetFilter 是 DOM/运行时判定，归 B 档（阶段二）。
 *
 * 变异抽检靶子：阈值常量被改小/比较方向写反 → 边界样本钉红。
 */
import { test, group, assert } from './runner.ts';
import {
  judgePoolSwipe,
  POOL_SWIPE_MIN_PX,
  POOL_SWIPE_AXIS_RATIO,
} from '../src/client/plugins/config-pool/swipe-verdict.ts';

group('pool-swipe（A7：方向裁决纯函数，dx<-64 且 |dx|>2|dy|）');

test('具名常量在脑：64px 阈值 + 2 倍主轴比，禁魔法数', () => {
  assert(POOL_SWIPE_MIN_PX === 64, '阈值常量应为 64（清单 §1.2-4）');
  assert(POOL_SWIPE_AXIS_RATIO === 2, '主轴比常量应为 2（清单 §1.2-4）');
});

test('左滑成立：dx<-64 且 |dx|>2|dy| → left', () => {
  assert(judgePoolSwipe(-100, 0) === 'left', '纯水平左滑应成立');
  assert(judgePoolSwipe(-65, 0) === 'left', '刚过阈值应成立');
  assert(judgePoolSwipe(-100, 49) === 'left', '100 > 2×49 斜滑偏水平应成立');
  assert(judgePoolSwipe(-200, 99) === 'left', '200 > 2×99 临界内应成立');
});

test('左滑不成立：垂直/不足阈值/斜率不够/临界点 → null（零动作零副作用）', () => {
  assert(judgePoolSwipe(0, -120) === null, '纯垂直滑不成立（终端 scrollback 链路）');
  assert(judgePoolSwipe(0, 120) === null, '纯垂直下滑不成立');
  assert(judgePoolSwipe(-64, 0) === null, 'dx=-64 是严格小于，临界点不成立');
  assert(judgePoolSwipe(-30, 0) === null, '不足阈值不成立');
  assert(judgePoolSwipe(-100, 50) === null, '100 不大于 2×50，斜率临界不成立');
  assert(judgePoolSwipe(-100, 60) === null, '斜滑偏垂直不成立');
  assert(judgePoolSwipe(0, 0) === null, '零位移不成立');
});

test('右滑对称（池页内返回，§1.2-5）：dx>64 且 |dx|>2|dy| → right', () => {
  assert(judgePoolSwipe(100, 0) === 'right', '纯水平右滑应成立');
  assert(judgePoolSwipe(65, 0) === 'right', '右滑刚过阈值应成立');
  assert(judgePoolSwipe(64, 0) === null, '右滑同为严格大于，临界点不成立');
  assert(judgePoolSwipe(100, 50) === null, '右滑斜率临界不成立');
});
