/**
 * KFM v3 — 动画工具函数
 *
 * 决策：T-005（模块分离）
 * 创建：2026-04-15
 * 维护：卡萝
 *
 * 缓动函数、动画计算，纯函数实现。
 */
import type { EasingName } from './types.js';

/**
 * 缓动函数
 * 
 * @param name 缓动类型名称
 * @param t 进度值 (0 ~ 1)
 * @returns 缓动后的值 (0 ~ 1)
 */
export function ease(name: EasingName, t: number): number {
  switch (name) {
    case 'linear': return t;
    case 'easeInQuad': return t * t;
    case 'easeOutQuad': return t * (2 - t);
    case 'easeInOutQuad': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'easeInCubic': return t * t * t;
    case 'easeOutCubic': { const t1 = t - 1; return t1 * t1 * t1 + 1; }
    case 'easeInOutCubic': return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    case 'easeOutElastic': {
      const p = 0.3;
      return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    }
    case 'easeOutBounce': {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) { const t1 = t - 1.5 / 2.75; return 7.5625 * t1 * t1 + 0.75; }
      if (t < 2.5 / 2.75) { const t1 = t - 2.25 / 2.75; return 7.5625 * t1 * t1 + 0.9375; }
      { const t1 = t - 2.625 / 2.75; return 7.5625 * t1 * t1 + 0.984375; }
    }
  }
}
