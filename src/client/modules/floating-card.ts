/**
 * KFM v4 - 浮卡系统（从 card-stack.ts 拆分）
 *
 * 浮卡的发射、拖拽、缩放、状态机。
 * 与 card-stack.ts（堆叠卡片面板）共享卡片定义和配色。
 */

import { gestures } from "./gesture-registry.js";
import { anim } from './animation-registry.js';
import { currentTheme as theme } from './theme.js';

import {
  getCardCount, getCardName, getCardId,
  getFocusIndex, getCurrentAccent, getCardHandler,
  getFocusedCardRect, animateStackPullFeedback,
  hexToRgba, cardGradient, cardBg,
} from './card-stack.js';

const orbT = theme.cornerOrb;
const cornerSize = orbT.size;
const cornerOff = orbT.cornerOff;
const rightOff = cornerOff + orbT.rightOffAdj;
const bottomOff = cornerOff + orbT.bottomOffAdj;

// ========== 配置 ==========
const Z_FLOATING_BASE = 50;

const FLOATING_CARD_W = 155;
const FLOATING_CARD_H = 68;
const COMPACT_W = 54;
const COMPACT_H = 54;

// ========== 编辑模式最小尺寸 ==========
const FLOATING_CARD_W_MIN = 54;
const FLOATING_CARD_H_MIN = 54;
const FLOATING_DRAG_THRESHOLD = 5;

// ========== 浮卡类型与状态 ==========

interface FloatingCardItem {
  el: HTMLElement;
  sourceIndex: number;
  zIndex: number;
  state: 'launching' | 'compact' | 'expanding' | 'active' | 'collapsing' | 'dismissing' | 'editing';
  tlOrb: HTMLElement | null;
  trOrb: HTMLElement | null;
  blOrb: HTMLElement | null;
  brOrb: HTMLElement | null;
  contentEl: HTMLElement | null;
  cardWidth: number;
  cardHeight: number;
  compactMemW: number;
  compactMemH: number;
  activeMemW: number;
  activeMemH: number;
  accentColor: string;
}

let _floatingCards: FloatingCardItem[] = [];
let _nextFloatingZ = Z_FLOATING_BASE;
const _brOrbToItem = new WeakMap<HTMLElement, FloatingCardItem>();
/** 记录进入编辑模式前的状态，退出时恢复 */
let _preEditState: 'compact' | 'active' = 'active';

// ========== 浮卡光球拖拽状态（复刻 orb.ts 的全局变量） ==========
let _fItem: FloatingCardItem | null = null;
let _fDragging = false;
let _fStartX = 0;
let _fStartY = 0;
let _fStartOrbX = 0;
let _fStartOrbY = 0;
let _fStartCardL = 0;
let _fStartCardT = 0;
let _fStartCardW = 0;
let _fStartCardH = 0;
let _fLPTimer: ReturnType<typeof setTimeout> | null = null;
let _fLPFired = false;
let _fPreEdit: 'compact' | 'active' = 'compact';

// ========== 浮卡拖拽状态 ==========
let _dragItem: FloatingCardItem | null = null;
let _dragStartX = 0;
let _dragStartY = 0;
let _dragStartLeft = 0;
let _dragStartTop = 0;
let _dragStartW = 0;
let _dragStartH = 0;
let _dragStartOrbAbsX = 0;
let _dragStartOrbAbsY = 0;
let _dragIsDragging = false;
let _dragLongPressFired = false;
let _dragLongPressTimer: ReturnType<typeof setTimeout> | null = null;
let _dragPointerId: number | null = null;

// ========== 浮卡 ==========

function createDecoratedCorner(
  x: number, y: number, w: number, h: number,
  color: string, svgInner: string,
): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = [
    'position:absolute',
    'left:' + x + 'px',
    'top:' + y + 'px',
    'width:' + w + 'px',
    'height:' + h + 'px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'pointer-events:none',
  ].join(';');
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + orbT.glowCenterAlpha + ')' : color;
  const glowM = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + orbT.glowMidAlpha + ')' : color;
  const shadowC1 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + orbT.shadow1Alpha + ')' : color;
  const shadowC2 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + orbT.shadow2Alpha + ')' : color;
  const symA = m && m[4] !== undefined ? m[4] : String(orbT.symAlpha);
  const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + symA + ')' : color;
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at ' + orbT.glowPos + ',' + glowC + ',' + glowM + ',transparent 70%);box-shadow:0 0 ' + orbT.shadow1Blur + ' ' + shadowC1 + ',0 0 ' + orbT.shadow2Blur + ' ' + shadowC2 + '"></div>' +
    '<div style="display:flex;align-items:center;justify-content:center;color:' + symC + ';-webkit-mask:linear-gradient(' + orbT.symMaskAngle + ',' + orbT.symMaskCutoff + ',transparent 100%);mask:linear-gradient(' + orbT.symMaskAngle + ',' + orbT.symMaskCutoff + ',transparent 100%)">' + svgInner + '</div>';
  return box;
}

