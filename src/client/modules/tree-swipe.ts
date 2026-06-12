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

// ========== 模块状态 ==========

let _tempCardEls: HTMLElement[] = [];
const _CARD_H = theme.stack.cardHeight;
const _CARD_GAP = theme.stack.cardGap;

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
  const rx = sidebarW + 20 + Math.floor(Math.random() * 14) - 4; // 创建时固定随机 X
  const rr = (Math.random() - 0.5) * 4;                           // 创建时固定随机旋转

  const card = document.createElement('div');
  const shadow = '0 2px 4px rgba(0,0,0,0.3),0 8px 16px rgba(0,0,0,0.25),0 16px 32px rgba(0,0,0,0.2),-4px 4px 8px rgba(0,0,0,0.15)';
  card.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'will-change:transform',
    'width:155px', 'height:' + _CARD_H + 'px',
    'border-radius:12px', 'padding:1px', 'padding-left:3px',
    'background:' + grad,
    'box-shadow:' + shadow,
    'cursor:pointer', 'z-index:1000', 'opacity:1',
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
  _tempCardEls.splice(insertIdx, 0, card);

  // 居中重排所有卡片（中心上移，考虑底部操作区，超出时压缩 gap）
  const count = _tempCardEls.length;
  const maxH = window.innerHeight * 0.54;
  const gap = count > 1
    ? Math.min(_CARD_GAP, (maxH - _CARD_H) / (count - 1))
    : _CARD_GAP;
  const stackH = _CARD_H + (count - 1) * gap;
  const baseTop = Math.round(window.innerHeight * 0.35 - stackH / 2);
  card.dataset.rx = String(rx);
  card.dataset.rr = String(rr);

  const baseZ = 1000;

  _tempCardEls.forEach((c, i) => {
    const targetTop = Math.round(baseTop + i * gap);
    const z = baseZ + i;
    c.style.zIndex = String(z);
    const crx = parseFloat(c.dataset.rx ?? '0');
    const crr = parseFloat(c.dataset.rr ?? '0');
    if (c === card) {
      card.dataset.topY = String(targetTop);
      anim.set(card, { x: fromX, y: fromY, opacity: 0, scale: 0.7, rotation: crr });
      anim.to(card, {
        x: crx, y: targetTop, opacity: 1, scale: 1, rotation: crr,
        duration: 0.35, ease: 'power2.out',
      });
    } else {
      const curY = parseFloat(c.dataset.topY ?? '0');
      if (Math.abs(curY - targetTop) > 3) {
        anim.to(c, { y: targetTop, duration: 0.25, ease: 'power2.out' });
      } else {
        c.style.transform = 'translate(' + crx + 'px,' + targetTop + 'px) rotate(' + crr + 'deg)';
      }
      c.dataset.topY = String(targetTop);
    }
  });
}

/** 移除所有临时卡片 DOM 并清空内部数组 */
export function clearTempCards(): void {
  _tempCardEls.forEach(el => el.remove());
  _tempCardEls = [];
}
