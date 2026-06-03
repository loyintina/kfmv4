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

// ========== RenderContext：渲染器相关的可变状态容器 ==========

/** 属于一个渲染器的可变状态集合。替换渲染器时通过 pushContext/popContext 原子化切换。 */
export interface RenderContext {
  renderer: Renderer | null;
  rowIndex: Box[];
  cursorBox: Box | null;
  cursorRowId: string | null;
}

// ========== 主类 ==========

export class RendererLifecycle {
  /** 上下文栈，索引 0 为默认上下文 */
  private _ctxStack: RenderContext[] = [{
    renderer: null, rowIndex: [], cursorBox: null, cursorRowId: null,
  }];

  /** 当前上下文（栈顶） */
  get ctx(): RenderContext { return this._ctxStack[this._ctxStack.length - 1]; }

  // ---- 向后兼容：通过 this.ctx 委托的访问器 ----
  get renderer(): Renderer | null { return this.ctx.renderer; }
  set renderer(v: Renderer | null) { this.ctx.renderer = v; }
  get _rowIndex(): Box[] { return this.ctx.rowIndex; }
  set _rowIndex(v: Box[]) { this.ctx.rowIndex = v; }
  get cursorBox(): Box | null { return this.ctx.cursorBox; }
  set cursorBox(v: Box | null) { this.ctx.cursorBox = v; }
  get cursorRowId(): string | null { return this.ctx.cursorRowId; }
  set cursorRowId(v: string | null) { this.ctx.cursorRowId = v; }
  // ---- 侧栏打开/关闭时暂存的光标位置（不属于 RenderContext） ----
  _savedCursorRowId: string | null = null;
  _pendingSelectFile: string | null = null;
  // ---- 显式接口（替代跨模块 _ 前缀直接访问，符合 §1.2 约束） ----

  /** 设置待选中的文件路径（AI select-file 命令使用） */
  setPendingSelectFile(path: string): void { this._pendingSelectFile = path; }
  /** 消费并清除待选中的文件路径，返回已保存值（无待选时返回 null） */
  consumePendingSelectFile(): string | null {
    const path = this._pendingSelectFile;
    this._pendingSelectFile = null;
    return path;
  }

  /** 保存侧栏关闭前的滚动位置和光标行（openSidebar 时通过 resetForOpen 恢复） */
  saveSidebarScrollState(scrollY: number, cursorRowId: string | null): void {
    this._savedScrollY = scrollY;
    this._savedCursorRowId = cursorRowId;
  }

  /** 侧栏是否已关闭（scroll gesture 守卫） */
  isSidebarClosed(): boolean { return this._sidebarClosed; }
  setSidebarClosed(v: boolean): void { this._sidebarClosed = v; }

  /** 恢复模式标记：恢复期间跳过 GSAP 滚动动画 */
  isRestoreMode(): boolean { return this._restoreMode; }
  setRestoreMode(v: boolean): void { this._restoreMode = v; }

  /** KFMState 订阅引用管理 */
  setStateSub(fn: ((state: any) => void) | null): void { this._stateSub = fn; }
  getStateSub(): ((state: any) => void) | null { return this._stateSub; }

  /** 返回当前动画已执行的毫秒数（无动画时返回 0） */
  get animElapsed(): number {
    return this._treeOp.kind === 'animating' ? Date.now() - this._treeOp.startedAt : 0;
  }


  // ---- RenderContext 原子化切换 ----

  /**
   * 推入新上下文。未指定的字段从当前上下文继承。
   * 返回当前上下文，调用方可引用它判断是否有变化。
   */
  pushContext(ctx: Partial<RenderContext>): void {
    const cur = this.ctx;
    this._ctxStack.push({
      renderer: ctx.renderer !== undefined ? ctx.renderer : cur.renderer,
      rowIndex: ctx.rowIndex !== undefined ? ctx.rowIndex : cur.rowIndex,
      cursorBox: ctx.cursorBox !== undefined ? ctx.cursorBox : cur.cursorBox,
      cursorRowId: ctx.cursorRowId !== undefined ? ctx.cursorRowId : cur.cursorRowId,
    });
  }

  /** 弹出当前上下文，恢复到上一个。至少保留一个默认上下文。 */
  popContext(): void {
    if (this._ctxStack.length > 1) this._ctxStack.pop();
  }

  // ---- KFMState 订阅 ----
  _stateSub: ((state: any) => void) | null = null;

  // ---- 滚动 ----
  _savedScrollY = 0;
  _lastUserScrollY = 0;
  _restoreMode = false;
  _sidebarClosed = true;
  _restoringFromSave = false;

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
      if (id) { cancelAnimationFrame(id); (this as unknown as Record<string, number>)[key] = 0; }
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
    this._pendingSelectFile = null;
  }

}

/** 全局单例 */
export const L = new RendererLifecycle();