// ========== 浮卡叠层辅助 ==========

function _cardAbove(item: FloatingCardItem): FloatingCardItem | null {
  let highest: FloatingCardItem | null = null;
  for (const c of _floatingCards) {
    if (c === item) continue;
    if (c.zIndex > item.zIndex) {
      if (!highest || c.zIndex > highest.zIndex) {
        highest = c;
      }
    }
  }
  return highest;
}

function _cardBelow(item: FloatingCardItem): FloatingCardItem | null {
  let lowest: FloatingCardItem | null = null;
  for (const c of _floatingCards) {
    if (c === item) continue;
    if (c.zIndex < item.zIndex) {
      if (!lowest || c.zIndex < lowest.zIndex) {
        lowest = c;
      }
    }
  }
  return lowest;
}

function _swapZIndex(a: FloatingCardItem, b: FloatingCardItem): void {
  const tmp = a.zIndex;
  a.zIndex = b.zIndex;
  b.zIndex = tmp;
  a.el.style.zIndex = String(a.zIndex);
  b.el.style.zIndex = String(b.zIndex);
}

// ========== 45° 层叠排布 ==========

interface FloatingSafeBounds {
  safeL: number; safeT: number; safeB: number; fullR: number; stackLeft: number;
}

function _calcFloatingSafeBounds(): FloatingSafeBounds {
  const safeL = 8;
  const safeB = 56.5; // 屏幕底部留给 AI 输入栏
  const safeT = 8;
  const fullR = window.innerWidth;
  const stackLeft = (window.innerWidth * 0.7); // 卡堆左边界
  return { safeL, safeT, safeB, fullR, stackLeft };
}

/**
 * 随机散落：在安全区内找一个不重叠的位置。
 * 最多尝试 30 次，失败则垂直堆叠在左侧。
 */
function _scatterPosition(cardIndex: number): { left: number; top: number } {
  const { safeL, safeT, safeB, stackLeft } = _calcFloatingSafeBounds();
  const stackL = stackLeft;
  const stackR = window.innerWidth - COMPACT_W;
  const stackT = safeT;
  const stackBot = window.innerHeight - safeB - COMPACT_H;
  const stackW = stackR - stackL;

  // 纵向堆叠：如果空间不够，依次向下排列
  const totalCards = _floatingCards.length;
  const verticalStep = 60;
  const stackCount = totalCards;
  const baseL = stackL + (stackW / 2);
  const baseT = stackT + 20 + stackCount * verticalStep;
  const fallbackLeft = Math.max(safeL, Math.min(baseL, stackR));
  const fallbackTop = Math.max(safeT, Math.min(baseT, stackBot));

  // 尝试横向散落在安全区域的左侧区域
  const spreadL = safeL;
  const spreadR = stackL - FLOATING_CARD_W;
  const spreadW = spreadR - spreadL;
  if (spreadW < 20) {
    return { left: fallbackLeft, top: fallbackTop };
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const l = spreadL + Math.random() * spreadW;
    const t = safeT + Math.random() * (window.innerHeight - safeB - safeT - COMPACT_H);
    let overlap = false;
    for (const c of _floatingCards) {
      const cl = parseFloat(c.el.style.left) || 0;
      const ct = parseFloat(c.el.style.top) || 0;
      const cw = c.cardWidth;
      const ch = c.cardHeight;
      if (l < cl + cw && l + COMPACT_W > cl && t < ct + ch && t + COMPACT_H > ct) {
        overlap = true;
        break;
      }
    }
    if (!overlap) {
      return { left: l, top: t };
    }
  }
  return { left: fallbackLeft, top: fallbackTop };
}

// ========== 浮卡拖拽/编辑状态机 ==========

function _clearFloatingDragTimer(): void {
  if (_dragLongPressTimer) { clearTimeout(_dragLongPressTimer); _dragLongPressTimer = null; }
}

function _enterFloatingEditMode(item: FloatingCardItem): void {
  _preEditState = item.state as 'compact' | 'active';
  item.state = 'editing';
  item.el.style.boxShadow = '0 0 24px 8px ' + hexToRgba(item.accentColor, 0.25) + ', 0 8px 32px rgba(0,0,0,0.5)';
}

function _exitFloatingEditMode(item: FloatingCardItem): void {
  item.state = _preEditState;
  item.el.style.boxShadow = theme.stack.blurShadow;
}

