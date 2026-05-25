/**
 * tree-render.ts — 渲染层
 *
 * 用 kfmv3 v2 引擎渲染 Box 树到 Canvas。
 * 滚动事件 → 写 rootBox.scrollY → 引擎自动处理裁剪/偏移/滚动条。
 * 点击事件 → 光标优先：第一次点击移动光标，第二次点击同一行执行 onTap。
 */

import { buildSidebarTree } from './tree-model.js';
import { KFMState, getFileRowData, type FileRowData } from './state.js';
import { anim } from './animation-registry.js';
import { setupCharRainTweens, setupCharRainForSiblings, cleanupCharRain, type CharRainCleanup } from "./char-rain.js";
import { closeSidebar } from './ui.js';
import { Renderer } from '../engine/v2/renderer.js';
import { L } from './renderer-lifecycle.js';
import { debugLog } from './debug-panel.js';
import { _rebuildRowIndex, findBoxById } from './canvas-utils.js';
import { Box } from '../engine/v2/box.js';
import { getCursorRowIndex, moveCursorTo, ensureCursorBox, _scrollToCenterCursor } from './canvas-cursor.js';
import { bindScrollEvents } from './canvas-scroll.js';
import { DOM } from "./dom-refs.js";
import * as clickQueue from "./click-queue.js";
import { assert, warn } from "./debug-assert.js";
const ts = anim.scope('tree-render');

/** 重置动画时间线：清空 tween + 归零播放头 + 清除回调。正常动画结束时调用。 */
function _resetAnimTimeline(): void {
  ts.clear();
  ts.eventCallback('onComplete', null);
  ts.reversed(false);  // 清除反转状态，确保新加 tween 正向播放
  ts.time(0);
}

// ========== Overlay 元数据类型 ==========
/** overlay Box 上挂载的动画元数据，替代 (as any) 隐式契约 */
interface OverlayMeta {
  _fullHeight?: number;
  _origYs?: number[];
  _targetY?: number;
}

// ========== Overlay 管理 ==========
const _activeOverlays: Box[] = [];

const OVERLAY_Z = 200;

function _addOverlay(overlay: Box): void {
  _activeOverlays.push(overlay);
  // debugLog(`[overlay] ADD ${overlay.id} total=${_activeOverlays.length}`);
}

function _removeOverlay(overlay: Box): void {
  const idx = _activeOverlays.indexOf(overlay);
  if (idx >= 0) _activeOverlays.splice(idx, 1);
  if (overlay.parent) {
    const pidx = overlay.parent.children.indexOf(overlay);
    if (pidx >= 0) overlay.parent.children.splice(pidx, 1);
  }
  // debugLog(`[overlay] REMOVE ${overlay.id} total=${_activeOverlays.length}`);
}

function _removeAllOverlays(): void {
  // debugLog(`[overlay] REMOVE_ALL start count=${_activeOverlays.length}`);
  for (const ov of [..._activeOverlays]) {
    _removeOverlay(ov);
  }
  _activeOverlays.length = 0;
  // debugLog('[overlay] REMOVE_ALL done');
}

