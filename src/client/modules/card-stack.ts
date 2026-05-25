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

// ========== 卡片配色：每张卡双色独立随机 ==========
let _currentAccents: Array<{ color1: string; color2: string }> | null = null;

/** HSL → hex （#rrggbb） */
function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, c)));
  };
  const r = f(0), g = f(8), b = f(4);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/** 每张卡双色独立随机，两色保持一定色相差避免撞色 */
function _generateRandomAccents(): void {
  const accents = [];
  for (let i = 0; i < 7; i++) {
    const h1 = Math.random() * 360;   // color1（渐变起点）
    // color2 在色环上与 color1 保持 30°–120° 的偏差，避免过于接近或完全随机撞色
    const offset = (30 + Math.random() * 90) * (Math.random() > 0.5 ? 1 : -1);
    const h2 = ((h1 + offset) % 360 + 360) % 360;
    const sat = 45 + Math.random() * 25;
    const lit = 50 + Math.random() * 15;
    accents.push({
      color1: hslToHex(h1, sat, lit),
      color2: hslToHex(h2, sat, lit),
    });
  }
  _currentAccents = accents;
}

/** 从单张卡取双色区域渐变（右上 30% → 左下 70%） */
function cardGradient(i: number, alpha: number): string {
  const c = _currentAccents![i];
  const a = hexToRgba(c.color1, alpha);
  const b = hexToRgba(c.color2, alpha);
  return "linear-gradient(135deg, " + a + " 30%, " + b + " 70%)";
}

/** 从单张卡的 border 派生卡片内部用色（边框/序号/毛玻璃） */
/** 卡片纯背景 */
function cardBg(): string {
  return 'rgba(20,16,32,0.92)';
}

/**
 * 创建双层卡片容器：
 *   外层 shell → background: 三色渐变, padding:1px (左3px) 挤出边框宽度
 *   内层 shell → 毛玻璃纯色背景 + backdrop-filter + 内容
 * 返回 { shell, inner } 供调用方填充内容
 */
// ========== 配置 ==========
const CARD_GAP = theme.stack.cardGap;
const CARD_HEIGHT = theme.stack.cardHeight;
const STACK_TOP_RATIO = 0.12;

// ========== z-index ==========
const Z_FLOATING_BASE = 50;
const Z_STACK_BASE = 150;

const FLOATING_CARD_W = 155;
const FLOATING_CARD_H = 68;
const COMPACT_W = 36;
const COMPACT_H = 36;

// ========== 编辑��式最小尺寸 ==========
const FLOATING_CARD_W_MIN = 100;
const FLOATING_CARD_H_MIN = 42;
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
  state: 'launching' | 'compact' | 'expanding' | 'active' | 'dismissing' | 'editing';
  tlOrb: HTMLElement | null;
  trOrb: HTMLElement | null;
  blOrb: HTMLElement | null;
  brOrb: HTMLElement | null;
  cardWidth: number;
  cardHeight: number;
  accentColor: string;
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
let _dragStartOrbAbsX = 0;
let _dragStartOrbAbsY = 0;
let _dragIsDragging = false;
let _dragLongPressFired = false;
let _dragLongPressTimer: ReturnType<typeof setTimeout> | null = null;
let _dragPointerId: number | null = null;

// ========== DOM 构建 ==========

