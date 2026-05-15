import { gestures } from "./gesture-registry.js";
import { anim, AnimTimeline } from './animation-registry.js';
import { debugLog } from './debug-panel.js';
import { currentTheme as theme } from './theme.js';
const orbT = theme.cornerOrb;

/**
 * KFM v4 - 堆叠卡片面板
 *
 * 全屏左滑唤出，7 张卡片按星云光谱堆叠。
 * 垂直滑动切换聚焦卡片，点击聚焦卡打开对应盒子（TODO）。
 * 无遮罩 + 卡片只露部分，像半开的抽屉。
 */

// ========== 卡片内容定义 ==========
const CARD_BG = theme.stack.cardBg;

interface CardDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

const CARDS: CardDef[] = [
  { id: 'settings', icon: '\u2699', name: '\u8BBE\u7F6E', desc: 'API Key \u00B7 \u6A21\u578B\u9009\u62E9' },
  { id: 'files',    icon: '\uD83D\uDCC1', name: '\u6587\u4EF6\u7BA1\u7406', desc: '\u4E0A\u4F20 \u00B7 \u4E0B\u8F7D \u00B7 \u6574\u7406' },
  { id: 'notes',    icon: '\uD83D\uDCDD', name: '\u7B14\u8BB0',     desc: '\u5FEB\u901F\u8BB0\u5F55 \u00B7 \u8349\u7A3F' },
  { id: 'plugins',  icon: '\uD83D\uDD0C', name: '\u63D2\u4EF6',     desc: '\u6269\u5C55 \u00B7 \u96C6\u6210' },
  { id: 'theme',    icon: '\uD83C\uDFA8', name: '\u4E3B\u9898',     desc: '\u5916\u89C2 \u00B7 \u914D\u8272' },
  { id: 'stats',    icon: '\uD83D\uDCCA', name: '\u7EDF\u8BA1',     desc: '\u4F7F\u7528\u6570\u636E \u00B7 \u8D8B\u52BF' },
  { id: 'about',    icon: '\uD83D\uDC8E', name: '\u5173\u4E8E',     desc: '\u7248\u672C \u00B7 \u4FE1\u606F' },
];

// ========== 星云配色 ==========
const CARD_COLORS = theme.cardAccents;

function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function getTriple(i: number, alpha: number): string[] {
  const n = CARD_COLORS.length;
  const mainRgba = hexToRgba(CARD_COLORS[i].border, alpha);
  const prevIdx = (i - 1 + n) % n;
  const nextIdx = (i + 1) % n;
  const prev = hexToRgba(CARD_COLORS[prevIdx].border, alpha);
  const next = hexToRgba(CARD_COLORS[nextIdx].border, alpha);
  return [prev, mainRgba, next];
}

function getBorderGradient(i: number, alpha: number): string {
  const [c1, c2, c3] = getTriple(i, alpha);
  return "linear-gradient(to bottom right, " + c1 + " 0%, " + c2 + " 33%, " + c3 + " 50%)";
}

// ========== 配置 ==========
const CARD_GAP = theme.stack.cardGap;
const CARD_HEIGHT = theme.stack.cardHeight;
const STACK_TOP_RATIO = 0.12;

// ========== z-index ==========
const Z_FLOATING_BASE = 50;
const Z_STACK_BASE = 150;

const FLOATING_CARD_W = 90;
const FLOATING_CARD_H = 39;

// ========== 编辑模式最小尺寸 ==========
const FLOATING_CARD_W_MIN = 60;
const FLOATING_CARD_H_MIN = 28;
const FLOATING_DRAG_THRESHOLD = 5;

// ========== 状态 ==========
type StackState = 'closed' | 'opening' | 'open' | 'closing';
let _state: StackState = 'closed';
let _focusIndex = 0;
let _cardEls: HTMLElement[] = [];
let _scrollStartFocus = 0;
let _tl: AnimTimeline | null = null;