/** 创建字符雨层：与容器Ov平级的独立 Box，不受 overflow:hidden 裁剪 */
function _createCharLayer(x: number, y: number, parent: Box): Box {
  const layer = new Box({
    id: 'char-layer',
    x, y, width: 0, height: 0,
    opacity: 1, visible: true,
    backgroundColor: 'transparent', interactive: false,
    overflow: 'visible',
  });
  parent.addChild(layer);
  return layer;
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

/**
 * 构建独立的动画树并设置到渲染器。
 * 双树渲染：overlay 节点不寄生在主树上，而是挂在独立的 _overlayRoot 下。
 * 主树的 opacity/overflow 完全不影响动画树。
 */
function _buildAndSetOverlayTree(
  pack: OverlayPack,
  subTargets: FlatSubTarget[],
  subPacks: OverlayPack[],
  root: Box,
): Box {
  // === 关键修复：overlayRoot 的位置 ===
  // overlay 树是扁平的（overlayRoot → 直接子节点），
  // 但主树的容器和兄弟位于 rootedContainer 等中间祖先节点之下（有 x 偏移）。
  // 捕获扣除 overlay 自身的 x/y 后的祖先偏移，赋给 overlayRoot，
  // 这样 overlayRoot 下的直接子节点自动获得正确的绝对位置。
  const topAbs = pack.containerOverlay.getAbsolutePosition();
  const parentOffX = topAbs.x - pack.containerOverlay.x;
  const parentOffY = topAbs.y - pack.containerOverlay.y;

  const overlayRoot = new Box({
    id: 'overlay-root',
    x: parentOffX, y: parentOffY,
    width: root.width, height: root.height,
    scrollY: root.scrollY ?? 0,
    scrollable: true,   // 与主树 rootBox 一致，让 renderer 应用 scroll 偏移
    opacity: 1,
    visible: true,
    overflow: 'visible',  // 字符粒子可能在 clip 区外起始，不裁剪
    backgroundColor: 'transparent',
  });

  // Top-level: container overlay + sibling overlays → direct children of overlayRoot
  // overlayRoot 已有正确的祖先偏移，直接子的 x/y 保持相对值即可
  overlayRoot.addChild(pack.containerOverlay);
  for (const sibOv of pack.siblingOverlays) {
    overlayRoot.addChild(sibOv);
  }

  // Map overlay id → overlay box for parent lookup
  const ovById = new Map<string, Box>();
  ovById.set(pack.containerOverlay.id ?? '', pack.containerOverlay);
  for (let i = 0; i < subTargets.length; i++) {
    ovById.set(subPacks[i].containerOverlay.id ?? '', subPacks[i].containerOverlay);
  }

  // Place each sub-pack's container overlays as children of their parent overlay
  for (let i = 0; i < subTargets.length; i++) {
    const st = subTargets[i];
    const sp = subPacks[i];
    const parentReal = st.container.parent;
    const parentOvId = parentReal ? `ov-${parentReal.id}` : pack.containerOverlay.id;
    const parentOv = parentOvId ? ovById.get(parentOvId) : null;
    if (parentOv) {
      parentOv.addChild(sp.containerOverlay);
      for (const sibOv of sp.siblingOverlays) {
        parentOv.addChild(sibOv);
      }
    } else {
      overlayRoot.addChild(sp.containerOverlay);
      for (const sibOv of sp.siblingOverlays) {
        overlayRoot.addChild(sibOv);
      }
    }
  }

  L.renderer?.setOverlayRoot(overlayRoot);
  return overlayRoot;
}

// ========== Box 视觉克隆器 ==========

function _createVisualClone(
  src: Box,
  overrides?: Partial<{ x: number; y: number; width: number; height: number; opacity: number; zIndex: number; visible: boolean; id: string }>,
  /** 是否克隆 label 子元素。行 overlay 不克隆（文字由字符雨提供），兄弟 overlay 需要克隆 */
  cloneLabel = false,
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
  // 递归克隆子 Box（行 overlay 需要克隆全部子元素）
  // 到展开/折叠时主树子行被隐藏（opacity=0），overlay 中的 toggle 自然可见且无重影
  for (const child of src.children) {
    if (cloneLabel) {
      const childClone = _createVisualClone(child, { id: child.id, zIndex: child.zIndex + OVERLAY_Z }, true);
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
  /** 被隐藏的容器（主树 expanded-* 自身） */
  hiddenContainer: Box | null;
  /** 被隐藏的真实兄弟 */
  hiddenSiblings: Box[];
  /** 被隐藏的容器内子行 */
  hiddenChildren: Box[];
}

/** 搭建展开动画的 overlay 集合 */
function _setupExpandOverlays(container: Box, fullHeight: number, siblingCloneLabels = true): OverlayPack {
  const parent = container.parent!;

  // 1. 容器 overlay (height=0, 即将动画到 fullHeight)
  const containerOv = _createVisualClone(container, { id: `ov-${container.id || 'container'}`, height: 0, opacity: 1, zIndex: OVERLAY_Z });
  containerOv.overflow = 'hidden';  // 裁剪子元素，height=0 时不可见
  _addOverlay(containerOv);
  // 由 _buildAndSetOverlayTree 统一构建 overlay 树
  // 但暂时标记 parent 引用以便 getAbsolutePosition 能正确计算
  containerOv.parent = parent;

  // 隐藏主树容器自身（gradient/shadow/border 与 overlay 叠加会变亮）
  container.opacity = 0;

  // 2. 行 overlay（FROM=折叠态 y，TO=终端态 y）
  //    跳过已展开的子容器（expanded-*），它们由独立的 setupExpandOverlays 处理
  const rowOverlays: Box[] = [];
  const hiddenChildren: Box[] = [];
  // 行直接在最终位置（expandedY），不设 collapsedY。
  // 容器 overlay 有 overflow:hidden，行被裁剪不显示。
  // 容器高度从 0 增长到 fullHeight，行从顶部逐行显露。
  const origYs = (container as Box & OverlayMeta)._origYs as number[] | undefined;
  for (let j = 0; j < container.children.length; j++) {
    const child = container.children[j];
    if (!child.visible) continue;
    if (child.id?.startsWith('expanded-')) continue;
    const expandedY = origYs ? origYs[j] : child.y;
    const rowOv = _createVisualClone(child, { id: child.id || (`row-${j}`), y: expandedY, opacity: 1, zIndex: OVERLAY_Z + 1 });
    _addOverlay(rowOv);
    containerOv.addChild(rowOv);
    rowOverlays.push(rowOv);
    // 隐藏主树真实行：动画期间只有 overlay 可见，防止两棵树重叠
    child.opacity = 0;
    hiddenChildren.push(child);
  }

  // 3. 兄弟 overlay（FROM=折叠态 y，TO=终端态 y）
  //    最外层兄弟 cloneLabel=true（无字符雨），内部子层兄弟 cloneLabel=false
  const siblingOverlays: Box[] = [];
  const hiddenSiblings: Box[] = [];
  const siblings = _collectSiblingsAfter(container);
  for (const sib of siblings) {
    if (!siblingCloneLabels && sib.id?.startsWith("expanded-")) continue;
    const sibOv = _createVisualClone(sib, { id: `ov-${sib.id || 'sib'}`, y: sib.y - fullHeight, opacity: 1, zIndex: OVERLAY_Z }, siblingCloneLabels);
    (sibOv as Box & OverlayMeta)._targetY = sib.y;
    _addOverlay(sibOv);
    sibOv.parent = parent;
    siblingOverlays.push(sibOv);
    // 同上：隐藏主树真实兄弟
    sib.opacity = 0;
    hiddenSiblings.push(sib);
  }

  return { containerOverlay: containerOv, rowOverlays, siblingOverlays, hiddenContainer: container, hiddenSiblings, hiddenChildren };
}

/** 搭建折叠动画的 overlay 集合 */
function _setupCollapseOverlays(container: Box, fullH: number, siblingCloneLabels = true): OverlayPack {
  const parent = container.parent!;

  // 1. 容器 overlay (height=fullH, 即将动画到 0)
  const containerOv = _createVisualClone(container, { id: `ov-${container.id || 'container'}`, height: fullH, opacity: 1, zIndex: OVERLAY_Z });
  containerOv.overflow = 'hidden';  // 裁剪子元素，折叠时子行逐行消失
  _addOverlay(containerOv);
  containerOv.parent = parent;

  // 隐藏主树容器自身（gradient/shadow/border 与 overlay 叠加会变亮）
  container.opacity = 0;

  // 2. 行 overlay：固定在展开态 y
  //    跳过已展开的子容器（expanded-*）
  const rowOverlays: Box[] = [];
  const hiddenChildren: Box[] = [];
  for (let j = 0; j < container.children.length; j++) {
    const child = container.children[j];
    if (!child.visible) continue;
    if (child.id?.startsWith('expanded-')) continue;
    const rowOv = _createVisualClone(child, { id: child.id || (`row-${j}`), y: child.y, opacity: 1, zIndex: OVERLAY_Z + 1 });
    _addOverlay(rowOv);
    containerOv.addChild(rowOv);
    rowOverlays.push(rowOv);
    // 隐藏主树真实行：动画期间只有 overlay 可见
    child.opacity = 0;
    hiddenChildren.push(child);
  }

  // 行直接在最终位置（expandedY），不设 collapsedY。
  // 容器 overlay 有 overflow:hidden，行被裁剪不显示。
  // 容器高度从 fullH 缩到 0，行从底部逐行消失。

  // 3. 兄弟 overlay
  //    最外层兄弟 cloneLabel=true，内部子层兄弟 cloneLabel=false
  const siblingOverlays: Box[] = [];
  const hiddenSiblings: Box[] = [];
  const siblings = _collectSiblingsAfter(container);
  for (const sib of siblings) {
    if (!siblingCloneLabels && sib.id?.startsWith("expanded-")) continue;
    const sibOv = _createVisualClone(sib, { id: `ov-${sib.id || 'sib'}`, y: sib.y, opacity: 1, zIndex: OVERLAY_Z }, siblingCloneLabels);
    (sibOv as Box & OverlayMeta)._targetY = sib.y - fullH;
    _addOverlay(sibOv);
    sibOv.parent = parent;
    siblingOverlays.push(sibOv);
    // 折叠时兄弟 overlay 的 toggle 设 0°（仅对 toggle 当前为 0° 的兄弟，
    // 展开态 toggle 是 ~90°，折叠态是 0°，保持展开兄弟的 toggle 不动）
    if (siblingCloneLabels) {
      const origTc = sib.children.find(c => c.id?.startsWith('toggle-'));
      const needsReset = !origTc || (origTc.transform?.rotate ?? 0) < 0.1;
      if (needsReset) {
        const tc = sibOv.children.find(c => c.id?.startsWith('toggle-'));
        if (tc?.transform) tc.transform.rotate = 0;
      }
    }
    // 隐藏主树真实兄弟
    sib.opacity = 0;
    hiddenSiblings.push(sib);
  }

  return { containerOverlay: containerOv, rowOverlays, siblingOverlays, hiddenContainer: container, hiddenSiblings, hiddenChildren };
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

/** 懒加载等场景的程序化展开入口：跳过状态切换和生命周期锁，直接跑动画 */
/** 从终端树获取展开所需的上下文（容器、三角、完整高度）。
 *  如果 fullHeight 为 0，自动处理三角旋转动画并调 onEmpty 回调。
 *  返回 null 时调用方应直接返回（无需继续）。
 *  onEmpty 用于生命周期清理（doExpand 需要 unlock，triggerExpandAnimation 不需要）。 */
function _getExpandContext(
  root: Box,
  path: string,
  onEmpty?: () => void,
): { container: Box; toggle2: Box | undefined; fullHeight: number } | null {
  const container = findBoxById(root, `expanded-${path}`);
  const titleRow = findBoxById(root, `title-${path}`);
  if (!container) { onEmpty?.(); return null; }
  const toggle2 = titleRow?.children?.find(c => c.id?.startsWith('toggle-'));

  const fullHeight = (container as Box & OverlayMeta)._fullHeight || 0;
  if (!fullHeight) {
    if (toggle2 && toggle2.transform) {
      toggle2.transform.rotate = 0;
      ts.to(toggle2.transform, {
        rotate: Math.PI / 2,
        duration: 0.3,
        ease: 'power2.out',
        onComplete: onEmpty,
      }, 0);
    } else {
      onEmpty?.();
    }
    return null;
  }
  return { container, toggle2, fullHeight };
}

export function triggerExpandAnimation(path: string): void {
  const root = L.renderer?.getRoot();
  if (!root) return;
  const ctx = _getExpandContext(root, path);
  if (!ctx) return;
  _runExpandAnimation({ container: ctx.container, root, fullHeight: ctx.fullHeight, toggle2: ctx.toggle2, path, onTap: null });
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
  canvas.style.touchAction = 'none';

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
  // 幂等：侧栏已关闭时跳过（防 overlay + 关闭按钮同时触发）
  if (L._sidebarClosed) return;
  // 先停掉所有动画和独立rAF循环
  _removeAllOverlays();
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
  canvas.style.touchAction = 'none';

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
    if (L._animBusy) {
      const hit = L._rowIndex[idx]!;
      const root = L.renderer?.getRoot();
      if (!root) return;
      const abs = hit.getAbsolutePosition();
      const scrollY = root.scrollY ?? 0;
      clickQueue.enqueue({ offsetX: abs.x + 4, offsetY: abs.y - scrollY });
      processClickQueue();
      return;
    }
    const hit = L._rowIndex[idx]!;
    const hitData = getFileRowData(hit.data);
    if (!hitData) return;
    if (hitData.isDir) {
      if (hitData.isExpanded) { doCollapse(hit, hitData); }
      else { doExpand(hit, hitData); }
    } else {
      hit.gesture?.onTap?.();
    }
  });
;

  // 右往左滑 → 关闭左栏（垂直主导时不触发，避免斜滑误触）
  let sx = 0, sy = 0;
  box.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
  }, { passive: true });
  box.addEventListener('pointerup', (e) => {
    const dx = sx - e.clientX;             // 正 = 向左
    const dy = Math.abs(sy - e.clientY);   // 垂直移动距离
    if (dx > 60 && dx > dy * 1.5) closeSidebar();
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
      const d = getFileRowData(hit.data);
      return d?.path || null;
    }
  }
  return null;
}
/**
 * 快速命中测试：只找点击目标，不触发任何副作用。
 * 用于动画期间穿透光标移动（不影响 overlay/动画状态）。
 */
