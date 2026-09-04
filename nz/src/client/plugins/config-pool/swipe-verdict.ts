/**
 * swipe-verdict.ts — 配置池左滑进入/右滑返回的方向裁决纯函数
 * （设计清单 §1.2-4 方向裁决后置 + §1.2-5 返回对称）
 *
 * 三重判定里可抽纯逻辑的部分只有方向裁决（condition 门与 targetFilter
 * 是运行时/DOM 判定，归阶段二手势件）。裁决在松手期（onEnd）才判：
 *
 *   左滑成立 ⇔ dx < -64px 且 |dx| > 2|dy|   （POOL_CLOSED → POOL_OPEN）
 *   右滑成立 ⇔ dx >  64px 且 |dx| > 2|dy|   （POOL_OPEN  → POOL_CLOSED）
 *   其余 → null = 零动作零副作用（垂直滚动自然落选，P1）
 *
 * 阈值进脑为具名常量（皮内禁魔法数）；纯函数无 DOM 依赖，A 档直接驱动。
 */
export const POOL_SWIPE_MIN_PX = 64;
export const POOL_SWIPE_AXIS_RATIO = 2;

export type PoolSwipeVerdict = 'left' | 'right' | null;

export function judgePoolSwipe(dx: number, dy: number): PoolSwipeVerdict {
  if (dx < -POOL_SWIPE_MIN_PX && Math.abs(dx) > POOL_SWIPE_AXIS_RATIO * Math.abs(dy)) return 'left';
  if (dx > POOL_SWIPE_MIN_PX && Math.abs(dx) > POOL_SWIPE_AXIS_RATIO * Math.abs(dy)) return 'right';
  return null;
}
