/**
 * terminal-renderer.ts — Phase 8: Canvas 终端渲染器
 *
 * 格子模型 + ANSI/VT 解析 + 光标动画 + 渲染循环。
 * 不依赖 xterm.js，复用项目 Canvas 2D 引擎基础设施。
 *
 * 设计文档：docs/design/TERMINAL_CARD_SPEC.md
 */

// ========== 步骤 0：字体测量 ==========

const FONT = '11px monospace';

interface FontMetrics {
  cellW: number;
  cellH: number;
}

let _metrics: FontMetrics | null = null;

/** 测量当前设备 11px 等宽字体的宽度和行高。仅首次调用时创建隐藏 canvas 测量 */
export function measureFontMetrics(): FontMetrics {
  if (_metrics) return _metrics;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = FONT;

  // 字宽：等宽字体每个字符宽度相同
  const cellW = ctx.measureText('A').width;

  // 行高：通过 bounding box 获取真实渲染高度（不受 font-size 11px 限制）
  const m = ctx.measureText('Ag');
  const cellH = Math.abs(m.actualBoundingBoxAscent) + Math.abs(m.actualBoundingBoxDescent);

  _metrics = { cellW, cellH };
  return _metrics;
}

/** 获取已缓存的字体度量（必须先调用 measureFontMetrics） */
export function getFontMetrics(): FontMetrics {
  if (!_metrics) return measureFontMetrics();
  return _metrics;
}
