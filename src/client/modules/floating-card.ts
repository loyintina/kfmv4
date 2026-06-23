/**
 * KFM v4 - 浮卡系统（从 card-stack.ts 拆分）
 *
 * 浮卡的发射、拖拽、缩放、状态机。
 * 与 card-stack.ts（堆叠卡片面板）共享卡片定义和配色。
 */

import { gestures } from "./gesture-registry.js";
import { anim } from './animation-registry.js';
import { currentTheme as theme } from './theme.js';
import { Registry } from './ui-registry.js';
import { MARGIN, FLOATING_CARD_W, FLOATING_CARD_H } from './interaction-constants.js';
import { createDragHandler, type DragConfig } from './drag-handler.js';

const orbT = theme.cornerOrb;

/** HSL → hex （#rrggbb） */
function _hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}
const cornerSize = orbT.size;
const cornerOff = orbT.cornerOff;
const rightOff = cornerOff + orbT.rightOffAdj;
const bottomOff = cornerOff + orbT.bottomOffAdj;

// ========== 配置 ==========
const Z_FLOATING_BASE = 50;

const COMPACT_W = 155;
const COMPACT_H = 68;

// ========== 编辑模式最小尺寸 ==========
const FLOATING_CARD_W_MIN = 155;
const FLOATING_CARD_H_MIN = 68;

// ========== 浮卡模板配置 ==========

export interface FloatingCardConfig {
  id: string;
  color1: string; color2: string;  // hex 主/辅色
  name: string;
  sourceX: number; sourceY: number;  // 飞入起点
  targetX?: number; targetY?: number;  // 不传则自动散落
  scatterBounds?: { left: number; top: number; right: number; bottom: number };
  contentHandler?: { activate: (el: HTMLElement) => void; deactivate: (el: HTMLElement) => void };
}

// ========== 浮卡类型与状态 ==========

