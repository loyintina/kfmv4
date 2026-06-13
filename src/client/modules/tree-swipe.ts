/**
 * tree-swipe.ts — 文件行右滑 → 临时卡片堆
 *
 * 从 tree-render.ts 拆分。负责：
 *   - 光标行 GSAP 回弹动画
 *   - DOM 卡片元素创建/堆叠/移除
 *   - 卡片随机渐变色生成
 */

import { L } from './renderer-lifecycle.js';
import { anim, type AnimTimeline } from './animation-registry.js';
import { getFileRowData } from './state.js';
import { findBoxById } from './canvas-utils.js';
import { currentTheme as theme } from './theme.js';
import { DOM } from './dom-refs.js';
import { Box } from '../engine/v2/box.js';
import { gestures } from './gesture-registry.js';

// ========== 模块状态 ==========

let _tempCardEls: HTMLElement[] = [];
let _focusIndex = -1;
let _prevFocusIndex = -1;
let _dismissing = false;
let _lifoQueue: HTMLElement[] = [];  // 入卡顺序，撤卡时从尾部取（LIFO）
let _bgCard: HTMLElement | null = null;  // 卡片堆背景
let _bgMaxH = 0;  // 压缩起始时的高度上限
const _CARD_H = theme.stack.cardHeight;
const _CARD_GAP = theme.stack.cardGap;
let _lastGap = _CARD_GAP;

const _HUE_BLUE = 220;
const _HUE_PURPLE = 265;
const _HUE_RANGE = 15;
const _SAT = 62;
const _LIT = 55;

// ========== 内部函数 ==========

function _rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 0xFF) + ',' + ((n >> 8) & 0xFF) + ',' + (n & 0xFF) + ',' + alpha + ')';
}

function _hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, c)));
  };
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function _cardAccent(isDir: boolean): { color1: string; color2: string } {
  const hBlue = _HUE_BLUE + (Math.random() - 0.5) * _HUE_RANGE * 2;
  const hPurple = _HUE_PURPLE + (Math.random() - 0.5) * _HUE_RANGE * 2;
  if (isDir) {
    return { color1: _hslToHex(hPurple, _SAT, _LIT), color2: _hslToHex(hBlue, _SAT, _LIT) };
  }
  return { color1: _hslToHex(hBlue, _SAT, _LIT), color2: _hslToHex(hPurple, _SAT, _LIT) };
}

function _pathBasename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

// ========== 弹跳 timeline 引用（新弹跳时 kill 旧 timeline） ==========
let _rowBounceTl: AnimTimeline | null = null;
let _cursorBounceTl: AnimTimeline | null = null;
let _bounceRowBox: Box | null = null;

// ========== 公开 API ==========

/** GSAP 回弹动画：光标行 + cursorBox 右移 8px 后弹回
 *
 *  核心设计：
 *    - 动画目标用 transform.translateX（与布局属性 x 隔离）
 *    - 两步 timeline：当前位置 → +8 → 0
 *    - 换行时 kill 旧 timeline，并重置旧行 translateX 为 0，消除残留偏移
 */
export function bounceCursorRow(): void {
  if (!L.cursorRowId) return;
  const root = L.renderer?.getRoot();
  if (!root) return;
  const rowBox = findBoxById(root, L.cursorRowId);
  if (!rowBox || !rowBox.interactive) return;

  _rowBounceTl?.kill();
  if (_bounceRowBox && _bounceRowBox !== rowBox) {
    _bounceRowBox.transform.translateX = 0;
  }

  _bounceRowBox = rowBox;
  _rowBounceTl = anim.timeline();
  _rowBounceTl.to(rowBox.transform, {
    translateX: 8, duration: 0.2, ease: 'power3.out',
  }).to(rowBox.transform, {
    translateX: 0, duration: 0.2, ease: 'power3.in',
  });

  if (L.cursorBox) {
    _cursorBounceTl?.kill();
    _cursorBounceTl = anim.timeline();
    _cursorBounceTl.to(L.cursorBox.transform, {
      translateX: 8, duration: 0.2, ease: 'power3.out',
    }).to(L.cursorBox.transform, {
      translateX: 0, duration: 0.2, ease: 'power3.in',
    });
  }
}

