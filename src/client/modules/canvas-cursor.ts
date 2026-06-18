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


export function getRowIndexLength(): number { return L._rowIndex.length; }

// 模式联动光标颜色（由 tree-swipe 的 _applyModeTheme 调用）
let _cursorColor: string | null = null;
let _cursorBgColor: string | null = null;
let _pulseBase: string | null = null;
let _pulseProxy: { a: number } | null = null;
let _pulseTween: ReturnType<typeof anim.to> | null = null;
let _liquidProxy: { pos: number } | null = null;
let _liquidTween: ReturnType<typeof anim.to> | null = null;

// 光标 Box.data 自定义字段的类型定义
type CData = Record<string, unknown> & {
  cursorDynamicLines?: boolean;
  topLineW?: number;
  botLineW?: number;
  color?: string;
  liquidColor?: string;
  _liquidSegments?: LiquidPoint[];
};


function _stopPulse(): void {
  if (_pulseTween) { _pulseTween.kill(); _pulseTween = null; }
  _pulseBase = null;
  _pulseProxy = null;
  if (_liquidTween) { _liquidTween.kill(); _liquidTween = null; }
  _liquidProxy = null;
  if (L.cursorBox?.data) (L.cursorBox.data as CData)._liquidSegments = undefined;
}

function _emitLiquidSegments(): void {
  const cb = L.cursorBox;
  if (!cb || !_liquidProxy) return;
  const d = cb.data as CData;
  const topW = d.topLineW || 0;
  const botW = d.botLineW || 0;
  const h = cb.height;
  const root = L.renderer?.getRoot();
  const scrollY = root?.scrollY ?? 0;
  const bx = cb.x;
  const by = cb.y - scrollY;
  const R = 4;
  const cfg = theme.canvas.cursorLiquid;
  if (!cfg) return;
  const vm = cfg.verticalMul ?? 1;
  const realVert = h - 2 * R;
  const pathLen = topW + realVert * vm + botW;
  if (pathLen <= 0) return;
  const pos = _liquidProxy.pos % pathLen;
  const segLenH = cfg.segLen;
  const segLenV = cfg.segLenVertical ?? 4;
  const segs: LiquidPoint[] = [];

  for (let i = 0; i < cfg.count; i++) {
    const pathC = (pos + (i * pathLen) / cfg.count) % pathLen;
    const physC = _pathToPhysical(pathC, topW, realVert, vm);

    if (physC < topW) {
      // 上线管道：右→左，w=1
      const distL = physC;
      const distR = topW - physC;
      const len = Math.min(segLenH, 2 * Math.min(distL, distR));
      const half = len / 2;
      const cs = Math.max(0, physC - half);
      const ce = Math.min(topW, physC + half);
      if (ce > cs) segs.push({ x: bx + R + topW - (cs + ce) / 2, y: by, angle: Math.PI, w: 1, len: ce - cs });
    } else if (physC < topW + realVert) {
      // 竖线管道：上→下，w=3
      const vert = physC - topW;
      const distT = vert;
      const distB = realVert - vert;
      const len = Math.min(segLenV, 2 * Math.min(distT, distB));
      const half = len / 2;
      const cs = Math.max(0, vert - half);
      const ce = Math.min(realVert, vert + half);
      if (ce > cs) segs.push({ x: bx, y: by + R + (cs + ce) / 2, angle: Math.PI / 2, w: 3, len: ce - cs });
    } else {
      // 下线管道：左→右，w=1
      const horiz = physC - topW - realVert;
      const distL = horiz;
      const distR = botW - horiz;
      const len = Math.min(segLenH, 2 * Math.min(distL, distR));
      const half = len / 2;
      const cs = Math.max(0, horiz - half);
      const ce = Math.min(botW, horiz + half);
      if (ce > cs) segs.push({ x: bx + R + (cs + ce) / 2, y: by + h, angle: 0, w: 1, len: ce - cs });
    }
  }
  (cb.data as CData)._liquidSegments = segs;
}

