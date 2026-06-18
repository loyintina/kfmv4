/**
 * KFM v4 - 手势注册中心
 *
 * 集中管理所有 document-level 触摸事件，按优先级调度。
 * 原则：优先匹配、独占执行 —— 同一时刻只有一个处理器响应手势。
 */

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
  /** 长按检测（ms），触发后设置 longPressConsumed */
  longPressMs?: number;
  onLongPress?: (event: PointerEvent) => void;
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

// ========== Registry 实现 ==========

export class GestureRegistry {
  private _handlers: GestureHandler[] = [];
  private _active: ActiveGesture | null = null;
  private _enabled = true;
  private _initialized = false;

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

  isRegistered(id: string): boolean {
    return this._handlers.some(h => h.id === id);
  }

  // ========== 全局控制 ==========

  disable(): void {
    this._enabled = false;
    this._active = null; // 清除进行中的手势
  }

  enable(): void {
    this._enabled = true;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  // ========== 生命周期 ==========

  /** 初始化：注册 document 级 pointer 监听（在主入口调用一次） */
  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    // 禁止浏览器接管触摸（否则 pointermove 会被提前终止）
    document.body.style.touchAction = 'none';
    // pointerdown 用 passive:false 以支持 preventDefault（主光球需要阻止滚动）
    document.addEventListener('pointerdown', this._onStart, { passive: false });
    document.addEventListener('pointermove', this._onMove, { passive: true });
    document.addEventListener('pointerup', this._onEnd, { passive: true });
    document.addEventListener('pointercancel', this._onEnd, { passive: true });
  }

  /** 销毁：移除所有监听 */
  destroy(): void {
    document.removeEventListener('pointerdown', this._onStart);
    document.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerup', this._onEnd);
    document.removeEventListener('pointercancel', this._onEnd);
    this._handlers = [];
    this._active = null;
    this._initialized = false;
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

  private _handleStart(e: PointerEvent): void {
    if (!this._enabled) return;
    // 只响应主按钮（左键/触摸主触点）
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (!target) return;

    if (this._active && this._active.handler.id === 'card-stack-global') {
    }

    // 清除上一个手势（防御性）
    this._active = null;

    for (const handler of this._handlers) {
      // 条件检查
      if (handler.condition && !handler.condition()) continue;
      // 目标匹配
      if (!this._matchTarget(handler, target, e)) continue;
      // 预处理钩子
      if (handler.onBeforeStart && !handler.onBeforeStart(e)) continue;

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
      return; // 只匹配优先级最高的一个
    }
  }

  private _handleMove(e: PointerEvent): void {
    if (!this._enabled) return;
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

    if (this._shouldStop(active.handler, 'end')) e.stopPropagation();
    active.handler.onEnd?.(e, dx, dy, elapsed);
    this._active = null;
  }
}

/** 全局单例 */
export const gestures = new GestureRegistry();