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
import { setCursorColor, setModeAccent } from './canvas-cursor.js';
import { currentTheme as theme } from './theme.js';
import { DOM } from './dom-refs.js';
import { Box } from '../engine/v2/box.js';
import { gestures } from './gesture-registry.js';
import { createFloatingCard } from './floating-card.js';

// ========== 模块状态 ==========

let _tempCardEls: HTMLElement[] = [];
let _focusIndex = -1;
let _prevFocusIndex = -1;
let _dismissing = false;
let _resetFocusToNewest = false;
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

let _selectedMode: string | null = null;
const _modeWrappers: HTMLElement[] = [];

let _okBtn: HTMLElement | null = null;
let _cancelBtn: HTMLElement | null = null;

let _currentBtnDim = 'linear-gradient(90deg,rgba(0,212,255,0.2),rgba(124,58,237,0.15))';
let _currentBtnGlow = 'linear-gradient(90deg,rgba(0,212,255,0.6),rgba(124,58,237,0.4))';
let _currentBgGrad = 'linear-gradient(135deg,rgba(0,212,255,0.4),rgba(99,102,241,0.35),rgba(124,58,237,0.35))';

// 模式按钮选中态（由 GestureRegistry 统一调度）
const _unregModeBtn = gestures.register({
  id: 'mode-btn',
  targetFilter: '[data-mode-btn]',
  condition: () => _bgCard !== null,
  priority: 90,
  stopPropagation: { start: true },
  onStart: (e) => {
    const key = (e.target as HTMLElement).closest('[data-mode-btn]')?.getAttribute('data-mode-btn');
    if (!key) return;
    _selectedMode = _selectedMode === key ? null : key;
    _updateModeSelection();
  },
});

// ✓/✗ 按钮按压反馈（由 GestureRegistry 统一调度）
let _pressedBtn: HTMLElement | null = null;
const _unregCheckBtns = gestures.register({
  id: 'check-btns',
  targetFilter: '[data-toolbar-btn]',
  condition: () => _bgCard !== null,
  priority: 95,
  stopPropagation: { start: true },
  onStart: (e) => {
    const btn = e.target as HTMLElement;
    if (!btn) return;
    _pressedBtn = btn;
    btn.style.background = _FILL + _currentBtnGlow + ' border-box';
    btn.style.boxShadow = _HOVER_SHADOW;
  },
  onEnd: () => {
    if (!_pressedBtn) return;
    _pressedBtn.style.background = _FILL + _currentBtnDim + ' border-box';
    _pressedBtn.style.boxShadow = _BASE_SHADOW;
    _pressedBtn = null;
  },
});

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

