/**
 * KFM v3 — 工具函数
 *
 * 决策：T-005（模块分离）
 * 创建：2026-04-15
 * 维护：卡萝
 *
 * 纯函数，无副作用，可独立测试。
 */
import type { Spacing } from './types.js';

/** 创建均匀间距 */
export function uniformSpacing(n: number): Spacing {
  return { top: n, right: n, bottom: n, left: n };
}

/** 创建水平垂直间距 */
export function hvSpacing(h: number, v: number): Spacing {
  return { top: v, right: h, bottom: v, left: h };
}

/** 零间距常量 */
export const ZERO_SPACING: Spacing = { top: 0, right: 0, bottom: 0, left: 0 };