function _startLiquidLoop(): void {
  const cb = L.cursorBox;
  if (!cb) return;
  const cfg = theme.canvas.cursorLiquid;
  if (!cfg) return;
  const d = cb.data as CData;
  const topW = d.topLineW || 0;
  const botW = d.botLineW || 0;
  const R = 4;
  const vm = cfg.verticalMul ?? 1;
  const pathLen = topW + (cb.height - 2 * R) * vm + botW;
  if (pathLen <= 0) return;
  if (_liquidTween) _liquidTween.kill();
  _liquidProxy = { pos: 0 };
  _liquidTween = anim.to(_liquidProxy, {
    pos: pathLen,
    duration: pathLen / cfg.speed,
    ease: 'none',
    onComplete() { _startLiquidLoop(); },
    onUpdate() { _emitLiquidSegments(); },
  });
}

export function setCursorColor(color: string | null, bgColor: string | null): void {
  _cursorColor = color;
  _cursorBgColor = bgColor;
  if (color) {
    _stopPulse();
    _pulseBase = color.replace(/[\d.]+\)$/, '');
    _pulseProxy = { a: 1.0 };
    _pulseTween = anim.to(_pulseProxy, {
      a: 0.1,
      duration: 0.9,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      onUpdate: () => {
        if (L.cursorBox?.data && _pulseBase) {
          L.cursorBox.data.color = _pulseBase + _pulseProxy!.a.toFixed(2) + ')';
        }
      },
    });
    // 玻璃管液体光效
    _startLiquidLoop();
    if (L.cursorBox) {
      L.cursorBox.backgroundColor = bgColor || theme.canvas.cursorBg;
      (L.cursorBox.data as CData).liquidColor = bgColor || undefined;
    }
  } else {
    _stopPulse();
    if (L.cursorBox) {
      const cdata = L.cursorBox.data;
      if (cdata) cdata.color = theme.canvas.cursor;
      L.cursorBox.backgroundColor = theme.canvas.cursorBg;
      (L.cursorBox.data as CData).liquidColor = undefined;
    }
  }
}

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
    width: (L.renderer?.canvas?.clientWidth ?? DOM.treeCanvas?.clientWidth) || 280,
    height: 24,
    backgroundColor: _cursorBgColor || theme.canvas.cursorBg,
    borderRadius: 0,
    interactive: false,
    visible: true,
    data: { cursorDynamicLines: true, topLineW: 0, botLineW: 0, color: _cursorColor || theme.canvas.cursor, liquidColor: _cursorBgColor || undefined },
  });

  root.addChild(L.cursorBox);
  if (_cursorColor) _startLiquidLoop();
  return L.cursorBox;
}


let _modeAccentColor: string | null = null;

export function setModeAccent(color: string | null): void {
  _modeAccentColor = color;
  const root = L.renderer?.getRoot();
  if (!root || !L.cursorRowId) return;
  const row = findBoxById(root, L.cursorRowId);
  const tog = row?.children.find(c => c.id?.startsWith('toggle-'));
  if (tog) tog.textStyle = { ...tog.textStyle, color: color || theme.canvas.accent };
}

export function getModeAccentColor(): string | null { return _modeAccentColor; }

// ========== 玻璃管液体光效路径计算（传送门：3直线，物理空间拆分）==========

interface LiquidPoint { x: number; y: number; angle: number; w: number; len: number }

/** 路径坐标 → 物理坐标（竖线段用 vm 逆缩放） */
function _pathToPhysical(t: number, topW: number, realVert: number, vm: number): number {
  if (t < topW) return t;
  t -= topW;
  const vPath = realVert * vm;
  if (t < vPath) return topW + t / vm;
  return topW + realVert + (t - vPath);
}