interface FloatingCardItem {
  el: HTMLElement;
  sourceIndex: number;
  zIndex: number;
  state: 'launching' | 'active' | 'dismissing' | 'editing';
  tlOrb: HTMLElement;
  blOrb: HTMLElement;
  brOrb: HTMLElement;
  cardWidth: number;
  cardHeight: number;
}
let _floatingCards: FloatingCardItem[] = [];
let _nextFloatingZ = Z_FLOATING_BASE;

// ========== 浮卡拖拽状态 ==========
let _dragItem: FloatingCardItem | null = null;
let _dragStartX = 0;
let _dragStartY = 0;
let _dragStartLeft = 0;
let _dragStartTop = 0;
let _dragStartW = 0;
let _dragStartH = 0;
let _dragIsDragging = false;
let _dragLongPressFired = false;
let _dragLongPressTimer: ReturnType<typeof setTimeout> | null = null;
let _dragPointerId: number | null = null;

// ========== DOM 构建 ==========

function createCard(index: number): HTMLElement {
  const card = CARDS[index];
  const color = CARD_COLORS[index];

  const el = document.createElement('div');
  el.className = 'stack-card';
  el.dataset.index = String(index);

  const topPx = Math.round(window.innerHeight * STACK_TOP_RATIO + index * CARD_GAP);

  el.dataset.randomRight = '0';
  el.dataset.randomRotate = '0';

  const alpha = 0.85;
  const borderGrad = getBorderGradient(index, alpha);

  el.style.cssText = [
    'position:fixed',
    'right:0px',
    'top:' + topPx + 'px',
    'width:155px',
    'height:' + CARD_HEIGHT + 'px',
    'border-radius:12px',
    'padding:4px 12px',
    'display:flex',
    'align-items:flex-start',
    'gap:6px',
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'border:1px solid transparent',
    'border-left-width:3px',
    'background: linear-gradient(' + CARD_BG + ',' + CARD_BG + ') padding-box, ' + borderGrad + ' border-box',
    'box-shadow:' + theme.stack.blurShadow,
    'transform:rotate(0deg)',
    'cursor:pointer',
    'z-index:' + (Z_STACK_BASE + index),
    'opacity:1',
    'user-select:none',
    '-webkit-user-select:none',
  ].join(';');

  el.innerHTML = ''
    + '<div class="stack-card-icon" style="width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:' + color.iconBg + ';color:' + color.border + '">' + String(index + 1).padStart(2, '0') + '</div>'
    + '<div class="stack-card-info" style="flex:1;min-width:0">'
    + '  <div class="stack-card-name" style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + card.name + '</div>'
    + '  <div class="stack-card-desc" style="font-size:10px;opacity:0.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0px">' + card.desc + '</div>'
    + '</div>';

  el.addEventListener("click", (e) => {
    const idx = parseInt(el.dataset.index || "0", 10);
    if (idx !== _focusIndex) {
      _focusIndex = idx;
      updateFocus();
    }
  });
  return el;
}

function buildCards(): void {
  console.log("[CARD-STACK] buildCards called");
  for (let i = 0; i < CARDS.length; i++) {
    const card = createCard(i);
    card.style.transform = 'translateX(100vw)';
    card.style.pointerEvents = 'none';
    document.body.appendChild(card);
    _cardEls.push(card);
  }
  console.log("[CARD-STACK] buildCards done, cards=", _cardEls.length);
}

