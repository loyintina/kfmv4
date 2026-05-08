/**
 * tree-render.ts — 渲染层
 *
 * 用 kfmv3 v2 引擎渲染 Box 树到 Canvas。
 * 滚动事件 → 写 rootBox.scrollY → 引擎自动处理裁剪/偏移/滚动条。
 * 点击事件 → 光标优先：第一次点击移动光标，第二次点击同一行执行 onTap。
 */

import { buildSidebarTree } from './tree-model.js';
import { KFMState } from './state.js';
import { anim } from './animation-registry.js';
import { animateCharRain, killActiveCharRain } from "./char-rain.js";
import { closeSidebar } from './ui.js';
import { Renderer } from '../engine/v2/renderer.js';
import { L } from './renderer-lifecycle.js';
import { _rebuildRowIndex, findBoxById } from './canvas-utils.js';
import { Box } from '../engine/v2/box.js';
import { getCursorRowIndex, getRowIndexLength, moveCursorTo, ensureCursorBox, _moveCursorBySteps, _isCursorMode, _getCenterRowIndex, _snapCursorToCenter, _scrollToCenterCursor } from './canvas-cursor.js';
import { bindScrollEvents } from './canvas-scroll.js';
import { DOM } from "./dom-refs.js";
import { treeAbort } from './abort.js';
import * as clickQueue from "./click-queue.js";
import { assert, warn } from "./debug-assert.js";
import { debugLog } from "./debug-panel.js";
const ts = anim.scope('tree-render');

/** 重置动画时间线：清空 tween + 归零播放头。正常动画结束时调用。
 *  注意：不杀 char-rain（让其自然播完）。中断场景需额外调用 killActiveCharRain()。 */
function _resetAnimTimeline(): void {
  ts.clear();
  ts.time(0);
}

// ========== Overlay 元数据类型 ==========
/** overlay Box 上挂载的动画元数据，替代 (as any) 隐式契约 */
interface OverlayMeta {
  _fullHeight?: number;
  _origYs?: number[];
  _targetY?: number;
  _savedCr?: number;
  _toggleBox?: Box;
  _toggleRotate?: number;
}

// ========== Overlay 管理 ==========
const _activeOverlays: Box[] = [];

const OVERLAY_Z = 200;

function _addOverlay(overlay: Box): void {
  _activeOverlays.push(overlay);
}

function _removeOverlay(overlay: Box): void {
  const idx = _activeOverlays.indexOf(overlay);
  if (idx >= 0) _activeOverlays.splice(idx, 1);
  if (overlay.parent) {
    const pidx = overlay.parent.children.indexOf(overlay);
    if (pidx >= 0) overlay.parent.children.splice(pidx, 1);
  }
}

function _removeAllOverlays(): void {
  for (const ov of [..._activeOverlays]) {
    _removeOverlay(ov);
  }
  _activeOverlays.length = 0;
}

/** 收集 container 在 parent 中之后的所有兄弟（排除 cursor-highlight） */
function _collectSiblingsAfter(container: Box): Box[] {
  const parent = container.parent;
  if (!parent) return [];
  const idx = parent.children.indexOf(container);
  if (idx < 0) return [];
  const result: Box[] = [];
  for (let i = idx + 1; i < parent.children.length; i++) {
    const sib = parent.children[i];
    if (sib.id === 'cursor-highlight') continue;
    if (_activeOverlays.includes(sib)) continue;
    result.push(sib);
  }
  return result;
}

// ========== Box 视觉克隆器 ==========

function _createVisualClone(
  src: Box,
  overrides?: Partial<{ x: number; y: number; width: number; height: number; opacity: number; zIndex: number; visible: boolean; id: string }>,
): Box {
  const clone = new Box({
    x: overrides?.x ?? src.x,
    y: overrides?.y ?? src.y,
    width: overrides?.width ?? src.width,
    height: overrides?.height ?? src.height,
    opacity: overrides?.opacity ?? src.opacity ?? 1,
    visible: overrides?.visible ?? src.visible,
    backgroundColor: src.backgroundColor || 'transparent',
    borderRadius: src.borderRadius,
    gradient: src.gradient ? { ...src.gradient } : undefined,
    shadow: src.shadow ? { ...src.shadow } : undefined,
    border: src.border ? { ...src.border } : undefined,
    highlight: src.highlight ? { ...src.highlight } : undefined,
    id: overrides?.id ?? `ov-${src.id || 'unknown'}`,
    interactive: false,
    zIndex: overrides?.zIndex ?? src.zIndex + OVERLAY_Z,
    overflow: 'visible',
    kfmStyle: src.kfmStyle ? { ...src.kfmStyle } : undefined,
    data: { ...(src as any).data },
  });
  if (src.textStyle) {
    clone.textStyle = { ...src.textStyle };
  }
  if (src.transform) {
    clone.transform = { ...src.transform };
  }
  // 递归克隆子 Box（label-* / toggle-* 等视觉子元素）
  for (const child of src.children) {
    if (child.id?.startsWith('label-') || child.id?.startsWith('toggle-')) {
      const childClone = new Box({
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
        opacity: child.opacity ?? 1,
        visible: child.visible,
        backgroundColor: child.backgroundColor || 'transparent',
        interactive: false, id: child.id,
        zIndex: child.zIndex + OVERLAY_Z,
        overflow: 'visible',
        kfmStyle: child.kfmStyle ? { ...child.kfmStyle } : undefined,
      });
      if (child.textStyle) childClone.textStyle = { ...child.textStyle };
      if (child.transform) childClone.transform = { ...child.transform };
      clone.addChild(childClone);
    }
  }
  return clone;
}