/** 由 canvas-scroll 通过 L.triggerRowSwipe 触发：回弹 → 创建临时卡片 */
export function handleRowSwipe(): void {
  bounceCursorRow();

  if (!L.cursorRowId) return;
  const root = L.renderer?.getRoot();
  if (!root) return;
  const rowBox = findBoxById(root, L.cursorRowId);
  if (!rowBox) return;
  const data = getFileRowData(rowBox.data);
  if (!data) return;

  const name = _pathBasename(data.path);
  const isDir = data.isDir;

  const cc = _cardAccent(isDir);
  const grad = `linear-gradient(135deg, ${_rgba(cc.color1, 0.85)} 30%, ${_rgba(cc.color2, 0.85)} 70%)`;

  // 从文件行位置飞入右侧堆叠
  const abs = rowBox.getAbsolutePosition();
  const scrollY = root.scrollY ?? 0;
  const fromX = abs.x;
  const fromY = abs.y - scrollY - (_CARD_H - rowBox.height) / 2;
  const sidebarW = DOM.sidebar?.getBoundingClientRect().width ?? 295;

  // 聚焦：新卡比其他卡靠左约 15-25px，向中央方向突出
  const focusRx = Math.round(sidebarW + 3 + (Math.random() * 8 - 4));  // sidebarW -1 到 sidebarW +7
  const normalRx = Math.round(sidebarW + 20 + (Math.random() * 14 - 4)); // sidebarW +16 到 sidebarW +30

  const rr = (Math.random() - 0.5) * 4;                           // 创建时固定随机旋转

  const card = document.createElement('div');
  const shadow = '0 2px 4px rgba(0,0,0,0.3),0 8px 16px rgba(0,0,0,0.25),0 16px 32px rgba(0,0,0,0.2),-4px 4px 8px rgba(0,0,0,0.15)';
  card.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'will-change:transform',
    'width:155px', 'height:' + _CARD_H + 'px',
    'border-radius:12px', 'padding:1px', 'padding-left:3px',
    'background:' + grad,
    'box-shadow:' + shadow,
    'cursor:pointer', 'z-index:1001', 'opacity:1',
  ].join(';');

  card.innerHTML = [
    '<div style="border-radius:11px;width:100%;height:100%;',
    'background:rgba(20,16,32,0.95);',
    'display:flex;align-items:flex-start;padding:7px 12px 0;gap:6px;box-sizing:border-box">',
    isDir ? '<span style="color:' + theme.canvas.accent + ';font-size:10px;flex-shrink:0;padding-top:1px">\u25b6</span>' : '',
    '<div style="font-size:12px;font-weight:500;color:rgba(224,224,224,0.9);',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</div>',
    '</div>',
  ].join('');

  document.body.appendChild(card);

  // 居中插入：新卡插入堆叠中间位置
  const insertIdx = _tempCardEls.length === 0 ? 0 : Math.floor(_tempCardEls.length / 2);
  // 旧聚焦卡：记下引用 + 复位 rx（splice 前拿引用，splice 后数组已变不能重索引）
  const prevFocusIdx = _focusIndex;
  let oldEl: HTMLElement | null = null;
  if (prevFocusIdx >= 0 && prevFocusIdx < _tempCardEls.length && _tempCardEls[prevFocusIdx] !== card) {
    oldEl = _tempCardEls[prevFocusIdx];
    oldEl.dataset.rx = oldEl.dataset._normalRx!;
  }

  _tempCardEls.splice(insertIdx, 0, card);

  card.dataset.rx = String(focusRx);
  card.dataset.rr = String(rr);
  card.dataset._focusRx = String(focusRx);
  card.dataset._normalRx = String(normalRx);
  card.dataset._normalRr = String(rr);
  card.dataset._fromX = String(fromX);
  card.dataset._fromY = String(fromY);