function createCard(index: number): HTMLElement {
  const card = CARDS[index];
  const cc = _currentAccents![index];
  const grad = cardGradient(index, 0.85);

  // 外层 shell —— 渐变背景 + 1px padding 挤出的边框
  const topPx = Math.round(window.innerHeight * STACK_TOP_RATIO + index * CARD_GAP);
  const el = document.createElement('div');
  el.className = 'stack-card';
  el.dataset.index = String(index);
  el.dataset.randomRight = '0';
  el.dataset.randomRotate = '0';
  el.style.cssText = [
    'position:fixed',
    'right:0px',
    'top:' + topPx + 'px',
    'width:155px',
    'height:' + CARD_HEIGHT + 'px',
    'border-radius:12px',
    'padding:1px',
    'padding-left:3px',
    'background:' + grad,
    'box-shadow:' + theme.stack.blurShadow,
    'transform:rotate(0deg)',
    'cursor:pointer',
    'z-index:' + (Z_STACK_BASE + index),
    'opacity:1',
    'user-select:none',
    '-webkit-user-select:none',
  ].join(';');

  // 内层 —— 毛玻璃 + 布局 + 内容
  const inner = document.createElement('div');
  inner.style.cssText = [
    'border-radius:11px',
    'width:100%',
    'height:100%',
    'background:' + cardBg(),
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'display:flex',
    'align-items:flex-start',
    'padding:4px 12px',
    'gap:6px',
    'box-sizing:border-box',
  ].join(';');

  inner.innerHTML = ''
    + '<div class="stack-card-icon" style="width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:' + hexToRgba(cc.color1, 0.15) + ';color:' + cc.color1 + '">' + String(index + 1).padStart(2, '0') + '</div>'
    + '<div class="stack-card-info" style="flex:1;min-width:0">'
    + '  <div class="stack-card-name" style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + card.name + '</div>'
    + '  <div class="stack-card-desc" style="font-size:10px;opacity:0.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0px">' + card.desc + '</div>'
    + '</div>';

  el.appendChild(inner);

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

    if (dist === 0) {
      anim.to(el, {
        xPercent: 0, x: -28, scale: 1.04, rotation: 0,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.boxShadow = theme.stack.focusShadow;
    } else {
      const randomRotate = parseFloat(el.dataset.randomRotate || '0');
      anim.to(el, {
        xPercent: 0, x: 0, scale: 1, rotation: randomRotate,
        duration: 0.35, ease: 'back.out(1.2)',
      });
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
    stackRect = new DOMRect(first.left, first.top, first.width, last.bottom - first.top);
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
  const clamped = {
    left: Math.max(b.safeL, Math.min(b.fullR - w, Math.round(fallbackX))),
    top: Math.max(b.safeT, Math.min(b.safeB - h, Math.round(fallbackY))),
  };
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
  // 进入编辑模式前重新读取当前位置（普通拖拽阶段已改变卡片位置）
  const cardRect = item.el.getBoundingClientRect();
  _dragStartLeft = cardRect.left;
  _dragStartTop = cardRect.top;
  _dragStartW = item.cardWidth;
  _dragStartH = item.cardHeight;
  const brEl = item.brOrb;
  if (!brEl) return;
  const brRect = brEl.getBoundingClientRect();
  _dragStartOrbAbsX = brRect.left;
  _dragStartOrbAbsY = brRect.top;

  item.state = 'editing';

  // 轻柔的卡��专���色发光阴影，不遮盖角光球
  const c = item.accentColor;
  if (c) {
    item.el.style.boxShadow = '0 0 18px 6px ' + hexToRgba(c, 0.35) + ', 0 2px 8px rgba(0,0,0,0.3)';
  } else {
    item.el.style.boxShadow = theme.stack.blurShadow;
  }
  debugLog("FLOAT edit enter");
}

function _exitFloatingEditMode(item: FloatingCardItem): void {
  item.state = 'active';
  item.el.style.boxShadow = theme.stack.blurShadow;
  debugLog("FLOAT edit exit");
}

function _startFloatingDrag(item: FloatingCardItem, clientX: number, clientY: number, pointerId?: number): void {
  // 清除任何可能的残留拖拽状态（touchend 边缘丢失）
  if (_dragItem) {
    _clearFloatingDragTimer();
    if (_dragItem.state === 'editing') _exitFloatingEditMode(_dragItem);
    _dragItem = null;
  }
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
  const brEl2 = item.brOrb;
  if (!brEl2) return;
  const brRect = brEl2.getBoundingClientRect();
  _dragStartOrbAbsX = brRect.left;
  _dragStartOrbAbsY = brRect.top;

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

  // 共用参数：光球常量、手指原始位置、输入栏限制
  const cSize = orbT.size;
  const rOff = orbT.cornerOff + orbT.rightOffAdj;
  const bOff = orbT.cornerOff + orbT.bottomOffAdj;
  const rawOrbX = _dragStartOrbAbsX + dx;
  const rawOrbY = _dragStartOrbAbsY + dy;
  const maxOrbY = (document.getElementById("aiInputBar")?.getBoundingClientRect().top ?? window.innerHeight) - 42;

  if (_dragItem.state === 'editing') {
    const minOrbAbsX = _dragStartLeft + FLOATING_CARD_W_MIN - rOff - cSize;
    const minOrbAbsY = _dragStartTop + FLOATING_CARD_H_MIN - bOff - cSize;
    const orbAbsX = Math.max(minOrbAbsX, rawOrbX);
    const orbAbsY = Math.min(maxOrbY, Math.max(minOrbAbsY, rawOrbY));

    const newW = Math.max(FLOATING_CARD_W_MIN, orbAbsX - _dragStartLeft + rOff + cSize);
    const newH = Math.max(FLOATING_CARD_H_MIN, orbAbsY - _dragStartTop + bOff + cSize);
    el.style.width = newW + 'px';
    el.style.height = newH + 'px';
    _dragItem.cardWidth = newW;
    _dragItem.cardHeight = newH;

    const tr = _dragItem.trOrb;
    const bl = _dragItem.blOrb;
    const br = _dragItem.brOrb;
    if (!tr || !bl || !br) return;
    const newRightX = newW - rOff - cSize;
    const newBottomY = newH - bOff - cSize;
    tr.style.left = newRightX + 'px';
    bl.style.top = newBottomY + 'px';
    br.style.left = newRightX + 'px';
    br.style.top = newBottomY + 'px';
  } else {
    const orbAbsX = rawOrbX;
    const orbAbsY = Math.min(maxOrbY, rawOrbY);

    const b = _calcFloatingSafeBounds();
    const tlFromOrbX = orbAbsX - _dragStartW + rOff + cSize;
    const tlFromOrbY = orbAbsY - _dragStartH + bOff + cSize;
    const clampedLeft = Math.round(Math.max(b.safeL, Math.min(b.fullR - FLOATING_CARD_W_MIN, tlFromOrbX)));
    const clampedTop = Math.round(Math.max(b.safeT, tlFromOrbY));
    el.style.left = clampedLeft + 'px';
    el.style.top = clampedTop + 'px';

    const newW = Math.max(FLOATING_CARD_W_MIN, orbAbsX - clampedLeft + rOff + cSize);
    const newH = Math.max(FLOATING_CARD_H_MIN, orbAbsY - clampedTop + bOff + cSize);
    if (newW !== _dragItem.cardWidth || newH !== _dragItem.cardHeight) {
      el.style.width = newW + 'px';
      el.style.height = newH + 'px';
    }

    const tr2 = _dragItem.trOrb;
    const bl2 = _dragItem.blOrb;
    const br2 = _dragItem.brOrb;
    if (!tr2 || !bl2 || !br2) return;
    const newRightX = newW - rOff - cSize;
    const newBottomY = newH - bOff - cSize;
    tr2.style.left = newRightX + 'px';
    bl2.style.top = newBottomY + 'px';
    br2.style.left = newRightX + 'px';
    br2.style.top = newBottomY + 'px';
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
  const cc = _currentAccents![_focusIndex];
  const cardName = CARDS[_focusIndex].name;

  const el = document.createElement('div');
  el.className = 'floating-card';
  el.dataset.index = String(_focusIndex);

  const cornerSize = orbT.size;
  const cornerOff = orbT.cornerOff;
  const rightOff = cornerOff + orbT.rightOffAdj;
  const bottomOff = cornerOff + orbT.bottomOffAdj;
  const s = orbT.symScale, c = 6 * (1 - s), sh = orbT.symShift;

  // 内层毛玻璃（紧凑态：居中显示卡片名称）
  const bgLayer = document.createElement('div');
  bgLayer.style.cssText = [
    'border-radius:11px', 'width:100%','height:100%',
    'background:' + cardBg(),
    'backdrop-filter:blur(16px)', '-webkit-backdrop-filter:blur(16px)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'box-sizing:border-box', 'padding:2px 6px',
    'font-size:11px', 'font-weight:500',
    'color:rgba(224,224,224,0.9)',
    'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
  ].join(';');
  bgLayer.textContent = cardName;
  el.appendChild(bgLayer);

  // 四角光球颜色：左 color1，右 color2
  const leftRgba = hexToRgba(cc.color1, 1);
  const rightRgba = hexToRgba(cc.color2, 1);

  const zIndex = _nextFloatingZ++;
  const item = {
    el, sourceIndex: _focusIndex, zIndex, state: 'launching',
    tlOrb: null as any, trOrb: null as any, blOrb: null as any, brOrb: null as any,
    cardWidth: COMPACT_W, cardHeight: COMPACT_H,
    accentColor: cc.color2,
  } as FloatingCardItem;

  // BR — 紧凑态唯一光球（无图标），点击触发展开
  const brOrb = createDecoratedCorner(
    COMPACT_W - rightOff - cornerSize,
    COMPACT_H - bottomOff - cornerSize, cornerSize, cornerSize, rightRgba, '');
  brOrb.style.pointerEvents = 'auto';
  brOrb.style.cursor = 'pointer';
  brOrb.title = cardName + ' · 点击展开';
  brOrb.addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.state === 'compact') {
      item.state = 'expanding';
      brOrb.title = cardName + ' · 点击折叠';
      _buildExpandedLayout(el, cc, cardName);
      // 以右下角光球为锚点展开：卡片向左上扩展
      const curLeft = parseFloat(el.style.left) || targetPos.left;
      const curTop = parseFloat(el.style.top) || targetPos.top;
      anim.to(el, {
        left: curLeft + COMPACT_W - FLOATING_CARD_W,
        top: curTop + COMPACT_H - FLOATING_CARD_H,
        width: FLOATING_CARD_W, height: FLOATING_CARD_H,
        duration: 0.3, ease: 'back.out(1.1)',
        onUpdate: () => {
          const w = parseFloat(el.style.width) || FLOATING_CARD_W;
          const h = parseFloat(el.style.height) || FLOATING_CARD_H;
          brOrb.style.left = (w - rightOff - cornerSize) + 'px';
          brOrb.style.top = (h - bottomOff - cornerSize) + 'px';
        },
        onComplete: () => {
          item.cardWidth = FLOATING_CARD_W;
          item.cardHeight = FLOATING_CARD_H;
          brOrb.style.left = (FLOATING_CARD_W - rightOff - cornerSize) + 'px';
          brOrb.style.top = (FLOATING_CARD_H - bottomOff - cornerSize) + 'px';
          // 创建 TL/TR/BL 光球
          const tlColor = hexToRgba(cc.color1, orbT.tlAlpha);
          const tlOrb = createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlColor,
            '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c - sh) + ') scale(' + s + ')"><path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
          tlOrb.style.pointerEvents = 'auto'; tlOrb.style.cursor = 'pointer';
          tlOrb.title = '\u4e0a\u79fb\u4e00\u5c42';
          tlOrb.addEventListener('click', () => {
            if (item.state !== 'active') return;
            const above = _cardAbove(item);
            if (above) _swapZIndex(item, above);
          });
          el.appendChild(tlOrb); item.tlOrb = tlOrb;

          const trOrb = createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, rightRgba,
            '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c + sh) + ',' + (c - sh) + ') scale(' + s + ')"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/></g></svg>');
          trOrb.style.pointerEvents = 'auto'; trOrb.style.cursor = 'pointer';
          trOrb.title = '\u5173\u95ed';
          trOrb.addEventListener('click', () => dismissFloatingCard(true, el));
          el.appendChild(trOrb); item.trOrb = trOrb;

          const blOrb = createDecoratedCorner(cornerOff, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, leftRgba,
            '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c + sh) + ') scale(' + s + ')"><path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
          blOrb.style.pointerEvents = 'auto'; blOrb.style.cursor = 'pointer';
          blOrb.title = '\u4e0b\u79fb\u4e00\u5c42';
          blOrb.addEventListener('click', () => {
            if (item.state !== 'active') return;
            const below = _cardBelow(item);
            if (below) _swapZIndex(item, below);
          });
          el.appendChild(blOrb); item.blOrb = blOrb;

        item.state = 'active';
        el.style.zIndex = String(zIndex);
        brOrb.title = cardName + ' · 点击折叠';
      }
    });
  } else if (item.state === 'active') {
    // 折叠回紧凑态
    item.state = 'dismissing';
    // 移除 TL/TR/BL 光球
    if (item.tlOrb) { item.tlOrb.remove(); item.tlOrb = null; }
    if (item.trOrb) { item.trOrb.remove(); item.trOrb = null; }
    if (item.blOrb) { item.blOrb.remove(); item.blOrb = null; }
    // 恢复紧凑态布局
    const bgLayer = el.firstElementChild as HTMLElement;
    if (bgLayer) {
      bgLayer.style.justifyContent = 'center';
      bgLayer.style.alignItems = 'center';
      bgLayer.style.padding = '2px 6px';
      bgLayer.innerHTML = '';
      bgLayer.textContent = cardName;
    }
    brOrb.title = cardName + ' · 点击展开';
    // 以右下角光球为锚点折叠：卡片向右下缩小
    const expLeft = parseFloat(el.style.left) || 0;
    const expTop = parseFloat(el.style.top) || 0;
    anim.to(el, {
      left: expLeft + FLOATING_CARD_W - COMPACT_W,
      top: expTop + FLOATING_CARD_H - COMPACT_H,
      width: COMPACT_W, height: COMPACT_H,
      duration: 0.3, ease: 'power2.in',
      onUpdate: () => {
        const w = parseFloat(el.style.width) || COMPACT_W;
        const h = parseFloat(el.style.height) || COMPACT_H;
        brOrb.style.left = (w - rightOff - cornerSize) + 'px';
        brOrb.style.top = (h - bottomOff - cornerSize) + 'px';
      },
      onComplete: () => {
        item.cardWidth = COMPACT_W;
        item.cardHeight = COMPACT_H;
        brOrb.style.left = (COMPACT_W - rightOff - cornerSize) + 'px';
        brOrb.style.top = (COMPACT_H - bottomOff - cornerSize) + 'px';
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
    'background:' + cardGradient(_focusIndex, 0.85),
    'pointer-events:auto', 'z-index:' + zIndex, 'opacity:1',
  ].join(';');

  document.body.appendChild(el);
  _ensureGlobalDragListeners();

  const targetPos = _scatterPosition(_floatingCards.length);
  _floatingCards.push(item);
  const targetLeft = targetPos.left;
  const targetTop = targetPos.top;
  debugLog('FLOAT launch compact ' + _focusIndex + ' ' + targetLeft + ',' + targetTop);

  const LAUNCH_Z_ABOVE_STACK = Z_STACK_BASE + CARDS.length + 1;
  el.style.zIndex = String(LAUNCH_Z_ABOVE_STACK);

  anim.set(el, { scale: 0.8 });
  anim.to(el, {
    left: targetLeft, top: targetTop, scale: 1,
    duration: 0.4, ease: 'back.out(1.3)',
    onComplete: () => {
      item.state = 'compact';
      el.style.zIndex = String(zIndex);
    }
  });
}

/** 在 compact 态浮卡上构建展开态的滚动内容区 */
function _buildExpandedLayout(el: HTMLElement, _cc: { color1: string; color2: string }, _cardName: string): void {
  const bgLayer = el.firstElementChild as HTMLElement;
  if (!bgLayer) return;
  bgLayer.style.justifyContent = 'flex-start';
  bgLayer.style.alignItems = 'stretch';
  bgLayer.style.padding = '0';
  bgLayer.innerHTML = '';
  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow-y:auto;padding:8px;font-size:11px;color:rgba(224,224,224,0.7)';
  content.textContent = '内容区';
  bgLayer.appendChild(content);
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

/** 用 _currentAccents 更新所有已存在卡片的 DOM 颜色（动画前调用） */
function _updateCardStyles(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const cc = _currentAccents![i];
    // 更新外层渐变边框
    el.style.background = cardGradient(i, 0.85);
    // 内层的毛玻璃从未变过，不用改
    // 内层中的图标颜色
    const icon = el.querySelector('.stack-card-icon') as HTMLElement | null;
    if (icon) {
      icon.style.background = hexToRgba(cc.color1, 0.15);
      icon.style.color = cc.color1;
    }
  }
}


/** 卡片堆打开时禁用 sidebarTouchArea 的触摸拦截 */
function _setSidebarTouchAreaEnabled(enabled: boolean): void {
  const box = document.getElementById('sidebarTouchArea');
  if (box) box.style.pointerEvents = enabled ? 'auto' : 'none';
}

export function openCardStack(): void {
  _setSidebarTouchAreaEnabled(false);
  if (_state === 'open' || _state === 'opening') return;
  if (_state === 'closing' && _tl) {
    _generateRandomAccents();
    _updateCardStyles();
    _state = 'opening';
    _tl.reverse();
    return;
  }

  _generateRandomAccents();
  _updateCardStyles();

  _state = 'opening';
  randomizeCards();

  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    anim.set(el, { x: '100vw', opacity: 1, pointerEvents: 'auto' });
  }

  _tl = anim.timeline({
    onComplete: () => {
      _state = 'open'; _tl = null;
      for (let i = 0; i < _cardEls.length; i++) {
        const el = _cardEls[i];
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
  _setSidebarTouchAreaEnabled(true);
  if (_state === 'closed' || _state === 'closing') return;
  // 关闭卡片堆时��销毁已召唤的浮卡

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
  _generateRandomAccents();
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
    onMove: (_e, dx, dy) => {
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