function _startFloatingDrag(item: FloatingCardItem, clientX: number, clientY: number, pointerId?: number): void {
  _dragItem = item;
  _dragStartX = clientX;
  _dragStartY = clientY;
  _dragStartLeft = parseFloat(item.el.style.left) || 0;
  _dragStartTop = parseFloat(item.el.style.top) || 0;
  _dragStartW = item.cardWidth;
  _dragStartH = item.cardHeight;
  _dragIsDragging = false;
  _dragLongPressFired = false;
  _dragPointerId = pointerId ?? null;

  // 长按进编辑模式
  _dragLongPressTimer = setTimeout(() => {
    if (!_dragItem) return;
    _dragLongPressFired = true;
    _startFloatingDrag(_dragItem, clientX, clientY, pointerId);
    _enterFloatingEditMode(_dragItem);
  }, 600);
}

function _handleFloatingDragMove(clientX: number, clientY: number, pointerId?: number): void {
  if (!_dragItem) return;
  if (_dragPointerId !== null && pointerId !== undefined && pointerId !== _dragPointerId) return;

  const dx = clientX - _dragStartX;
  const dy = clientY - _dragStartY;

  if (Math.abs(dx) > FLOATING_DRAG_THRESHOLD || Math.abs(dy) > FLOATING_DRAG_THRESHOLD) {
    if (!_dragIsDragging) {
      _dragIsDragging = true;
      if (_dragLongPressTimer) { clearTimeout(_dragLongPressTimer); _dragLongPressTimer = null; }
    }
  }

  if (!_dragIsDragging) return;

  const { safeL, safeT, safeB } = _calcFloatingSafeBounds();

  if (_dragItem.state === 'editing') {
    // 编辑模式：左上角固定，拉伸右下角
    const newW = Math.max(FLOATING_CARD_W_MIN, _dragStartW + dx);
    const newH = Math.max(FLOATING_CARD_H_MIN, _dragStartH + dy);

    // 边界钳制（右下角不超出屏幕）
    const maxRight = window.innerWidth - safeL;
    const maxBottom = window.innerHeight - safeB;
    const clampedW = Math.min(newW, maxRight - _dragStartLeft);
    const clampedH = Math.min(newH, maxBottom - _dragStartTop);

    _dragItem.el.style.width = clampedW + 'px';
    _dragItem.el.style.height = clampedH + 'px';
    _dragItem.cardWidth = clampedW;
    _dragItem.cardHeight = clampedH;

    // 记忆当前尺寸
    if (_dragItem.compactMemW < clampedW) _dragItem.compactMemW = clampedW;
    if (_dragItem.compactMemH < clampedH) _dragItem.compactMemH = clampedH;
    if (_dragItem.activeMemW < clampedW) _dragItem.activeMemW = clampedW;
    if (_dragItem.activeMemH < clampedH) _dragItem.activeMemH = clampedH;

    // 同步光球位置
    const rx = clampedW - rightOff - cornerSize;
    const by = clampedH - bottomOff - cornerSize;
    if (_dragItem.brOrb) {
      _dragItem.brOrb.style.left = rx + 'px';
      _dragItem.brOrb.style.top = by + 'px';
    }
  } else {
    // 普通拖动
    const newL = _dragStartLeft + dx;
    const newT = _dragStartTop + dy;
    const clampedL = Math.max(safeL, Math.min(newL, window.innerWidth - _dragStartW - safeL));
    const clampedT = Math.max(safeT, Math.min(newT, window.innerHeight - _dragStartH - safeB));
    _dragItem.el.style.left = clampedL + 'px';
    _dragItem.el.style.top = clampedT + 'px';
  }
}

function _endFloatingDrag(): void {
  _clearFloatingDragTimer();
  if (_dragItem && _dragLongPressFired) {
    _exitFloatingEditMode(_dragItem);
  }
  if (_dragItem && !_dragIsDragging && !_dragLongPressFired) {
    _dragItem.brOrb?.click();
  }
  _dragItem = null;
  _dragIsDragging = false;
}

function _bindBrDragEvents(brOrb: HTMLElement, item: FloatingCardItem): void {
  let pStartX = 0, pStartY = 0;
  let pDragging = false;
  let pLPFired = false;
  let pLPTimer: ReturnType<typeof setTimeout> | null = null;

  brOrb.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pStartX = e.clientX;
    pStartY = e.clientY;
    pDragging = false;
    pLPFired = false;

    _startFloatingDrag(item, e.clientX, e.clientY, e.pointerId);

    pLPTimer = setTimeout(() => {
      pLPFired = true;
      _startFloatingDrag(item, pStartX, pStartY, e.pointerId);
      _enterFloatingEditMode(item);
    }, 600);
  });

  document.addEventListener('pointermove', (e) => {
    if (!pDragging && (Math.abs(e.clientX - pStartX) > FLOATING_DRAG_THRESHOLD || Math.abs(e.clientY - pStartY) > FLOATING_DRAG_THRESHOLD)) {
      pDragging = true;
      if (pLPTimer) { clearTimeout(pLPTimer); pLPTimer = null; }
    }
    _handleFloatingDragMove(e.clientX, e.clientY, e.pointerId);
  });

  document.addEventListener('pointerup', () => {
    if (pLPTimer) { clearTimeout(pLPTimer); pLPTimer = null; }
    if (_dragItem && pLPFired) {
      _exitFloatingEditMode(_dragItem);
    }
    if (_dragItem && !pDragging && !pLPFired) {
      _dragItem.brOrb?.click();
    }
    _dragItem = null;
    _dragIsDragging = false;
  }, { once: true });
}

