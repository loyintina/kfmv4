/**
 * canvas-cursor.ts — 通用 Canvas 盒子光标系统
 *
 * 不绑定任何具体页面（非文件树专属）。
 * 任何用 Box + Canvas 渲染的页面，只要需要在盒子间移动光标、
 * 判断滚动模式、吸附居中，都可以导入这个模块。
 *
 * 依赖: canvas-utils.ts → renderer-lifecycle (L) → engine/v2
 * 被依赖: canvas-scroll.ts, tree-render.ts, 未来的 card-stream.ts ...
 *
 * 设计原则:
 * - "光标模式" vs "滚动模式" 根据内容是否溢出（maxScroll.maxY > 0）自动切换
 * - 所有光标移动通过 GSAP 平滑动画过渡
 * - 光标行索引（_rowIndex）由 _rebuildRowIndex 维护（在 canvas-utils.ts）
 * - 不导入任何 tree-* 文件（保持通用性）
 */

import { Box } from '../engine/v2/box.js';
import { L } from './renderer-lifecycle.js';
import { DOM } from './dom-refs.js';
import { getRootScrollY, setRootScrollY, _rebuildRowIndex, findBoxById } from './canvas-utils.js';
import { anim } from './animation-registry.js';
import { getShift, LINE_HEIGHT, MAX_LINES } from './style-registry.js';
import { currentTheme as theme } from './theme.js';
import { getFileRowData } from './state.js';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

export function getSession(): number { return L._sessionId; }

export function getRowIndexLength(): number { return L._rowIndex.length; }

/** 创建/获取光标 Box，保证它挂在 root 上 */
export function ensureCursorBox(root: Box, canvasH: number): Box {
  if (L.cursorBox) {
    // 确保还在 root 的子节点中
    if (root.children.includes(L.cursorBox!)) return L.cursorBox;
  }

  L.cursorBox = new Box({
    id: 'cursor-highlight',
    x: 0,
    y: canvasH / 2 - 14,
    width: DOM.treeCanvas?.clientWidth || 280,
    height: 24,
    backgroundColor: theme.canvas.cursorBg,
    borderRadius: 0,
    interactive: false,
    visible: true,
    data: { cursorDynamicLines: true, topLineW: 0, botLineW: 0, color: theme.canvas.cursor },
  });

  root.addChild(L.cursorBox);
  return L.cursorBox;
}


/** 移动光标到指定行（GSAP 平滑过渡） */
export function moveCursorTo(hitBox: Box, animate = true): void {
  if (!L.cursorBox) { const r = L.renderer?.getRoot(); if (!r) return; ensureCursorBox(r, r.height || (DOM.treeCanvas?.clientHeight ?? 618)); }
  // 防崩溃：确认光标盒仍在树中，不在则重新挂载
  const root = L.renderer?.getRoot();
  if (root && !root.children.includes(L.cursorBox!)) {
    ensureCursorBox(root, root.height || (DOM.treeCanvas?.clientHeight ?? 618));
  }
  let abs: { x: number; y: number };
  try {
    abs = hitBox.getAbsolutePosition();
  } catch { return; }
  const canvas = DOM.treeCanvas;

  const depth = getFileRowData(hitBox.data)?.depth ?? 0;
  const shift = getShift(depth);
  const offsetX = shift / 2;

  const rm = (canvas?.clientWidth ?? 295) - 8;
  const targetX = abs.x + offsetX;
  const targetY = abs.y + 2;
  const targetW = rm - abs.x - offsetX;
  const targetH = hitBox.height - 4;
  L.cursorRowId = hitBox.id || null;

  // 测量文字宽度，计算上下线长度
  const label = hitBox.children.find(c => c.id?.startsWith('label-'));
  let textW = 0;
  if (label?.textStyle?.content) {
    const ctx2d = (canvas as any)?.getContext?.('2d');
    if (ctx2d) {
      const font = label.textStyle.font || '11px system-ui, sans-serif';
      const labelX = label.x || 0;
      const maxWidth = label.width;
      const content = label.textStyle.content;

      try {
        const prepared = prepareWithSegments(content, font);
        const { lines } = layoutWithLines(prepared, maxWidth, LINE_HEIGHT);
        const firstLine = lines[0];
        let renderWidth = firstLine.width;
        if (lines.length > 1 && label.textStyle.overflow === 'ellipsis') {
          const truncated = firstLine.text.slice(0, -1) + '…';
          ctx2d.font = font;
          renderWidth = ctx2d.measureText(truncated).width;
        }
        textW = labelX + renderWidth;
      } catch {
        ctx2d.font = font;
        const measured = ctx2d.measureText(content);
        if (measured.width > maxWidth && label.textStyle.overflow === 'ellipsis') {
          let text = content;
          while (text.length > 0 && ctx2d.measureText(text + '…').width > maxWidth) {
            text = text.slice(0, -1);
          }
          textW = labelX + ctx2d.measureText(text + '…').width;
        } else {
          textW = labelX + measured.width;
        }
      }
    }
  }
  const totalLineW = targetW;
  const topLineW = Math.min(Math.max(textW, 20), totalLineW - 10);
  const botLineW = totalLineW - topLineW;

  // 确保 data 对象存在（不替换，直接在属性上做动画）
  const cdata = (L.cursorBox as any).data;
  if (cdata) {
    cdata.cursorDynamicLines = true;
    cdata.color = theme.canvas.cursor;
  }

  if (animate && cdata) {
    // GSAP 平滑过渡：位置/尺寸 + 上线长度
    // 不 kill 旧动画——让 GSAP 自动衔接连续的目标变更，避免视觉跳动
    try {
      anim.to(L.cursorBox, {
        x: targetX, y: targetY, width: targetW, height: targetH,
        duration: 0.18, ease: 'power3.out',
        overwrite: 'auto',
      });
      anim.to(cdata, {
        topLineW, botLineW,
        duration: 0.18, ease: 'power3.out',
        overwrite: 'auto',
      });
    } catch {
      // GSAP 异常时降级为瞬移
      L.cursorBox!.x = targetX; L.cursorBox!.y = targetY;
      L.cursorBox!.width = targetW; L.cursorBox!.height = targetH;
      cdata.topLineW = topLineW; cdata.botLineW = botLineW;
    }
  } else {
    // 瞬移模式（初始放置等场景）
    L.cursorBox!.x = targetX;
    L.cursorBox!.y = targetY;
    L.cursorBox!.width = targetW;
    L.cursorBox!.height = targetH;
    if (cdata) {
      cdata.topLineW = topLineW;
      cdata.botLineW = botLineW;
    }
  }
}

