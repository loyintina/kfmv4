/**
 * KFM v3 — BorderDrawer 边框绘制引擎
 *
 * 决策：D-003/T-002/T-003
 * 创建：2026-04-14
 * 维护：卡萝
 *
 * v5.1：Leafer Path → Canvas 2D 翻译版（TASK-012）
 * 8段分解圆角矩形 + 宽度渐变 + 四边独立控制
 */

import {
  BorderConfig, BorderState, BorderSide, BoxStyle
} from './StyleConfig.js'

// 角编号 → 位置映射（逆时针）
// 1=左上, 2=左竖线, 3=左下, 4=下横线
// 5=右下, 6=右竖线, 7=右上, 8=上横线
type CornerIndex = 1 | 3 | 5 | 7;

// 圆角的宽度类型
type CornerType =
  | { type: 'uniform'; width: number }                          // 类型①②：固定宽度
  | { type: 'taper'; startWidth: number; endWidth: number }      // 类型③④：宽度渐变

// 获取圆角相邻的两条边
function getCornerSides(corner: CornerIndex): { side1: BorderSide; side2: BorderSide } {
  switch (corner) {
    case 1: return { side1: 'top', side2: 'left' };     // 左上：上边→左边（逆时针）
    case 3: return { side1: 'left', side2: 'bottom' };   // 左下：左边→下边
    case 5: return { side1: 'bottom', side2: 'right' };  // 右下：下边→右边
    case 7: return { side1: 'right', side2: 'top' };     // 右上：右边→上边
  }
}

// 判断某个圆角是否需要绘制
function shouldDrawCorner(
  corner: CornerIndex,
  border: BorderConfig
): boolean {
  var sides = getCornerSides(corner);
  var s1 = border[sides.side1];
  var s2 = border[sides.side2];

  // 普通和隐藏之间、隐藏和隐藏之间不画圆角
  if (s1 === 'hidden' && s2 === 'hidden') return false;
  if ((s1 === 'normal' && s2 === 'hidden') ||
      (s1 === 'hidden' && s2 === 'normal')) return false;

  return true;
}

// 获取圆角的宽度类型
function getCornerType(
  corner: CornerIndex,
  border: BorderConfig,
  emphasisW: number,
  normalW: number
): CornerType | null {
  var sides = getCornerSides(corner);
  var s1 = border[sides.side1];
  var s2 = border[sides.side2];

  // ① 强调+强调 = 固定 emphasisW
  if (s1 === 'emphasis' && s2 === 'emphasis') {
    return { type: 'uniform', width: emphasisW };
  }
  // ② 普通+普通 = 固定 normalW
  if (s1 === 'normal' && s2 === 'normal') {
    return { type: 'uniform', width: normalW };
  }
  // ③ 强调+普通 = 从 emphasisW 渐变到 normalW
  if (s1 === 'emphasis' && s2 === 'normal') {
    return { type: 'taper', startWidth: emphasisW, endWidth: normalW };
  }
  if (s1 === 'normal' && s2 === 'emphasis') {
    return { type: 'taper', startWidth: normalW, endWidth: emphasisW };
  }
  // ④ 强调+隐藏 = 从 emphasisW 渐变到 0
  if (s1 === 'emphasis' && s2 === 'hidden') {
    return { type: 'taper', startWidth: emphasisW, endWidth: 0 };
  }
  if (s1 === 'hidden' && s2 === 'emphasis') {
    return { type: 'taper', startWidth: 0, endWidth: emphasisW };
  }

  return null;
}

// 获取弧线上某个角度对应的坐标
// 圆心 (cx, cy)，半径 r，角度 angle（弧度）
// Canvas 坐标系：Y 轴向下
function getArcPoint(
  cx: number, cy: number, r: number, angle: number
): { px: number; py: number } {
  return {
    px: cx + r * Math.cos(angle),
    py: cy + r * Math.sin(angle),
  };
}

// 获取每个圆角的弧线角度范围（起止角度，弧度）
// 逆时针方向：从 side1 的直线端 → side2 的直线端
function getArcAngles(corner: CornerIndex): { start: number; end: number } {
  // Canvas 坐标系角度：
  // 0 = 右, π/2 = 下, π = 左, 3π/2 = 上
  switch (corner) {
    case 1: return { start: 3 * Math.PI / 2, end: Math.PI };           // 左上：上→左
    case 3: return { start: Math.PI, end: Math.PI / 2 };               // 左下：左→下
    case 5: return { start: Math.PI / 2, end: 0 };                     // 右下：下→右
    case 7: return { start: 0, end: -Math.PI / 2 };                    // 右上：右→上（负方向90°）
  }
}

