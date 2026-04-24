/**
 * KFM v3 — 滚动事件处理器
 *
 * 决策：F-010（滚动与断行分离）
 * 创建：2026-04-15
 * 维护：卡萝
 *
 * 职责：监听触摸/鼠标事件，计算滚动偏移，触发重绘。
 */
import { Box } from './box.js';

export interface ScrollHandlerOptions {
  /** 目标滚动 Box */
  target: Box;
  /** 触发重绘的回调 */
  onScroll?: () => void;
}

export class ScrollHandler {
  target: Box;
  onScroll?: () => void;

  private _isDragging: boolean;
  private _startX: number;
  private _startY: number;
  private _startScrollX: number;
  private _startScrollY: number;

  constructor(options: ScrollHandlerOptions) {
    this.target = options.target;
    this.onScroll = options.onScroll;
    this._isDragging = false;
    this._startX = 0;
    this._startY = 0;
    this._startScrollX = 0;
    this._startScrollY = 0;
  }

  // ============================================================
  // 事件绑定
  // ============================================================

  /** 绑定到 Canvas 元素 */
  bind(canvas: HTMLCanvasElement): void {
    // 触摸事件
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd);
    canvas.addEventListener('touchcancel', this._onTouchEnd);

    // 鼠标事件
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('mouseleave', this._onMouseUp);
  }

  /** 解绑 */
  unbind(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener('touchstart', this._onTouchStart);
    canvas.removeEventListener('touchmove', this._onTouchMove);
    canvas.removeEventListener('touchend', this._onTouchEnd);
    canvas.removeEventListener('touchcancel', this._onTouchEnd);
    canvas.removeEventListener('mousedown', this._onMouseDown);
    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('mouseup', this._onMouseUp);
    canvas.removeEventListener('mouseleave', this._onMouseUp);
  }

  // ============================================================
  // 触摸事件处理
  // ============================================================

  private _onTouchStart = (e: TouchEvent): void => {
    if (!this.target.scrollable) return;
    
    const touch = e.touches[0];
    this._beginDrag(touch.clientX, touch.clientY);
    e.preventDefault();
  };

  private _onTouchMove = (e: TouchEvent): void => {
    if (!this._isDragging) return;
    
    const touch = e.touches[0];
    this._moveDrag(touch.clientX, touch.clientY);
    e.preventDefault();
  };

  private _onTouchEnd = (): void => {
    this._endDrag();
  };

  // ============================================================
  // 鼠标事件处理
  // ============================================================

  private _onMouseDown = (e: MouseEvent): void => {
    if (!this.target.scrollable) return;
    this._beginDrag(e.clientX, e.clientY);
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this._isDragging) return;
    this._moveDrag(e.clientX, e.clientY);
  };

  private _onMouseUp = (): void => {
    this._endDrag();
  };

  // ============================================================
  // 拖拽逻辑
  // ============================================================

  private _beginDrag(x: number, y: number): void {
    this._isDragging = true;
    this._startX = x;
    this._startY = y;
    this._startScrollX = this.target.scrollX;
    this._startScrollY = this.target.scrollY;
  }

  private _moveDrag(x: number, y: number): void {
    const dx = x - this._startX;
    const dy = y - this._startY;

    const dir = this.target.scrollDirection;

    if (dir === 'vertical' || dir === 'both') {
      this.target.scrollY = this._startScrollY - dy;
    }
    if (dir === 'horizontal' || dir === 'both') {
      this.target.scrollX = this._startScrollX - dx;
    }

    // 边界限制
    this.target.clampScroll();

    // 触发重绘
    this.onScroll?.();
  }

  private _endDrag(): void {
    this._isDragging = false;
  }

  // ============================================================
  // 状态查询
  // ============================================================

  get isDragging(): boolean {
    return this._isDragging;
  }
}