// ========== Overlay 搭建 ==========

interface OverlayPack {
  containerOverlay: Box;
  rowOverlays: Box[];
  siblingOverlays: Box[];
  /** 被隐藏的真实兄弟 */
  hiddenSiblings: Box[];
  /** 被隐藏的容器内子行 */
  hiddenChildren: Box[];
}

/** 搭建展开动画的 overlay 集合 */
function _setupExpandOverlays(container: Box, fullHeight: number): OverlayPack {
  const parent = container.parent!;
  const ci = parent.children.indexOf(container);

  // 1. 容器 overlay (height=0, 即将动画到 fullHeight)
  const containerOv = _createVisualClone(container, { id: `ov-${container.id || 'container'}`, height: 0, opacity: 1, zIndex: OVERLAY_Z });
  _addOverlay(containerOv);
  // 插入到 container 之后
  parent.children.splice(ci + 1, 0, containerOv);
  // 修正 parent 引用（splice 不自动设置）
  containerOv.parent = parent;

  // 2. 行 overlay（FROM=折叠态 y，TO=终端态 y，从元数据计算）
  const rowOverlays: Box[] = [];
  const hiddenChildren: Box[] = [];
  const origYs = (container as Box & OverlayMeta)._origYs as number[] | undefined;
  for (let j = 0; j < container.children.length; j++) {
    const child = container.children[j];
    if (!child.visible) continue;
    const expandedY = origYs ? origYs[j] : child.y;   // terminal (expanded) Y
    const collapsedY = expandedY - fullHeight;         // computed collapsed Y
    const rowOv = _createVisualClone(child, { id: child.id || (`row-${j}`), y: collapsedY, opacity: 1, zIndex: OVERLAY_Z + 1 });
    (rowOv as Box & OverlayMeta)._targetY = expandedY;  // GSAP target
    _addOverlay(rowOv);
    containerOv.addChild(rowOv);
    rowOverlays.push(rowOv);
    // 隐藏真实行
    child.opacity = 0;
    hiddenChildren.push(child);
  }

  // 3. 兄弟 overlay（FROM=折叠态 y，TO=终端态 y，从元数据计算）
  const siblingOverlays: Box[] = [];
  const hiddenSiblings: Box[] = [];
  const siblings = _collectSiblingsAfter(container);
  for (const sib of siblings) {
    const sibOv = _createVisualClone(sib, { id: `ov-${sib.id || 'sib'}`, y: sib.y - fullHeight, opacity: 1, zIndex: OVERLAY_Z });
    (sibOv as Box & OverlayMeta)._targetY = sib.y;  // terminal position
    _addOverlay(sibOv);
    const si = parent.children.indexOf(sib);
    parent.children.splice(si, 0, sibOv);
    sibOv.parent = parent;
    siblingOverlays.push(sibOv);
    sib.opacity = 0;
    hiddenSiblings.push(sib);
  }

  return { containerOverlay: containerOv, rowOverlays, siblingOverlays, hiddenSiblings, hiddenChildren };
}

/** 搭建折叠动画的 overlay 集合 */
function _setupCollapseOverlays(container: Box, fullH: number): OverlayPack {
  const parent = container.parent!;
  const ci = parent.children.indexOf(container);

  // 1. 容器 overlay (height=fullH, 即将动画到 0)
  const containerOv = _createVisualClone(container, { id: `ov-${container.id || 'container'}`, height: fullH, opacity: 1, zIndex: OVERLAY_Z });
  _addOverlay(containerOv);
  parent.children.splice(ci + 1, 0, containerOv);
  containerOv.parent = parent;
  containerOv.overflow = 'hidden';  // 折叠时裁剪文字

  debugLog(`[collapse] setup path=${container.id} fullH=${fullH} overflow=${containerOv.overflow} height=${containerOv.height} borderRadius=${containerOv.borderRadius} parent=${parent.id}`);

  // 2. 行 overlay：固定在展开态 y，不单独做 Y 动画。
  // 容器 overlay 收缩时 overflow:hidden 自然裁掉它们，无需行自己动。
  const rowOverlays: Box[] = [];
  const hiddenChildren: Box[] = [];
  for (let j = 0; j < container.children.length; j++) {
    const child = container.children[j];
    if (!child.visible) continue;
    const rowOv = _createVisualClone(child, { id: child.id || (`row-${j}`), y: child.y, opacity: 1, zIndex: OVERLAY_Z + 1 });
    _addOverlay(rowOv);
    containerOv.addChild(rowOv);
    rowOverlays.push(rowOv);
    child.opacity = 0;
    hiddenChildren.push(child);
  }

  // 3. 兄弟 overlay（在展开态 y（已下移），目标 y = y - fullH 折叠态）
  const siblingOverlays: Box[] = [];
  const hiddenSiblings: Box[] = [];
  const siblings = _collectSiblingsAfter(container);
  for (const sib of siblings) {
    const sibOv = _createVisualClone(sib, { id: `ov-${sib.id || 'sib'}`, y: sib.y, opacity: 1, zIndex: OVERLAY_Z });
    (sibOv as Box & OverlayMeta)._targetY = sib.y - fullH;
    _addOverlay(sibOv);
    const si = parent.children.indexOf(sib);
    parent.children.splice(si, 0, sibOv);
    sibOv.parent = parent;
    siblingOverlays.push(sibOv);
    sib.opacity = 0;
    hiddenSiblings.push(sib);
  }

  return { containerOverlay: containerOv, rowOverlays, siblingOverlays, hiddenSiblings, hiddenChildren };
}

