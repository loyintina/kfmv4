/**
 * KFM v3 — 渲染器 v2
 *
 * 决策：A-002/T-001
 * 创建：2026-04-13
 * 维护：卡萝
 *
 * 职责：把 Box 树绘制到 Canvas 上。
 * 文本排版委托给 Pretext。
 */

import { Box } from './box.js';
import type {
  Rect, BoxVisualStyle, VisualBorderConfig, HighlightConfig,
  ShadowConfig, GradientConfig, TextStyle, IconConfig,
  Spacing, GestureConfig, BackgroundPatternConfig,  // Phase 2 Demo
} from './types.js';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import { applyFlexLayout } from './flex.js';
import { drawBorders } from './BorderDrawer.js';
import type { BoxStyle as KFMBoxStyle } from './StyleConfig.js';

export interface RendererOptions {
  dpr?: number;
  backgroundColor?: string;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
  width: number;
  height: number;
  backgroundColor: string;
  private _isRunning: boolean;
  private _root: Box | null;
  /** 动画树根（可选，动画期间在主树上方独立渲染，互不影响） */
  private _overlayRoot: Box | null;
  private _rafId: number;
  private _lastTime: number;
  private _frameCount: number;
  private _fps: number;

  // Pretext 缓存：key = font + text
  private _pretextCache: Map<string, any>;