function _cardAccent(isDir: boolean, h1?: number, h2?: number, s?: number, l?: number): { color1: string; color2: string; off1: number; off2: number } {
  const base1 = h1 ?? _HUE_BLUE;
  const base2 = h2 ?? _HUE_PURPLE;
  const sat = s ?? _SAT;
  const lit = l ?? _LIT;
  const off1 = (Math.random() - 0.5) * _HUE_RANGE * 2;
  const off2 = (Math.random() - 0.5) * _HUE_RANGE * 2;
  if (isDir) {
    return { color1: _hslToHex(base2 + off2, sat, lit), color2: _hslToHex(base1 + off1, sat, lit), off1, off2 };
  }
  return { color1: _hslToHex(base1 + off1, sat, lit), color2: _hslToHex(base2 + off2, sat, lit), off1, off2 };
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

  const t = _selectedMode ? _MODE_THEME[_selectedMode] : null;
  const triColor = t ? (_MODE_TRI_COLOR[_selectedMode!]) : theme.canvas.accent;
  const cc = _cardAccent(isDir, t?.hue1, t?.hue2, t?.sat, t?.lit);
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
    isDir ? '<span data-card-triangle style="color:' + triColor + ';font-size:10px;flex-shrink:0;padding-top:1px">\u25b6</span>' : '',
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
  card.dataset._name = name;
  card.dataset._isDir = String(isDir);
  card.dataset._accent1 = cc.color1;
  card.dataset._accent2 = cc.color2;
  card.dataset._hueOff1 = String(cc.off1);
  card.dataset._hueOff2 = String(cc.off2);

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
  const baseTop = Math.round(window.innerHeight * 0.35 - stackH / 2 - 40);

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

/** 一键收回所有卡片：往左飞过屏幕后淡出 */
export function dismissAllCards(): boolean {
  if (_tempCardEls.length === 0) return false;

  const sw = window.innerWidth;
  const cards = [..._tempCardEls];  // 快照，后续清空

  cards.forEach(el => {
    anim.killTweensOf(el);
    const curX = parseFloat(el.dataset.rx || '0');
    const curY = parseFloat(el.dataset.topY || '0');
    const dist = sw + 80 + Math.random() * 200;
    const targetX = curX - dist;
    const targetY = curY + (Math.random() - 0.5) * 60;
    const dur = 0.45 + Math.random() * 0.2;

    anim.to(el, {
      x: targetX, y: targetY, rotation: parseFloat(el.dataset.rr || '0'),
      duration: dur, ease: 'power2.in',
      onComplete() { el.remove(); },
    });
  });

  _tempCardEls = [];
  _lifoQueue = [];
  _focusIndex = -1;
  _prevFocusIndex = -1;
  _dismissing = false;
  _resetFocusToNewest = false;
  _removeBg();

  return true;
}

/** ✓ 投放：清空卡片数组(防 closeSidebar 的 clearTempCards 误删)，关侧栏，背景滑出 */
export function deployAllCards(): void {
  if (_tempCardEls.length === 0) return;

  const cards = [..._tempCardEls];

  // 清空数组让 closeSidebar 的 clearTempCards 找不到
  _tempCardEls = [];
  _lifoQueue = [];
  _focusIndex = -1;
  _prevFocusIndex = -1;
  _dismissing = false;
  _resetFocusToNewest = false;

  import('./ui.js').then(m => m.closeSidebar());
  _removeBg();

  // 投放区域约束
  const sw = window.innerWidth;
  const sh = window.innerHeight;
  const cw = 155;
  const ch = _CARD_H;
  const pad = 16;
  const topMin = 60;
  const leftMax = sw - cw - pad;
  const topMax = sh - 120 - ch;

  cards.forEach(el => {
    const fromX = parseFloat(el.dataset.rx || '0');
    const fromY = parseFloat(el.dataset.topY || '0');
    const tx = pad + Math.random() * Math.max(0, leftMax - pad);
    const ty = topMin + Math.random() * Math.max(0, topMax - topMin);

    createFloatingCard({
      id: 'temp-' + (el.dataset._name || ''),
      color1: el.dataset._accent1 || '#7c3aed',
      color2: el.dataset._accent2 || '#00d4ff',
      name: el.dataset._name || '',
      sourceX: fromX, sourceY: fromY,
      targetX: tx, targetY: ty,
    });

    el.remove();
  });
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

let _toolbar: HTMLElement | null = null;  // 背景卡底部工具栏

const _BTN_CSS = [
  'pointer-events:auto',
  'width:40px', 'height:40px',
  'border:1px solid transparent',
  'border-radius:12px',
  'background:linear-gradient(rgba(18,18,26,0.75),rgba(18,18,26,0.75)) padding-box,'
    + 'linear-gradient(90deg,rgba(0,212,255,0.2),rgba(124,58,237,0.15)) border-box',
  'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
  'cursor:pointer',
  'display:flex', 'align-items:center', 'justify-content:center',
  'box-shadow:0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08)',
  'transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
  'color:rgba(224,224,240,0.85)',
  'font-family:system-ui,-apple-system,sans-serif',
].join(';');

// SVG 渐变图标的颜色可随模式动态切换
function _makeCheckSvg(start: string, end: string): string {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#checkGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="checkGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="' + start + '"/><stop offset="100%" stop-color="' + end + '"/></linearGradient></defs><polyline points="20 6 9 17 4 12"/></svg>';
}
function _makeCloseSvg(start: string, end: string): string {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#closeGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="closeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="' + start + '"/><stop offset="100%" stop-color="' + end + '"/></linearGradient></defs><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
}

// hover/active/glow 统一由 GSAP 管理
const _BASE_SHADOW = '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)';
const _HOVER_SHADOW = '0 6px 24px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.1)';
const _BORDER_DIM = 'linear-gradient(90deg,rgba(0,212,255,0.2),rgba(124,58,237,0.15))';
const _BORDER_GLOW = 'linear-gradient(90deg,rgba(0,212,255,0.6),rgba(124,58,237,0.4))';
const _FILL = 'linear-gradient(rgba(18,18,26,0.75),rgba(18,18,26,0.75)) padding-box,';

function _toolbarPos(bgTop: number, bgH: number): void {
  if (!_toolbar) return;
  anim.to(_toolbar, {
    y: bgTop + bgH + 8, duration: 0.25, ease: 'power2.out',
    overwrite: 'auto',
  });
}

function _ensureBg(sidebarW: number): void {
  if (_bgCard) return;
  const left = Math.round(sidebarW - 10);

  // 工具栏（背景卡外部下方）
  _toolbar = document.createElement('div');
  _toolbar.style.cssText = [
    'position:fixed', 'left:' + left + 'px', 'right:-12px',
    'z-index:1010', 'pointer-events:none',
  ].join(';');

  // ✓ — 贴工具栏左沿（= 背景卡左沿）
  const okBtn = document.createElement('button');
  okBtn.innerHTML = _makeCheckSvg('#7c3aed', '#00d4ff');
  okBtn.style.cssText = _BTN_CSS + ';position:absolute;left:0;top:0';
  okBtn.setAttribute('data-toolbar-btn', 'ok');
  okBtn.addEventListener('click', deployAllCards);
  _toolbar.appendChild(okBtn);
  _okBtn = okBtn;

  // ✗ — 半距左移
  const tbW = window.innerWidth - left + 12;
  const btnW = 40, gap = 12;
  const D = Math.max(0, (tbW - btnW * 2 - gap) / 2);
  const cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = _makeCloseSvg('#7c3aed', '#00d4ff');
  cancelBtn.style.cssText = _BTN_CSS + ';position:absolute;left:' + Math.round(btnW + gap + D / 2) + 'px;top:0';
  cancelBtn.setAttribute('data-toolbar-btn', 'cancel');
  cancelBtn.addEventListener('click', dismissAllCards);
  _toolbar.appendChild(cancelBtn);
  _cancelBtn = cancelBtn;

  // 第 2 行：三个模式按钮（左右对齐 ✓ 左沿 ↔ ✗ 右沿）
  const cancelLeft = Math.round(btnW + gap + D / 2);
  const spanW = cancelLeft + btnW;
  const row2 = document.createElement('div');
  row2.style.cssText = [
    'position:absolute', 'left:0', 'top:55px',
    'width:' + spanW + 'px',
    'display:flex', 'justify-content:space-between',
  ].join(';');

  const modeMeta: { key: string; grad: string }[] = [
    { key: 'copy',   grad: 'linear-gradient(135deg,rgba(132,204,22,0.25),rgba(15,118,110,0.18))' },
    { key: 'move',   grad: 'linear-gradient(135deg,rgba(245,158,11,0.25),rgba(163,230,53,0.18))' },
    { key: 'delete', grad: 'linear-gradient(135deg,rgba(249,115,22,0.25),rgba(131,24,67,0.18))' },
  ];
  _modeWrappers.length = 0;
  for (const { key, grad } of modeMeta) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-mode-btn', key);
    wrapper.style.cssText = [
      'pointer-events:auto',
      'width:34px', 'height:34px',
      'border:2px solid transparent',
      'border-radius:9px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'transition:background 0.15s',
      'flex-shrink:0',
    ].join(';');
    const btn = document.createElement('button');
    btn.innerHTML = _MODE_SVG[key];
    btn.style.cssText = [
      'pointer-events:none',
      'width:30px', 'height:30px',
      'border:1px solid transparent',
      'border-radius:7px',
      'background:linear-gradient(rgba(18,18,26,0.75),rgba(18,18,26,0.75)) padding-box,'
        + grad + ' border-box',
      'display:flex', 'align-items:center', 'justify-content:center',
    ].join(';');
    wrapper.appendChild(btn);
    _modeWrappers.push(wrapper);
    row2.appendChild(wrapper);
  }
  _toolbar.appendChild(row2);
  document.body.appendChild(_toolbar);

  // 背景卡
  _bgCard = document.createElement('div');
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
  document.body.appendChild(_bgCard);

  anim.set([_bgCard, _toolbar], { x: '100vw' });
  anim.to([_bgCard, _toolbar], { x: 0, duration: 0.35, ease: 'power3.out' });
}

function _updateBg(stackH: number, gap: number): void {
  if (!_bgCard) return;

  // 高度随卡片数增长，压缩开始时锁定上限
  if (_bgMaxH === 0 && gap < _CARD_GAP) _bgMaxH = stackH;
  const h = (_bgMaxH > 0 ? _bgMaxH : stackH) + 40;  // 上下留白

  const top = Math.round(window.innerHeight * 0.35 - h / 2 - 40);
  anim.to(_bgCard, {
    y: top, height: h, duration: 0.25, ease: 'power2.out',
    overwrite: 'auto',
  });
  _toolbarPos(top, h);
}

const _MODE_BORDER_GRAD: Record<string, string> = {
  copy:   'linear-gradient(135deg,rgba(132,204,22,0.6),rgba(15,118,110,0.4))',
  move:   'linear-gradient(135deg,rgba(245,158,11,0.6),rgba(163,230,53,0.4))',
  delete: 'linear-gradient(135deg,rgba(249,115,22,0.6),rgba(131,24,67,0.4))',
};

const _MODE_TRI_COLOR: Record<string, string> = {
  copy: '#4ade80',
  move: '#eab308',
  delete: '#ef4444',
};

const _MODE_THEME: Record<string, { bgGrad: string; btnDim: string; btnGlow: string; svgStart: string; svgEnd: string; hue1: number; hue2: number; sat?: number; lit?: number }> = {
  copy: {
    hue1: 160, hue2: 85, sat: 75, lit: 48,
    bgGrad: 'linear-gradient(135deg,rgba(132,204,22,0.4),rgba(16,185,129,0.35),rgba(15,118,110,0.35))',
    btnDim: 'linear-gradient(90deg,rgba(132,204,22,0.2),rgba(15,118,110,0.15))',
    btnGlow: 'linear-gradient(90deg,rgba(132,204,22,0.6),rgba(15,118,110,0.4))',
    svgStart: '#84cc16',
    svgEnd: '#0f766e',
  },
  move: {
    hue1: 40, hue2: 55,
    bgGrad: 'linear-gradient(135deg,rgba(245,158,11,0.4),rgba(234,179,8,0.35),rgba(163,230,53,0.35))',
    btnDim: 'linear-gradient(90deg,rgba(245,158,11,0.2),rgba(163,230,53,0.15))',
    btnGlow: 'linear-gradient(90deg,rgba(245,158,11,0.6),rgba(163,230,53,0.4))',
    svgStart: '#f59e0b',
    svgEnd: '#a3e635',
  },
  delete: {
    hue1: 20, hue2: 345,
    bgGrad: 'linear-gradient(135deg,rgba(249,115,22,0.4),rgba(244,114,182,0.35),rgba(131,24,67,0.35))',
    btnDim: 'linear-gradient(90deg,rgba(249,115,22,0.2),rgba(131,24,67,0.15))',
    btnGlow: 'linear-gradient(90deg,rgba(249,115,22,0.6),rgba(131,24,67,0.4))',
    svgStart: '#f97316',
    svgEnd: '#831843',
  },
};

const _DEFAULT_SVG_START = '#7c3aed';
const _DEFAULT_SVG_END = '#00d4ff';

function _recolorCards(mode: string | null): void {
  const t = mode ? _MODE_THEME[mode] : null;
  const h1 = t?.hue1 ?? _HUE_BLUE;
  const h2 = t?.hue2 ?? _HUE_PURPLE;
  const sat = t?.sat ?? _SAT;
  const lit = t?.lit ?? _LIT;
  const triColor = mode ? _MODE_TRI_COLOR[mode] : '#00d4ff';
  _tempCardEls.forEach(card => {
    const tri = card.querySelector('[data-card-triangle]') as HTMLElement | null;
    if (tri) tri.style.color = triColor;
    const off1 = parseFloat(card.dataset._hueOff1 || '0');
    const off2 = parseFloat(card.dataset._hueOff2 || '0');
    const isDir = card.dataset._isDir === 'true';
    const c1 = _hslToHex(h1 + off1, sat, lit);
    const c2 = _hslToHex(h2 + off2, sat, lit);
    const [accent1, accent2] = isDir ? [c2, c1] : [c1, c2];
    card.style.background = `linear-gradient(135deg, ${_rgba(accent1, 0.85)} 30%, ${_rgba(accent2, 0.85)} 70%)`;
    card.dataset._accent1 = accent1;
    card.dataset._accent2 = accent2;
  });
}

function _applyModeTheme(mode: string | null): void {
  _recolorCards(mode);
  if (mode === 'copy') {
    setCursorColor('rgba(74,222,128,0.7)', 'rgba(74,222,128,0.12)');
    setModeAccent('#4ade80');
  } else if (mode === 'move') {
    setCursorColor('rgba(234,179,8,0.7)', 'rgba(234,179,8,0.12)');
    setModeAccent('#eab308');
  } else {
    setCursorColor(null, null);
    setModeAccent(null);
  }
  if (mode) {
    const t = _MODE_THEME[mode];
    _currentBtnDim = t.btnDim;
    _currentBtnGlow = t.btnGlow;
    _currentBgGrad = t.bgGrad;
    if (_bgCard) _bgCard.style.background = 'linear-gradient(rgba(16,12,24,0.7),rgba(16,12,24,0.7)) padding-box,' + t.bgGrad + ' border-box';
    if (_okBtn) { _okBtn.innerHTML = _makeCheckSvg(t.svgStart, t.svgEnd); _okBtn.style.background = _FILL + t.btnDim + ' border-box'; }
    if (_cancelBtn) { _cancelBtn.innerHTML = _makeCloseSvg(t.svgStart, t.svgEnd); _cancelBtn.style.background = _FILL + t.btnDim + ' border-box'; }
  } else {
    _currentBtnDim = 'linear-gradient(90deg,rgba(0,212,255,0.2),rgba(124,58,237,0.15))';
    _currentBtnGlow = 'linear-gradient(90deg,rgba(0,212,255,0.6),rgba(124,58,237,0.4))';
    _currentBgGrad = 'linear-gradient(135deg,rgba(0,212,255,0.4),rgba(99,102,241,0.35),rgba(124,58,237,0.35))';
    if (_bgCard) _bgCard.style.background = 'linear-gradient(rgba(16,12,24,0.7),rgba(16,12,24,0.7)) padding-box,' + _currentBgGrad + ' border-box';
    if (_okBtn) { _okBtn.innerHTML = _makeCheckSvg(_DEFAULT_SVG_START, _DEFAULT_SVG_END); _okBtn.style.background = _FILL + _currentBtnDim + ' border-box'; }
    if (_cancelBtn) { _cancelBtn.innerHTML = _makeCloseSvg(_DEFAULT_SVG_START, _DEFAULT_SVG_END); _cancelBtn.style.background = _FILL + _currentBtnDim + ' border-box'; }
  }
}

function _updateModeSelection(): void {
  const activeIdx = _selectedMode === 'copy' ? 0 : _selectedMode === 'move' ? 1 : _selectedMode === 'delete' ? 2 : -1;
  _modeWrappers.forEach((w, i) => {
    if (i === activeIdx) {
      const grad = i === 0 ? _MODE_BORDER_GRAD.copy : i === 1 ? _MODE_BORDER_GRAD.move : _MODE_BORDER_GRAD.delete;
      w.style.borderColor = 'transparent';
      w.style.background = 'linear-gradient(rgba(18,18,26,0.75),rgba(18,18,26,0.75)) padding-box,'
        + grad + ' border-box';
    } else {
      w.style.borderColor = 'transparent';
      w.style.background = '';
    }
  });
  _applyModeTheme(_selectedMode);
}

const _MODE_SVG: Record<string, string> = {
  copy:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#copyGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="copyGrad" x1="2" y1="0" x2="22" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#84cc16"/><stop offset="100%" stop-color="#0f766e"/></linearGradient></defs><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  move:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#moveGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="moveGrad" x1="2" y1="0" x2="22" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#a3e635"/></linearGradient></defs><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 17 15 14"/></svg>',
  delete: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#delGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="delGrad" x1="3" y1="0" x2="21" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f97316"/><stop offset="100%" stop-color="#831843"/></linearGradient></defs><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
};

function _removeBg(): void {
  if (!_bgCard) return;
  const bgEl = _bgCard;
  const tbEl = _toolbar;
  _bgCard = null;
  _toolbar = null;
  _okBtn = null;
  _cancelBtn = null;
  _bgMaxH = 0;
  _selectedMode = null;
  _modeWrappers.length = 0;
  setCursorColor(null, null);
  setModeAccent(null);
  anim.killTweensOf([bgEl, tbEl]);
  anim.to([bgEl, tbEl], {
    x: '100vw', duration: 0.3, ease: 'power2.in',
    onComplete() { bgEl.remove(); tbEl?.remove(); },
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