/** 保存 KFMState 订阅引用，防止重复订阅 */
function _ensureSubscribed(): void {
  if (L._stateSub) KFMState.unsubscribe(L._stateSub);
  L._stateSub = () => {
    // state 变化（toggleHidden/expanded）是用户主动行为，跳过 L._animBusy 锁
    L.endOp();
    // 守卫：_stateSub 被调用时 L.isAnimating 必须已被 endOp() 清除。
    // 如果这里 isAnimating 仍为 true，说明有人在动画进行中调了 notify()。
    if (L.isAnimating) warn('_stateSub fired while animation still active');

    rebuildTree();
  };
  KFMState.subscribe(L._stateSub);
}

/** 外部使用：标记某路径正在做展开动画（懒加载专用） */
export function markAnimatingPath(path: string | null): void {
  if (path === null) {
    L.endOp();
  } else {
    L.beginOp(path, 'expand');
  }
}

export function triggerExpandAnimation(path: string): void {
  const root = L.renderer?.getRoot();
  if (!root) return;
  const container = findBoxById(root, `expanded-${path}`);
  const titleRow = findBoxById(root, `title-${path}`);
  const toggle2 = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));

  if (!container) return;

  const fullHeight = (container as Box & OverlayMeta)._fullHeight || 0;
  if (!fullHeight) {
    if (toggle2 && toggle2.transform) {
      toggle2.transform.rotate = 0;
      ts.to(toggle2.transform, {
        rotate: Math.PI / 2,
        duration: 0.3,
        ease: 'power2.out',
        onUpdate: () => { L.renderer?.setRoot(L.renderer!.getRoot()!); },
      }, 0);
    }
    return;
  }

  // 手动将 toggle 归零（buildExpanded 设为 90°，但展开动画 FROM 是 0°）
  if (toggle2) {
    anim.killTweensOf(toggle2.transform);
    toggle2.transform.rotate = 0;
  }

  // === overlay 模式 ===
  assert(_activeOverlays.length === 0, 'overlays not empty before triggerExpandAnimation');
  const pack = _setupExpandOverlays(container, fullHeight);
  const rowTargetYs = pack.rowOverlays.map(r => (r as Box & OverlayMeta)._targetY as number);
  // 关键：传真实容器而非 overlay，字符 Box 不会被 _removeAllOverlays 误杀
  animateCharRain(container, root, L.renderer, rowTargetYs);

  L.beginOp(path, 'expand');
  const animRoot = L.renderer!.getRoot()!;

  // 容器 overlay: height 0→fullHeight
  ts.to(pack.containerOverlay, {
    height: fullHeight,
    duration: 0.05,
    ease: 'back.out(1.15)',
    onUpdate: () => {
      if (L.renderer?.getRoot() !== animRoot) return;
      L.renderer?.setRoot(L.renderer!.getRoot()!);
    },
  }, 0);

  // 行 overlay: y→_targetY
  for (const rowOv of pack.rowOverlays) {
    ts.to(rowOv, {
      y: (rowOv as Box & OverlayMeta)._targetY!,
      duration: 0.05,
      ease: 'back.out(1.15)',
      onUpdate: () => {
        if (L.renderer?.getRoot() !== animRoot) return;
        L.renderer?.setRoot(L.renderer!.getRoot()!);
      },
    }, 0);
  }

  // 兄弟 overlay: y→_targetY
  for (const sibOv of pack.siblingOverlays) {
    ts.to(sibOv, {
      y: (sibOv as Box & OverlayMeta)._targetY!,
      duration: 0.05,
      ease: 'back.out(1.15)',
      onUpdate: () => {
        if (L.renderer?.getRoot() !== animRoot) return;
        L.renderer?.setRoot(L.renderer!.getRoot()!);
      },
    }, 0);
  }

  // 动画完成: 清理 overlay → 主树已是终端态
  ts.call(() => {
    if (L.renderer?.getRoot() !== animRoot) return;
    _removeAllOverlays();
    _resetAnimTimeline();
    assert(_activeOverlays.length === 0, 'overlays leaked after animation');
    for (const c of pack.hiddenChildren) c.opacity = 1;
    for (const s of pack.hiddenSiblings) s.opacity = 1;
    if (container.kfmStyle && (container as Box & OverlayMeta)._savedCr !== undefined) {
      container.kfmStyle.cornerRadius = (container as Box & OverlayMeta)._savedCr!;
    }
    // 主树已是终端态，不需要第二次 rebuildTree
    // _ensureMetaFromExpandedState 已在 rebuildTree 中调用
    L.renderer?.setRoot(L.renderer!.getRoot()!);
    if (container) {
      _unveilOverlaySubContainers(container, root, toggle2).catch((err: any) => {
        warn(`_unveilOverlaySubContainers failed: ${err?.message || err}`);
      }).finally(() => {
        L.endOp();
        const _root = L.renderer?.getRoot();
        if (_root) { _rebuildRowIndex(_root); }
        processClickQueue();
      });
    } else {
      L.endOp();
      const _root = L.renderer?.getRoot();
      if (_root) { _rebuildRowIndex(_root); }
      processClickQueue();
    }
  });
}
export function isAnimLocked(): boolean {
  return L.isAnimating;
}

// ============================================================
// 光标状态
// ============================================================

