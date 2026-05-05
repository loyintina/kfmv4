/**
 * RendererLifecycle — 渲染器生命周期注册中心
 *
 * 集中管理 tree-render.ts 的所有可变状态、rAF 循环和 DOM 事件监听。
 * onSidebarOpen/Close 通过此注册中心统一初始化和清理。
 */

// ========== 类型 ==========

interface ListenerRef {
  target: EventTarget;
  type: string;
  listener: EventListener;
  options?: AddEventListenerOptions | boolean;
}

// ========== 主类 ==========

export class RendererLifecycle {
  // ---- Renderer ----
  renderer: any = null;

  // ---- KFMState 订阅 ----
  _stateSub: ((state: any) => void) | null = null;

  // ---- 光标 ----
  cursorBox: any = null;
  cursorRowId: string | null = null;
  _savedCursorRowId: string | null = null;

  // ---- 滚动 ----
  _savedScrollY = 0;
  _lastUserScrollY = 0;
  _restoreMode = false;
  _sidebarClosed = true;
  _restoringFromSave = false;

  // ---- 行索引 ----
  _rowIndex: any[] = [];

  // ---- 会话隔离 ----
  _sessionId = 0;

  // ---- 动画锁 ----
  animatingPath: string | null = null;
  _animBusy = false;
  _animBusyAt = 0;
  pendingCollapse: { path: string; rowId: string } | null = null;
  _clickQueue: Array<{ offsetX: number; offsetY: number }> = [];

  // ---- rAF 句柄 ----
  _cursorWheelDecayRaf = 0;
  _wheelRaf = 0;
  _cursorFlingRaf = 0;
  _flingRaf = 0;

  // ---- DOM 监听器追踪 ----
  private _listenerRefs: ListenerRef[] = [];

  // ========== rAF 管理 ==========

  /** 取消所有已注册的 rAF 循环 */
  cancelAllRafs(): void {
    const handles = [
      "_cursorWheelDecayRaf", "_wheelRaf", "_cursorFlingRaf", "_flingRaf"
    ] as const;
    for (const key of handles) {
      const id = this[key] as number;
      if (id) { cancelAnimationFrame(id); (this as any)[key] = 0; }
    }
  }

  // ========== Listener 管理 ==========

  /** 注册 DOM 事件监听（自动追踪，供 removeAllListeners 清理） */
  registerListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean
  ): void {
    target.addEventListener(type, listener, options);
    this._listenerRefs.push({ target, type, listener, options });
  }

  /** 移除所有通过 registerListener 注册的监听器 */
  removeAllListeners(): void {
    for (const ref of this._listenerRefs) {
      ref.target.removeEventListener(ref.type, ref.listener, ref.options);
    }
    this._listenerRefs = [];
  }

  // ========== 生命周期快捷方法 ==========

  /** 侧栏打开时的状态重置 */
  resetForOpen(): void {
    this._sessionId++;
    this._animBusy = false;
    this._animBusyAt = 0;
    this.animatingPath = null;
    this._clickQueue = [];
    this.cursorBox = null;
    this.cursorRowId = this._savedCursorRowId;
    this._savedCursorRowId = null;
    this._rowIndex = [];
    this.pendingCollapse = null;
    this._sidebarClosed = false;
  }

  /** 侧栏关闭时的状态保存 + 清理 */
  prepareClose(): void {
    this._sidebarClosed = true;
    this._animBusy = false;
    this._animBusyAt = 0;
    this._restoringFromSave = true;
    this._clickQueue = [];
    this.cursorBox = null;
    this.cursorRowId = null;
    this._rowIndex = [];
    this.cancelAllRafs();
    this.removeAllListeners();
  }
}

/** 全局单例 */
export const L = new RendererLifecycle();