// 获取弧线中心（内缩 radius）
function getArcCenter(
  corner: CornerIndex,
  x: number, y: number, w: number, h: number,
  radius: number
): { cx: number; cy: number } {
  switch (corner) {
    case 1: return { cx: x + radius, cy: y + radius };
    case 3: return { cx: x + radius, cy: y + h - radius };
    case 5: return { cx: x + w - radius, cy: y + h - radius };
    case 7: return { cx: x + w - radius, cy: y + radius };
  }
}

// 绘制固定宽度的圆角弧线（类型①②）— Canvas 2D 版
function drawUniformArc(
  ctx: CanvasRenderingContext2D,
  corner: CornerIndex,
  x: number, y: number, w: number, h: number,
  radius: number,
  strokeWidth: number,
  color: string
): void {
  if (radius <= 0 || strokeWidth <= 0) return;

  var center = getArcCenter(corner, x, y, w, h, radius);
  var angles = getArcAngles(corner);

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(center.cx, center.cy, radius, angles.start, angles.end, true);
  ctx.stroke();
}

// 绘制渐变宽度的圆角弧线（类型③④）— Canvas 2D 版
// 将 90° 弧线拆成 N 段，每段独立 arc + stroke，lineWidth 线性插值
function drawTaperArc(
  ctx: CanvasRenderingContext2D,
  corner: CornerIndex,
  x: number, y: number, w: number, h: number,
  radius: number,
  startWidth: number,
  endWidth: number,
  color: string
): void {
  var segments = 10;

  var center = getArcCenter(corner, x, y, w, h, radius);
  var angles = getArcAngles(corner);

  // 角度步进（负值 = 逆时针）
  var angleStep = (angles.end - angles.start) / segments;

  ctx.strokeStyle = color;
  ctx.lineCap = 'butt';

  for (var i = 0; i < segments; i++) {
    var t = (i + 0.5) / segments; // 段中心位置的插值参数
    var sw = startWidth + (endWidth - startWidth) * t;
    if (sw < 0.3) continue; // 太细跳过

    var a1 = angles.start + angleStep * i;
    var a2 = angles.start + angleStep * (i + 1);

    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.arc(center.cx, center.cy, radius, a1, a2, true);
    ctx.stroke();
  }
}

// 绘制直线段（Canvas 2D）
function drawLineSegment(
  ctx: CanvasRenderingContext2D,
  side: BorderSide,
  x: number, y: number, w: number, h: number,
  radius: number,
  strokeWidth: number,
  color: string
): void {
  var halfSw = strokeWidth / 2;
  ctx.fillStyle = color;

  switch (side) {
    case 'left':
      ctx.fillRect(x - halfSw, y + radius, strokeWidth, Math.max(1, h - radius * 2));
      break;
    case 'bottom':
      ctx.fillRect(x + radius, y + h - halfSw, Math.max(1, w - radius * 2), strokeWidth);
      break;
    case 'right':
      ctx.fillRect(x + w - halfSw, y + radius, strokeWidth, Math.max(1, h - radius * 2));
      break;
    case 'top':
      ctx.fillRect(x + radius, y - halfSw, Math.max(1, w - radius * 2), strokeWidth);
      break;
  }
}

// === 主绘制函数 ===

export function drawBorders(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  style: BoxStyle
): void {
  var emphasisW = style.borderWidth * style.emphasisScale; // 3px
  var normalW = style.borderWidth; // 1px
  var radius = style.cornerRadius;
  var emColor = typeof style.borderColor === 'string' ? style.borderColor : '#7c3aed';
  var nmColor = emColor;
  var border = style.border;
  var sides: BorderSide[] = ['top', 'right', 'bottom', 'left'];

  // 1. 先画普通边的直线段（底层）
  for (var i = 0; i < 4; i++) {
    var side = sides[i];
    if (border[side] !== 'normal') continue;
    drawLineSegment(ctx, side, x, y, w, h, radius, normalW, nmColor);
  }

  // 2. 画强调边的直线段（覆盖普通边端点）
  for (var j = 0; j < 4; j++) {
    var side2 = sides[j];
    if (border[side2] !== 'emphasis') continue;
    drawLineSegment(ctx, side2, x, y, w, h, radius, emphasisW, emColor);
  }

  // 3. 画四个圆角（最上层）
  var corners: CornerIndex[] = [1, 3, 5, 7];
  for (var k = 0; k < 4; k++) {
    var corner = corners[k];
    if (!shouldDrawCorner(corner, border)) continue;

    var cornerSides = getCornerSides(corner);
    var hasEm = border[cornerSides.side1] === 'emphasis' || border[cornerSides.side2] === 'emphasis';
    var color = hasEm ? emColor : nmColor;

    var cType = getCornerType(corner, border, emphasisW, normalW);
    if (!cType) continue;

    if (cType.type === 'uniform') {
      drawUniformArc(ctx, corner, x, y, w, h, radius, cType.width, color);
    } else {
      drawTaperArc(
        ctx, corner, x, y, w, h, radius,
        cType.startWidth, cType.endWidth, color
      );
    }
  }
}