// ========== 全局文档级拖动监听 ==========
let _globalDragInitialized = false;

function _ensureGlobalDragListeners(): void {
  if (_globalDragInitialized) return;
  _globalDragInitialized = true;

  document.addEventListener('pointermove', (e) => {
    _handleFloatingDragMove(e.clientX, e.clientY, e.pointerId);
  });

  document.addEventListener('pointerup', () => {
    _endFloatingDrag();
  });

  document.addEventListener('pointercancel', () => {
    _endFloatingDrag();
  });
}

// ========== 发射浮卡 ==========

export function launchFocusedCard(): void {
  animateStackPullFeedback();
  const focusIdx = getFocusIndex();
  const cardRect = getFocusedCardRect();
  if (!cardRect) return;
  const cc = getCurrentAccent(focusIdx);
  if (!cc) return;

  const el = document.createElement('div');
  el.className = 'floating-card';
  el.dataset.index = String(focusIdx);

  // cornerSize/cornerOff/rightOff/bottomOff 已提升为模块级常量
  const s = orbT.symScale, c = 6 * (1 - s), sh = orbT.symShift;

  // 内层毛玻璃容器
  const bgLayer = document.createElement('div');
  bgLayer.style.cssText = [
    'border-radius:11px', 'width:100%', 'height:100%',
    'background:' + cardBg(),
    'backdrop-filter:blur(16px)', '-webkit-backdrop-filter:blur(16px)',
    'position:relative', 'overflow:hidden',
  ].join(';');
  // 内容层：所有展示内容都在这里，过渡时 opacity 淡入淡出
  const contentEl = document.createElement('div');
  contentEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:2px 6px;font-size:11px;font-weight:500;color:rgba(224,224,224,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:none';
  bgLayer.appendChild(contentEl);
  _renderFloatingContent(contentEl, 'compact', getCardName(focusIdx));
  el.appendChild(bgLayer);

  // 四角光球颜色：左 color1，右 color2
  const leftRgba = hexToRgba(cc.color1, 1);
  const rightRgba = hexToRgba(cc.color2, 1);

  const zIndex = _nextFloatingZ++;
  const item = {
    el, sourceIndex: focusIdx, zIndex, state: 'launching',
    tlOrb: null, trOrb: null, blOrb: null, brOrb: null, contentEl,
    cardWidth: COMPACT_W, cardHeight: COMPACT_H,
    compactMemW: COMPACT_W, compactMemH: COMPACT_H,
    activeMemW: FLOATING_CARD_W, activeMemH: FLOATING_CARD_H,
    accentColor: cc.color2,
  } as FloatingCardItem;

  // BR — 紧凑态唯一光球（无图标），点击触发展开
  const brOrb = createDecoratedCorner(
    COMPACT_W - rightOff - cornerSize,
    COMPACT_H - bottomOff - cornerSize, cornerSize, cornerSize, rightRgba, '');
  brOrb.style.pointerEvents = 'auto';
  brOrb.style.cursor = 'pointer';
  brOrb.classList.add("floating-br-orb");
  _brOrbToItem.set(brOrb, item);

  brOrb.addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.state === 'compact') {
      item.state = 'expanding';

      // 内容淡出 → 切换为展开态内容 → 淡入（与展开动画并行）
      anim.to(contentEl, { opacity: 0, duration: 0.1, ease: 'none', onComplete: () => {
        if (item.contentEl) {
          const cardId = getCardId(item.sourceIndex);
          if (cardId) getCardHandler(cardId)?.activate?.(item.contentEl);
          _renderFloatingContent(item.contentEl, 'active');
        }
        anim.to(contentEl, { opacity: 1, duration: 0.15, ease: 'none' });
      }});

      // 卡片尺寸动画 + 角落光球
      const expW = item.activeMemW;
      const expH = item.activeMemH;
      const curLeft = parseFloat(el.style.left) || targetPos.left;
      const curTop = parseFloat(el.style.top) || targetPos.top;
      const targetW = expW;
      const targetH = expH;
      const MARGIN = 8;
      const curW = item.cardWidth;
      const curH = item.cardHeight;
      const compressedW = Math.max(FLOATING_CARD_W_MIN, Math.min(expW, curLeft + curW - MARGIN));
      const compressedH = Math.max(FLOATING_CARD_W_MIN, Math.min(expH, curTop + curH - MARGIN));
      const expLeft = curLeft + curW - compressedW;
      const expTop = curTop + curH - compressedH;
      const brX0 = curW - rightOff - cornerSize;
      const brY0 = curH - bottomOff - cornerSize;
      const tlColor = hexToRgba(cc.color1, orbT.tlAlpha);
      const tlOrb = createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlColor,
        '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c - sh) + ') scale(' + s + ')"><path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
      tlOrb.style.pointerEvents = 'auto'; tlOrb.style.cursor = 'pointer';
      tlOrb.title = '\u4e0a\u79fb\u4e00\u5c42';
      tlOrb.addEventListener('click', () => { if (item.state !== 'active') return; const above = _cardAbove(item); if (above) _swapZIndex(item, above); });
      el.appendChild(tlOrb); item.tlOrb = tlOrb;
      const trOrb = createDecoratedCorner(compressedW - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, rightRgba,
        '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c + sh) + ',' + (c - sh) + ') scale(' + s + ')"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/></g></svg>');
      trOrb.style.pointerEvents = 'auto'; trOrb.style.cursor = 'pointer';
      trOrb.title = '\u5173\u95ed';
      trOrb.addEventListener('click', () => { if (item.state !== 'active') return; dismissFloatingCard(true, el); });
      el.appendChild(trOrb); item.trOrb = trOrb;
      const blOrb = createDecoratedCorner(cornerOff, compressedH - bottomOff - cornerSize, cornerSize, cornerSize, leftRgba,
        '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c + sh) + ') scale(' + s + ')"><path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
      blOrb.style.pointerEvents = 'auto'; blOrb.style.cursor = 'pointer';
      blOrb.title = '\u4e0b\u79fb\u4e00\u5c42';
      blOrb.addEventListener('click', () => { if (item.state !== 'active') return; const below = _cardBelow(item); if (below) _swapZIndex(item, below); });
      el.appendChild(blOrb); item.blOrb = blOrb;
      // 初始偏移到 BR 位置（GSAP x/y），动画结束归零
      anim.set(tlOrb, { x: brX0 - cornerOff, y: brY0 - cornerOff });
      anim.set(trOrb, { x: brX0 - (compressedW - rightOff - cornerSize), y: brY0 - cornerOff });
      anim.set(blOrb, { x: brX0 - cornerOff, y: brY0 - (compressedH - bottomOff - cornerSize) });

      // BR 光球展开态图案
      const brSvgContainer = brOrb.children[1] as HTMLElement;
      if (brSvgContainer) brSvgContainer.innerHTML = '<svg width="14" height="14" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" fill="none"/><line x1="6" y1="1.5" x2="6" y2="10.5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/><line x1="1.5" y1="6" x2="10.5" y2="6" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/></svg>';

      anim.to(el, {
        left: expLeft, top: expTop,
        width: compressedW, height: compressedH,
        duration: 0.3, ease: 'back.out(1.1)',
        onUpdate: () => {
          const w = parseFloat(el.style.width) || compressedW;
          const h = parseFloat(el.style.height) || compressedH;
          brOrb.style.left = (w - rightOff - cornerSize) + 'px';
          brOrb.style.top = (h - bottomOff - cornerSize) + 'px';
        },
        onComplete: () => {
          item.cardWidth = compressedW;
          item.cardHeight = compressedH;
          brOrb.style.left = (item.cardWidth - rightOff - cornerSize) + 'px';
          brOrb.style.top = (item.cardHeight - bottomOff - cornerSize) + 'px';
          item.state = 'active';
          el.style.zIndex = String(zIndex);
        },
      });
      anim.to(tlOrb, { x: 0, y: 0, duration: 0.3, ease: 'back.out(1.1)' });
      anim.to(trOrb, { x: 0, y: 0, duration: 0.3, ease: 'back.out(1.1)' });
      anim.to(blOrb, { x: 0, y: 0, duration: 0.3, ease: 'back.out(1.1)' });
    } else if (item.state === 'active') {
      item.state = 'collapsing';
      // 内容淡出 → 切换为紧凑态内容 → 淡入
      anim.to(item.contentEl, { opacity: 0, duration: 0.1, ease: 'none', onComplete: () => {
        if (item.contentEl) {
          const _id = getCardId(item.sourceIndex);
          if (_id) getCardHandler(_id)?.deactivate?.(item.contentEl);
          _renderFloatingContent(item.contentEl, 'compact', getCardName(item.sourceIndex));
        }
        anim.to(item.contentEl, { opacity: 1, duration: 0.15, ease: 'none' });
      }});

      // 清除 BR 光球展开态图案
      const brSvg2 = brOrb.children[1] as HTMLElement;
      if (brSvg2) brSvg2.innerHTML = '';
      // 以右下角光球为锚点折叠：卡片向右下缩小
      const expLeft = parseFloat(el.style.left) || 0;
      const expTop = parseFloat(el.style.top) || 0;
      const foldW = item.compactMemW;
      const foldH = item.compactMemH;
      const MARGIN_F = 8;
      const expW = item.cardWidth;
      const expH = item.cardHeight;
      // 边界压缩（与展开对称）：折叠后右下角锚点不能超出屏幕
      // 右下角光球位置（锚点，不动）
      const anchorRight = expLeft + expW;
      const anchorBottom = expTop + expH;
      // 边界压缩：如果折叠后左上角超出屏幕，压缩尺寸（展开对称）
      const clampedFoldW = Math.max(FLOATING_CARD_W_MIN, Math.min(foldW, anchorRight - MARGIN_F));
      const clampedFoldH = Math.max(FLOATING_CARD_H_MIN, Math.min(foldH, anchorBottom - MARGIN_F));
      const foldLeft = anchorRight - clampedFoldW;
      const foldTop = anchorBottom - clampedFoldH;
      // TL/TR/BL 偏移到 BR 终点，与卡片折叠同步
      const brX_end = clampedFoldW - rightOff - cornerSize;
      const brY_end = clampedFoldH - bottomOff - cornerSize;
      if (item.tlOrb) anim.to(item.tlOrb, { x: brX_end - cornerOff, y: brY_end - cornerOff, duration: 0.3, ease: 'power2.in' });
      if (item.trOrb) anim.to(item.trOrb, { x: brX_end - (expW - rightOff - cornerSize), y: brY_end - cornerOff, duration: 0.3, ease: 'power2.in' });
      if (item.blOrb) anim.to(item.blOrb, { x: brX_end - cornerOff, y: brY_end - (expH - bottomOff - cornerSize), duration: 0.3, ease: 'power2.in' });
      anim.to(el, {
        left: foldLeft, top: foldTop,
        width: clampedFoldW, height: clampedFoldH,
        duration: 0.3, ease: 'power2.in',
        onUpdate: () => {
          const w = parseFloat(el.style.width) || foldW;
          const h = parseFloat(el.style.height) || foldH;
          brOrb.style.left = (w - rightOff - cornerSize) + 'px';
          brOrb.style.top = (h - bottomOff - cornerSize) + 'px';
        },
        onComplete: () => {
          item.cardWidth = clampedFoldW;
          item.cardHeight = clampedFoldH;
          brOrb.style.left = (clampedFoldW - rightOff - cornerSize) + 'px';
          brOrb.style.top = (clampedFoldH - bottomOff - cornerSize) + 'px';
          if (item.tlOrb) { item.tlOrb.remove(); item.tlOrb = null; }
          if (item.trOrb) { item.trOrb.remove(); item.trOrb = null; }
          if (item.blOrb) { item.blOrb.remove(); item.blOrb = null; }
          item.state = 'compact';
        },
      });
    }
  });
  el.appendChild(brOrb);
  item.brOrb = brOrb;

  // 紧凑态初始样式
  el.style.cssText = [
    'position:fixed',
    'left:' + cardRect.left + 'px', 'top:' + cardRect.top + 'px',
    'width:' + COMPACT_W + 'px', 'height:' + COMPACT_H + 'px',
    'border-radius:12px', 'padding:1px', 'padding-left:3px',
    'background:' + cardGradient(focusIdx, 0.85),
    'pointer-events:auto', 'z-index:' + zIndex, 'opacity:1',
  ].join(';');

  document.body.appendChild(el);
  _ensureGlobalDragListeners();

  const targetPos = _scatterPosition(_floatingCards.length);
  _floatingCards.push(item);
  const targetLeft = targetPos.left;
  const targetTop = targetPos.top;


  const LAUNCH_Z_ABOVE_STACK = Z_FLOATING_BASE + getCardCount() + 1;
  el.style.zIndex = String(LAUNCH_Z_ABOVE_STACK);

  anim.set(el, { scale: 0.8 });
  anim.to(el, {
    left: targetLeft, top: targetTop, scale: 1,
    duration: 0.4, ease: 'back.out(1.3)',
    onComplete: () => {
      item.state = 'compact';
    },
  });
}