function updateFocus(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dist = Math.abs(i - _focusIndex);
    anim.killTweensOf(el);
    const alpha = 0.85;

    if (dist === 0) {
      anim.to(el, {
        xPercent: 0, x: -28, scale: 1.04, rotation: 0,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.backdropFilter = 'blur(16px)';
      (el.style as any).webkitBackdropFilter = 'blur(16px)';
      el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
      el.style.boxShadow = theme.stack.focusShadow;
    } else {
      const randomRotate = parseFloat(el.dataset.randomRotate || '0');
      anim.to(el, {
        xPercent: 0, x: 0, scale: 1, rotation: randomRotate,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.backdropFilter = 'blur(16px)';
      (el.style as any).webkitBackdropFilter = 'blur(16px)';
      el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
      el.style.boxShadow = theme.stack.blurShadow;
    }
  }
}

function randomizeCards(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const right = Math.floor(Math.random() * 14) - 4;
    const rot = (Math.random() - 0.5) * 4;
    el.dataset.randomRight = String(right);
    el.dataset.randomRotate = String(rot);
    el.style.right = right + 'px';
    el.style.top = Math.round(window.innerHeight * STACK_TOP_RATIO + i * CARD_GAP) + 'px';
  }
}

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

function _animateStackPullFeedback(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const origX = i === _focusIndex ? -28 : 0;
    const pullDist = -(Math.random() * 10 + 5);
    const delay = Math.random() * 0.15;
    anim.to(el, {
      x: origX + pullDist,
      duration: 0.2,
      delay: delay,
      ease: 'power2.out',
      onComplete: () => {
        anim.to(el, { x: origX, duration: 0.25, ease: 'back.out(1.2)' });
      },
    });
  }
}

// ========== 浮卡叠层辅助 ==========

function _cardAbove(item: FloatingCardItem): FloatingCardItem | null {
  let best: FloatingCardItem | null = null;
  for (const c of _floatingCards) {
    if (c.zIndex > item.zIndex && (!best || c.zIndex < best.zIndex))
      best = c;
  }
  return best;
}

function _cardBelow(item: FloatingCardItem): FloatingCardItem | null {
  let best: FloatingCardItem | null = null;
  for (const c of _floatingCards) {
    if (c.zIndex < item.zIndex && (!best || c.zIndex > best.zIndex))
      best = c;
  }
  return best;
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
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const PAD = 16;

  const sideEl = document.getElementById("sidebar");
  const safeL = (sideEl?.classList.contains("open")
    ? sideEl.getBoundingClientRect().right : 0) + PAD;
  const safeT = PAD + 24;
  const fullR = vw - PAD;

  const orbEl = document.querySelector(".light-orb");
  let safeB = vh - PAD;
  if (orbEl) {
    const r = orbEl.getBoundingClientRect();
    if (r.bottom > vh * 0.3) safeB = Math.min(safeB, r.top - PAD);
  }

  const stackCards = document.querySelectorAll(".stack-card");
  const stackLeft = stackCards.length > 0
    ? stackCards[0].getBoundingClientRect().left
    : fullR;

  return { safeL, safeT, safeB, fullR, stackLeft };
}

function _clampCardPosition(
  left: number, top: number, w: number, h: number
): { left: number; top: number } {
  const b = _calcFloatingSafeBounds();
  return {
    left: Math.max(b.safeL, Math.min(b.fullR - w, Math.round(left))),
    top: Math.max(b.safeT, Math.min(b.safeB - h, Math.round(top))),
  };
}

/**
 * 随机散落：在安全区内找一个不重叠的位置。
 * 最多尝试 30 次，失败则垂直堆叠在左侧。
 */
function _scatterPosition(cardIndex: number): { left: number; top: number } {
  const b = _calcFloatingSafeBounds();
  const w = FLOATING_CARD_W;
  const h = FLOATING_CARD_H;
  const maxX = b.fullR - w;
  const maxY = b.safeB - h;

  // 已存在浮卡的位置列表
  const existing = _floatingCards.map(item => item.el.getBoundingClientRect());

  // 卡片堆排除区域（右上角）
  const stackCards = document.querySelectorAll(".stack-card");
  let stackRect: DOMRect | null = null;
  if (stackCards.length > 0) {
    const first = stackCards[0].getBoundingClientRect();
    const last = stackCards[stackCards.length - 1].getBoundingClientRect();
    stackRect = new DOMRectReadOnly(first.left, first.top, first.width, last.bottom - first.top) as unknown as DOMRect;
  }

  /** 检查位置 (x,y) 是否有效 */
  function isValid(x: number, y: number): boolean {
    if (x < b.safeL || x + w > b.fullR) return false;
    if (y < b.safeT || y + h > b.safeB) return false;
    for (const r of existing) {
      if (x < r.right && x + w > r.left && y < r.bottom && y + h > r.top)
        return false;
    }
    if (stackRect) {
      if (x < stackRect.right + 8 && x + w > stackRect.left - 8 &&
          y < stackRect.bottom + 8 && y + h > stackRect.top - 8)
        return false;
    }
    return true;
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const x = b.safeL + Math.random() * (maxX - b.safeL);
    const y = b.safeT + Math.random() * (maxY - b.safeT);
    if (isValid(x, y)) {
      const result = { left: Math.round(x), top: Math.round(y) };
      debugLog("FLOAT scatter c" + cardIndex + " " + result.left + "," + result.top);
      return result;
    }
  }

  // 兜底：左侧垂直堆叠
  const fallbackX = b.safeL;
  const fallbackY = b.safeT + cardIndex * (h + 4);
  const clamped = _clampCardPosition(fallbackX, fallbackY, w, h);
  debugLog("FLOAT fallback c" + cardIndex + " " + clamped.left + "," + clamped.top);
  return clamped;
}

// ========== 浮卡拖拽/编辑状态机 ==========

function _clearFloatingDragTimer(): void {
  if (_dragLongPressTimer) {
    clearTimeout(_dragLongPressTimer);
    _dragLongPressTimer = null;
  }
}

function _enterFloatingEditMode(item: FloatingCardItem): void {
  item.state = 'editing';
  item.el.style.boxShadow = theme.aiChat.panelShadowEdit;
  debugLog("FLOAT edit enter");
}

function _exitFloatingEditMode(item: FloatingCardItem): void {
  item.state = 'active';
  item.el.style.boxShadow = theme.stack.blurShadow;
  debugLog("FLOAT edit exit");
}

function _startFloatingDrag(item: FloatingCardItem, clientX: number, clientY: number, pointerId?: number): void {
  if (_dragItem) return;
  _dragItem = item;
  _dragPointerId = pointerId ?? null;
  _dragIsDragging = false;
  _dragLongPressFired = false;
  _dragStartX = clientX;
  _dragStartY = clientY;

  const rect = item.el.getBoundingClientRect();
  _dragStartLeft = rect.left;
  _dragStartTop = rect.top;
  _dragStartW = item.cardWidth;
  _dragStartH = item.cardHeight;

  _dragLongPressTimer = setTimeout(() => {
    _dragLongPressFired = true;
    if (item.state === 'active') {
      _enterFloatingEditMode(item);
    }
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
      _clearFloatingDragTimer();
    }
  }
  if (!_dragIsDragging) return;

  const el = _dragItem.el;

  if (_dragItem.state === 'editing') {
    const newW = Math.max(FLOATING_CARD_W_MIN, _dragStartW + dx);
    const newH = Math.max(FLOATING_CARD_H_MIN, _dragStartH + dy);
    el.style.width = newW + 'px';
    el.style.height = newH + 'px';
    _dragItem.cardWidth = newW;
    _dragItem.cardHeight = newH;
  } else {
    const rawX = _dragStartLeft + dx;
    const rawY = _dragStartTop + dy;
    const clamped = _clampCardPosition(rawX, rawY, _dragItem.cardWidth, _dragItem.cardHeight);
    el.style.left = clamped.left + 'px';
    el.style.top = clamped.top + 'px';
  }
}

function _endFloatingDrag(): void {
  _clearFloatingDragTimer();
  if (_dragItem) {
    if (_dragItem.state === 'editing') {
      _exitFloatingEditMode(_dragItem);
    }
    _dragItem = null;
  }
  _dragPointerId = null;
  _dragIsDragging = false;
  _dragLongPressFired = false;
}

function _bindBrDragEvents(brOrb: HTMLElement, item: FloatingCardItem): void {
  brOrb.addEventListener('touchstart', (e: TouchEvent) => {
    e.stopPropagation();
    if (item.state !== 'active' && item.state !== 'editing') return;
    const t = e.changedTouches[0];
    _startFloatingDrag(item, t.clientX, t.clientY, t.identifier);
  });

  brOrb.addEventListener('touchmove', (e: TouchEvent) => {
    if (!_dragItem || _dragItem !== item) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      _handleFloatingDragMove(t.clientX, t.clientY, t.identifier);
    }
  });

  brOrb.addEventListener('touchend', (e: TouchEvent) => {
    if (!_dragItem || _dragItem !== item) return;
    const stillActive = Array.from(e.touches).some(
      t => t.identifier === _dragPointerId
    );
    if (!stillActive) _endFloatingDrag();
  });

  brOrb.addEventListener('mousedown', (e: MouseEvent) => {
    e.stopPropagation();
    if (item.state !== 'active' && item.state !== 'editing') return;
    _startFloatingDrag(item, e.clientX, e.clientY);
  });
}