// ============================================================

/** ��取当前光标在行索引中的位置 */
export function getCursorRowIndex(): number {
  if (!L.cursorRowId || L._rowIndex.length === 0) return -1;
  return L._rowIndex.findIndex(box => box.id === L.cursorRowId);
}

/** 移���光标 N 步（正=向下，负=向上），自动 clamp */
export function _moveCursorBySteps(steps: number): void {
  if (L._rowIndex.length === 0) return;
  const oldIdx = getCursorRowIndex();
  const newIdx = ((oldIdx + steps) % L._rowIndex.length + L._rowIndex.length) % L._rowIndex.length;
  if (newIdx !== oldIdx && L._rowIndex[newIdx]) {
    moveCursorTo(L._rowIndex[newIdx]);
  }
}

/** 判断��前是否���标模式（内容高度 <= 视口高度，无溢出） */
export function _isCursorMode(): boolean {
  const root = L.renderer?.getRoot();
  if (!root) return false;
  return root.getMaxScroll().maxY <= 0;
}

/** 获取视口中央最近行的索引（在 L._rowIndex 中的位���） */
export function _getCenterRowIndex(): number {
  const root = L.renderer?.getRoot();
  if (!root || L._rowIndex.length === 0) return -1;
  const canvasH = (DOM.treeCanvas?.clientHeight ?? 0) || 618;
  const scrollY = root.scrollY ?? 0;
  const centerY = scrollY + canvasH / 2;
  let closestIdx = -1;
  let closestDist = Infinity;
  for (let i = 0; i < L._rowIndex.length; i++) {
    try {
      if (!L._rowIndex[i]) continue;
      const abs = L._rowIndex[i].getAbsolutePosition();
      const rowCenter = abs.y + L._rowIndex[i].height / 2;
      const dist = Math.abs(rowCenter - centerY);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    } catch { /* Box 被移除则跳过 */ }
  }
  return closestIdx;
}

/** 滚���模式下，将光标吸附到视口中央最近的行 */
export function _snapCursorToCenter(): void {
  if (L.isAnimating) return;
  const idx = _getCenterRowIndex();
  if (idx >= 0 && L._rowIndex[idx] && L._rowIndex[idx]!.id !== L.cursorRowId) {
    console.log('[snapCursorToCenter] snapping from', L.cursorRowId, 'to', L._rowIndex[idx]!.id, 'centerIdx=', idx);
    moveCursorTo(L._rowIndex[idx]!);
  }
}


/** 点击后滚动页面到光标居中位置（GSAP 平滑动画） */
export function _scrollToCenterCursor(): void {
  if (_isCursorMode()) return;
  if (L._restoreMode) return;  // 恢复期间跳过 GSAP
  const root = L.renderer?.getRoot();
  if (!root || L.cursorRowId === null) return;
  const canvas = DOM.treeCanvas;
  const canvasH = canvas?.clientHeight ?? 618;
  const maxY = root.getMaxScroll().maxY;
  const idx = getCursorRowIndex();
  if (idx < 0 || !L._rowIndex[idx]) return;
  try {
    const abs = L._rowIndex[idx].getAbsolutePosition();
    const targetScrollY = Math.max(0, Math.min(maxY, abs.y + L._rowIndex[idx].height / 2 - canvasH / 2));
    console.log('[GSAP-SCROLL] targetScrollY=', targetScrollY, 'from=', root.scrollY);
    anim.to(root, {
      scrollY: targetScrollY,
      duration: 0.35,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
  } catch {}
}