function _buildExpandedLayout(el: HTMLElement, _cc: { color1: string; color2: string }): void {
  const item = _floatingCards.find(i => i.el === el);
  if (!item?.contentEl) return;
  const cardId = getCardId(item.sourceIndex);
  const handler = cardId ? getCardHandler(cardId) : undefined;
  if (handler) {
    handler.activate(item.contentEl);
    return;
  }
  _renderFloatingContent(item.contentEl, 'active');
}

/** 在 compact/active 态浮卡上构建内容框架 */
function _renderFloatingContent(contentEl: HTMLElement, state: 'compact' | 'active', cardName?: string): void {
  if (state === 'compact') {
    contentEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:2px 6px;font-size:11px;font-weight:500;color:rgba(224,224,224,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    contentEl.textContent = cardName || '';
  } else {
    contentEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:flex-start;box-sizing:border-box;padding:8px;font-size:11px;color:rgba(224,224,224,0.7);overflow-y:auto';
  }
}


export function dismissFloatingCard(animated?: boolean, sourceEl?: HTMLElement): void {
  if (sourceEl) {
    for (const item of _floatingCards) {
      if (item.el === sourceEl) {
        if (item.state === 'dismissing') return;
        _dismissOne(item, animated);
        return;
      }
    }
  } else {
    for (const item of [..._floatingCards]) {
      if (item.state !== 'dismissing') _dismissOne(item, animated);
    }
  }
}

function _dismissOne(item: FloatingCardItem, animated?: boolean): void {
  const el = item.el;
  if (item.state === 'expanding' || item.state === 'launching') {
    item.state = 'dismissing';
    return;
  }
  item.state = 'dismissing';

  if (item.contentEl) {
    const _id = getCardId(item.sourceIndex);
    if (_id) getCardHandler(_id)?.deactivate?.(item.contentEl);
  }
  if (animated !== false) {
    anim.to(el, {
      scale: 0.3, opacity: 0, duration: 0.2, ease: 'back.in(1.3)',
      onComplete: () => {
        el.remove();
        const idx = _floatingCards.indexOf(item);
        if (idx >= 0) _floatingCards.splice(idx, 1);
      },
    });
  } else {
    el.remove();
    const idx = _floatingCards.indexOf(item);
    if (idx >= 0) _floatingCards.splice(idx, 1);
  }
}

export function hasFloatingCard(): boolean {
  return _floatingCards.length > 0;
}

// ========== 浮卡初始化 ==========

/** 注册浮卡的光球拖拽手势（从 card-stack.ts initCardStack 中拆分） */
export function initFloatingCards(): void {
  const _fRS = orbT.size;
  const _fRH = _fRS / 2;
  const _frightOff = orbT.cornerOff + orbT.rightOffAdj;
  const _fbottomOff = orbT.cornerOff + orbT.bottomOffAdj;
  const _fMARGIN = 8;

  function _fGetMaxY(): number {
    const bar = document.getElementById('aiInputBar');
    return (bar ? bar.getBoundingClientRect().top : window.innerHeight) - _fRS - _fMARGIN;
  }

  function _fClamp(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(_fMARGIN, Math.min(window.innerWidth - _fRS - _fMARGIN, x)),
      y: Math.max(_fMARGIN, Math.min(_fGetMaxY(), y)),
    };
  }

  function _fSyncCorners(item: FloatingCardItem, w: number, h: number): void {
    const rx = w - _frightOff - _fRS;
    const by = h - _fbottomOff - _fRS;
    // BR 光球只要有就独立更新（紧缩态下 TL/TR/BL 为 null）
    if (item.brOrb) {
      item.brOrb.style.left = rx + 'px';
      item.brOrb.style.top = by + 'px';
    }
    if (item.trOrb && item.blOrb) {
      item.trOrb.style.left = rx + 'px';
      item.blOrb.style.top = by + 'px';
    }
  }

  gestures.register({
    id: 'floating-orb',
    targetFilter: '.floating-br-orb',
    priority: 100,
    stopPropagation: true,
    onStart: (e: PointerEvent) => {
      e.preventDefault();
      const orbEl = (e.target as HTMLElement).closest('.floating-br-orb') as HTMLElement;
      if (!orbEl) return;
      const item = _brOrbToItem.get(orbEl);
      if (!item) return;
      if (item.state !== 'compact' && item.state !== 'active' && item.state !== 'editing') return;

      _fItem = item;
      _fDragging = false;
      _fLPFired = false;
      _fStartX = e.clientX;
      _fStartY = e.clientY;
      _fPreEdit = item.state as 'compact' | 'active';

      const r = orbEl.getBoundingClientRect();
      _fStartOrbX = r.left;
      _fStartOrbY = r.top;
      _fStartCardL = parseFloat(item.el.style.left) || 0;
      _fStartCardT = parseFloat(item.el.style.top) || 0;
      _fStartCardW = item.cardWidth;
      _fStartCardH = item.cardHeight;

      _fLPTimer = setTimeout(() => {
        _fLPFired = true;
        if (!_fItem) return;
        _fPreEdit = _fItem.state as 'compact' | 'active';
        _fItem.state = 'editing';
        const r2 = orbEl.getBoundingClientRect();
        _fStartOrbX = r2.left;
        _fStartOrbY = r2.top;
        _fStartCardL = parseFloat(_fItem.el.style.left) || 0;
        _fStartCardT = parseFloat(_fItem.el.style.top) || 0;
        _fStartCardW = _fItem.cardWidth;
        _fStartCardH = _fItem.cardHeight;
        // 保存光球初始光晕，退出时恢复
        const glowDiv = orbEl.firstElementChild as HTMLElement;
        if (glowDiv) glowDiv.dataset.initBoxShadow = glowDiv.style.boxShadow;
        // 编辑模式光晕（复刻 orb.ts panelShadowEdit，用 accentColor + 半透明）
        const editGlow = hexToRgba(_fItem.accentColor, 0.25);
        _fItem.el.style.boxShadow = '0 0 24px 8px ' + editGlow + ', 0 8px 32px rgba(0,0,0,0.5)';
      }, 600);
    },
    onMove: (e: PointerEvent) => {
      if (!_fItem) return;
      const dx = e.clientX - _fStartX;
      const dy = e.clientY - _fStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        _fDragging = true;
        if (_fLPTimer) { clearTimeout(_fLPTimer); _fLPTimer = null; }
      }
      if (!_fDragging) return;

      const orbEl = _fItem.brOrb;
      if (!orbEl) return;

      if (_fItem.state === 'editing') {
        // 编辑模式：卡片左上角固定，BR光球当缩放手柄
        const rawX = _fStartOrbX + dx;
        const rawY = _fStartOrbY + dy;
        const clamped = _fClamp(rawX, rawY);
        const minX = _fStartCardL + FLOATING_CARD_W_MIN - _frightOff - _fRS;
        const minY = _fStartCardT + FLOATING_CARD_H_MIN - _fbottomOff - _fRS;
        const ox = Math.max(minX, clamped.x);
        const oy = Math.max(minY, clamped.y);

        const newW = Math.max(FLOATING_CARD_W_MIN, ox - _fStartCardL + _frightOff + _fRS);
        const newH = Math.max(FLOATING_CARD_H_MIN, oy - _fStartCardT + _fbottomOff + _fRS);
        _fItem.el.style.width = newW + 'px';
        _fItem.el.style.height = newH + 'px';
        _fItem.cardWidth = newW;
        _fItem.cardHeight = newH;
        if (_fPreEdit === 'compact') {
          _fItem.compactMemW = newW;
          _fItem.compactMemH = newH;
        } else {
          _fItem.activeMemW = newW;
          _fItem.activeMemH = newH;
        }
        _fSyncCorners(_fItem, newW, newH);
      } else {
        // 普通拖动：复刻 orb.ts 的 updatePanelPosition 逻辑
        // 光球位置约束
        const rawX = _fStartOrbX + dx;
        const rawY = _fStartOrbY + dy;
        const clamped = _fClamp(rawX, rawY);

        // 光球中心
        const orbCX = clamped.x + _fRH;
        const orbCY = clamped.y + _fRH;

        // 边界压缩：可用空间 = 光球中心到屏幕左/上的距离
        const availLeft = orbCX - _fMARGIN;
        const availTop = orbCY - _fMARGIN;
        const renderW = Math.max(FLOATING_CARD_W_MIN, Math.min(_fStartCardW, availLeft));
        const renderH = Math.max(FLOATING_CARD_H_MIN, Math.min(_fStartCardH, availTop));

        // 卡片定位：右下角对齐光球中心
        const left = Math.max(_fMARGIN, orbCX - renderW);
        const top = Math.max(_fMARGIN, orbCY - renderH);
        _fItem.el.style.left = left + 'px';
        _fItem.el.style.top = top + 'px';
        _fItem.el.style.width = renderW + 'px';
        _fItem.el.style.height = renderH + 'px';
        _fItem.cardWidth = renderW;
        _fItem.cardHeight = renderH;
        _fSyncCorners(_fItem, renderW, renderH);
      }
    },
    onEnd: () => {
      if (_fLPTimer) { clearTimeout(_fLPTimer); _fLPTimer = null; }
      if (_fItem) {
        if (_fItem.state === 'editing') {
          _fItem.state = _fPreEdit;
          _fItem.el.style.boxShadow = theme.stack.blurShadow;
          // 恢复光球初始光晕
          const gd = _fItem.brOrb?.firstElementChild as HTMLElement;
          if (gd && gd.dataset.initBoxShadow !== undefined) {
            gd.style.boxShadow = gd.dataset.initBoxShadow;
            delete gd.dataset.initBoxShadow;
          }
        }
        if (!_fDragging && !_fLPFired) {
          _fItem.brOrb?.click();
        }
      }
      _fDragging = false;
      _fItem = null;
    },
  });
}
