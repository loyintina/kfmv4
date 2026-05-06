/**
 * RendererLifecycle — 渲染器生命周期注册中心
 *
 * 集中管理 tree-render.ts 的所有可变状态、rAF 循环和 DOM 事件监听。
 * onSidebarOpen/Close 通过此注册中心统一初始化和清理。
 */

// ========== 类型 ==========

import type { Box } from '../engine/v2/box.js';
import type { Renderer } from '../engine/v2/renderer.js';

interface ListenerRef {
  target: EventTarget;
  type: string;
  listener: EventListener;
  options?: AddEventListenerOptions | boolean;
}

// ========== 主类 ==========

export class RendererLifecycle {
  // ---- Renderer ----
  renderer: Renderer | null = null;

  // ---- KFMState 订阅 ----
  _stateSub: ((state: any) => void) | null = null;

  // ---- 光标 ----
  cursorBox: Box | null = null;
  cursorRowId: string | null = null;
  _savedCursorRowId: string | null = null;

  // ---- 滚动 ----
  _savedScrollY = 0;
  _lastUserScrollY = 0;
  _restoreMode = false;
  _sidebarClosed = true;
  _restoringFromSave = false;

  // ---- 行索引 ----
  _rowIndex: Box[] = [];

  // ---- 会话隔离 ----
  _sessionId = 0;

  // ---- 动画锁（形式化状态机） ----
  // idle = 无动画进行；animating = 正在展开或折叠指定路径
  _treeOp: { kind: 'idle' } | { kind: 'animating'; path: string; direction: 'expand' | 'collapse'; startedAt: number } = { kind: 'idle' };
  pendingCollapse: { path: string; rowId: string } | null = null;
  _clickQueue: Array<{ offsetX: number; offsetY: number }> = [];

  // ---- 向后兼容：旧代码仍可读取 animatingPath / _animBusy / _animBusyAt ----
  get animatingPath(): string | null {
    return this._treeOp.kind === 'animating' ? this._treeOp.path : null;
  }
  set animatingPath(v: string | null) {
    if (v === null) {
      this._treeOp = { kind: 'idle' };
    } else {
      this._treeOp = { kind: 'animating', path: v, direction: 'expand', startedAt: Date.now() };
    }
  }
  get _animBusy(): boolean {
    return this._treeOp.kind !== 'idle';
  }
  set _animBusy(v: boolean) {
    if (!v && this._treeOp.kind === 'animating') {
      this._treeOp = { kind: 'idle' };
    }
    // setting true is always preceded by animatingPath setter, so no-op here
  }
  get _animBusyAt(): number {
    return this._treeOp.kind === 'animating' ? this._treeOp.startedAt : 0;
  }
  set _animBusyAt(_v: number) {
    // no-op, startedAt is set when the op begins
  }

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
    this._treeOp = { kind: 'idle' };
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
    this._treeOp = { kind: 'idle' };
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