card.addEventListener('click', (e) => {
    e.stopPropagation();
    const idx = _tempCardEls.indexOf(card);
    if (idx >= 0 && idx !== _focusIndex) {
      _focusIndex = idx;
      updateFocus();
    }
  });

  _focusIndex = insertIdx;
  _prevFocusIndex = oldEl ? _tempCardEls.indexOf(oldEl) : -1;
  _lifoQueue.push(card);
  _ensureBg(sidebarW);

  // 重排所有卡片 Y 位置（含压缩 + 聚焦下方留白）
  _repositionCards();

  // 新卡飞入（覆盖 _repositionCards 设的 Y）
  const crx = parseFloat(card.dataset.rx ?? '0');
  const crr = parseFloat(card.dataset.rr ?? '0');
  const cardTop = parseFloat(card.dataset.topY ?? '0');
  anim.set(card, { x: fromX, y: fromY, opacity: 0, scale: 0.7, rotation: crr });
  anim.to(card, {
    x: crx, y: cardTop, opacity: 1, scale: 1, rotation: crr,
    duration: 0.35, ease: 'power2.out',
  });

  updateFocus(false);
}

// ========== 聚焦控制 ==========

/** 按当前 _focusIndex 重排所有卡片的 Y 位置（含压缩间距 + 聚焦位下方留白） */
function _repositionCards(): void {
  const count = _tempCardEls.length;
  if (count === 0) return;

  const maxH = window.innerHeight * 0.54;
  const gap = count > 1
    ? Math.min(_CARD_GAP, (maxH - _CARD_H) / (count - 1))
    : _CARD_GAP;
  _lastGap = gap;

  const extraGap = count > 1 && gap < _CARD_GAP ? _CARD_GAP - gap : 0;
  const stackH = _CARD_H + (count - 1) * gap + extraGap;
  const baseTop = Math.round(window.innerHeight * 0.35 - stackH / 2);

  _tempCardEls.forEach((c, i) => {
    const shift = i > _focusIndex ? extraGap : 0;
    const targetTop = Math.round(baseTop + i * gap + shift);
    c.style.zIndex = String(1001 + i);

    const curY = parseFloat(c.dataset.topY ?? '0');
    if (Math.abs(curY - targetTop) > 3) {
      anim.to(c, { y: targetTop, duration: 0.25, ease: 'power2.out' });
    } else {
      anim.set(c, { y: targetTop });
    }
    c.dataset.topY = String(targetTop);
  });
  _updateBg(stackH, gap);
}

/** 更新所有卡片到对应的聚焦/非聚焦状态（只动画状态变化的两张卡） */
export function updateFocus(reposition = true): void {
  if (_tempCardEls.length === 0) return;
  if (_focusIndex < 0 || _focusIndex >= _tempCardEls.length) {
    _focusIndex = 0;
  }

  for (let i = 0; i < _tempCardEls.length; i++) {
    const el = _tempCardEls[i];
    // 只动画聚焦状态实际变化的卡片（旧聚焦卡失焦、新聚焦卡聚焦）
    if (i === _focusIndex && i === _prevFocusIndex) continue;
    if (i !== _focusIndex && i !== _prevFocusIndex) continue;

    if (i === _focusIndex) {
      const fx = parseFloat(el.dataset._focusRx ?? '0');
      el.dataset.rx = String(fx);
      anim.to(el, {
        x: fx, scale: 1.04, rotation: 0,
        duration: 0.35, ease: 'back.out(1.2)',
        overwrite: 'auto',
      });
      el.style.boxShadow = theme.stack.focusShadow;
    } else {
      const nx = parseFloat(el.dataset._normalRx ?? '0');
      const nr = parseFloat(el.dataset._normalRr ?? '0');
      el.dataset.rx = String(nx);
      anim.to(el, {
        x: nx, scale: 1, rotation: nr,
        duration: 0.35, ease: 'back.out(1.2)',
        overwrite: 'auto',
      });
      el.style.boxShadow = theme.stack.blurShadow;
    }
  }

  _prevFocusIndex = _focusIndex;
  if (reposition) _repositionCards();
}

/** 聚焦上一张卡片（循环） */
export function focusNext(): void {
  if (_tempCardEls.length === 0) return;
  _focusIndex = (_focusIndex + 1) % _tempCardEls.length;
  updateFocus();
}

/** 聚焦下一张卡片（循环） */
export function focusPrev(): void {
  if (_tempCardEls.length === 0) return;
  _focusIndex = (_focusIndex - 1 + _tempCardEls.length) % _tempCardEls.length;
  updateFocus();
}