/** 移动光标到指定行（GSAP 平滑过渡） */
export function moveCursorTo(hitBox: Box, animate = true): void {
  if (!L.cursorBox) { const r = L.renderer?.getRoot(); if (!r) return; ensureCursorBox(r, r.height || (L.renderer?.canvas?.clientHeight ?? DOM.treeCanvas?.clientHeight ?? 618)); }
  // 防崩溃：确认光标盒仍在树中，不在则重新挂载
  const root = L.renderer?.getRoot();
  if (root && !root.children.includes(L.cursorBox!)) {
    ensureCursorBox(root, root.height || (L.renderer?.canvas?.clientHeight ?? DOM.treeCanvas?.clientHeight ?? 618));
  }
  let abs: { x: number; y: number };
  try {
    abs = hitBox.getAbsolutePosition();
  } catch { console.warn('[cursor] getAbsolutePosition failed, box may be detached'); return; }
  const canvas = L.renderer?.canvas ?? DOM.treeCanvas;

  const depth = getFileRowData(hitBox.data)?.depth ?? 0;
  const shift = getShift(depth);
  const offsetX = shift / 2;

  const rm = (canvas?.clientWidth ?? 295) - 8;
  const targetX = abs.x + offsetX;
  const targetY = abs.y + 2;
  const targetW = rm - abs.x - offsetX;
  const targetH = hitBox.height - 4;
  const prevRowId = L.cursorRowId;
  L.cursorRowId = hitBox.id || null;

  // 模式联动：只有光标行的 toggle 箭头变色
  if (_modeAccentColor) {
    const newTog = hitBox.children.find(c => c.id?.startsWith('toggle-'));
    if (newTog) newTog.textStyle = { ...newTog.textStyle, color: _modeAccentColor };
    if (prevRowId && prevRowId !== hitBox.id) {
      const r = root ?? L.renderer?.getRoot();
      const prevRow = r ? findBoxById(r, prevRowId) : null;
      const prevTog = prevRow?.children.find(c => c.id?.startsWith('toggle-'));
      if (prevTog) prevTog.textStyle = { ...prevTog.textStyle, color: theme.canvas.accent };
    }
  } else if (prevRowId && prevRowId !== hitBox.id) {
    const r = root ?? L.renderer?.getRoot();
    const prevRow = r ? findBoxById(r, prevRowId) : null;
    const prevTog = prevRow?.children.find(c => c.id?.startsWith('toggle-'));
    if (prevTog) prevTog.textStyle = { ...prevTog.textStyle, color: theme.canvas.accent };
  }

  // 测量文字宽度，计算上下线长度
  const label = hitBox.children.find(c => c.id?.startsWith('label-'));
  let textW = 0;
  if (label?.textStyle?.content) {
    const ctx2d = canvas instanceof HTMLCanvasElement ? canvas.getContext?.('2d') : undefined;
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
  const cdata = L.cursorBox?.data;
  if (cdata) {
    cdata.cursorDynamicLines = true;
    if (!_pulseBase) cdata.color = _cursorColor || theme.canvas.cursor;
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

/** 获取视口中央最近行的索引（在 L._rowIndex 中的位置） */
export function _getCenterRowIndex(): number {
  const root = L.renderer?.getRoot();
  if (!root || L._rowIndex.length === 0) return -1;
  const canvasH = (L.renderer?.canvas?.clientHeight ?? DOM.treeCanvas?.clientHeight ?? 0) || 618;
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
    } catch { console.warn('[cursor] row box detached during snapToCenterRow'); /* Box 被移除则跳过 */ }
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
  if (L.isRestoreMode()) return;  // 恢复期间跳过 GSAP
  const root = L.renderer?.getRoot();
  if (!root || L.cursorRowId === null) return;
  const canvas = L.renderer?.canvas ?? DOM.treeCanvas;
  const canvasH = canvas?.clientHeight ?? 618;
  const maxY = root.getMaxScroll().maxY;
  const idx = getCursorRowIndex();
  if (idx < 0 || !L._rowIndex[idx]) return;
  try {
    const abs = L._rowIndex[idx].getAbsolutePosition();
    const targetScrollY = Math.max(0, Math.min(maxY, abs.y + L._rowIndex[idx].height / 2 - canvasH / 2));
    anim.to(root, {
      scrollY: targetScrollY,
      duration: 0.35,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
  } catch { console.warn('[cursor] GSAP scrollToRow failed'); }
}