interface FloatingCardItem {
  el: HTMLElement;
  config: FloatingCardConfig;
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
// ========== 浮卡光球拖拽状态（复刻 orb.ts 的全局变量） ==========
let dragItem: FloatingCardItem | null = null;

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
  const safeL = MARGIN;
  const safeB = 56.5; // 屏幕底部留给 AI 输入栏
  const safeT = MARGIN;
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

// ========== 浮卡模板 ==========

/** 创建浮卡模板入口：接受配置，返回 FloatingCardItem */
export function createFloatingCard(config: FloatingCardConfig): FloatingCardItem | null {
  const el = document.createElement('div');
  el.className = 'floating-card';
  el.dataset.id = config.id;

  const s = orbT.symScale, c = 6 * (1 - s), sh = orbT.symShift;

  // 内层毛玻璃容器
  const bgLayer = document.createElement('div');
  bgLayer.style.cssText = [
    'border-radius:11px', 'width:100%', 'height:100%',
    'background:rgba(20,16,32,0.92)',
    'backdrop-filter:blur(16px)', '-webkit-backdrop-filter:blur(16px)',
    'position:relative', 'overflow:hidden',
  ].join(';');
  const contentEl = document.createElement('div');
  contentEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:2px 6px;font-size:11px;font-weight:500;color:rgba(224,224,224,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:none';
  bgLayer.appendChild(contentEl);
  _renderFloatingContent(contentEl, 'compact', config.name);
  el.appendChild(bgLayer);

  const zIndex = _nextFloatingZ++;
  const item: FloatingCardItem = {
    el, config, zIndex, state: 'launching',
    tlOrb: null, trOrb: null, blOrb: null, brOrb: null, contentEl,
    cardWidth: COMPACT_W, cardHeight: COMPACT_H,
    compactMemW: COMPACT_W, compactMemH: COMPACT_H,
    activeMemW: FLOATING_CARD_W, activeMemH: FLOATING_CARD_H,
    accentColor: config.color2,
  };

  // 四角光球颜色：左 color1，右 color2
  const leftRgba = _hexToRgba(config.color1, 1);
  const rightRgba = _hexToRgba(config.color2, 1);

  // BR — 紧凑态唯一光球（无图标），点击触发展开
  const brOrb = createDecoratedCorner(
    COMPACT_W - rightOff - cornerSize,
    COMPACT_H - bottomOff - cornerSize, cornerSize, cornerSize, rightRgba, '');
  brOrb.style.pointerEvents = 'auto';
  brOrb.style.cursor = 'pointer';
  brOrb.classList.add('floating-br-orb');
  _brOrbToItem.set(brOrb, item);

  // TL — 上移一层（紧凑态也显示）
  const tlColor = _hexToRgba(config.color1, orbT.tlAlpha);
  const tlOrb = createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlColor,
    '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c - sh) + ') scale(' + s + ')"><path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
  tlOrb.style.pointerEvents = 'auto'; tlOrb.style.cursor = 'pointer';
  tlOrb.title = '\u4e0a\u79fb\u4e00\u5c42';
  tlOrb.addEventListener('click', () => { if (item.state !== 'active' && item.state !== 'compact') return; const above = _cardAbove(item); if (above) _swapZIndex(item, above); });
  el.appendChild(tlOrb); item.tlOrb = tlOrb;

  // TR — 关闭
  const trOrb = createDecoratedCorner(COMPACT_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, rightRgba,
    '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c + sh) + ',' + (c - sh) + ') scale(' + s + ')"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/></g></svg>');
  trOrb.style.pointerEvents = 'auto'; trOrb.style.cursor = 'pointer';
  trOrb.title = '\u5173\u95ed';
  trOrb.addEventListener('click', () => { if (item.state !== 'active' && item.state !== 'compact') return; dismissFloatingCard(true, el); });
  el.appendChild(trOrb); item.trOrb = trOrb;

  // BL — 下移一层
  const blOrb = createDecoratedCorner(cornerOff, COMPACT_H - bottomOff - cornerSize, cornerSize, cornerSize, leftRgba,
    '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c + sh) + ') scale(' + s + ')"><path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
  blOrb.style.pointerEvents = 'auto'; blOrb.style.cursor = 'pointer';
  blOrb.title = '\u4e0b\u79fb\u4e00\u5c42';
  blOrb.addEventListener('click', () => { if (item.state !== 'active' && item.state !== 'compact') return; const below = _cardBelow(item); if (below) _swapZIndex(item, below); });
  el.appendChild(blOrb); item.blOrb = blOrb;

  brOrb.addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.state === 'compact') {
      item.state = 'expanding';
      anim.to(contentEl, { opacity: 0, duration: 0.1, ease: 'none', onComplete: () => {
        if (item.contentEl) {
          item.config.contentHandler?.activate?.(item.contentEl);
          _renderFloatingContent(item.contentEl, 'active');
        }
        anim.to(contentEl, { opacity: 1, duration: 0.15, ease: 'none' });
      }});

      const expW = item.activeMemW;
      const expH = item.activeMemH;
      const curLeft = parseFloat(el.style.left) || (config.targetX ?? 0);
      const curTop = parseFloat(el.style.top) || (config.targetY ?? 0);
      const curW = item.cardWidth;
      const curH = item.cardHeight;
      const compressedW = Math.max(FLOATING_CARD_W_MIN, Math.min(expW, curLeft + curW - MARGIN));
      const compressedH = Math.max(FLOATING_CARD_H_MIN, Math.min(expH, curTop + curH - MARGIN));
      const expLeft = curLeft + curW - compressedW;
      const expTop = curTop + curH - compressedH;

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
          if (item.trOrb) item.trOrb.style.left = (w - rightOff - cornerSize) + 'px';
          if (item.blOrb) item.blOrb.style.top = (h - bottomOff - cornerSize) + 'px';
        },
        onComplete: () => {
          item.cardWidth = compressedW;
          item.cardHeight = compressedH;
          brOrb.style.left = (item.cardWidth - rightOff - cornerSize) + 'px';
          brOrb.style.top = (item.cardHeight - bottomOff - cornerSize) + 'px';
          if (item.trOrb) item.trOrb.style.left = (item.cardWidth - rightOff - cornerSize) + 'px';
          if (item.blOrb) item.blOrb.style.top = (item.cardHeight - bottomOff - cornerSize) + 'px';
          item.state = 'active';
          el.style.zIndex = String(zIndex);
        },
      });
      anim.to(tlOrb, { x: 0, y: 0, duration: 0.3, ease: 'back.out(1.1)' });
    } else if (item.state === 'active') {
      item.state = 'collapsing';
      anim.to(item.contentEl, { opacity: 0, duration: 0.1, ease: 'none', onComplete: () => {
        if (item.contentEl) {
          item.config.contentHandler?.deactivate?.(item.contentEl);
          _renderFloatingContent(item.contentEl, 'compact', item.config.name);
        }
        anim.to(item.contentEl, { opacity: 1, duration: 0.15, ease: 'none' });
      }});

      const brSvg2 = brOrb.children[1] as HTMLElement;
      if (brSvg2) brSvg2.innerHTML = '';
      const expLeft = parseFloat(el.style.left) || 0;
      const expTop = parseFloat(el.style.top) || 0;
      const foldW = item.compactMemW;
      const foldH = item.compactMemH;
      const expW = item.cardWidth;
      const expH = item.cardHeight;
      const anchorRight = expLeft + expW;
      const anchorBottom = expTop + expH;
      const clampedFoldW = Math.max(FLOATING_CARD_W_MIN, Math.min(foldW, anchorRight - MARGIN));
      const clampedFoldH = Math.max(FLOATING_CARD_H_MIN, Math.min(foldH, anchorBottom - MARGIN));
      const foldLeft = anchorRight - clampedFoldW;
      const foldTop = anchorBottom - clampedFoldH;
      anim.to(el, {
        left: foldLeft, top: foldTop,
        width: clampedFoldW, height: clampedFoldH,
        duration: 0.3, ease: 'power2.in',
        onUpdate: () => {
          const w = parseFloat(el.style.width) || foldW;
          const h = parseFloat(el.style.height) || foldH;
          brOrb.style.left = (w - rightOff - cornerSize) + 'px';
          brOrb.style.top = (h - bottomOff - cornerSize) + 'px';
          if (item.trOrb) item.trOrb.style.left = (w - rightOff - cornerSize) + 'px';
          if (item.blOrb) item.blOrb.style.top = (h - bottomOff - cornerSize) + 'px';
        },
        onComplete: () => {
          item.cardWidth = clampedFoldW;
          item.cardHeight = clampedFoldH;
          brOrb.style.left = (clampedFoldW - rightOff - cornerSize) + 'px';
          brOrb.style.top = (clampedFoldH - bottomOff - cornerSize) + 'px';
          if (item.trOrb) item.trOrb.style.left = (clampedFoldW - rightOff - cornerSize) + 'px';
          if (item.blOrb) item.blOrb.style.top = (clampedFoldH - bottomOff - cornerSize) + 'px';
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
    'left:' + config.sourceX + 'px', 'top:' + config.sourceY + 'px',
    'width:' + COMPACT_W + 'px', 'height:' + COMPACT_H + 'px',
    'border-radius:12px', 'padding:1px', 'padding-left:3px',
    'background:linear-gradient(135deg,' + _hexToRgba(config.color1, 0.85) + ' 30%,' + _hexToRgba(config.color2, 0.85) + ' 70%)',
    'pointer-events:auto', 'z-index:' + zIndex, 'opacity:1',
  ].join(';');

  document.body.appendChild(el);

  _floatingCards.push(item);
  const LAUNCH_Z_ABOVE_STACK = Z_FLOATING_BASE + _floatingCards.length + 1;
  el.style.zIndex = String(LAUNCH_Z_ABOVE_STACK);

  // 目标位置：优先用 config 指定，否则自动散落
  let targetLeft: number, targetTop: number;
  if (config.targetX !== undefined && config.targetY !== undefined) {
    targetLeft = config.targetX;
    targetTop = config.targetY;
  } else {
    const targetPos = _scatterPosition(_floatingCards.length);
    targetLeft = targetPos.left;
    targetTop = targetPos.top;
  }

  anim.set(el, { scale: 0.8 });
  anim.to(el, {
    left: targetLeft, top: targetTop, scale: 1,
    duration: 0.4, ease: 'back.out(1.3)',
    onComplete: () => {
      item.state = 'compact';
    },
  });

  return item;
}

/** 在 compact/active 态浮卡上构建内容框架 */
function _renderFloatingContent(contentEl: HTMLElement, state: 'compact' | 'active', cardName?: string): void {
  if (state === 'compact') {
    contentEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:4px 6px;font-size:11px;font-weight:500;color:rgba(224,224,224,0.9);text-align:center;overflow:hidden';
    let label = contentEl.querySelector('.fc-compact-label') as HTMLElement | null;
    if (!label) {
      label = document.createElement('div');
      label.className = 'fc-compact-label';
      label.style.cssText = 'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;text-overflow:ellipsis;word-break:break-all;line-height:1.3';
      contentEl.appendChild(label);
    }
    label.textContent = cardName || '';
  } else {
    contentEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:flex-start;box-sizing:border-box;padding:8px;font-size:11px;color:rgba(224,224,224,0.7);overflow-y:auto';
    const old = contentEl.querySelector('.fc-compact-label');
    if (old) old.remove();
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
    item.config.contentHandler?.deactivate?.(item.contentEl);
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
  const rs = orbT.size;
  const rh = rs / 2;
  const rightOff = orbT.cornerOff + orbT.rightOffAdj;
  const bottomOff = orbT.cornerOff + orbT.bottomOffAdj;
  const margin = MARGIN;

  function getMaxY(): number {
    const bar = document.getElementById('aiInputBar');
    return (bar ? bar.getBoundingClientRect().top : window.innerHeight) - rs - margin;
  }

  function fClamp(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(margin, Math.min(window.innerWidth - rs - margin, x)),
      y: Math.max(margin, Math.min(getMaxY(), y)),
    };
  }

  function fSyncCorners(item: FloatingCardItem, w: number, h: number): void {
    const rx = w - rightOff - rs;
    const by = h - bottomOff - rs;
    // BR 光球只要有就独立更新（TL/TR/BL 现在所有态都存在）
    if (item.brOrb) {
      item.brOrb.style.left = rx + 'px';
      item.brOrb.style.top = by + 'px';
    }
    if (item.trOrb && item.blOrb) {
      item.trOrb.style.left = rx + 'px';
      item.blOrb.style.top = by + 'px';
    }
  }

  // 拖动共享状态（配置闭包内捕获）
  let preEdit: 'compact' | 'active' = 'compact';
  let startCardL = 0;
  let startCardT = 0;
  let startCardW = 0;
  let startCardH = 0;

  const dragCfg: DragConfig = {
    getElement(e: PointerEvent) {
      const orbEl = (e.target as HTMLElement).closest('.floating-br-orb') as HTMLElement;
      if (!orbEl) return null;
      const item = _brOrbToItem.get(orbEl);
      if (!item) return null;
      dragItem = item;
      startCardW = item.cardWidth; startCardH = item.cardHeight;  // 每次交互起始捕获当前尺寸
      return orbEl;
    },
    canStart() {
      if (!dragItem) return false;
      return dragItem.state === 'compact' || dragItem.state === 'active' || dragItem.state === 'editing';
    },
    getOrbStartRect() {
      return dragItem!.brOrb!.getBoundingClientRect();
    },
    minEditW: FLOATING_CARD_W_MIN,
    minEditH: FLOATING_CARD_H_MIN,
    clamp: fClamp,
    isEditing() { return dragItem?.state === 'editing'; },
    onTap() { dragItem?.brOrb?.click(); },
    onSavePosition() { /* 浮卡不保存自由位置 */ },
    onEnterEdit() {
      if (!dragItem) return;
      preEdit = dragItem.state as 'compact' | 'active';
      dragItem.state = 'editing';
      const orbEl = dragItem.brOrb!;
      const r2 = orbEl.getBoundingClientRect();
      startCardL = parseFloat(dragItem.el.style.left) || 0;
      startCardT = parseFloat(dragItem.el.style.top) || 0;
      startCardW = dragItem.cardWidth;
      startCardH = dragItem.cardHeight;
      const glowDiv = orbEl.firstElementChild as HTMLElement;
      if (glowDiv) glowDiv.dataset.initBoxShadow = glowDiv.style.boxShadow;
      const editGlow = _hexToRgba(dragItem.accentColor, 0.25);
      dragItem.el.style.boxShadow = '0 0 24px 8px ' + editGlow + ', 0 8px 32px rgba(0,0,0,0.5)';
    },
    onExitEdit() {
      if (!dragItem) return;
      dragItem.state = preEdit;
      dragItem.el.style.boxShadow = theme.stack.blurShadow;
      const gd = dragItem.brOrb?.firstElementChild as HTMLElement;
      if (gd && gd.dataset.initBoxShadow !== undefined) {
        gd.style.boxShadow = gd.dataset.initBoxShadow;
        delete gd.dataset.initBoxShadow;
      }
    },
    onMoveNormal({ dx, dy, startOrbX, startOrbY }) {
      if (!dragItem) return;
      const rawX = startOrbX + dx;
      const rawY = startOrbY + dy;
      const clamped = fClamp(rawX, rawY);
      const orbCX = clamped.x + rh;
      const orbCY = clamped.y + rh;
      const availLeft = orbCX - margin;
      const availTop = orbCY - margin;
      const renderW = Math.max(FLOATING_CARD_W_MIN, Math.min(startCardW, availLeft));
      const renderH = Math.max(FLOATING_CARD_H_MIN, Math.min(startCardH, availTop));
      const left = Math.max(margin, orbCX - renderW);
      const top = Math.max(margin, orbCY - renderH);
      dragItem.el.style.left = left + 'px';
      dragItem.el.style.top = top + 'px';
      dragItem.el.style.width = renderW + 'px';
      dragItem.el.style.height = renderH + 'px';
      fSyncCorners(dragItem, renderW, renderH);
    },
    onMoveEditing({ dx, dy, startOrbX, startOrbY }) {
      if (!dragItem) return;
      const rawX = startOrbX + dx;
      const rawY = startOrbY + dy;
      const clamped = fClamp(rawX, rawY);
      const minX = startCardL + FLOATING_CARD_W_MIN - rightOff - rs;
      const minY = startCardT + FLOATING_CARD_H_MIN - bottomOff - rs;
      const ox = Math.max(minX, clamped.x);
      const oy = Math.max(minY, clamped.y);
      const newW = Math.max(FLOATING_CARD_W_MIN, ox - startCardL + rightOff + rs);
      const newH = Math.max(FLOATING_CARD_H_MIN, oy - startCardT + bottomOff + rs);
      dragItem.el.style.width = newW + 'px';
      dragItem.el.style.height = newH + 'px';
      dragItem.cardWidth = newW;
      dragItem.cardHeight = newH;
      if (preEdit === 'compact') {
        dragItem.compactMemW = newW;
        dragItem.compactMemH = newH;
      } else {
        dragItem.activeMemW = newW;
        dragItem.activeMemH = newH;
      }
      fSyncCorners(dragItem, newW, newH);
    },
  };

  const drag = createDragHandler(dragCfg);
  gestures.register({
    id: 'floating-orb',
    targetFilter: '.floating-br-orb',
    priority: 100,
    stopPropagation: true,
    onStart: drag.onStart,
    onMove: drag.onMove,
    onEnd: drag.onEnd,
  });
}