function _quickHitTest(root: Box, px: number, py: number): Box | null {
  for (const child of root.children) {
    if (!child.visible || child.disabled) continue;
    const hit = findTapTarget(child, px, py);
    if (hit) return hit;
  }
  return null;
}

/** 在 overlay 树上查找点击目标（不要求 interactive/gesture） */
function _overlayContainsPoint(box: Box, px: number, py: number): Box | null {
  for (let i = box.children.length - 1; i >= 0; i--) {
    const child = box.children[i];
    if (!child.visible || child.disabled) continue;
    const found = _overlayContainsPoint(child, px, py);
    if (found) return found;
  }
  if (box.containsPoint(px, py)) return box;
  return null;
}

function processClickQueue(): void {
  if (clickQueue.isEmpty() || !L.renderer) return;

  // === 规则：动画进行中 ===
  if (L.isAnimating) {
    if (L._animBusyAt && Date.now() - L._animBusyAt > 3000) {
      L.endOp();
      clickQueue.clear();
      return;
    }
    const next = clickQueue.peek();
    if (!next) return;

    const r = L.renderer!.getRoot()!;
    const sy = r.scrollY ?? 0;
    const hit = _quickHitTest(r, next.offsetX, next.offsetY + sy);

    // 规则 2a：光标移动穿透（保留）
    if (hit && L.cursorRowId !== null && L.cursorRowId !== hit.id) {
      clickQueue.dequeue();
      moveCursorTo(hit);
      _scrollToCenterCursor();
      setTimeout(processClickQueue, 0);
      return;
    }

    // 规则 2b：不同路径点击 → 直接忽略
    // 动画期间主树内容已隐藏（opacity=0/visible=false），优先在 overlay 树上做 hit test
    const overlayRoot2 = L.renderer!.getOverlayRoot();
    let tgt: string | null = null;
    if (overlayRoot2) {
      const ovHit = _overlayContainsPoint(overlayRoot2, next.offsetX, next.offsetY + sy);
      if (ovHit) tgt = L.animatingPath;  // overlay 内点击 = 同一动画路径
    }
    if (!tgt) {
      tgt = _findClickPath(r, next.offsetX, next.offsetY + sy);
    }
    if (!tgt || tgt !== L.animatingPath) return;

    // 规则 1：同路径点击 → 状态先行 + reverse
    clickQueue.dequeue();
    // 反转目标取决于动画方向：
    // 展开中反转 → 折叠（false），折叠中反转 → 展开（true）
    KFMState.expandedPaths[tgt] = L.animatingDir === 'collapse';
    localStorage.setItem('expandedPaths', JSON.stringify(KFMState.expandedPaths));
    // 直接 reverse：overlay 反向播放时会将内容"展开"回主树位置，
    // 由 onReverseComplete 统一重建。
    // reverse 所有 tween（overlay 高度/位置 + 字符位置/透明度）
    // 清除 onComplete：防止折叠动画的 onComplete 反转 state（竞态）
    ts.eventCallback('onComplete', null);
    ts.reverse();
    ts.eventCallback('onReverseComplete', () => {
      L.endOp();
      _removeAllOverlays();
      _resetAnimTimeline();  // ts.clear() + time(0) + 清除 onComplete
      KFMState.notify();    // 触发 _stateSub → rebuildTree
      processClickQueue();
    });
    return;
  }

  // === 非动画中：正常消费 ===
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
        const hitData = getFileRowData(hit.data);
        if (!hitData) return;
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
  // 非动画操作，继续处理队列
  setTimeout(processClickQueue, 0);
}