// ========== 全局文档级拖动监听 ==========
let _globalDragInitialized = false;

function _ensureGlobalDragListeners(): void {
  if (_globalDragInitialized) return;
  _globalDragInitialized = true;

  document.addEventListener('mousemove', (e: MouseEvent) => {
    _handleFloatingDragMove(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', () => {
    _endFloatingDrag();
  });
}

// ========== 发射浮卡 ==========

export function launchFocusedCard(): void {
  _animateStackPullFeedback();

  const focusedCard = _cardEls[_focusIndex];
  if (!focusedCard) return;

  const cardRect = focusedCard.getBoundingClientRect();
  const color = CARD_COLORS[_focusIndex];

  const el = document.createElement('div');
  el.className = 'floating-card';
  el.dataset.index = String(_focusIndex);

  const iconClone = focusedCard.querySelector('.stack-card-icon')?.cloneNode(true) as HTMLElement;
  const infoClone = focusedCard.querySelector('.stack-card-info')?.cloneNode(true) as HTMLElement;

  const [triPrev, triMain, triNext] = getTriple(_focusIndex, 1);
  const tlColor = triPrev.replace(/,\s*1\)$/, ',' + orbT.tlAlpha + ')');

  const cornerSize = orbT.size;
  const cornerOff = orbT.cornerOff;
  const rightOff = cornerOff + orbT.rightOffAdj;
  const bottomOff = cornerOff + orbT.bottomOffAdj;
  const s = orbT.symScale, c = 6 * (1 - s), sh = orbT.symShift;

  // 毛玻璃背景
  const cardBg = document.createElement('div');
  cardBg.style.cssText = [
    'position:absolute',
    'inset:0',
    'border-radius:12px',
    'border:1px solid transparent',
    'border-left-width:3px',
    'background: linear-gradient(' + CARD_BG + ',' + CARD_BG + ') padding-box, linear-gradient(to bottom right, ' + triPrev + ' 0%, ' + triMain + ' 33%, ' + triNext + ' 50%) border-box',
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'pointer-events:none',
  ].join(';');
  el.appendChild(cardBg);

  // 内容区
  const content = document.createElement('div');
  content.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;pointer-events:none';
  if (iconClone) {
    iconClone.style.width = '22px';
    iconClone.style.height = '22px';
    iconClone.style.fontSize = '11px';
    content.appendChild(iconClone);
  }
  if (infoClone) content.appendChild(infoClone);
  el.appendChild(content);

  // FloatingCardItem
  const zIndex = _nextFloatingZ++;
  const item: FloatingCardItem = {
    el, sourceIndex: _focusIndex, zIndex, state: 'launching',
    tlOrb: null as unknown as HTMLElement,
    blOrb: null as unknown as HTMLElement,
    brOrb: null as unknown as HTMLElement,
    cardWidth: FLOATING_CARD_W,
    cardHeight: FLOATING_CARD_H,
  };

  // TL — 上移一层
  const tlOrb = createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlColor,
    `<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${c-sh},${c-sh}) scale(${s})"><path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="${orbT.symStroke}" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>`);
  tlOrb.style.pointerEvents = 'auto';
  tlOrb.style.cursor = 'pointer';
  tlOrb.title = '\u4e0a\u79fb\u4e00\u5c42';
  tlOrb.addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.state !== 'active') return;
    const above = _cardAbove(item);
    if (!above) return;
    _swapZIndex(item, above);
  });
  el.appendChild(tlOrb);
  item.tlOrb = tlOrb;

  // TR — 关闭
  const trOrb = createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, triMain,
    `<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${c+sh},${c-sh}) scale(${s})"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="${orbT.symStroke}" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="${orbT.symStroke}" stroke-linecap="round"/></g></svg>`);
  trOrb.style.pointerEvents = 'auto';
  trOrb.style.cursor = 'pointer';
  trOrb.title = '\u5173\u95ed';
  trOrb.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissFloatingCard(true, el);
  });
  el.appendChild(trOrb);

  // BL — 下移一层
  const blOrb = createDecoratedCorner(cornerOff, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, triMain,
    `<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${c-sh},${c+sh}) scale(${s})"><path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="${orbT.symStroke}" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>`);
  blOrb.style.pointerEvents = 'auto';
  blOrb.style.cursor = 'pointer';
  blOrb.title = '\u4e0b\u79fb\u4e00\u5c42';
  blOrb.addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.state !== 'active') return;
    const below = _cardBelow(item);
    if (!below) return;
    _swapZIndex(item, below);
  });
  el.appendChild(blOrb);
  item.blOrb = blOrb;

  // BR — 拖拽移动 + 长按编辑大小
  const brOrb = createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize,
    FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, triNext,
    `<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${c+sh},${c+sh}) scale(${s})"><path d="M8,2 L8,14 M2,8 L14,8 M4,4 L8,2 L12,4 M4,12 L8,14 L12,12 M4,4 L2,8 L4,12 M12,4 L14,8 L12,12" stroke="currentColor" stroke-width="${orbT.symStroke}" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>`);
  brOrb.style.pointerEvents = 'auto';
  brOrb.style.cursor = 'move';
  brOrb.title = '\u62d6\u62fd\u79fb\u52a8 \u00B7 \u957F\u6309\u8C03\u6574\u5927\u5C0F';
  _bindBrDragEvents(brOrb, item);
  el.appendChild(brOrb);
  item.brOrb = brOrb;

  // 初始样式
  el.style.cssText = [
    'position:fixed',
    'left:' + cardRect.left + 'px',
    'top:' + cardRect.top + 'px',
    'width:' + FLOATING_CARD_W + 'px',
    'height:' + FLOATING_CARD_H + 'px',
    'pointer-events:auto',
    'z-index:' + zIndex,
    'opacity:1',
  ].join(';');

  document.body.appendChild(el);
  _ensureGlobalDragListeners();

  // 随机散落：在安全区内找不重叠位置（push 前调用）
  const targetPos = _scatterPosition(_floatingCards.length);
  _floatingCards.push(item);
  const targetLeft = targetPos.left;
  const targetTop = targetPos.top;
  debugLog('FLOAT launch ' + _focusIndex + ' ' + targetLeft + ',' + targetTop);

  // 发射时升到卡片堆之上以便飞行动画可见
  const LAUNCH_Z_ABOVE_STACK = Z_STACK_BASE + CARDS.length + 1;
  el.style.zIndex = String(LAUNCH_Z_ABOVE_STACK);

  anim.set(el, { scale: 0.8 });
  anim.to(el, {
    left: targetLeft,
    top: targetTop,
    scale: 1,
    duration: 0.4,
    ease: 'back.out(1.3)',
    onComplete: () => {
      item.state = 'active';
      el.style.zIndex = String(zIndex);
    },
  });
}