// 光标步进模式 —— 行索引（按绝对 Y 坐标排序的可交互行）

// ===== 事件堆栈 + 会话隔离 =====
// 会话隔离：每次开/关侧栏递增 L._sessionId，旧会话异步操作自动失效
// 事件堆栈：同一会话内快速点击串行执行

export function onSidebarOpen(): void {
  // ===== 销毁旧渲染器 + 通过生命周期重置所有状态 =====
  killActiveCharRain();
  _resetAnimTimeline();
  L.renderer?.stop();
  L.renderer = null;
  L.resetForOpen();

  // ===== 从零重建：销毁旧 canvas，创建新渲染器 =====
  const fileTree = DOM.fileTree;
  if (!fileTree) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'tree-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  fileTree.innerHTML = '';          // 彻底销毁旧 DOM（包括旧 canvas）
  fileTree.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  L.renderer = new Renderer(canvas, {
    backgroundColor: 'rgba(10,10,15,0.85)',
    dpr,
  });

  // 等 CSS layout 完成后再 rebuildTree（canvas 刚创建时 clientWidth=0）
  requestAnimationFrame(() => {
    _removeAllOverlays();
    rebuildTree();
    // rebuildTree 后强制恢复 scrollY（在所有可能覆盖它的逻辑之后）
    if (L._savedScrollY > 0) {
      const root = L.renderer?.getRoot();
      if (root) {
        const maxY = root.getMaxScroll().maxY;
        root.scrollY = Math.min(L._savedScrollY, maxY);
        // 实验日志：写到页面上可见
        const savedVal = root.scrollY;
        L._savedScrollY = 0;
        L._restoreMode = true;
        setTimeout(() => {
          L._restoreMode = false;
          // 最终检查：如果 scrollY 被覆盖了，强制恢复
          const r2 = L.renderer?.getRoot();
          if (r2 && Math.abs(r2.scrollY - savedVal) > 10) {
            r2.scrollY = savedVal;
          }
          // 最终状态日志
        }, 500);
      }
    }
    L._restoringFromSave = false;
    L.renderer?.resize();
    window.__treeRenderer = L.renderer;

    _ensureSubscribed();
    window.addEventListener('resize', () => L.renderer?.resize());

    bindScrollEvents(canvas);
    bindClickEvents(canvas, dpr);

    // 创建左栏右侧触摸盒子
    _createSidebarTouchArea();
  });

  // 等侧栏 CSS 过渡结束后再 resize 一次
  const sidebar = DOM.sidebar;
  if (sidebar) {
    const onEnd = () => {
      sidebar.removeEventListener('transitionend', onEnd);
      L.renderer?.resize();
    };
    sidebar.addEventListener('transitionend', onEnd);
  }
}

export function onSidebarClose(): void {
  // 先停掉所有动画和独立rAF循环
  _removeAllOverlays();
  killActiveCharRain();
  _resetAnimTimeline();
  L._sidebarClosed = true;  // 让wheel/touch的rAF循环自己退出
  L.endOp();
  
  L._restoringFromSave = true;
  // 直接保存当前 scrollY（动画停止后的稳定值）
  const rootScrollY = L.renderer?.getRoot()?.scrollY ?? 0;
  // 关键：只有 L.renderer 存在时才保存，避免用 0/null 覆盖正确的值
  if (L.renderer && L.renderer.getRoot()) {
    L._savedScrollY = rootScrollY;
    L._savedCursorRowId = L.cursorRowId;
  }
  clickQueue.clear();
  L.cursorBox = null;
  L.cursorRowId = null;
  L._rowIndex = [];
  L.renderer?.stop();
  L.renderer = null;
  DOM.sidebarTouchArea?.remove();
  L.cancelAllRafs();
}

export function initTreeRenderer(): void {
  const fileTree = DOM.fileTree;
  if (!fileTree) {
    console.warn('[tree-render] #fileTree not found');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'tree-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  fileTree.innerHTML = '';
  fileTree.appendChild(canvas);

  const dpr = window.devicePixelRatio || 1;
  L.renderer = new Renderer(canvas, {
    backgroundColor: 'rgba(10,10,15,0.85)',
    dpr,
  });

  rebuildTree();

  // 暴露到 window 供调试
  window.__treeRenderer = L.renderer;

  _ensureSubscribed();
  window.addEventListener('resize', () => L.renderer?.resize());

  bindScrollEvents(canvas);
  bindClickEvents(canvas, dpr);
}


/** 创建左栏右侧触摸盒子：填充剩余屏幕，同步滚动 + 点击执行光标动作 + 右往左滑关闭 */
function _createSidebarTouchArea(): void {
  const old = DOM.sidebarTouchArea;
  if (old) old.remove();

  const sidebar = DOM.sidebar;
  if (!sidebar) return;

  const box = document.createElement('div');
  box.id = 'sidebarTouchArea';
  const w = sidebar.getBoundingClientRect().width;
  box.style.cssText = `position:fixed;top:0;bottom:0;right:0;z-index:999;touch-action:none;left:${w}px;`;
  document.body.appendChild(box);

  // 绑定��样的滚动事件（wheel + touch）
  bindScrollEvents(box);

  // 点击任意位置 → 执行���前光标行的动作
  box.addEventListener('click', () => {
    if (!L.cursorRowId || L._rowIndex.length === 0) return;
    const idx = getCursorRowIndex();
    if (idx < 0 || !L._rowIndex[idx]) return;
    const hit = L._rowIndex[idx]!;
    const hitData = (hit as any).data || {};
    if (hitData.isDir) {
      if (hitData.isExpanded) { doCollapse(hit, hitData); }
      else { doExpand(hit, hitData); }
    } else {
      hit.gesture?.onTap?.();
    }
  });

  // 右往左滑 → 关闭左栏
  let sx = 0;
  box.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX;
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (sx - e.changedTouches[0].clientX > 60) closeSidebar();
  });
}