  // input 元素缓存：key = Box.id
  private _inputElements: Map<string, HTMLInputElement | HTMLTextAreaElement>;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = options.dpr ?? (window.devicePixelRatio || 1);
    this.backgroundColor = options.backgroundColor ?? '#0a0a0f';
    this.width = 0;
    this.height = 0;
    this._isRunning = false;
    this._root = null;
    this._overlayRoot = null;
    this._rafId = 0;
    this._lastTime = 0;
    this._frameCount = 0;
    this._fps = 0;
    this._pretextCache = new Map();
    this._inputElements = new Map();
    this.resize();
  }

  // ============================================================
  // 生命周期
  // ============================================================

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.width = w;
    this.height = h;
  }

  setRoot(box: Box | null): this {
    this._root = box;
    return this;
  }

  getRoot(): Box | null {
    return this._root;
  }

  /** 设置动画树根（在主树之上独立渲染） */
  setOverlayRoot(box: Box | null): this {
    this._overlayRoot = box;
    return this;
  }

  getOverlayRoot(): Box | null {
    return this._overlayRoot;
  }

  start(): this {
    if (this._isRunning) return this;
    this._isRunning = true;
    this._lastTime = performance.now();
    const loop = (now: number) => {
      if (!this._isRunning) return;
      this._render(now);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
    return this;
  }

  stop(): this {
    this._isRunning = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    return this;
  }

  get isRunning(): boolean { return this._isRunning; }
  get fps(): number { return this._fps; }

  // ============================================================
  // 渲染主循环
  // ============================================================

  private _render(now: number): void {
    // FPS
    if (this._lastTime) {
      const delta = now - this._lastTime;
      this._fps = Math.round(1000 / delta);
    }
    this._lastTime = now;
    this._frameCount++;

    // 清屏
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 渲染主树
    if (this._root) {
      this._tickAndRender(this._root, now, 1);
      try {
        this._manageInputs(this._root);
      } catch (e) {
        console.error('_manageInputs error', e);
      }
    }

    // 在主树之上渲染动画树（如果有）
    if (this._overlayRoot) {
      this._tickAndRender(this._overlayRoot, now, 1);
    }
  }

  private _tickAndRender(box: Box, now: number, parentOpacity: number): void {
    // 动画 tick
    box.tickAnimations(now);

    if (!box.visible) return;

    const opacity = box.opacity * parentOpacity;
    if (opacity <= 0) return;

    this.ctx.save();
    this.ctx.globalAlpha = opacity;

    // 变换
    const bounds = box.getBounds();
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const { scale, rotate, translateX, translateY } = box.transform;
    if (translateX !== 0 || translateY !== 0) {
      this.ctx.translate(translateX, translateY);
    }
    if (rotate !== 0 || scale !== 1) {
      this.ctx.translate(cx, cy);
      if (rotate !== 0) this.ctx.rotate(rotate);
      if (scale !== 1) this.ctx.scale(scale, scale);
      this.ctx.translate(-cx, -cy);
    }


    // 绘制各层（在 clip 之前，确保边框全宽可见）
    this._drawShadow(box, bounds);
    this._drawBackground(box, bounds);
    if (box.shape) this._drawShape(box, bounds);
    this._drawBorder(box, bounds);
    this._drawHighlight(box, bounds);
    if (box.icon) this._drawIcon(box.icon, bounds, box.padding);
    if (box.textStyle.content) this._drawText(box.textStyle, bounds, box.padding, box.icon);
    // 裁剪子元素（滚动容器必须裁剪子元素）
    if (box.overflow === 'hidden' || box.scrollable) {
      this.ctx.beginPath();
      this.ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, box.borderRadius);
      this.ctx.clip();
    }

    // Flex 布局（在子元素渲染前计算位置）
    if (box.layout) {
      applyFlexLayout(box);
    }

    // 滚动偏移（子元素层）
    if (box.scrollable) {
      this.ctx.save();
      this.ctx.translate(-box.scrollX, -box.scrollY);
    }

    // 子元素渲染（按 zIndex 升序排序：小的先画，大的后画在上面）
    const sortedChildren = [...box.children].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    for (const child of sortedChildren) {
      this._tickAndRender(child, now, opacity);
    }

    // 恢复滚动偏移 + 绘制滚动条
    if (box.scrollable) {
      this.ctx.restore();
      if (box.scrollbarVisible) {
        this._drawScrollbar(box, bounds);
      }
    }

    this.ctx.restore();
  }

  // ============================================================
  // input 元素管理（Phase 2 Demo）
  // ============================================================

  private _manageInputs(root: Box): void {
    // 收集所有 inputable Box
    const inputableBoxes = root.flatten().filter(b => b.inputable?.enabled);
    const seenIds = new Set<string>();

    // 创建或更新 input 元素
    for (const box of inputableBoxes) {
      seenIds.add(box.id);
      const bounds = box.getBounds();
      let el = this._inputElements.get(box.id);

      if (!el) {
        // 创建新元素
        const isTextarea = box.inputable?.type === 'textarea';
        el = document.createElement(isTextarea ? 'textarea' : 'input');
        el.style.position = 'fixed';
        el.style.background = 'transparent';
        el.style.border = 'none';
        el.style.outline = 'none';
        el.style.fontSize = '16px';
        el.style.color = '#e0e0e0';
        el.style.zIndex = '10';
        el.style.resize = 'none';
        el.style.padding = '10px';  // 内边距，让滚动窗口小一圈
        el.style.boxSizing = 'border-box';
        el.style.lineHeight = (box.inputable?.lineHeight || 24) + 'px';
        if (isTextarea) {
          el.style.wordWrap = 'break-word';
          el.style.overflowY = 'auto';
          // 最大高度限制（maxRows × lineHeight）
          const maxRows = box.inputable?.maxRows || 5;
          const lineHeight = box.inputable?.lineHeight || 24;
          const maxHeight = maxRows * lineHeight + 20;  // +20 是 padding
          el.style.maxHeight = maxHeight + 'px';
          // 自适应高度函数 + 同步 Box 高度
          const textareaEl = el;
          const inputBox = box;  // 闭包引用
          const rendererInstance = this;  // renderer 实例
          const adjustHeight = () => {
            textareaEl.style.height = 'auto';
            const scrollHeight = textareaEl.scrollHeight;
            const minHeight = lineHeight;  // 最小高度（一行）
            const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
            textareaEl.style.height = newHeight + 'px';
            // 同步更新 Box 高度
            inputBox.height = newHeight;
            // 同步更新父容器（inputBar）高度和位置
            if (inputBox.parent) {
              inputBox.parent.height = newHeight + 24;  // +24 是上下 padding
              // 重新定位到底部
              inputBox.parent.y = rendererInstance.height - inputBox.parent.height;
            }
          }; 
          el.addEventListener('input', adjustHeight);
          // 初始化时设置最小高度
          el.style.height = lineHeight + 'px';
          inputBox.height = lineHeight;
          if (inputBox.parent) {
            inputBox.parent.height = lineHeight + 24;
            inputBox.parent.y = rendererInstance.height - inputBox.parent.height;
          }
        }
        el.setAttribute('autocapitalize', 'off');
        el.setAttribute('autocomplete', 'off');
        el.setAttribute('autocorrect', 'off');
        if (box.inputable?.placeholder) el.placeholder = box.inputable.placeholder;
        if (box.inputable?.value) el.value = box.inputable.value;
        // 先设置位置，再添加到 DOM（避免闪烁）
        el.style.left = `${bounds.x}px`;
        el.style.top = `${bounds.y}px`;
        el.style.width = `${bounds.width}px`;
        el.style.height = `${bounds.height}px`;
        this.canvas.parentElement?.appendChild(el);
        this._inputElements.set(box.id, el);
      } else {
        // 已存在，更新位置
        el.style.left = `${bounds.x}px`;
        el.style.top = `${bounds.y}px`;
        el.style.width = `${bounds.width}px`;
        el.style.height = `${bounds.height}px`;
      }
    }

    // 移除不再需要的 input 元素
    for (const [id, el] of this._inputElements) {
      if (!seenIds.has(id)) {
        el.remove();
        this._inputElements.delete(id);
      }
    }
  }

  // ============================================================
  // 绘制层
  // ============================================================

  private _drawShadow(box: Box, b: Rect): void {
    const shadow = box.shadow;
    if (!shadow) return;
    // console.log("DRAW SHADOW:", box.id, shadow, b);
    this.ctx.save();
    
    this.ctx.beginPath();
    this.ctx.rect(-10000, -10000, 20000, 20000);
    this.ctx.roundRect(b.x, b.y, b.width, b.height, box.borderRadius);
    this.ctx.clip('evenodd');

    this.ctx.shadowColor = shadow.color;
    this.ctx.shadowBlur = shadow.blur;
    this.ctx.shadowOffsetX = shadow.offsetX + 10000;
    this.ctx.shadowOffsetY = shadow.offsetY;
    
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.roundRect(b.x - 10000, b.y, b.width, b.height, box.borderRadius);
    this.ctx.fill();
    
    this.ctx.restore();
  }

  /** 绘制矢量形状（Phase 2 Demo） */
  private _drawShape(box: Box, b: Rect): void {
    const shape = box.shape!;
    const points = shape.points;
    if (points.length < 2) return;
    const composite = shape.composite ?? 'destination-out';
    const closed = shape.closed ?? true;
    this.ctx.save();
    this.ctx.globalCompositeOperation = composite;
    this.ctx.beginPath();
    this.ctx.moveTo(b.x + points[0].x * b.width, b.y + points[0].y * b.height);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(b.x + points[i].x * b.width, b.y + points[i].y * b.height);
    }
    if (closed) this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private _drawBackground(box: Box, b: Rect): void {
    // 合成模式：如 destination-over 让背景画在已有内容下面
    const prevComposite = box.composite || '';
    if (prevComposite) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = prevComposite as GlobalCompositeOperation;
    }

    if (box.gradient) {
      this._drawGradient(box.gradient, b, box.borderRadius);
    } else {
      this.ctx.fillStyle = box.backgroundColor;
      this.ctx.beginPath();
      this.ctx.roundRect(b.x, b.y, b.width, b.height, box.borderRadius);
      this.ctx.fill();
    }
    
    if (prevComposite) {
      this.ctx.restore();
    }

    // Phase 2 Demo：绘制 Box 的网格背景图案
    if (box.backgroundPattern && box.backgroundPattern.type === 'grid') {
      this._drawBoxGridPattern(box, b);
    }
  }

  /** 绘制 Box 内的网格背景图案 */
  private _drawBoxGridPattern(box: Box, b: Rect): void {
    const pattern = box.backgroundPattern!;
    const cellSize = pattern.cellSize ?? 20;
    const lineColor = pattern.lineColor ?? '#2a2a3a';  // 默认暗色
    const lineWidth = pattern.lineWidth ?? 1;
    
    this.ctx.save();
    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = lineWidth;
    
    // 裁剪到 Box 区域（考虑 borderRadius）
    this.ctx.beginPath();
    this.ctx.roundRect(b.x, b.y, b.width, b.height, box.borderRadius);
    this.ctx.clip();
    
    // 垂直线（从 Box 左边界到右边界）
    for (let x = b.x; x <= b.x + b.width; x += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, b.y);
      this.ctx.lineTo(x, b.y + b.height);
      this.ctx.stroke();
    }
    
    // 水平线（从 Box 上边界到下边界）
    for (let y = b.y; y <= b.y + b.height; y += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(b.x, y);
      this.ctx.lineTo(b.x + b.width, y);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
    
    // 自检输出（仅在首帧）
    if (this._frameCount === 1) {
      const vLines = Math.floor(b.width / cellSize) + 1;
      const hLines = Math.floor(b.height / cellSize) + 1;
      // console.log(`[Box网格] ${box.id}: ${b.width}x${b.height}, 垂直=${vLines}, 水平=${hLines}, 单元格=${cellSize}px ✅`);
    }
  }

  private _drawGradient(grad: GradientConfig, b: Rect, radius: number): void {
    let fillStyle: CanvasGradient;
    if (grad.type === 'linear') {
      const angle = (grad.angle * Math.PI) / 180;
      const halfW = b.width / 2;
      const halfH = b.height / 2;
      fillStyle = this.ctx.createLinearGradient(
        b.x + halfW - Math.cos(angle) * halfW,
        b.y + halfH - Math.sin(angle) * halfH,
        b.x + halfW + Math.cos(angle) * halfW,
        b.y + halfH + Math.sin(angle) * halfH
      );
    } else {
      fillStyle = this.ctx.createRadialGradient(
        b.x + b.width / 2, b.y + b.height / 2, 0,
        b.x + b.width / 2, b.y + b.height / 2, Math.max(b.width, b.height) / 2
      );
    }
    for (const stop of grad.stops) {
      fillStyle.addColorStop(stop.offset, stop.color);
    }
    this.ctx.fillStyle = fillStyle;
    this.ctx.beginPath();
    this.ctx.roundRect(b.x, b.y, b.width, b.height, radius);
    this.ctx.fill();
  }

  private _drawScrollbar(box: Box, b: Rect): void {
    const content = box.getContentSize();
    const viewportH = b.height - box.padding.top - box.padding.bottom;
    const viewportW = b.width - box.padding.left - box.padding.right;
    const maxScroll = box.getMaxScroll();

    // 垂直滚动条
    if (maxScroll.maxY > 0 && (box.scrollDirection === 'vertical' || box.scrollDirection === 'both')) {
      const trackHeight = viewportH;
      const thumbHeight = Math.max(20, (viewportH / content.height) * trackHeight);
      const thumbY = b.y + box.padding.top + (box.scrollY / maxScroll.maxY) * (trackHeight - thumbHeight);

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.beginPath();
      this.ctx.roundRect(b.x + b.width - 6, thumbY, 4, thumbHeight, 2);
      this.ctx.fill();
    }

    // 水平滚动条
    if (maxScroll.maxX > 0 && (box.scrollDirection === 'horizontal' || box.scrollDirection === 'both')) {
      const trackWidth = viewportW;
      const thumbWidth = Math.max(20, (viewportW / content.width) * trackWidth);
      const thumbX = b.x + box.padding.left + (box.scrollX / maxScroll.maxX) * (trackWidth - thumbWidth);

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.beginPath();
      this.ctx.roundRect(thumbX, b.y + b.height - 6, thumbWidth, 4, 2);
      this.ctx.fill();
    }
  }

  private _drawCursorBorder(b: Rect, data: any): void {
    const ctx = this.ctx;
    const color = data.color || 'rgba(0,212,255,0.7)';
    const x = b.x;
    const y = b.y;
    const h = b.height;
    const R = 4;   // cornerRadius
    const EW = 3;  // emphasis width
    const NW = 1;  // normal width
    const seg = 12;

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';

    // 1. 左强调线主体（跳过圆角区）
    ctx.fillRect(x - 1.65, y + R, EW, h - R * 2);

    // 2. 左上圆角：从 π(左,3px) 逆时针到 3π/2(上,1px)
    //    圆心 (x+R, y+R)，弧上角度从 π 递减到 3π/2
    const tlCx = x + R, tlCy = y + R + 0.1;
    for (let i = 0; i < seg; i++) {
      const t = (i + 0.5) / seg;
      ctx.lineWidth = EW + (NW - EW) * t;  // 3 → 1
      const a1 = Math.PI + (Math.PI / 2) * (i / seg);       // π → 3π/2
      const a2 = Math.PI + (Math.PI / 2) * ((i + 1) / seg);
      ctx.beginPath();
      ctx.arc(tlCx, tlCy, R, a1, a2, false);  // clockwise
      ctx.stroke();
    }

    // 3. 左下圆角：从 3π/2(上,1px) 顺时针到 π(左,3px)
    //    实际就是从 π(左) 逆时针到 π/2(下)，线宽 1→3
    //    圆心 (x+R, y+h-R)
    const blCx = x + R, blCy = y + h - R;
    for (let i = 0; i < seg; i++) {
      const t = (i + 0.5) / seg;
      ctx.lineWidth = NW + (EW - NW) * t;  // 1 → 3
      const a1 = Math.PI / 2 + (Math.PI / 2) * (i / seg);       // π/2 → π
      const a2 = Math.PI / 2 + (Math.PI / 2) * ((i + 1) / seg);
      ctx.beginPath();
      ctx.arc(blCx, blCy, R, a1, a2, false);  // clockwise
      ctx.stroke();
    }
    const topW = data.topLineW || 0;
    if (topW > 0) { ctx.lineWidth = NW; ctx.beginPath(); ctx.moveTo(x + R, y); ctx.lineTo(x + R + topW, y); ctx.stroke(); }
    const botW = data.botLineW || 0;
    if (botW > 0) { ctx.lineWidth = NW; ctx.beginPath(); ctx.moveTo(x + R, y + h); ctx.lineTo(x + R + botW, y + h); ctx.stroke(); }
    ctx.restore();
  }
  private _drawBorder(box: Box, b: Rect): void {
    // 优先使用 kfmStyle（高级边框）
    const cdata = box.data;
    if (cdata?.cursorDynamicLines) {
      this._drawCursorBorder(b, cdata);
      return;
    }
    if (box.kfmStyle) {
      drawBorders(this.ctx, b.x, b.y, b.width, b.height, box.kfmStyle);
      return;
    }

    // 否则使用简化边框
    const border = box.border;
    if (!border || border.width <= 0) return;

    const { color, width, sides } = border;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';

    // 按方向绘制
    const x = b.x, y = b.y, w = b.width, h = b.height, r = box.borderRadius;
    this.ctx.beginPath();
    if (sides.top) {
      this.ctx.moveTo(x + r, y);
      this.ctx.lineTo(x + w - r, y);
    }
    if (sides.right) {
      this.ctx.moveTo(x + w, y + r);
      this.ctx.lineTo(x + w, y + h - r);
    }
    if (sides.bottom) {
      this.ctx.moveTo(x + w - r, y + h);
      this.ctx.lineTo(x + r, y + h);
    }
    if (sides.left) {
      this.ctx.moveTo(x, y + h - r);
      this.ctx.lineTo(x, y + r);
    }
    this.ctx.stroke();

    // ���果四边都有，画完整的 roundRect
    if (sides.top && sides.right && sides.bottom && sides.left) {
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, w, h, r);
      this.ctx.stroke();
    }
  }

  private _drawHighlight(box: Box, b: Rect): void {
    const hl = box.highlight;
    if (!hl) return;

    this.ctx.strokeStyle = hl.color;
    this.ctx.lineWidth = hl.width;
    this.ctx.lineCap = 'round';

    if (hl.side === 'all') {
      // 画完整矩形框（不受 clip 影响，因为是实心色块 stroke）
      if (box.borderRadius > 0) {
        this.ctx.roundRect(b.x, b.y, b.width, b.height, box.borderRadius);
      } else {
        this.ctx.strokeRect(b.x, b.y, b.width, b.height);
      }
    } else {
      // 原有逻辑：只画左侧竖线
      this.ctx.beginPath();
      this.ctx.moveTo(b.x + hl.width / 2, b.y + 4);
      this.ctx.lineTo(b.x + hl.width / 2, b.y + b.height - 4);
      this.ctx.stroke();
    }
  }

  private _drawIcon(icon: IconConfig, b: Rect, padding: Spacing): void {
    const iconX = icon.position === 'left'
      ? b.x + padding.left
      : b.x + b.width - padding.right - icon.size;
    const iconY = b.y + padding.top;

    this.ctx.font = `${icon.size}px system-ui`;
    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(icon.char, iconX, iconY);
  }

  // ============================================================
  // Pretext 文本渲染
  // ============================================================

  private _getTextKey(text: string, font: string): string {
    return `${font}::${text}`;
  }

  private _drawText(style: TextStyle, b: Rect, padding: Spacing, icon: IconConfig | null): void {
    if (!style.content) return;

    const iconWidth = icon && icon.position === 'left' ? icon.size + 8 : 0;
    const iconRightWidth = icon && icon.position === 'right' ? icon.size + 8 : 0;
    const textX = b.x + padding.left + iconWidth;
    const textY = b.y + padding.top;
    const maxWidth = b.width - padding.left - padding.right - iconWidth - iconRightWidth;

    if (maxWidth <= 0) return;

    // 获取或创建 Pretext prepared
    const key = this._getTextKey(style.content, style.font);
    let prepared = this._pretextCache.get(key);
    if (!prepared) {
      try {
        prepared = prepareWithSegments(style.content, style.font);
        this._pretextCache.set(key, prepared);
      } catch {
        // Pretext 失败时回退到简单渲染
        this._drawTextFallback(style, textX, textY, maxWidth, b, padding);
        return;
      }
    }

    // 使用 layoutWithLines 获���排版结果
    const { lines } = layoutWithLines(prepared, maxWidth, style.lineHeight);
    const maxL = style.maxLines > 0 ? style.maxLines : lines.length;
    const visibleLines = lines.slice(0, maxL);

    // 垂直对齐
    const totalTextHeight = visibleLines.length * style.lineHeight;
    const availableHeight = b.height - padding.top - padding.bottom;
    let offsetY = 0;
    if (style.verticalAlign === 'middle') {
      offsetY = (availableHeight - totalTextHeight) / 2;
    } else if (style.verticalAlign === 'bottom') {
      offsetY = availableHeight - totalTextHeight;
    }

    // 绘制每一行
    this.ctx.font = style.font;
    this.ctx.fillStyle = style.color;
    this.ctx.textBaseline = 'middle';

    // 计算当前字体的实际行高（ascender + descender）
    const metrics = this.ctx.measureText('Ag');
    const fontHeight = Math.abs(metrics.actualBoundingBoxAscent) + Math.abs(metrics.actualBoundingBoxDescent);
    const lineGap = (style.lineHeight - fontHeight) / 2;

    for (let i = 0; i < visibleLines.length; i++) {
      const line = visibleLines[i];
      let lineText = line.text;

      // 省略号：当排版宽度达到或超过 maxWidth 时表示被截断
      // 注意：单行情况下 Pretext 返回 line.text 可能仍是原始文本，不能靠字符串比较
      const isOverflowing = style.overflow === 'ellipsis';
      const isTrimmed = lines.length > maxL || (maxL === 1 && line.width >= maxWidth - 2);
      if (isOverflowing && i === maxL - 1 && isTrimmed) {
        lineText = lineText.slice(0, -1) + '…';
        line.width = this.ctx.measureText(lineText).width;
      }

      // 水平对齐
      let alignX = textX;
      if (style.align === 'center') {
        alignX = textX + (maxWidth - line.width) / 2;
      } else if (style.align === 'right') {
        alignX = textX + maxWidth - line.width;
      }

      // 垂直居中：框中心 + 偏移，用 textBaseline middle 精确对齐
      const lineCenterY = textY + offsetY + i * style.lineHeight + style.lineHeight / 2;
      this.ctx.fillText(lineText, alignX, lineCenterY);
    }
  }

  /** 简单文本渲染回退（Pretext 不可用时） */
  private _drawTextFallback(style: TextStyle, x: number, y: number, maxWidth: number, b: Rect, padding: Spacing): void {
    this.ctx.font = style.font;
    this.ctx.fillStyle = style.color;
    this.ctx.textBaseline = 'middle';
    const centerY = y + (b.height - padding.top - padding.bottom) / 2;
    let text = style.content;
    const measured = this.ctx.measureText(text);
    if (measured.width > maxWidth) {
      while (text.length > 0 && this.ctx.measureText(text + '…').width > maxWidth) {
        text = text.slice(0, -1);
      }
      text += '…';
    }
    this.ctx.fillText(text, x, centerY);
  }

  // ============================================================
  // 碰撞检测
  // ============================================================

  /** 获取指定坐标下最顶层的可交互 Box */
  hitTest(x: number, y: number): Box | null {
    if (!this._root) return null;
    return this._hitTestRecursive(this._root, x, y);
  }

  private _hitTestRecursive(box: Box, x: number, y: number): Box | null {
    if (!box.visible || !box.interactive || box.disabled) return null;

    // 先检查子元素（后添加的在上面，zIndex 高的先检测）
    for (let i = box.children.length - 1; i >= 0; i--) {
      const found = this._hitTestRecursive(box.children[i], x, y);
      if (found) return found;
    }

    // 检测当前 Box
    if (box.containsPoint(x, y)) {
      // D-013-c：gesture.passive 默认 true，未绑定时穿透下层
      if (box.gesture) {
        const hasCallbacks = this._hasGestureCallbacks(box.gesture);
        const isPassive = box.gesture.passive !== false; // 默认 true
        
        if (isPassive && !hasCallbacks) {
          // 穿透：passive=true 且无回调绑定，继续检测下层
          return null;
        }
      }
      return box;
    }
    return null;
  }

  /** 检测 gesture 是否绑定了任何回调 */
  private _hasGestureCallbacks(gesture: GestureConfig): boolean {
    return !!(
      gesture.onTap ||
      gesture.onLongPress ||
      gesture.onSwipeLeft ||
      gesture.onSwipeRight ||
      gesture.onSwipeUp ||
      gesture.onSwipeDown ||
      gesture.onPan ||
      gesture.onPanEnd ||
      gesture.onPinch ||
      gesture.onRotate ||
      gesture.onCancel
    );
  }

  // ============================================================
  // 缓存管理
  // ============================================================

  clearTextCache(): void {
    this._pretextCache.clear();
  }
}