/** 用户点击触发的展开：先调 onTap 触发状态变更 + rebuildTree，再执行动画 */
/** 用户点击触发的展开：先调 onTap 触发状态变更 + rebuildTree，再执行动画 */
function doExpand(hit: Box, hitData: FileRowData): void {
  L.beginOp(hitData.path, 'expand');
  hit.gesture!.onTap!();  // KFMState toggle → _stateSub → rebuildTree（终端态）

  const root = L.renderer!.getRoot()!;
  const cleanup = () => { L.endOp(); processClickQueue(); };
  const ctx = _getExpandContext(root, hitData.path, cleanup);
  if (!ctx) return;
  _runExpandAnimation({ container: ctx.container, root, fullHeight: ctx.fullHeight, toggle2: ctx.toggle2, path: hitData.path, onTap: null });
}

/** 展开动画参数的公共接口 */
interface ExpandAnimParams {
  container: Box;
  root: Box;
  fullHeight: number;
  toggle2: Box | undefined;
  path: string;
  /** 动画完成后调用的 onTap，null 表示跳过（triggerExpandAnimation 用） */
  onTap: (() => void) | null;
}

/** 展开动画核心：一条 ts timeline 上同时布置 overlay tween 和字符 tween */
function _runExpandAnimation(params: ExpandAnimParams): void {
  const { container, root, fullHeight, toggle2, path, onTap } = params;

  // 手动将 toggle 归零（buildExpanded 设为 90°，但展开动画 FROM 是 0°）
  // 然后动画到 90°
  if (toggle2) {
    anim.killTweensOf(toggle2.transform);
    toggle2.transform.rotate = 0;
    ts.to(toggle2.transform, {
      rotate: Math.PI / 2,
      duration: 0.3,
      ease: 'power2.out',
    }, 0);
  }

  // === overlay 模式 ===
  assert(_activeOverlays.length === 0, 'overlays not empty before expand');
  const pack = _setupExpandOverlays(container, fullHeight);

  // 扁平化收集所有子容器 target，一次性搭建 overlay
  const subTargets = _flattenExpandTree(container, 1);
  const subPacks = subTargets.map(st => _setupExpandOverlays(st.container, st.fullHeight, false));

  // 构建独立动画树并设置到渲染器（双树渲染）
  const overlayRoot = _buildAndSetOverlayTree(pack, subTargets, subPacks, root);

  // 字符雨层：与容器Ov平级，不受 overflow:hidden 裁剪
  const charLayer = _createCharLayer(pack.containerOverlay.x, pack.containerOverlay.y, overlayRoot);

  L.beginOp(path, 'expand');
  const animRoot = L.renderer!.getRoot()!;
  debugLog(`[expand] BEGIN path=${path} animRoot.id=${animRoot.id} scrollY=${(container as any).scrollY ?? root.scrollY ?? '?'}`);
  debugLog(`[expand] container=${container.id} children=[${container.children.map(c => c.id).join(', ')}]`);
  debugLog(`[expand] parentOv.id=${pack.containerOverlay.id} parentOv.pos=(${pack.containerOverlay.x},${pack.containerOverlay.y})`);
  debugLog(`[expand] container.absPos(y)=${container.getAbsolutePosition().y} topAbs(y)=${pack.containerOverlay.getAbsolutePosition().y}`);
  debugLog(`[expand] rowOverlays=${pack.rowOverlays.map(r => r.id + '@y=' + r.y.toFixed(0)).join(' | ')}`);
  debugLog(`[expand] siblingOverlays=${pack.siblingOverlays.map(s => s.id).join(',') || '(none)'}`);
  debugLog(`[expand] subTargets=${subTargets.map(st => st.container.id + '(L' + st.level + ')').join(',') || '(none)'}`);
  debugLog(`[expand] subPacks=${subPacks.length} _fullHeight=${(container as any)._fullHeight} _origYs=${JSON.stringify((container as any)._origYs)}`);
  debugLog(`[expand] overlayRoot.id=${overlayRoot.id} overlayRoot.pos=(${overlayRoot.x},${overlayRoot.y})`);
  debugLog(`[expand] charLayer parent=${charLayer.parent?.id} pos=(${charLayer.x.toFixed(0)},${charLayer.y.toFixed(0)})`);

  // 所有 overlay tween + 字符雨 cleanup 信息收集
  const charRainCleanups: CharRainCleanup[] = [];

  // 本层 overlay tween
  ts.to(pack.containerOverlay, { height: fullHeight, duration: 0.05, ease: 'back.out(1.15)' }, 0);
  for (const sibOv of pack.siblingOverlays) {
    ts.to(sibOv, { y: (sibOv as Box & OverlayMeta)._targetY!, duration: 0.05, ease: 'back.out(1.15)' }, 0);
  }

  // 本层字符雨 tween（行已在 final 位置，rowOv.y = expandedY）
  const topCleanup = setupCharRainTweens(
    container, charLayer, root,
    pack.rowOverlays.map(r => r.y),
    ts, 0
  );
  debugLog(`[expand] topCleanup=${topCleanup ? topCleanup.charBoxes.length + ' char boxes' : 'null'}`);
  if (topCleanup) charRainCleanups.push(topCleanup);

  // 所有子容器 overlay + 字符雨，按层 staggered delay
  for (const sp of subPacks) {
    const subLevel = subTargets.find(st => st.container.id === sp.containerOverlay.id?.replace('ov-expanded-', 'expanded-'))?.level ?? 1;
    const delay = subLevel * 0.05;
    const targetHeight = sp.containerOverlay.height === 0
      ? (subTargets.find(st => `ov-${st.container.id}` === sp.containerOverlay.id)?.fullHeight ?? sp.containerOverlay.height)
      : sp.containerOverlay.height;
    ts.to(sp.containerOverlay, { height: targetHeight, duration: 0.05, ease: 'back.out(1.15)' }, delay);
    for (const sibOv of sp.siblingOverlays) {
      ts.to(sibOv, { y: (sibOv as Box & OverlayMeta)._targetY!, duration: 0.05, ease: 'back.out(1.15)' }, delay);
    }
    // 子层字符雨（在独立的子层字符层上创建字符 Box）
    const realContainer = subTargets.find(st => `ov-${st.container.id}` === sp.containerOverlay.id)?.container;
    if (realContainer) {
      const subParent = sp.containerOverlay.parent!;
      const subCharLayer = _createCharLayer(sp.containerOverlay.x, sp.containerOverlay.y, subParent);
      // 容器内部行的字符雨
      const subCleanup = setupCharRainTweens(
        realContainer, subCharLayer, root,
        sp.rowOverlays.map(r => r.y),
        ts, delay
      );
      if (subCleanup) charRainCleanups.push(subCleanup);
    }
  }

  // cleanup: 在所有动画完成后自动触发
  // 用 onComplete 而非 ts.call：反向播放时 onComplete 不会被触发，
  // 不会与 processClickQueue 的 onReverseComplete 冲突。
  ts.eventCallback('onComplete', () => {
    debugLog(`[expand] onComplete FIRED animRoot match=${L.renderer?.getRoot() === animRoot} charRainCleanups=${charRainCleanups.length} overlays=${_activeOverlays.length}`);
    if (L.renderer?.getRoot() !== animRoot) { debugLog('[expand] onComplete SKIPPED (root changed)'); return; }
    for (const cu of charRainCleanups) cleanupCharRain(cu);
    _removeAllOverlays();
    L.renderer?.setOverlayRoot(null);  // 销毁动画树
    debugLog('[expand] onComplete cleanup done');
    // 恢复主树被隐藏的元素（展开动画：树已重建，元素仍在）
    for (const p of [pack, ...subPacks]) {
      if (p.hiddenContainer) p.hiddenContainer.opacity = 1;
      for (const child of p.hiddenChildren) child.opacity = 1;
      for (const sib of p.hiddenSiblings) sib.opacity = 1;
    }
    _resetAnimTimeline();
    assert(_activeOverlays.length === 0, 'overlays leaked after expand');
    L.endOp();
    const _root = L.renderer?.getRoot();
    if (_root) { _rebuildRowIndex(_root); }
    if (onTap) onTap();
    processClickQueue();
  });
}