function bindClickEvents(canvas: HTMLElement, _dpr: number): void {
  canvas.addEventListener('click', (e) => {
    if (!L.renderer) return;

    clickQueue.enqueue({ offsetX: e.offsetX, offsetY: e.offsetY });
    processClickQueue();
  });
}

/**
 * 事件堆栈核心：逐一处理点击队列。
 * 每次处理一个点击，如果是展开/折叠则启动动画，
 * 动画�������成后自动处理队列中下一个点击。
 */

/** 在树中查找点击目标路径（用于 P2 状态机同路径判断） */
function _findClickPath(root: Box, px: number, py: number): string | null {
  for (const child of root.children) {
    if (!child.visible || child.disabled) continue;
    const hit = findTapTarget(child, px, py);
    if (hit) {
      const d = (hit as any).data || {};
      return d.path || null;
    }
  }
  return null;
}
function processClickQueue(): void {
  if (clickQueue.isEmpty() || !L.renderer) return;

  // === P2 状态机：动画进行中 ===
  if (L.isAnimating) {
    if (L._animBusyAt && Date.now() - L._animBusyAt > 3000) {
      L.endOp();
      clickQueue.clear();
      return;
    }
    const next = clickQueue.peek();
    if (next) {
      const r = L.renderer!.getRoot()!;
      const sy = r.scrollY ?? 0;
      const tgt = _findClickPath(r, next.offsetX, next.offsetY + sy);
      if (tgt && tgt === L.animatingPath) {
        // P2 逆向动画：同路径点击 → 中断当前动画，清理 overlay，
        // 主树已在终端态，直接走反向（下方 dequeue + doExpand/doCollapse）
        killActiveCharRain();
        _resetAnimTimeline();
        _removeAllOverlays();
        L.endOp();
        rebuildTree();
      } else {
        return;
      }
    }
  }

  const { offsetX, offsetY } = clickQueue.dequeue()!;
  const root = L.renderer.getRoot();
  if (!root) return;
  const scrollY = root.scrollY ?? 0;
  const px = offsetX;
  const py = offsetY + scrollY;

  for (const child of root.children) {
    if (!child.visible || child.disabled) continue;
    const hit = findTapTarget(child, px, py);
    if (hit?.gesture?.onTap) {
      // 光标逻辑：第一次点击移动光标，第二次同一行才执行
      if (L.cursorRowId !== null && L.cursorRowId === hit.id) {
        const hitData = (hit as any).data || {};
        const isDir = hitData.isDir;
        const isExpanded = hitData.isExpanded;
        if (isDir) {
          if (isExpanded) {
            console.log('[processClickQueue] doCollapse path=', hitData.path);
            doCollapse(hit, hitData);
          } else {
            console.log('[processClickQueue] doExpand path=', hitData.path);
            doExpand(hit, hitData);
          }
          return;  // 动画函数完成后会 processClickQueue()
        } else {
          hit.gesture.onTap();
        }
      } else {
        moveCursorTo(hit);
        _scrollToCenterCursor();
      }
      break;
    }
  }
  // �����������动画操作，继续处理队列
  processClickQueue();
}

/** 展开动画（overlay 模式：GSAP 只碰 overlay Box，不碰主树）
 *  rebuildTree 构建终端态树 → _ensureMetaFromExpandedState 补元数据
 *  → 手动 toggle.rotate=0 → _setupExpandOverlays（从元数据计算 FROM）→ GSAP */