// ========== 销毁浮卡 ==========

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
  item.state = 'dismissing';

  // 清理拖拽状态
  if (_dragItem === item) {
    _clearFloatingDragTimer();
    _dragItem = null;
    _dragPointerId = null;
    _dragIsDragging = false;
    _dragLongPressFired = false;
  }

  anim.killTweensOf(el);
  if (animated) {
    const tl = anim.timeline({
      onComplete: () => {
        _floatingCards = _floatingCards.filter(fi => fi !== item);
        el.remove();
      },
    });
    tl.to(el, { scale: 1.08, duration: 0.1, ease: 'power2.out' });
    tl.to(el, { scale: 0, duration: 0.2, ease: 'power3.in' });
  } else {
    _floatingCards = _floatingCards.filter(fi => fi !== item);
    el.remove();
  }
}

export function hasFloatingCard(): boolean {
  return _floatingCards.length > 0;
}

// ========== 卡片堆开/关 ==========

export function openCardStack(): void {
  if (_state === 'open' || _state === 'opening') return;
  if (_state === 'closing' && _tl) {
    _state = 'opening';
    _tl.reverse();
    return;
  }

  _state = 'opening';
  randomizeCards();

  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    anim.set(el, { x: '100vw', opacity: 1, pointerEvents: 'auto' });
  }

  _tl = anim.timeline({
    onComplete: () => {
      _state = 'open'; _tl = null;
      const alpha = 0.85;
      for (let i = 0; i < _cardEls.length; i++) {
        const el = _cardEls[i];
        el.style.backdropFilter = 'blur(16px)';
        (el.style as any).webkitBackdropFilter = 'blur(16px)';
        el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
        el.style.boxShadow = (i === _focusIndex) ? theme.stack.focusShadow : theme.stack.blurShadow;
      }
    },
    onReverseComplete: () => { _state = 'closed'; _tl = null; }
  });

  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dur = 0.2 + Math.random() * 0.3;
    if (i === _focusIndex) {
      _tl.to(el, { x: -28, scale: 1.04, rotation: 0, duration: dur, ease: 'back.out(1.2)' }, 0);
    } else {
      const rot = parseFloat(el.dataset.randomRotate || '0');
      _tl.to(el, { x: 0, scale: 1, rotation: rot, duration: dur, ease: 'back.out(1.2)' }, 0);
    }
  }
}

