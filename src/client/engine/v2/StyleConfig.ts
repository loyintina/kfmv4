/**
 * KFM v3 — StyleConfig 样式配置接口
 *
 * 决策：T-004（类型命名重构）
 * 创建：2026-04-15
 * 维护：卡萝
 *
 * KFM Box 样式配置接口：四边独立控制，三种状态。
 */

export type BorderSide = 'top' | 'right' | 'bottom' | 'left';
export type BorderState = 'hidden' | 'normal' | 'emphasis';

export interface BorderConfig {
  top: BorderState;
  right: BorderState;
  bottom: BorderState;
  left: BorderState;
}

export interface GradientStop {
  offset: number;
  color: string;
}

export interface BoxStyle {
  border: BorderConfig;
  borderWidth: number;          // 基础线宽 (1x), default 1
  emphasisScale: number;       // 强调倍率, default 3
  cornerRadius: number;        // 圆角半径, default 12
  borderColor: string | { type: string; stops: GradientStop[] };
  glowEnabled: boolean;
  glowRadius: number;
  background: 'glass' | 'solid' | 'none';
  backgroundOpacity: number;
  backgroundFill?: string;     // solid 模式的填充色
}

// 相邻边处理策略
export type CornerAction =
  | { type: 'none' }                                              // 无处理
  | { type: 'taper-to-zero' }                                     // 变细到消失
  | { type: 'taper-to-width'; targetWidth: number }               // 变细到指定宽度
  | { type: 'gradient-merge' }                                    // 不变细，渐变过渡
  | { type: 'small-corner'; radius: number }                      // 普通边之间加细圆角

// 拐角策略查表：(当前边状态, 邻居边状态) → CornerAction
export function getCornerAction(
  current: BorderState,
  neighbor: BorderState
): CornerAction {
  if (current === 'hidden') return { type: 'none' };

  if (current === 'emphasis') {
    switch (neighbor) {
      case 'emphasis': return { type: 'gradient-merge' };
      case 'normal': return { type: 'taper-to-width', targetWidth: 1 };
      case 'hidden': return { type: 'taper-to-zero' };
    }
  }

  // current === 'normal'
  switch (neighbor) {
    case 'emphasis': return { type: 'none' }; // 邻居会处理
    case 'normal': return { type: 'small-corner', radius: 3 };
    case 'hidden': return { type: 'none' };
  }

  return { type: 'none' };
}

// 获取邻居边：给定边和端点(start/end)，返回相邻的边
export function getNeighbor(
  border: BorderConfig,
  side: BorderSide,
  endpoint: 'start' | 'end'
): BorderSide {
  // 顺时针: top(start=left, end=right), right(start=top, end=bottom),
  //          bottom(start=right, end=left), left(start=bottom, end=top)
  const map: Record<BorderSide, { start: BorderSide; end: BorderSide }> = {
    top:    { start: 'left',   end: 'right'  },
    right:  { start: 'top',    end: 'bottom' },
    bottom: { start: 'right',  end: 'left'   },
    left:   { start: 'bottom', end: 'top'    },
  };
  return map[side][endpoint];
}

// 默认盒子样式
export const DEFAULT_BOX_STYLE: BoxStyle = {
  border: { left: 'emphasis', bottom: 'normal', top: 'hidden', right: 'hidden' },
  borderWidth: 1,
  emphasisScale: 3,
  cornerRadius: 12,
  borderColor: '#7c3aed',
  glowEnabled: false,
  glowRadius: 8,
  background: 'glass',
  backgroundOpacity: 0.6,
};

// 预设样式
export const PRESETS: Record<string, Partial<BoxStyle>> = {
  'default': {}, // use DEFAULT_BOX_STYLE
  'all-emphasis': {
    border: { top: 'emphasis', right: 'emphasis', bottom: 'emphasis', left: 'emphasis' },
  },
  'all-hidden': {
    border: { top: 'hidden', right: 'hidden', bottom: 'hidden', left: 'hidden' },
    background: 'glass',
    backgroundOpacity: 0.4,
  },
  'left-emphasis-rest-hidden': {
    border: { left: 'emphasis', top: 'hidden', right: 'hidden', bottom: 'hidden' },
  },
  'left-bottom-normal': {
    border: { left: 'normal', bottom: 'normal', top: 'hidden', right: 'hidden' },
  },
  'bottom-right-normal': {
    border: { bottom: 'normal', right: 'normal', top: 'hidden', left: 'hidden' },
  },
  'left-right-emphasis': {
    border: { left: 'emphasis', right: 'emphasis', top: 'hidden', bottom: 'hidden' },
  },
};

export function resolveStyle(preset: string, overrides?: Partial<BoxStyle>): BoxStyle {
  var base = { ...DEFAULT_BOX_STYLE };
  var p = PRESETS[preset];
  if (p) {
    if (p.border) base.border = { ...base.border, ...p.border };
    if (p.borderWidth !== undefined) base.borderWidth = p.borderWidth;
    if (p.emphasisScale !== undefined) base.emphasisScale = p.emphasisScale;
    if (p.cornerRadius !== undefined) base.cornerRadius = p.cornerRadius;
    if (p.borderColor !== undefined) base.borderColor = p.borderColor;
    if (p.glowEnabled !== undefined) base.glowEnabled = p.glowEnabled;
    if (p.glowRadius !== undefined) base.glowRadius = p.glowRadius;
    if (p.background !== undefined) base.background = p.background;
    if (p.backgroundOpacity !== undefined) base.backgroundOpacity = p.backgroundOpacity;
    if (p.backgroundFill !== undefined) base.backgroundFill = p.backgroundFill;
  }
  if (overrides) {
    if (overrides.border) base.border = { ...base.border, ...overrides.border };
    if (overrides.borderWidth !== undefined) base.borderWidth = overrides.borderWidth;
    if (overrides.emphasisScale !== undefined) base.emphasisScale = overrides.emphasisScale;
    if (overrides.cornerRadius !== undefined) base.cornerRadius = overrides.cornerRadius;
    if (overrides.borderColor !== undefined) base.borderColor = overrides.borderColor;
    if (overrides.glowEnabled !== undefined) base.glowEnabled = overrides.glowEnabled;
    if (overrides.glowRadius !== undefined) base.glowRadius = overrides.glowRadius;
    if (overrides.background !== undefined) base.background = overrides.background;
    if (overrides.backgroundOpacity !== undefined) base.backgroundOpacity = overrides.backgroundOpacity;
    if (overrides.backgroundFill !== undefined) base.backgroundFill = overrides.backgroundFill;
  }
  return base;
}