/** 折叠动画：字符往回飞 + 盒子缩回 + 兄弟复位 */
function doCollapse(hit: Box, hitData: FileRowData): void {
  L.beginOp(hitData.path, 'collapse');
  const root = L.renderer!.getRoot()!;
  const container = findBoxById(root, `expanded-${hitData.path}`);
  const tog = hit.children.find(c => c.id?.startsWith('toggle-'));

  const animRoot = L.renderer!.getRoot()!;

  // toggle 旋转回收
  if (tog) {
    ts.to(tog.transform, {
      rotate: 0,
      duration: 0.25,
      ease: 'power2.in',
    }, 0);
  }

  if (!container) {
    L.endOp();
    hit.gesture!.onTap!();
    processClickQueue();
    return;
  }

  const fullH = container.height;
  assert(_activeOverlays.length === 0, 'overlays not empty before doCollapse');

  // 搭建折叠 overlay
  const pack = _setupCollapseOverlays(container, fullH);

  // 扁平化收集子容器
  const subTargets = _flattenExpandTree(container, 1);
  const subPacks = subTargets.map(st => _setupCollapseOverlays(st.container, st.fullHeight, false));

  // 构建独立动画树（折叠）
  const overlayRoot = _buildAndSetOverlayTree(pack, subTargets, subPacks, root);

  // 字符雨层：与容器Ov平级，不受 overflow:hidden 裁剪
  const charLayer = _createCharLayer(pack.containerOverlay.x, pack.containerOverlay.y, overlayRoot);

  const maxLevel = subTargets.length > 0 ? Math.max(...subTargets.map(st => st.level)) : 0;
  const charRainCleanups: CharRainCleanup[] = [];

  // 字符雨：方向 collapse，最深层先飞（delay 从最深层的展开延迟对称）
  const collapseBaseDelay = maxLevel * 0.05;
  const topCleanup = setupCharRainTweens(
    container, charLayer, root,
    pack.rowOverlays.map(r => r.y),
    ts, collapseBaseDelay, 'collapse',
  );
  if (topCleanup) charRainCleanups.push(topCleanup);

  for (const sp of subPacks) {
    const subLevel = subTargets.find(st => st.container.id === sp.containerOverlay.id?.replace('ov-expanded-', 'expanded-'))?.level ?? 1;
    const delay = collapseBaseDelay - subLevel * 0.05;
    const realContainer = subTargets.find(st => `ov-${st.container.id}` === sp.containerOverlay.id)?.container;
    if (realContainer) {
      const subParent = sp.containerOverlay.parent!;
      const subCharLayer = _createCharLayer(sp.containerOverlay.x, sp.containerOverlay.y, subParent);
      const subCleanup = setupCharRainTweens(
        realContainer, subCharLayer, root,
        sp.rowOverlays.map(r => r.y),
        ts, delay, 'collapse',
      );
      if (subCleanup) charRainCleanups.push(subCleanup);
    }
  }

  // 盒子收缩：从内到外（最深层先收缩），与字符雨同步结束
  // 字符雨 ≈ BASE_DUR(0.22s)，盒子 0.05s → 偏移 0.17s
  const COLLAPSE_BOX_OFFSET = 0.17;
  const topBoxDelay = collapseBaseDelay + COLLAPSE_BOX_OFFSET;
  ts.to(pack.containerOverlay, {
    height: 0, duration: 0.05, ease: 'power2.in',
  }, topBoxDelay);
  for (const sibOv of pack.siblingOverlays) {
    ts.to(sibOv, {
      y: (sibOv as Box & OverlayMeta)._targetY!,
      duration: 0.05, ease: 'power2.in',
    }, topBoxDelay);
  }

  for (const sp of subPacks) {
    const subLevel = subTargets.find(st => st.container.id === sp.containerOverlay.id?.replace('ov-expanded-', 'expanded-'))?.level ?? 1;
    const delay = (maxLevel - subLevel) * 0.05 + COLLAPSE_BOX_OFFSET;
    ts.to(sp.containerOverlay, { height: 0, duration: 0.05, ease: 'power2.in' }, delay);
    for (const sibOv of sp.siblingOverlays) {
      ts.to(sibOv, {
        y: (sibOv as Box & OverlayMeta)._targetY!,
        duration: 0.05, ease: 'power2.in',
      }, delay);
    }
  }

  // 用 onComplete：反向播放时不被触发，由 onReverseComplete 接管。
  ts.eventCallback('onComplete', () => {
    if (L.renderer?.getRoot() !== animRoot) return;
    for (const cu of charRainCleanups) cleanupCharRain(cu);
    _removeAllOverlays();
    L.renderer?.setOverlayRoot(null);  // 销毁动画树
    assert(_activeOverlays.length === 0, 'overlays leaked after doCollapse');
    _resetAnimTimeline();
    L.endOp();
    hit.gesture!.onTap!();
    processClickQueue();
  });
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

  // 保存��前滚动位置和����标行
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
  
    // 重建光标步进行索引
  }

  if (newRoot) _rebuildRowIndex(newRoot);

  if (!L.renderer.isRunning) {
    L.renderer.start();
  }

  // 清空 L.animatingPath，防止后续 rebuildTree 读到脏值

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
 * 扁平化收集 container 下所有展开的子容器，按层分组。
 * 用于一次性搭建所有 overlay，替代递归 async _unveilOverlaySubContainers。
 */