export function closeCardStack(): void {
  if (_state === 'closed' || _state === 'closing') return;
  dismissFloatingCard(true);

  if (_state === 'opening' && _tl) {
    _state = 'closing';
    _tl.reverse();
    return;
  }

  _state = 'closing';
  _tl = anim.timeline({
    onComplete: () => { _state = 'closed'; _tl = null; },
    onReverseComplete: () => { _state = 'open'; _tl = null; updateFocus(); }
  });

  for (const el of _cardEls) {
    _tl.to(el, { x: '100vw', duration: 0.3, ease: 'power2.in',
      onComplete: () => { el.style.pointerEvents = 'none'; }
    }, 0);
  }
}

export function isCardStackOpen(): boolean {
  return _state === 'open' || _state === 'opening';
}

export function focusNext(): void {
  _focusIndex = (_focusIndex + 1) % CARDS.length;
  updateFocus();
}

export function focusPrev(): void {
  _focusIndex = (_focusIndex - 1 + CARDS.length) % CARDS.length;
  updateFocus();
}

export function initCardStack(): void {
  buildCards();
  type _AxisLock = 'none' | 'horizontal' | 'vertical';
  let _axisLock: _AxisLock = 'none';
  let _prevDx = 0;

  gestures.register({
    id: 'card-stack-global',
    targetFilter: () => true,
    condition: () => isCardStackOpen(),
    priority: 80,
    onStart: () => {
      _scrollStartFocus = _focusIndex;
      _axisLock = 'none';
      _prevDx = 0;
    },
    onMove: (e, dx, dy) => {
      if (_axisLock === 'none' && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        _axisLock = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      if (_axisLock === 'horizontal') {
        if (dx < -50 && _prevDx >= -50) { _prevDx = dx; launchFocusedCard(); return; }
        if (dx > 50 && _prevDx <= 50) { _prevDx = dx; closeCardStack(); return; }
        _prevDx = dx;
      } else if (_axisLock === 'vertical') {
        const offset = Math.round(-dy / CARD_GAP);
        const target = _scrollStartFocus + offset;
        const clamped = ((target % CARDS.length) + CARDS.length) % CARDS.length;
        if (clamped !== _focusIndex) {
          _focusIndex = clamped;
          updateFocus();
        }
      }
    },
  });
  window.addEventListener('resize', () => {
    randomizeCards();
  });
}