function doExpand(hit: Box, hitData: any): void {
  L.beginOp(hitData.path, 'expand');
  hit.gesture!.onTap!();  // KFMState toggle → _stateSub → rebuildTree（终端态，无 collapseSubs）

  
  const root = L.renderer!.getRoot()!;
  const containerId = `expanded-${hitData.path}`;
  const container = findBoxById(root, containerId);
  const titleRow = findBoxById(root, `title-${hitData.path}`);
  const toggle2 = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));

  if (!container) {
    L.endOp();
    processClickQueue();
    return;
  }

  const fullHeight = (container as Box & OverlayMeta)._fullHeight || 0;
  if (!fullHeight) {
    const finish = () => {
      L.endOp();
      processClickQueue();
    };
    if (toggle2 && toggle2.transform) {
      toggle2.transform.rotate = 0;
      ts.to(toggle2.transform, {
        rotate: Math.PI / 2,
        duration: 0.3,
        ease: 'power2.out',
        onUpdate: () => { L.renderer?.setRoot(L.renderer!.getRoot()!); },
        onComplete: finish,
      }, 0);
    } else {
      finish();
    }
    return;
  }

  // 手动将 toggle 归零（buildExpanded 设为 90°，但展开动画 FROM 是 0°）
  if (toggle2) {
    anim.killTweensOf(toggle2.transform);
    toggle2.transform.rotate = 0;
  }

  // === overlay 模式 ===
  assert(_activeOverlays.length === 0, 'overlays not empty before doExpand');
  const pack = _setupExpandOverlays(container, fullHeight);
  const rowTargetYs = pack.rowOverlays.map(r => (r as Box & OverlayMeta)._targetY as number);
  // 关键：传真实容器而非 overlay。字符 Box 挂载在真实容器上，
  // 这样 ts.call 里 _removeAllOverlays() 移除 overlay 时字符不受影响。
  animateCharRain(container, root, L.renderer, rowTargetYs);

  const animRoot = L.renderer!.getRoot()!;

  // 容器 overlay: height 0→fullHeight
  ts.to(pack.containerOverlay, {
    height: fullHeight,
    duration: 0.05,
    ease: 'back.out(1.15)',
    onUpdate: () => {
      if (L.renderer?.getRoot() !== animRoot) return;
      L.renderer?.setRoot(L.renderer!.getRoot()!);
    },
  }, 0);

  // 行 overlay: y→_targetY
  for (const rowOv of pack.rowOverlays) {
    ts.to(rowOv, {
      y: (rowOv as Box & OverlayMeta)._targetY!,
      duration: 0.05,
      ease: 'back.out(1.15)',
      onUpdate: () => {
        if (L.renderer?.getRoot() !== animRoot) return;
        L.renderer?.setRoot(L.renderer!.getRoot()!);
      },
    }, 0);
  }

  // 兄弟 overlay: y→_targetY
  for (const sibOv of pack.siblingOverlays) {
    ts.to(sibOv, {
      y: (sibOv as Box & OverlayMeta)._targetY!,
      duration: 0.05,
      ease: 'back.out(1.15)',
      onUpdate: () => {
        if (L.renderer?.getRoot() !== animRoot) return;
        L.renderer?.setRoot(L.renderer!.getRoot()!);
      },
    }, 0);
  }

  // 动画完成: 清理 overlay → 主树已是终端态，直接 _unveilOverlaySubContainers
  ts.call(() => {
    if (L.renderer?.getRoot() !== animRoot) return;
    _removeAllOverlays();
    assert(_activeOverlays.length === 0, 'overlays leaked after doExpand');
    _resetAnimTimeline();
    for (const c of pack.hiddenChildren) c.opacity = 1;
    for (const s of pack.hiddenSiblings) s.opacity = 1;
    if (container.kfmStyle && (container as Box & OverlayMeta)._savedCr !== undefined) {
      container.kfmStyle.cornerRadius = (container as Box & OverlayMeta)._savedCr!;
    }
    // 主树已是终端态，不需要第二次 rebuildTree
    // _ensureMetaFromExpandedState 已在 rebuildTree 中调用
    L.renderer?.setRoot(L.renderer!.getRoot()!);
    if (container) {
      _unveilOverlaySubContainers(container, root, toggle2).catch((err: any) => {
        warn(`_unveilOverlaySubContainers failed: ${err?.message || err}`);
      }).finally(() => {
        L.endOp();
        const _root = L.renderer?.getRoot();
        if (_root) { _rebuildRowIndex(_root); }
        processClickQueue();
      });
    } else {
      L.endOp();
      const _root = L.renderer?.getRoot();
      if (_root) { _rebuildRowIndex(_root); }
      processClickQueue();
    }
  });
}

/** 折叠动画（overlay 模式：GSAP 只碰 overlay Box，不碰主树） */
function doCollapse(hit: Box, hitData: any): void {
  L.beginOp(hitData.path, 'collapse');
  const tog = hit.children.find(c => c.id?.startsWith('toggle-'));
  const containerId = `expanded-${hitData.path}`;
  const root = L.renderer!.getRoot()!;
  const container = findBoxById(root, containerId);

  
  const animRoot = L.renderer!.getRoot()!;

  // toggle 旋转动画（在主树上，不是 overlay）
  if (tog) {
    ts.to(tog.transform, {
      rotate: 0,
      duration: 0.25,
      ease: 'power2.in',
      onUpdate: () => { if (L.renderer?.getRoot() === animRoot) L.renderer.setRoot(L.renderer.getRoot()!); },
    }, 0);
  }

  let pack: OverlayPack | null = null;
  if (container) {
    const fullH = container.height;
    assert(_activeOverlays.length === 0, 'overlays not empty before doCollapse');
    pack = _setupCollapseOverlays(container, fullH);

    debugLog(`[collapse] anim start path=${hitData.path} fullH=${fullH} containerOv=${pack.containerOverlay.id}`);

    // 容器 overlay: height fullH → 0
    ts.to(pack.containerOverlay, {
      height: 0,
      duration: 0.3,
      ease: 'power2.in',
      onUpdate: () => {
        if (L.renderer?.getRoot() !== animRoot) { debugLog(`[collapse] SKIP onUpdate root mismatch`); return; }
        L.renderer?.setRoot(L.renderer!.getRoot()!);
      },
      onStart: () => { debugLog(`[collapse] tween START height=${pack!.containerOverlay.height}`); },
    }, 0);

    // 兄弟 overlay: y → _targetY
    for (const sibOv of pack.siblingOverlays) {
      ts.to(sibOv, {
        y: (sibOv as Box & OverlayMeta)._targetY!,
        duration: 0.3,
        ease: 'power2.in',
        onUpdate: () => {
          if (L.renderer?.getRoot() !== animRoot) return;
          L.renderer?.setRoot(L.renderer!.getRoot()!);
        },
      }, 0);
    }
  }

  const maxDur = container ? 0.3 : (tog ? 0.25 : 0);
  ts.call(() => {
    if (L.renderer?.getRoot() !== animRoot) return;
    _removeAllOverlays();
    assert(_activeOverlays.length === 0, 'overlays leaked after doCollapse');
    _resetAnimTimeline();
    if (pack) {
      for (const c of pack.hiddenChildren) c.opacity = 1;
      for (const s of pack.hiddenSiblings) s.opacity = 1;
    }
    L.endOp();
    const _savedCid = L.cursorRowId;
    hit.gesture!.onTap!();
    processClickQueue();
    if (_savedCid) {
      const _r = L.renderer?.getRoot();
      if (_r) { const _tc = findBoxById(_r, _savedCid); if (_tc) moveCursorTo(_tc, false); }
    }
  }, undefined, maxDur);

}

