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
import { getFileRowData, API, KFMState } from './state.js';
import { findBoxById } from './canvas-utils.js';
import { setCursorColor, setModeAccent, setLiquidColor } from './canvas-cursor.js';
import { currentTheme as theme } from './theme.js';
import { DOM } from './dom-refs.js';
import { Box } from '../engine/v2/box.js';
import { createFloatingCard } from './floating-card.js';
import { loadFileTree } from './tree-loader.js';
import { rgba, hslToHex, cardAccent, pathBasename } from './color-utils.js';
import { initModeSystem, ensureBg, removeBg, updateBg, recolorCards, getSelectedMode, getModeTheme, getTriColor, applyModeTheme, updateModeSelection } from './mode-system.js';
import { gestures } from './gesture-registry.js';
import { FLOATING_CARD_W } from './interaction-constants.js';

export function isDimmed(path: string): boolean { return _dimmedPaths.has(path); }

// ========== 模块状态 ==========

let _tempCardEls: HTMLElement[] = [];
let _focusIndex = -1;
let _prevFocusIndex = -1;
let _dismissing = false;
let _resetFocusToNewest = false;
let _lifoQueue: HTMLElement[] = [];  // 入卡顺序，撤卡时从尾部取（LIFO）
let _dimmedPaths = new Set<string>();
let _dimmedBoxes = new Map<string, Box>();
const _CARD_H = theme.stack.cardHeight;
const _CARD_GAP = theme.stack.cardGap;
let _lastGap = _CARD_GAP;

// ========== 内部函数 ==========

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

  const name = pathBasename(data.path);
  const isDir = data.isDir;

  const t = getSelectedMode() ? getModeTheme(getSelectedMode()!) : null;
  const triColor = t ? getTriColor(getSelectedMode()!) : theme.canvas.accent;
  const cc = cardAccent(isDir, t?.hue1, t?.hue2, t?.sat, t?.lit);
  const grad = `linear-gradient(135deg, ${rgba(cc.color1, 0.85)} 30%, ${rgba(cc.color2, 0.85)} 70%)`;

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
    'width:' + FLOATING_CARD_W + 'px', 'height:' + _CARD_H + 'px',
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
  card.dataset._path = data.path;
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
  _dimmedPaths.add(data.path);
  _dimmedBoxes.set(data.path, rowBox);
  rowBox.opacity = 0.25;
  ensureBg(sidebarW);

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
  updateBg(stackH, gap);
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

function _getCursorDir(): string {
  if (!L.cursorRowId) return '';
  const root = L.renderer?.getRoot();
  if (!root) return '';
  const box = findBoxById(root, L.cursorRowId);
  if (!box) return '';
  const data = getFileRowData(box.data);
  if (!data) return '';
  return data.isDir ? data.path : data.path.substring(0, data.path.lastIndexOf('/')) || '/';
}

async function _executeMode(): Promise<void> {
  const paths = [...new Set(_tempCardEls.map(e => e.dataset._path).filter(Boolean))];
  if (!paths.length) return;

  const dest = _getCursorDir();
  const base = (s: string) => s.substring(s.lastIndexOf('/') + 1);

  for (const src of paths) {
    const destPath = dest + '/' + base(src!);
    if (getSelectedMode() === 'copy') {
      await fetch(API + '/files/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src, dest: destPath }),
      });
    } else if (getSelectedMode() === 'move') {
      await fetch(API + '/files/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src, dest: destPath }),
      });
    } else if (getSelectedMode() === 'delete') {
      await fetch(API + '/files/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: src }),
      });
    }
  }

  await _animateExecute();
  _tempCardEls = [];
  _lifoQueue = [];
  _dimmedPaths.clear();
  _focusIndex = -1;
  _prevFocusIndex = -1;
  _dismissing = false;
  _resetFocusToNewest = false;
  removeBg();
  await loadFileTree(KFMState.currentRoot);
}

async function _animateExecute(): Promise<void> {
  const cards = [..._tempCardEls];
  // 模式动画
  for (const el of cards) {
    anim.killTweensOf(el);
    if (getSelectedMode() === 'delete') {
      // 删除：变红 → 向中心收缩 → 碎散淡出
      el.style.transition = 'filter 0.15s';
      el.style.filter = 'brightness(1.3) saturate(0.5) hue-rotate(-30deg)';
      await new Promise(r => setTimeout(r, 150));
      const cx = parseFloat(el.dataset.rx || '0');
      const cy = parseFloat(el.dataset.topY || '0');
      anim.to(el, {
        x: cx + 10, y: cy, scale: 0.3, opacity: 0, rotation: parseFloat(el.dataset.rr || '0') + 30,
        duration: 0.35, ease: 'back.in(1.5)',
        onComplete() { el.remove(); },
      });
    } else {
      // copy/move：卡片向光标位置飞行 → 缩小淡出
      const cursorBox = L.cursorBox;
      const root = L.renderer?.getRoot();
      const scrollY = root?.scrollY ?? 0;
      let tx = cursorBox ? cursorBox.x + cursorBox.width / 2 : window.innerWidth * 0.3;
      let ty = cursorBox ? cursorBox.y + cursorBox.height / 2 - scrollY : window.innerHeight * 0.3;
      const cx = parseFloat(el.dataset.rx || '0');
      const cy = parseFloat(el.dataset.topY || '0');
      tx = cx + (tx - cx) * 0.5;
      ty = cy + (ty - cy) * 0.5;
      anim.to(el, {
        x: tx, y: ty, scale: 0.5, opacity: 0,
        duration: 0.5, ease: 'power2.in',
        onComplete() { el.remove(); },
      });
    }
  }
  await new Promise(r => setTimeout(r, 400));
}

function _restoreDimmedRows(): void {
  for (const box of _dimmedBoxes.values()) box.opacity = 1;
  _dimmedBoxes.clear();
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
  _restoreDimmedRows();
  _dimmedPaths.clear();
  _focusIndex = -1;
  _prevFocusIndex = -1;
  _dismissing = false;
  _resetFocusToNewest = false;
  removeBg();

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
  removeBg();

  // 投放区域约束
  const sw = window.innerWidth;
  const sh = window.innerHeight;
  const cw = FLOATING_CARD_W;
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
  const path = el.dataset._path;
  el.remove();
  // 从 lifo 队列移除
  const lIdx = _lifoQueue.indexOf(el);
  if (lIdx >= 0) _lifoQueue.splice(lIdx, 1);
  const idx = _tempCardEls.indexOf(el);
  if (idx < 0) return;
  _tempCardEls.splice(idx, 1);
  // 该路径无剩余卡片 → 恢复行 dim
  if (path && !_tempCardEls.some(c => c.dataset._path === path)) {
    _dimmedPaths.delete(path);
    const box = _dimmedBoxes.get(path);
    if (box) box.opacity = 1;
    _dimmedBoxes.delete(path);
  }
  if (_tempCardEls.length === 0) {
    _restoreDimmedRows();
    _dimmedPaths.clear();
    _focusIndex = -1;
    _prevFocusIndex = -1;
    removeBg();
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

  initModeSystem({
    deployCb: deployAllCards,
    dismissCb: dismissAllCards,
    executeCb: _executeMode,
  });

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

/** 移除所有临时卡片 DOM 并清空内部数组 */
export function clearTempCards(): void {
  _tempCardEls.forEach(el => el.remove());
  _tempCardEls = [];
  _lifoQueue = [];
  _restoreDimmedRows();
  _dimmedPaths.clear();
  _focusIndex = -1;
  _prevFocusIndex = -1;
  _dismissing = false;
  _resetFocusToNewest = false;
  removeBg();
}
