
// ========== 状态机（纯逻辑，可脱离浏览器测试） ==========

export type FloatingCardAction =
  | 'launchComplete' | 'expand' | 'collapse'
  | 'expandComplete' | 'collapseComplete'
  | 'longPress' | 'release'
  | 'enterFullscreen' | 'exitFullscreen' | 'dismiss';

export function nextFloatingCardState(
  current: FloatingCardItem['state'],
  action: FloatingCardAction,
): FloatingCardItem['state'] {
  switch (action) {
    case 'launchComplete':  return current === 'launching' ? 'active' : current;
    case 'expand':          return current === 'compact' ? 'expanding' : current;
    case 'collapse':        return current === 'active' ? 'collapsing' : current;
    case 'expandComplete':  return current === 'expanding' ? 'active' : current;
    case 'collapseComplete':return current === 'collapsing' ? 'compact' : current;
    case 'longPress':       return current === 'active' ? 'editing' : current;
    case 'release':         return current === 'editing' ? 'active' : current;
    case 'enterFullscreen': return (current === 'active' || current === 'compact') ? 'fullscreen' : current;
    case 'exitFullscreen':  return current === 'fullscreen' ? 'active' : current;
    case 'dismiss':         return (current !== 'dismissing') ? 'dismissing' : current;
    default: return current;
  }
}

/**
 * floating-shared.ts — 浮卡系统共享类型、常量、状态与工具函数
 *
 * floating-card.ts 和 floating-fullscreen.ts 共同导入本文件，避免循环依赖。
 */

import type { CardContentHandler } from './card-registry.js';
import { cardRegistry } from './card-registry.js';
import { currentTheme as theme } from './theme.js';
import { MARGIN, FLOATING_CARD_W, FLOATING_CARD_H } from './interaction-constants.js';
import { anim } from './animation-registry.js';

// ========== 主题派生 ==========

const orbT = theme.cornerOrb;

export function _hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

export const _cornerLayout = {
  cornerSize: orbT.size,
  cornerOff: orbT.cornerOff,
  rightOff: orbT.cornerOff + orbT.rightOffAdj,
  bottomOff: orbT.cornerOff + orbT.bottomOffAdj,
};

// ========== 常量 ==========

export const Z_FLOATING_BASE = 50;
export const Z_FULLSCREEN = 30;
export const TITLE_BAR_H = 28;
export const COMPACT_W = 155;
export const COMPACT_H = 68;

// ========== 类型 ==========

export interface FloatingCardConfig {
  id: string; typeId: string;
  color1: string; color2: string;
  name: string;
  sourceX: number; sourceY: number;
  targetX?: number; targetY?: number;
  scatterBounds?: { left: number; top: number; right: number; bottom: number };
  contentHandler?: CardContentHandler;
  startInFullscreen?: boolean;
}

export interface FloatingCardItem {
  el: HTMLElement;
  config: FloatingCardConfig;
  instanceId: string;
  zIndex: number;
  state: 'launching' | 'compact' | 'expanding' | 'active' | 'collapsing' | 'dismissing' | 'editing' | 'fullscreen';
  tlOrb: HTMLElement | null; trOrb: HTMLElement | null;
  blOrb: HTMLElement | null; brOrb: HTMLElement | null;
  topMidOrb: HTMLElement | null;
  contentEl: HTMLElement | null; headerEl: HTMLElement | null;
  cardWidth: number; cardHeight: number;
  compactMemW: number; compactMemH: number;
  activeMemW: number; activeMemH: number;
  accentColor: string; needsKeyboard: boolean; isFullscreen: boolean;
  _fullscreenSaved: { left: number; top: number; width: number; height: number } | null;
  zLocked: boolean;
  fullscreenBtns: { windowize: HTMLElement; close: HTMLElement } | null;
  _fsResizeHandler: (() => void) | null;
}

// ========== 可变状态 ==========

export const _floatingCards: FloatingCardItem[] = [];
let _nextFloatingZ = Z_FLOATING_BASE;
export function _allocZ(): number { return _nextFloatingZ++; }
export const _brOrbToItem = new WeakMap<HTMLElement, FloatingCardItem>();

// ========== 散落位置计算 ==========

function _calcFloatingSafeBounds(): { safeL: number; safeT: number; safeB: number; fullR: number; stackLeft: number } {
  return {
    safeL: MARGIN, safeT: MARGIN,
    safeB: 100,
    fullR: window.innerWidth,
    stackLeft: window.innerWidth * 0.7,
  };
}

export function _scatterPosition(cardIndex: number): { left: number; top: number } {
  const { safeL, safeT, safeB } = _calcFloatingSafeBounds();
  const MIN_GAP = 54; const pad = 16;
  const topMin = 60;
  const rightMax = window.innerWidth - FLOATING_CARD_W - pad;
  const bottomMax = window.innerHeight - safeB - FLOATING_CARD_H;
  const fallbackLeft = safeL;
  const fallbackTop = safeT + 20 + _floatingCards.length * 60;
  for (let attempt = 0; attempt < 30; attempt++) {
    const l = pad + Math.random() * Math.max(0, rightMax - pad);
    const t = topMin + Math.random() * Math.max(0, bottomMax - topMin);
    let blocked = false;
    for (const c of _floatingCards) {
      const cl = parseFloat(c.el.style.left) || 0;
      const ct = parseFloat(c.el.style.top) || 0;
      if (Math.abs(l - cl) < MIN_GAP && Math.abs(t - ct) < MIN_GAP) { blocked = true; break; }
    }
    if (!blocked) return { left: l, top: t };
  }
  return { left: fallbackLeft, top: fallbackTop };
}

// ========== 浮卡关闭 ==========

export function _dismissOne(item: FloatingCardItem, animated?: boolean): void {
  const el = item.el;
  if (item.state === 'expanding' || item.state === 'launching') { item.state = 'dismissing'; return; }
  if (item.state === 'fullscreen') {
    const onResize = item._fsResizeHandler;
    if (onResize) { window.visualViewport?.removeEventListener('resize', onResize); item._fsResizeHandler = null; }
    if (item.fullscreenBtns) { item.fullscreenBtns.windowize.remove(); item.fullscreenBtns.close.remove(); item.fullscreenBtns = null; }
    item.zLocked = false;
  }
  item.state = 'dismissing';
  if (item.contentEl) {
    const ci = cardRegistry.getInstance(item.instanceId);
    if (ci) item.config.contentHandler?.deactivate?.(item.contentEl, ci, 'dismiss');
  }
  if (animated !== false) {
    anim.to(el, {
      scale: 0.3, opacity: 0, duration: 0.2, ease: 'back.in(1.3)',
      onComplete: () => {
        el.remove(); cardRegistry.destroyInstance(item.instanceId);
        const idx = _floatingCards.indexOf(item);
        if (idx >= 0) _floatingCards.splice(idx, 1);
      },
    });
  } else {
    el.remove(); cardRegistry.destroyInstance(item.instanceId);
    const idx = _floatingCards.indexOf(item);
    if (idx >= 0) _floatingCards.splice(idx, 1);
  }
}
