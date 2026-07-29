/**
 * KFM v4 - 手势注册中心
 *
 * 集中管理所有 document-level 触摸事件，按优先级调度。
 * 原则：优先匹配、独占执行 —— 同一时刻只有一个处理器响应手势。
 */

import { log } from './logger.js';

// ========== 类型定义 ==========

export interface GestureHandler {
  /** 唯一标识（用于注销和调试） */
  id: string;
  /** 目标过滤：CSS 选择器或判定函数 */
  targetFilter: string | ((target: HTMLElement, event: PointerEvent) => boolean);
  /** 运行时条件：返回 false 时跳过该处理器 */
  condition?: () => boolean;
  /** 优先级：数字越大越优先匹配 */
  priority: number;
  /** pointerdown 前调用，返回 false 可否决处理 */
  onBeforeStart?: (event: PointerEvent) => boolean;
  onStart?: (event: PointerEvent) => void;
  onMove?: (event: PointerEvent, dx: number, dy: number, elapsed: number) => void;
  onEnd?: (event: PointerEvent, dx: number, dy: number, elapsed: number) => void;
  /** 长按检测（ms），触发后设 longPressConsumed */
  longPressMs?: number;
  onLongPress?: (event: PointerEvent) => void;
  /** 双指缩放回调 */
  onPinchStart?: (event: PointerEvent, scale: number) => void;
  onPinchMove?: (event: PointerEvent, scale: number) => void;
  onPinchEnd?: (event: PointerEvent, scale: number) => void;
  /** stopPropagation 控制（默认不调用） */
  stopPropagation?: boolean | { start?: boolean; move?: boolean; end?: boolean };
}

interface ActiveGesture {
  handler: GestureHandler;
  startX: number;
  startY: number;
  startTime: number;
  longPressTimer?: ReturnType<typeof setTimeout>;
  longPressConsumed?: boolean;
}

interface PinchState {
  handler: GestureHandler;
  initialDistance: number;
  initialScale: number;
  target: HTMLElement;
}

// ========== Registry 实现 ==========

export class GestureRegistry {
  private _handlers: GestureHandler[] = [];
  private _preMatchHooks: Array<(e: PointerEvent) => void> = [];
  private _active: ActiveGesture | null = null;
  private _enabled = true;
  private _initialized = false;

  // 多指追踪
  private _pointers: Map<number, PointerEvent> = new Map();
  private _pinchState: PinchState | null = null;

  // 绑定的回调引用（用于 removeEventListener）
  private _onStart: (e: PointerEvent) => void;
  private _onMove: (e: PointerEvent) => void;
  private _onEnd: (e: PointerEvent) => void;

  constructor() {
    this._onStart = this._handleStart.bind(this);
    this._onMove = this._handleMove.bind(this);
    this._onEnd = this._handleEnd.bind(this);
  }

  // ========== 注册 / 注销 ==========

  /** 注册手势处理器，返回注销函数 */
  register(handler: GestureHandler): () => void {
    // 替换同 id 的旧处理器
    const oldIdx = this._handlers.findIndex(h => h.id === handler.id);
    if (oldIdx !== -1) this._handlers.splice(oldIdx, 1);

    this._handlers.push(handler);
    this._handlers.sort((a, b) => b.priority - a.priority); // priority 降序

    return () => this.unregister(handler.id);
  }

  /** 按 id 注销处理器 */
  unregister(id: string): void {
    const idx = this._handlers.findIndex(h => h.id === id);
    if (idx !== -1) {
      this._handlers.splice(idx, 1);
    }
    // 如果当前活跃手势属于被注销的处理器，清除
    if (this._active && this._active.handler.id === id) {
      this._active = null;
    }
  }

  /** 注册 preMatch 钩子：每次 pointerdown 在 handler 匹配前执行（无优先级，无返回值） */
  addPreMatchHook(fn: (e: PointerEvent) => void): void {
    this._preMatchHooks.push(fn);
  }

  // ========== 生命周期 ==========