// ========== 卡片撤销 ==========

/** 左滑撤卡：当前聚焦不是最新卡则收聚焦卡，否则 LIFO 收最新卡。 */
let _resetFocusToNewest = false;

export function dismissFocusedCard(): boolean {
  if (_tempCardEls.length === 0 || _lifoQueue.length === 0) return false;

  // 正在撤：瞬杀当前卡
  if (_dismissing) _completeCurrent();
  if (_tempCardEls.length === 0) return true;

  const focusedEl = _tempCardEls[_focusIndex];
  const newestCard = _lifoQueue[_lifoQueue.length - 1];

  if (focusedEl && focusedEl !== newestCard) {
    // 当前聚焦的不是最新卡 → 先收聚焦卡，收完后回正到最新卡
    _resetFocusToNewest = true;
    _startDismiss();
    return true;
  }

  // 正常 LIFO：取最新卡
  const target = _lifoQueue.pop()!;
  const idx = _tempCardEls.indexOf(target);
  if (idx < 0) return false;

  if (idx !== _focusIndex) {
    _focusIndex = idx;
    _prevFocusIndex = -1;
    updateFocus();
  }

  _startDismiss();
  return true;
}

function _completeCurrent(): void {
  const el = _tempCardEls[_focusIndex];
  if (el) { anim.killTweensOf(el); _removeCard(el); }
}

function _startDismiss(): void {
  const el = _tempCardEls[_focusIndex];
  if (!el) return;
  _dismissing = true;

  const fromX = parseFloat(el.dataset._fromX ?? '0');
  const fromY = parseFloat(el.dataset._fromY ?? '0');
  const rr = parseFloat(el.dataset.rr ?? '0');

  anim.killTweensOf(el);
  anim.to(el, {
    x: fromX, y: fromY, opacity: 0, scale: 0.7, rotation: rr,
    duration: 0.2, ease: 'power2.in',
    onComplete() { _removeCard(el); },
  });
}

function _removeCard(el: HTMLElement): void {
  _dismissing = false;
  if (!document.contains(el)) return;
  el.remove();
  // 从 lifo 队列移除
  const lIdx = _lifoQueue.indexOf(el);
  if (lIdx >= 0) _lifoQueue.splice(lIdx, 1);
  const idx = _tempCardEls.indexOf(el);
  if (idx < 0) return;
  _tempCardEls.splice(idx, 1);
  if (_tempCardEls.length === 0) {
    _focusIndex = -1;
    _prevFocusIndex = -1;
    _removeBg();
  } else if (_resetFocusToNewest) {
    // 收的不是最新卡 → 聚焦回正到最新卡
    _resetFocusToNewest = false;
    const newest = _lifoQueue[_lifoQueue.length - 1];
    const ni = newest ? _tempCardEls.indexOf(newest) : -1;
    _focusIndex = ni >= 0 ? ni : Math.min(_focusIndex, _tempCardEls.length - 1);
    _prevFocusIndex = -1;
    _repositionCards();
    updateFocus(false);
  } else {
    if (_focusIndex >= _tempCardEls.length) _focusIndex = _tempCardEls.length - 1;
    _prevFocusIndex = -1;
    _repositionCards();
    updateFocus(false);
  }
}

// ========== 卡片堆垂直滑动切换聚焦 ==========

type _AxisLock = 'none' | 'horizontal' | 'vertical';

let _swipeStartFocus = -1;
let _swipeAxis: _AxisLock = 'none';
let _swipePrevDx = 0;
let _gestureRegistered = false;