interface FlatSubTarget {
  container: Box;
  fullHeight: number;
  level: number;
}

function _flattenExpandTree(container: Box, level: number = 0): FlatSubTarget[] {
  const result: FlatSubTarget[] = [];
  for (const c of container.children) {
    if (!c.id?.startsWith('expanded-') || !c.height) continue;
    result.push({
      container: c,
      fullHeight: c.height,
      level,
    });
    result.push(..._flattenExpandTree(c, level + 1));
  }
  return result;
}
/** 为终端态树的所有 expanded-* 容器补元数据。
 * 在 rebuildTree setRoot 之后调用，确保元数据始终可用。
 * 捕获 _fullHeight, _origYs。 */
function _ensureMetaFromExpandedState(root: Box): void {
  function walk(box: Box): void {
    for (const c of box.children) {
      if (c.id?.startsWith('expanded-')) {
        // 防御性：如果 c.height 被渲染器��置为 0，从子元素推算
        const h = c.height > 0 ? c.height
          : (c.children || []).reduce((s: number, ch: Box) => s + (ch.height > 0 ? ch.height : 0), 0);
        if (h > 0) {
          if (!(c as Box & OverlayMeta)._fullHeight) (c as Box & OverlayMeta)._fullHeight = h;
          if (!(c as Box & OverlayMeta)._origYs) (c as Box & OverlayMeta)._origYs = c.children.map((ch: Box) => ch.y);
        }
      }
      walk(c);
    }
  }
  walk(root);
}