  /** 初始化：注册 document 级 pointer 监听（在主入口调用一次） */
  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    // 禁止浏览器接管触摸（否则 pointermove 会被提前终止）
    document.body.style.touchAction = 'none';
    // pointerdown 用 passive:true — 浏览器无需等待 JS，可直接根据 touch-action 接管原生滚动
    document.addEventListener('pointerdown', this._onStart, { passive: true });
    document.addEventListener('pointermove', this._onMove, { passive: true });
    document.addEventListener('pointerup', this._onEnd, { passive: true });
    document.addEventListener('pointercancel', this._onEnd, { passive: true });
  }

  // ========== 内部调度 ==========

  private _matchTarget(handler: GestureHandler, target: HTMLElement, event: PointerEvent): boolean {
    if (typeof handler.targetFilter === 'string') {
      return !!target.closest(handler.targetFilter);
    }
    return handler.targetFilter(target, event);
  }

  private _shouldStop(handler: GestureHandler, phase: 'start' | 'move' | 'end'): boolean {
    const sp = handler.stopPropagation;
    if (typeof sp === 'boolean') return sp;
    if (typeof sp === 'object') return !!sp[phase];
    return false;
  }

  /** 计算两个指针之间的距离 */
  private _calcDistance(p1: PointerEvent, p2: PointerEvent): number {
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 找到两个指针共同的最近祖先，用于确定 pinch 目标 */
  private _findPinchTarget(p1: PointerEvent, p2: PointerEvent): HTMLElement | null {
    const t1 = p1.target as HTMLElement;
    const t2 = p2.target as HTMLElement;
    if (!t1 || !t2) return null;
    // 从 t1 向上找包含 t2 的最近祖先
    let el: HTMLElement | null = t1;
    while (el) {
      if (el.contains(t2)) return el;
      el = el.parentElement;
    }
    return null;
  }

  /** 尝试启动 pinch 手势（当有两个指针时调用） */
  private _tryStartPinch(): boolean {
    if (this._pointers.size !== 2 || this._pinchState) return false;

    const pointers = Array.from(this._pointers.values());
    const distance = this._calcDistance(pointers[0], pointers[1]);
    const target = this._findPinchTarget(pointers[0], pointers[1]);
    if (!target) return false;

    // 中断当前单指手势
    if (this._active) {
      this._active.handler.onEnd?.(pointers[0], 0, 0, Date.now() - this._active.startTime);
      this._active = null;
    }

    // 按优先级找匹配的 pinch handler
    for (const handler of this._handlers) {
      if (!handler.onPinchStart) continue;
      if (handler.condition && !handler.condition()) continue;
      if (!this._matchTarget(handler, target, pointers[0])) continue;

      // log('[gesture] pinch start, handler:', handler.id, 'distance:', distance);
      this._pinchState = { handler, initialDistance: distance, initialScale: 1, target };
      handler.onPinchStart(pointers[0], 1);
      return true;
    }
    return false;
  }

  private _handleStart(e: PointerEvent): void {
    if (!this._enabled) return;

    // 追踪所有指针（用于 pinch 检测）
    this._pointers.set(e.pointerId, e);

    // 只响应主按钮（左键/触摸主触点）的单指手势
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (!target) return;

    // 清除上一个手势（防御性）
    this._active = null;

    // preMatch hooks: handler 匹配前全局执行
    for (const fn of this._preMatchHooks) fn(e);

    for (const handler of this._handlers) {
      // 跳过纯双指处理器（只有 onPinch*，没有 onStart/onMove/onEnd），
      // 它们通过 _tryStartPinch 激活。有 onEnd 无 onStart 的处理器（如全屏按钮点击）
      // 需要被匹配，因为 onEnd 在松手时仍会触发。
      if (!handler.onStart && !handler.onMove && !handler.onEnd) continue;
      // 条件检查
      if (handler.condition && !handler.condition()) continue;
      // 目标匹配
      if (!this._matchTarget(handler, target, e)) continue;
      // 预处理钩子
      if (handler.onBeforeStart && !handler.onBeforeStart(e)) continue;

      // 调试日志：检查哪个处理器匹配了触摸
      // log('[gesture] matched handler:', handler.id, 'target:', target.className, 'tagName:', target.tagName);

      // 锁定该处理器
      this._active = {
        handler,
        startX: e.clientX,
        startY: e.clientY,
        startTime: Date.now(),
      };

      // 长按计时器
      if (handler.longPressMs && handler.onLongPress) {
        this._active.longPressTimer = setTimeout(() => {
          if (!this._active || this._active.handler.id !== handler.id) return;
          this._active.longPressConsumed = true;
          this._active.longPressTimer = undefined;
          handler.onLongPress!(e);
        }, handler.longPressMs);
      }

      if (this._shouldStop(handler, 'start')) e.stopPropagation();
      handler.onStart?.(e);
      break; // 只匹配优先级最高的一个
    }

    // 尝试启动 pinch（需要两个指针都在目标内）
    if (this._pointers.size === 2) {
      this._tryStartPinch();
    }
  }

  private _handleMove(e: PointerEvent): void {
    if (!this._enabled) return;

    // 更新指针位置
    this._pointers.set(e.pointerId, e);

    // 处理 pinch 手势
    if (this._pinchState && this._pointers.size === 2) {
      const pointers = Array.from(this._pointers.values());
      const currentDistance = this._calcDistance(pointers[0], pointers[1]);
      const scale = currentDistance / this._pinchState.initialDistance;
      this._pinchState.handler.onPinchMove?.(e, scale);
      return; // pinch 期间不处理单指手势
    }

    const active = this._active;
    if (!active) return;

    // 条件变化检测：如果处理器不再适用，中止手势
    if (active.handler.condition && !active.handler.condition()) {
      active.handler.onEnd?.(e, 0, 0, Date.now() - active.startTime);
      this._active = null;
      return;
    }

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;
    const elapsed = Date.now() - active.startTime;

    // 调试日志：检查手势移动
      // log('[gesture] MOVE, dx:', dx, 'dy:', dy, 'handler:', active.handler.id);

    // 长按检测：移动超过 10px 取消计时器（让路给滑动/滚动）
    if (active.longPressTimer && !active.longPressConsumed && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      clearTimeout(active.longPressTimer);
      active.longPressTimer = undefined;
    }

    if (this._shouldStop(active.handler, 'move')) e.stopPropagation();
    active.handler.onMove?.(e, dx, dy, elapsed);
  }

  private _handleEnd(e: PointerEvent): void {
    if (!this._enabled) return;
    // 移除指针
    this._pointers.delete(e.pointerId);

    // 处理 pinch 结束
    if (this._pinchState) {
      if (this._pointers.size < 2) {
        // 少于两个指针，结束 pinch
        const pointers = Array.from(this._pointers.values());
        let scale = 1;
        if (pointers.length === 1) {
          // 还剩一个指针，计算最终 scale
          const remaining = pointers[0];
          const distance = this._calcDistance(e, remaining);
          scale = distance / this._pinchState.initialDistance;
        }
        this._pinchState.handler.onPinchEnd?.(e, scale);
        this._pinchState = null;
      }
      return;
    }

    const active = this._active;
    if (!active) return;

    // 清除长按计时器
    if (active.longPressTimer) {
      clearTimeout(active.longPressTimer);
      active.longPressTimer = undefined;
    }

    // 长按已消费 → 跳过 onEnd（防止滚动/swipe 误触发）
    if (active.longPressConsumed) {
      this._active = null;
      return;
    }

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;
    const elapsed = Date.now() - active.startTime;

      // 调试日志：检查手势结束类型
      // log('[gesture] END, type:', e.type, 'handler:', active.handler.id, 'dx:', dx.toFixed(0));
      // log('[gesture] END, type:', e.type, 'dx:', dx, 'dy:', dy, 'handler:', active.handler.id);

    if (this._shouldStop(active.handler, 'end')) e.stopPropagation();
    active.handler.onEnd?.(e, dx, dy, elapsed);
    this._active = null;
  }
}

/** 全局单例 */
export const gestures = new GestureRegistry();