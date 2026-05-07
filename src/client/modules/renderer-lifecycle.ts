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

  // ---- 状态机：显式状态转换 ----
  beginOp(path: string, direction: 'expand' | 'collapse'): void {
    this._treeOp = { kind: 'animating', path, direction, startedAt: Date.now() };
  }

  endOp(): void {
    this._treeOp = { kind: 'idle' };
  }

  get isAnimating(): boolean {
    return this._treeOp.kind !== 'idle';
  }

  get animatingDir(): 'expand' | 'collapse' | null {
    return this._treeOp.kind === 'animating' ? this._treeOp.direction : null;
  }

  // ---- 向后兼容：旧代码仍可读取 animatingPath / _animBusy / _animBusyAt ----
  // 写入请用 beginOp() / endOp()；读取用 isAnimating / animatingDir / animatingPath
  get animatingPath(): string | null {
    return this._treeOp.kind === 'animating' ? this._treeOp.path : null;
  }
  // animatingPath setter 已删除 — 所有写入走 beginOp(path, direction)
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
    this.cursorBox = null;
    this.cursorRowId = this._savedCursorRowId;
    this._savedCursorRowId = null;
    this._rowIndex = [];
    this._sidebarClosed = false;
  }

}

/** 全局单例 */
export const L = new RendererLifecycle();
