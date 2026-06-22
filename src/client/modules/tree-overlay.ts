/**
 * tree-overlay.ts — 视觉 Overlay 构建系统
 *
 * 从 tree-render.ts 拆分。负责：
 *   - 为展开/折叠动画构建视觉克隆 Box 树
 *   - Overlay 节点的生命周期管理（创建/追踪/销毁）
 *   - 双树渲染：overlay 树独立于主树，互不影响
 *
 * 纯数据操作，不涉及 GSAP 动画回调、点击逻辑或状态变更。
 */

import { Box } from '../engine/v2/box.js';
import { L } from './renderer-lifecycle.js';

// ========== Overlay 元数据类型 ==========
/** overlay Box 上挂载的动画元数据，替代 (as any) 隐式契约 */
export interface OverlayMeta {
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

export function removeAllOverlays(): void {
  // debugLog(`[overlay] REMOVE_ALL start count=${_activeOverlays.length}`);
  for (const ov of [..._activeOverlays]) {
    _removeOverlay(ov);
  }
  _activeOverlays.length = 0;
  // debugLog('[overlay] REMOVE_ALL done');
}

/** 创建字符雨层：与容器Ov平级的独立 Box，不受 overflow:hidden 裁剪 */
export function createCharLayer(x: number, y: number, parent: Box): Box {
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
export function collectSiblingsAfter(container: Box): Box[] {
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
export function buildAndSetOverlayTree(
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

export function createVisualClone(
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
    data: { ...src.data },
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
      const childClone = createVisualClone(child, { id: child.id, zIndex: child.zIndex + OVERLAY_Z }, true);
      clone.addChild(childClone);
    }
  }
  return clone;
}

// ========== Overlay 搭建 ==========

export interface OverlayPack {
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
export function setupExpandOverlays(container: Box, fullHeight: number, siblingCloneLabels = true): OverlayPack {
  const parent = container.parent!;

  // 1. 容器 overlay (height=0, 即将动画到 fullHeight)
  const containerOv = createVisualClone(container, { id: `ov-${container.id || 'container'}`, height: 0, opacity: 1, zIndex: OVERLAY_Z });
  containerOv.overflow = 'hidden';  // 裁剪子元素，height=0 时不可见
  _addOverlay(containerOv);
  // 由 buildAndSetOverlayTree 统一构建 overlay 树
  // 但暂时标记 parent 引用以便 getAbsolutePosition 能正确计算
  containerOv.parent = parent;

  // 隐藏主树容器自身（gradient/shadow/border 与 overlay 叠加会变亮）
  container.visible = false;

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
    const rowOv = createVisualClone(child, { id: child.id || (`row-${j}`), y: expandedY, opacity: 1, zIndex: OVERLAY_Z + 1 });
    _addOverlay(rowOv);
    containerOv.addChild(rowOv);
    rowOverlays.push(rowOv);
    // 隐藏主树真实行：动画期间只有 overlay 可见，防止两棵树重叠
    child.visible = false;
    hiddenChildren.push(child);
  }

  // 3. 兄弟 overlay（FROM=折叠态 y，TO=终端态 y）
  //    最外层兄弟 cloneLabel=true（无字符雨），内部子层兄弟 cloneLabel=false
  const siblingOverlays: Box[] = [];
  const hiddenSiblings: Box[] = [];
  const siblings = collectSiblingsAfter(container);
  for (const sib of siblings) {
    if (!siblingCloneLabels && sib.id?.startsWith("expanded-")) continue;
    const sibOv = createVisualClone(sib, { id: `ov-${sib.id || 'sib'}`, y: sib.y - fullHeight, opacity: 1, zIndex: OVERLAY_Z }, siblingCloneLabels);
    (sibOv as Box & OverlayMeta)._targetY = sib.y;
    _addOverlay(sibOv);
    sibOv.parent = parent;
    siblingOverlays.push(sibOv);
    // 同上：隐藏主树真实兄弟
    sib.visible = false;
    hiddenSiblings.push(sib);
  }

  return { containerOverlay: containerOv, rowOverlays, siblingOverlays, hiddenContainer: container, hiddenSiblings, hiddenChildren };
}

/** 搭建折叠动画的 overlay 集合 */
export function setupCollapseOverlays(container: Box, fullH: number, siblingCloneLabels = true): OverlayPack {
  const parent = container.parent!;

  // 1. 容器 overlay (height=fullH, 即将动画到 0)
  const containerOv = createVisualClone(container, { id: `ov-${container.id || 'container'}`, height: fullH, opacity: 1, zIndex: OVERLAY_Z });
  containerOv.overflow = 'hidden';  // 裁剪子元素，折叠时子行逐行消失
  _addOverlay(containerOv);
  containerOv.parent = parent;

  // 隐藏主树容器自身（gradient/shadow/border 与 overlay 叠加会变亮）
  container.visible = false;

  // 2. 行 overlay：固定在展开态 y
  //    跳过已展开的子容器（expanded-*）
  const rowOverlays: Box[] = [];
  const hiddenChildren: Box[] = [];
  for (let j = 0; j < container.children.length; j++) {
    const child = container.children[j];
    if (!child.visible) continue;
    if (child.id?.startsWith('expanded-')) continue;
    const rowOv = createVisualClone(child, { id: child.id || (`row-${j}`), y: child.y, opacity: 1, zIndex: OVERLAY_Z + 1 });
    _addOverlay(rowOv);
    containerOv.addChild(rowOv);
    rowOverlays.push(rowOv);
    // 隐藏主树真实行：动画期间只有 overlay 可见
    child.visible = false;
    hiddenChildren.push(child);
  }

  // 行直接在最终位置（expandedY），不设 collapsedY。
  // 容器 overlay 有 overflow:hidden，行被裁剪不显示。
  // 容器高度从 fullH 缩到 0，行从底部逐行消失。

  // 3. 兄弟 overlay
  //    最外层兄弟 cloneLabel=true，内部子层兄弟 cloneLabel=false
  const siblingOverlays: Box[] = [];
  const hiddenSiblings: Box[] = [];
  const siblings = collectSiblingsAfter(container);
  for (const sib of siblings) {
    if (!siblingCloneLabels && sib.id?.startsWith("expanded-")) continue;
    const sibOv = createVisualClone(sib, { id: `ov-${sib.id || 'sib'}`, y: sib.y, opacity: 1, zIndex: OVERLAY_Z }, siblingCloneLabels);
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
    sib.visible = false;
    hiddenSiblings.push(sib);
  }

  return { containerOverlay: containerOv, rowOverlays, siblingOverlays, hiddenContainer: container, hiddenSiblings, hiddenChildren };
}

// ========== 祖先级联 overlay ==========

export interface AncestorSiblingOverlay {
  overlay: Box;
  original: Box;
  targetY: number;
}

/** 沿祖先 expanded-* 链向上，为每层祖先后方兄弟创建 overlay。用于 collapse 时的级联偏移。 */
export function setupAncestorSiblingOverlays(
  container: Box,
  fullH: number,
): AncestorSiblingOverlay[] {
  const result: AncestorSiblingOverlay[] = [];
  let ancestor: Box | null = container.parent;
  while (ancestor) {
    if (!ancestor.id?.startsWith('expanded-')) break;
    const siblings = collectSiblingsAfter(ancestor);
    for (const sib of siblings) {
      const sibOv = createVisualClone(sib, {
        id: `ov-${sib.id || 'anc-sib'}`,
        y: sib.y,
        opacity: 1,
        zIndex: OVERLAY_Z,
      }, true);
      _addOverlay(sibOv);
      (sibOv as Box & OverlayMeta)._targetY = sib.y - fullH;
      sib.visible = false;
      result.push({ overlay: sibOv, original: sib, targetY: sib.y - fullH });
    }
    ancestor = ancestor.parent;
  }
  return result;
}

// ========== 子容器展开辅助 ==========

export interface FlatSubTarget {
  container: Box;
  fullHeight: number;
  level: number;
}

export function flattenExpandTree(container: Box, level: number = 0): FlatSubTarget[] {
  const result: FlatSubTarget[] = [];
  for (const c of container.children) {
    if (!c.id?.startsWith('expanded-') || !c.height) continue;
    result.push({
      container: c,
      fullHeight: c.height,
      level,
    });
    result.push(...flattenExpandTree(c, level + 1));
  }
  return result;
}

/** 为终端态树的所有 expanded-* 容器补元数据。
 * 在 rebuildTree setRoot 之后调用，确保元数据始终可用。
 * 捕获 _fullHeight, _origYs。 */
export function ensureMetaFromExpandedState(root: Box): void {
  function walk(box: Box): void {
    for (const c of box.children) {
      if (c.id?.startsWith('expanded-')) {
        // 防御性：如果 c.height 被渲染器置为 0，从子元素推算
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

/** 活跃 overlay 数量（用于调试断言：动画前后应为 0） */
export function activeOverlayCount(): number {
  return _activeOverlays.length;
}