function findTapTarget(box: Box, px: number, py: number): Box | null {
  for (let i = box.children.length - 1; i >= 0; i--) {
    const child = box.children[i];
    if (!child.visible || child.disabled) continue;
    const found = findTapTarget(child, px, py);
    if (found) return found;
  }
  if (box.containsPoint(px, py) && box.interactive && box.gesture?.onTap) {
    return box;
  }
  return null;
}

// ============================================================
// 树重建
// ============================================================

/** 强制重建树（跳过 L._animBusy 锁，用于眼睛图标��用户主动行为） */
export function forceRebuildTree(): void {
  _removeAllOverlays();
  L.endOp();
  
  clickQueue.clear();
  rebuildTree();
}

function rebuildTree(): void {
  if (!L.renderer) return;
  if (L.isAnimating) {
    // rebuildTree 被调用时动画应已完成或超时。
    // 这是一个防御性守卫：如果走到这里说明 _stateSub 可能绕过了 endOp()。
    warn('rebuildTree called while animation still active — forcing release');
    // 超���兜底：超过 3000ms 自动释��
    if (L._animBusyAt && Date.now() - L._animBusyAt > 3000) {
      L.endOp();
      
      clickQueue.clear();  // ����队列防死循环
    } else {
      return;
    }
  }

  // 保存当前滚动位置和����标行
  const prevScrollY = L.renderer.getRoot()?.scrollY ?? 0;
  const prevCursorRowId = L.cursorRowId;

  // 重置光标实例（旧 root 销毁后 L.cursorBox ��向的 Box 已无���）
  L.cursorBox = null;
  L.cursorRowId = null;

  const canvas = DOM.treeCanvas;
  const cw = (canvas?.clientWidth ?? 0) || 295;  // 动态宽度（|| 兜底 clientWidth=0 的��况）
  const rightMargin = cw - 8;              // 行右边界 = 画布宽��� - 8px ���白
  const rootBox = buildSidebarTree(cw, rightMargin);
  // 让 rootBox ��实际����=canvas 宽度（扩大裁剪区域），但内部盒��保��相应比例
  if (canvas) rootBox.width = cw;
  const canvasH = (canvas?.clientHeight ?? 0) || 618;
  if (canvas) {
    rootBox.height = canvasH;
  }

  L.renderer.setRoot(rootBox);

  // 为终端态树的所有 expanded-* 容器补元数据
  _ensureMetaFromExpandedState(rootBox);

  // 恢复滚动位置（从关闭���态恢复时，L._savedScrollY 在下游统一处理，此处跳过）
  const newRoot = L.renderer.getRoot();
  if (!L._restoringFromSave && newRoot && prevScrollY > 0) {
    const maxY = newRoot.getMaxScroll().maxY;
    newRoot.scrollY = Math.min(prevScrollY, maxY);
  }

  // 【关键】从关闭状态恢复时，先恢复 scrollY，再让光标逻辑基于恢复后的位置工作
  // 注意：第一次rebuildTree时_isCursorMode=true,maxY=0,恢复会失败
  // 不在这里消耗_savedScrollY，等rAF回调中的强制恢复
  if (L._restoringFromSave) {
    L._restoringFromSave = false;  // 只消耗标志，不消耗_savedScrollY
  }

  // ���新创建光标
  if (newRoot) {
    ensureCursorBox(newRoot, canvasH);

    {
      if (prevCursorRowId) {
        // 尝试恢复光标到之前的行
        const target = findBoxById(newRoot, prevCursorRowId);
        if (target) {
          moveCursorTo(target, false);
        } else {
          snapToCenterRow(newRoot, canvasH);
        }
      } else {
        // 初始状态：光标居中吸附
        snapToCenterRow(newRoot, canvasH);
      }
    }
  
    // 重建光标步进行索引
    }

  if (newRoot) _rebuildRowIndex(newRoot);

  if (!L.renderer.isRunning) {
    L.renderer.start();
  }

  // 清空 L.animatingPath，防止后续 rebuildTree 读到脏值
  // 通知所有持有旧 token 的 async 动画中止
  treeAbort.cancel();

}

function snapToCenterRow(root: Box, canvasH: number): void {
  const scrollY = root.scrollY ?? 0;
  const centerY = scrollY + canvasH / 2;
  let closest: Box | null = null;
  let closestDist = Infinity;

  function walk(box: Box): void {
    for (const child of box.children) {
      if (!child.visible || child.disabled) continue;
      if (child.interactive && child.gesture?.onTap) {
        const abs = child.getAbsolutePosition();
        const rowCenter = abs.y + child.height / 2;
        const dist = Math.abs(rowCenter - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = child;
        }
      }
      walk(child);
    }
  }

  walk(root);
  if (closest) moveCursorTo(closest);
}