export function initTempCardGesture(): void {
  if (_gestureRegistered) return;
  _gestureRegistered = true;

  gestures.register({
    id: 'temp-card-swipe',
    targetFilter: (_target, e) => _tempCardEls.some(el => {
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left - 12 && e.clientX <= r.right + 12
          && e.clientY >= r.top - 12 && e.clientY <= r.bottom + 12;
    }),
    condition: () => _tempCardEls.length > 0,
    priority: 80,
    onStart() {
      _swipeStartFocus = _focusIndex;
      _swipeAxis = 'none';
      _swipePrevDx = 0;
    },
    onMove(_e, dx, dy) {
      if (_swipeAxis === 'none' && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        _swipeAxis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      if (_swipeAxis === 'vertical') {
        const offset = Math.round(-dy / _lastGap);
        const target = _swipeStartFocus + offset;
        const clamped = ((target % _tempCardEls.length) + _tempCardEls.length) % _tempCardEls.length;
        if (clamped !== _focusIndex) {
          _focusIndex = clamped;
          updateFocus();
        }
      } else if (_swipeAxis === 'horizontal') {
        if (dx < -50 && _swipePrevDx >= -50) { _swipePrevDx = dx; dismissFocusedCard(); return; }
        _swipePrevDx = dx;
      }
    },
  });
}

// ========== 卡片堆背景 ==========

function _bgGradient(): string { return theme.aiChat.panelBorderGradient; }

const _BTN = [
  'pointer-events:auto',
  'width:36px', 'height:36px',
  'border:1px solid transparent',
  'border-radius:10px',
  'background:linear-gradient(rgba(18,18,26,0.75),rgba(18,18,26,0.75)) padding-box,'
    + 'linear-gradient(90deg,rgba(0,212,255,0.2),rgba(124,58,237,0.15)) border-box',
  'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
  'cursor:pointer',
  'display:flex', 'align-items:center', 'justify-content:center',
  'box-shadow:0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)',
  'transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
  'color:rgba(224,224,240,0.85)', 'font-size:16px',
  'font-family:system-ui,-apple-system,sans-serif',
].join(';');

function _ensureBg(sidebarW: number): void {
  if (_bgCard) return;
  _bgCard = document.createElement('div');
  const left = Math.round(sidebarW - 10);  // 比侧栏右沿略左，覆盖卡片聚焦区
  _bgCard.style.cssText = [
    'position:fixed', 'left:' + left + 'px', 'right:-12px', 'top:0',
    'height:0px',
    'border-radius:16px 0 0 16px',
    'border:1px solid transparent',
    'background:linear-gradient(rgba(16,12,24,0.7),rgba(16,12,24,0.7)) padding-box,'
      + 'linear-gradient(135deg,rgba(0,212,255,0.4),rgba(99,102,241,0.35),rgba(124,58,237,0.35)) border-box',
    'z-index:1000',
    'pointer-events:none',
  ].join(';');

  // 工具栏（背景卡底部）
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;gap:12px;pointer-events:none';
  const okBtn = document.createElement('button');
  okBtn.textContent = '\u2713';
  okBtn.style.cssText = _BTN;
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '\u2717';
  cancelBtn.style.cssText = _BTN;
  bar.appendChild(okBtn);
  bar.appendChild(cancelBtn);
  _bgCard.appendChild(bar);

  document.body.appendChild(_bgCard);

  anim.set(_bgCard, { x: '100vw' });
  anim.to(_bgCard, { x: 0, duration: 0.35, ease: 'power3.out' });
}

function _updateBg(stackH: number, gap: number): void {
  if (!_bgCard) return;

  // 高度随卡片数增长，压缩开始时锁定上限
  if (_bgMaxH === 0 && gap < _CARD_GAP) _bgMaxH = stackH;
  const h = (_bgMaxH > 0 ? _bgMaxH : stackH) + 24;  // 上下各留 12px 空白

  const top = Math.round(window.innerHeight * 0.35 - h / 2);
  anim.to(_bgCard, {
    y: top, height: h, duration: 0.25, ease: 'power2.out',
    overwrite: 'auto',
  });
}

function _removeBg(): void {
  if (!_bgCard) return;
  const el = _bgCard;
  _bgCard = null;
  _bgMaxH = 0;
  anim.killTweensOf(el);
  anim.to(el, {
    x: '100vw', duration: 0.3, ease: 'power2.in',
    onComplete() { el.remove(); },
  });
}

/** 移除所有临时卡片 DOM 并清空内部数组 */
export function clearTempCards(): void {
  _tempCardEls.forEach(el => el.remove());
  _tempCardEls = [];
  _lifoQueue = [];
  _focusIndex = -1;
  _prevFocusIndex = -1;
  _dismissing = false;
  _resetFocusToNewest = false;
  _removeBg();
}