/**
 * _unveilOverlaySubContainers: overlay 模式的子容器串行展示。
 *
 * 为每个展开子容器创建临时 overlay，在 overlay 上做高度展开动画，
 * 完成后移除 overlay 并恢复真实内容。递归处理嵌套。
 * 使用 treeAbort 令牌在 rebuildTree 后安全中止。
 */
/** 为终端态树的所有 expanded-* 容器补元数据。
 * 在 rebuildTree setRoot 之后调用，确保元数据始终可用。
 * 捕获 _fullHeight, _origYs, _toggleBox, _toggleRotate。 */
function _ensureMetaFromExpandedState(root: Box): void {
  function walk(box: Box): void {
    for (const c of box.children) {
      if (c.id?.startsWith('expanded-')) {
        // 防御性：如果 c.height 被渲染器重置为 0，从子元素推算
        const h = c.height > 0 ? c.height
          : (c.children || []).reduce((s: number, ch: Box) => s + (ch.height > 0 ? ch.height : 0), 0);
        if (h > 0) {
          if (!(c as Box & OverlayMeta)._fullHeight) (c as Box & OverlayMeta)._fullHeight = h;
          if (!(c as Box & OverlayMeta)._origYs) (c as Box & OverlayMeta)._origYs = c.children.map((ch: Box) => ch.y);
          // capture toggle reference for cascade expand
          const subPath = c.id.slice("expanded-".length);
          const subTitle = findBoxById(root, "title-" + subPath);
          const subTog = subTitle?.children?.find((ch: Box) => ch.id?.startsWith("toggle-"));
          if (subTog && !(c as Box & OverlayMeta)._toggleBox) {
            (c as Box & OverlayMeta)._toggleBox = subTog;
            (c as Box & OverlayMeta)._toggleRotate = subTog.transform.rotate;
          }
        }
      }
      walk(c);
    }
  }
  walk(root);
}

async function _unveilOverlaySubContainers(container: Box, root: Box, selfToggle?: Box): Promise<void> {
  const token = treeAbort.start();

  // self-toggle 旋转动画
  if (selfToggle) {
    anim.fromTo(selfToggle.transform, { rotate: 0 }, {
      rotate: Math.PI / 2,
      duration: 0.15,
      ease: 'power2.out',
      onUpdate: () => { L.renderer?.setRoot(L.renderer!.getRoot()!); },
    });
  }

  const subContainers = container.children.filter(
    c => c.id?.startsWith('expanded-') && c.height > 0
  );

  for (let idx = 0; idx < subContainers.length; idx++) {
    const child = subContainers[idx];
    const subFullH = child.height;

    // 修复子容器 toggle
    const freshTitle = findBoxById(root, `title-${child.id!.slice('expanded-'.length)}`);
    const freshTog = freshTitle?.children?.find((c: Box) => c.id?.startsWith('toggle-'));
    if (freshTog) {
      anim.killTweensOf(freshTog.transform);
      freshTog.transform.rotate = (child as Box & OverlayMeta)._toggleRotate ?? Math.PI / 2;
    }

    // === overlay 模式：主树已是终端态，直接用元数据建 overlay ===
    // 元数据已在 rebuildTree 中被 _ensureMetaFromExpandedState 补全
    if (child.kfmStyle) {
      (child as Box & OverlayMeta)._savedCr = child.kfmStyle.cornerRadius;
      child.kfmStyle.cornerRadius = 0;
    }

    animateCharRain(child, root, L.renderer);

    // 创建 overlay 并动画（_setupExpandOverlays 从元数据计算 FROM 位置）
    const pack = _setupExpandOverlays(child, subFullH);

    await new Promise<void>(resolve => {
      const tl = anim.timeline({
        onComplete: () => {
          assert(_activeOverlays.length === 0, 'overlays leaked after unveil');
          _removeAllOverlays();
          // 主树已是终端态，只需恢复可见性
          for (const c of pack.hiddenChildren) c.opacity = 1;
          for (const s of pack.hiddenSiblings) s.opacity = 1;
          if (child.kfmStyle && (child as Box & OverlayMeta)._savedCr !== undefined) {
            child.kfmStyle.cornerRadius = (child as Box & OverlayMeta)._savedCr!;
          }
          L.renderer?.setRoot(L.renderer!.getRoot()!);
          resolve();
        },
      });

      tl.to(pack.containerOverlay, {
        height: subFullH,
        duration: 0.05,
        ease: 'back.out(1.15)',
        onUpdate: () => { L.renderer?.setRoot(L.renderer!.getRoot()!); },
      }, 0);

      for (const rowOv of pack.rowOverlays) {
        tl.to(rowOv, {
          y: (rowOv as Box & OverlayMeta)._targetY!,
          duration: 0.05,
          ease: 'back.out(1.15)',
          onUpdate: () => { L.renderer?.setRoot(L.renderer!.getRoot()!); },
        }, 0);
      }

      for (const sibOv of pack.siblingOverlays) {
        tl.to(sibOv, {
          y: (sibOv as Box & OverlayMeta)._targetY!,
          duration: 0.05,
          ease: 'back.out(1.15)',
          onUpdate: () => { L.renderer?.setRoot(L.renderer!.getRoot()!); },
        }, 0);
      }
    });

    if (treeAbort.isCancelled(token)) return;

    // 递归处理嵌套子容器
    const root2 = L.renderer?.getRoot();
    if (!root2) return;
    const child2 = findBoxById(root2, child.id!);
    if (child2) {
      await _unveilOverlaySubContainers(child2, root2);
      if (treeAbort.isCancelled(token)) return;
    }
  }
}

// ============================================================
// 调试面板已删除