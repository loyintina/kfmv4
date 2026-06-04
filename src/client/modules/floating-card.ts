/**
 * KFM v4 - 统一浮卡引擎
 *
 * 所有浮动面板（调试浮卡、AI 对话面板、未来的插件卡片）通过此引擎创建。
 *
 * 核心设计：
 *   一份状态机 + 一份拖拽逻辑（通过 gesture-registry）+ 可配置参数。
 *   新增一种浮卡 = 调一次 createFloatingCard(config)，不复制任何逻辑。
 *
 * 设计参见 docs/CARD_SYSTEM_UNIFICATION_SPEC.md
 */

import { gestures } from "./gesture-registry.js";
import { anim } from './animation-registry.js';
import { Registry } from './ui-registry.js';
import { wsChannel } from './ws-channel.js';
import { currentTheme as theme } from './theme.js';

// card-stack 依赖（用于从卡片堆发射的浮卡）
import {
  getCardCount, getCardName, getCardId,
  getFocusIndex, getCurrentAccent, getCardHandler,
  getFocusedCardRect, animateStackPullFeedback,
  hexToRgba, cardGradient, cardBg,
} from './card-stack.js';

import type { InteractiveElement, ContentBlock } from './ui-registry.js';

const orbT = theme.cornerOrb;
const cornerSize = orbT.size;
const cornerOff = orbT.cornerOff;
const rightOff = cornerOff + orbT.rightOffAdj;
const bottomOff = cornerOff + orbT.bottomOffAdj;

// ========== 配置类型与默认值 ==========

export interface FloatingCardConfig {
  // 标识
  id: string;
  name: string;

  // 几何
  compactWidth: number;
  compactHeight: number;
  activeWidth: number;
  activeHeight: number;
  minWidth: number;
  minHeight: number;

  // 角光球
  cornerTL: boolean;
  cornerTR: boolean;
  cornerBL: boolean;

  // 行为
  alwaysOnTop: boolean;
  inputBarAvoid: boolean;
  accentColor: string;
  brOrbSize?: number;

  // 初始位置（设定了就跳过随机散落）
  initialPosition?: { right: number; bottom: number };

  // 生命周期
  onActivate: (contentEl: HTMLElement) => void;
  onDeactivate: (contentEl: HTMLElement) => void;
  onCreate?: (el: HTMLElement) => void;
  /** 在展开动画开始前调用（用于设置卡片样式，避免 onActivate 的 0.1s 延迟） */
  onPreExpand?: (el: HTMLElement) => void;
  // AI 命令
  onCommand?: (action: string, params: unknown) => void;
  registryElement?: InteractiveElement;
  registryContent?: () => ContentBlock;
}

const DEFAULT_CONFIG: Partial<FloatingCardConfig> = {
  compactWidth: 54,
  compactHeight: 54,
  activeWidth: 155,
  activeHeight: 68,
  minWidth: 54,
  minHeight: 54,
  cornerTL: true,
  cornerTR: true,
  cornerBL: true,
  alwaysOnTop: false,
  inputBarAvoid: false,
  accentColor: '#7c3aed',
  onActivate: () => {},
  onDeactivate: () => {},
};

// ========== 引擎常量 ==========

const Z_FLOATING_BASE = 50;
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
  minWidth: number;
  minHeight: number;
  onDeactivate?: (contentEl: HTMLElement) => void;
  name: string;
}

let _floatingCards: FloatingCardItem[] = [];
let _nextFloatingZ = Z_FLOATING_BASE;
const _brOrbToItem = new WeakMap<HTMLElement, FloatingCardItem>();
let _preEditState: 'compact' | 'active' = 'active';

// ========== 浮卡 BR 光球拖拽状态（gesture-registry 驱动） ==========
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

// ========== 输入栏避让状态 ==========
let _inputBarWatcherInitialized = false;
// ========== 角光球创建 ==========

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

// ========== 场景位置计算（随机散落和预置位置）==========

interface FloatingSafeBounds {
  safeL: number; safeT: number; safeB: number; fullR: number; stackLeft: number;
}

function _calcFloatingSafeBounds(): FloatingSafeBounds {
  const safeL = 8;
  const safeB = 56.5;
  const safeT = 8;
  const fullR = window.innerWidth;
  const stackLeft = (window.innerWidth * 0.7);
  return { safeL, safeT, safeB, fullR, stackLeft };
}

function _scatterPosition(
  cardIndex: number,
  compactW: number,
  compactH: number,
): { left: number; top: number } {
  const { safeL, safeT, safeB, stackLeft } = _calcFloatingSafeBounds();
  const stackR = window.innerWidth - compactW;
  const stackT = safeT;
  const stackBot = window.innerHeight - safeB - compactH;
  const stackW = stackR - stackLeft;

  const totalCards = _floatingCards.length;
  const verticalStep = 60;
  const stackCount = totalCards;
  const baseL = stackLeft + (stackW / 2);
  const baseT = stackT + 20 + stackCount * verticalStep;
  const fallbackLeft = Math.max(safeL, Math.min(baseL, stackR));
  const fallbackTop = Math.max(safeT, Math.min(baseT, stackBot));

  const spreadL = safeL;
  const spreadR = stackLeft - compactW;
  const spreadW = spreadR - spreadL;
  if (spreadW < 20) {
    return { left: fallbackLeft, top: fallbackTop };
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const l = spreadL + Math.random() * spreadW;
    const t = safeT + Math.random() * (window.innerHeight - safeB - safeT - compactH);
    let overlap = false;
    for (const c of _floatingCards) {
      const cl = parseFloat(c.el.style.left) || 0;
      const ct = parseFloat(c.el.style.top) || 0;
      const cw = c.cardWidth;
      const ch = c.cardHeight;
      if (l < cl + cw && l + compactW > cl && t < ct + ch && t + compactH > ct) {
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

// ========== 输入栏避让（从 orb.ts 搬运） ==========

function initInputBarWatcher(cardEl: HTMLElement, getCardPos: () => { left: number; top: number }): void {
  if (_inputBarWatcherInitialized) return;
  _inputBarWatcherInitialized = true;

  let freeX = -1, freeY = -1;
  let lastBarTop = -1;
  let isPushed = false;

  function updatePosition(): void {
    const bar = document.getElementById('aiInputBar');
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const barTop = barRect.top;

    if (freeX < 0 || freeY < 0) {
      const pos = getCardPos();
      freeX = pos.left;
      freeY = pos.top;
      lastBarTop = barTop;
    }

    if (barTop < lastBarTop) {
      // 输入栏上移（输入法弹出）→ 压缩浮卡
      const barRight = barRect.right;
      const cardRight = freeX + (parseFloat(cardEl.style.width) || 0);
      if (cardRight > barRight - 8) {
        const newLeft = barRight - (parseFloat(cardEl.style.width) || 0) - 8;
        cardEl.style.left = Math.max(8, newLeft) + 'px';
        isPushed = true;
      }
      const cardBottom = freeY + (parseFloat(cardEl.style.height) || 0);
      if (cardBottom > barTop - 8) {
        const newTop = barTop - (parseFloat(cardEl.style.height) || 0) - 8;
        cardEl.style.top = Math.max(8, newTop) + 'px';
        isPushed = true;
      }
    } else if (barTop > lastBarTop && isPushed) {
      // 输入栏恢复 → 回到自由位置
      cardEl.style.left = freeX + 'px';
      cardEl.style.top = freeY + 'px';
      isPushed = false;
    }
    lastBarTop = barTop;
  }

  const watcher = window.visualViewport;
  if (watcher) {
    watcher.addEventListener('resize', updatePosition);
  }
}

// ========== 浮卡紧凑态内容渲染 ==========

function _renderCompactContent(contentEl: HTMLElement, name: string): void {
  contentEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:2px 6px;font-size:11px;font-weight:500;color:rgba(224,224,224,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  contentEl.textContent = name || '';
}

function _renderActiveLayout(contentEl: HTMLElement): void {
  contentEl.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:stretch;box-sizing:border-box;padding:8px;font-size:11px;color:rgba(224,224,224,0.7);overflow-y:auto';
}

// ========== 创建浮卡（统一入口）==========

export function createFloatingCard(config: FloatingCardConfig): void {
  const cfg = { ...DEFAULT_CONFIG, ...config } as Required<FloatingCardConfig>;

  // 创建 DOM
  const el = document.createElement('div');
  el.className = 'floating-card';

  const bgLayer = document.createElement('div');
  bgLayer.style.cssText = [
    'border-radius:11px', 'width:100%', 'height:100%',
    'background:' + cardBg(),
    'backdrop-filter:blur(16px)', '-webkit-backdrop-filter:blur(16px)',
    'position:relative', 'overflow:hidden',
  ].join(';');

  const contentEl = document.createElement('div');
  bgLayer.appendChild(contentEl);
  el.appendChild(bgLayer);

  const leftRgba = hexToRgba(cfg.accentColor, 1);
  const rightRgba = hexToRgba(cfg.accentColor, 1);

  const zIndex = cfg.alwaysOnTop ? 9999 : _nextFloatingZ++;

  // 紧凑/展开尺寸记忆
  const compactMemW = cfg.compactWidth;
  const compactMemH = cfg.compactHeight;

  const item: FloatingCardItem = {
    el, sourceIndex: -1, zIndex, state: 'compact',
    tlOrb: null, trOrb: null, blOrb: null, brOrb: null,
    contentEl,
    cardWidth: cfg.compactWidth,
    cardHeight: cfg.compactHeight,
    compactMemW, compactMemH,
    activeMemW: cfg.activeWidth,
    activeMemH: cfg.activeHeight,
    accentColor: cfg.accentColor,
    minWidth: cfg.minWidth,
    minHeight: cfg.minHeight,
    onDeactivate: cfg.onDeactivate,
    name: cfg.name,
  };

  // BR 光球（始终创建。尺寸可配置：普通浮卡=10px，主光球=36px）
  const brSize = cfg.brOrbSize ?? cornerSize;
  const brOrb = createDecoratedCorner(
    cfg.compactWidth - rightOff - brSize,
    cfg.compactHeight - bottomOff - brSize,
    brSize, brSize, rightRgba, '');
  brOrb.style.pointerEvents = 'auto';
  brOrb.style.cursor = 'pointer';
  brOrb.classList.add('floating-br-orb');
  _brOrbToItem.set(brOrb, item);
  // BR 点击：展开/折叠
  brOrb.addEventListener('click', (e) => {
    e.stopPropagation();
    const onlyBR = !cfg.cornerTL && !cfg.cornerTR && !cfg.cornerBL;
    if (item.state === 'compact') {
      item.state = 'expanding';
      cfg.onPreExpand?.(el);

      anim.to(contentEl, { opacity: 0, duration: 0.1, ease: 'none', onComplete: () => {
        if (item.contentEl) {
          _renderActiveLayout(item.contentEl);
        }
        cfg.onActivate(contentEl);
        anim.to(contentEl, { opacity: 1, duration: 0.15, ease: 'none' });
      }});

      const expW = item.activeMemW;
      const expH = item.activeMemH;
      const curLeft = parseFloat(el.style.left) || 0;
      const curTop = parseFloat(el.style.top) || 0;
      const curW = item.cardWidth;
      const curH = item.cardHeight;
      const MARGIN = 8;
      const anchorR = curLeft + curW;
      const anchorB = curTop + curH;
      const compressedW = Math.max(cfg.minWidth, Math.min(expW, anchorR - MARGIN));
      const compressedH = Math.max(cfg.minHeight, Math.min(expH, anchorB - MARGIN));
      const expLeft = anchorR - compressedW;
      const expTop = anchorB - compressedH;

      // TL/TR/BL 角光球
      if (cfg.cornerTL) {
        const tlOrb = createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, leftRgba, '');
        tlOrb.style.opacity = '0';
        el.appendChild(tlOrb);
        item.tlOrb = tlOrb;
        anim.to(tlOrb, { opacity: 1, duration: 0.2, ease: 'none' });
      }
      if (cfg.cornerTR) {
        const trOrb = createDecoratedCorner(compressedW - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, rightRgba, '');
        trOrb.style.opacity = '0';
        trOrb.style.pointerEvents = 'auto';
        trOrb.style.cursor = 'pointer';
        if (onlyBR) {
          trOrb.addEventListener('click', () => {
            if (item.state === 'active') {
              item.state = 'collapsing';
              _collapseCard(item);
            }
          });
        }
        el.appendChild(trOrb);
        item.trOrb = trOrb;
        anim.to(trOrb, { opacity: 1, duration: 0.2, ease: 'none', delay: 0.05 });
      }
      if (cfg.cornerBL) {
        const blOrb = createDecoratedCorner(cornerOff, expH - bottomOff - cornerSize, cornerSize, cornerSize, leftRgba, '');
        blOrb.style.opacity = '0';
        el.appendChild(blOrb);
        item.blOrb = blOrb;
        anim.to(blOrb, { opacity: 1, duration: 0.2, ease: 'none', delay: 0.1 });
      }

      const brX = compressedW - rightOff - cornerSize;
      const brY = compressedH - bottomOff - cornerSize;
      anim.to(el, {
        left: expLeft, top: expTop,
        width: compressedW, height: compressedH,
        duration: 0.35, ease: 'back.out(1.2)',
        onComplete: () => {
          item.cardWidth = compressedW;
          item.cardHeight = compressedH;
          item.state = 'active';
        },
      });
      anim.to(brOrb, { left: brX, top: brY, duration: 0.35, ease: 'back.out(1.2)' });

    } else if (item.state === 'active') {
      item.state = 'collapsing';
      _collapseCard(item);
    } else if (onlyBR && item.state === 'editing') {
      // 只有 BR 光球时，编辑模式点击 BR 退出编辑
      item.state = _preEditState;
      item.el.style.boxShadow = theme.stack.blurShadow;
      const gd = item.brOrb?.firstElementChild as HTMLElement;
      if (gd && gd.dataset.initBoxShadow !== undefined) {
        gd.style.boxShadow = gd.dataset.initBoxShadow;
        delete gd.dataset.initBoxShadow;
      }
    }
  });

  el.appendChild(brOrb);
  item.brOrb = brOrb;

  // 初始内容
  _renderCompactContent(contentEl, cfg.name);

  // 初始样式
  const initLeft: number = cfg.initialPosition
    ? window.innerWidth - cfg.initialPosition.right - cfg.compactWidth
    : _scatterPosition(_floatingCards.length, cfg.compactWidth, cfg.compactHeight).left;
  const initTop: number = cfg.initialPosition
    ? window.innerHeight - cfg.initialPosition.bottom - cfg.compactHeight
    : _scatterPosition(_floatingCards.length, cfg.compactWidth, cfg.compactHeight).top;

  el.style.cssText = [
    'position:fixed',
    'left:' + initLeft + 'px', 'top:' + initTop + 'px',
    'width:' + cfg.compactWidth + 'px', 'height:' + cfg.compactHeight + 'px',
    'border-radius:12px', 'padding:1px', 'padding-left:3px',
    'background:' + cardGradient(0, 0.85),
    'pointer-events:auto', 'z-index:' + zIndex, 'opacity:1',
  ].join(';');

  document.body.appendChild(el);
  _floatingCards.push(item);

  // 输入法避让
  if (cfg.inputBarAvoid) {
    initInputBarWatcher(el, () => ({
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
    }));
  }

  // 创建回调
  cfg.onCreate?.(el);
  // Registry 注册
  if (cfg.registryElement) {
    Registry.registerElement(cfg.registryElement);
  }

  // AI 命令注册
  if (cfg.onCommand) {
    wsChannel.onCommand('card-' + cfg.id + '-activate', (_a, p) => cfg.onCommand!('activate', p));
  }

  // 内容生成器
  if (cfg.registryContent) {
    Registry.registerContentGenerator(cfg.id + '-content', cfg.registryContent);
  }

  // 发射动画
  anim.set(el, { scale: 0.8 });
  anim.to(el, {
    left: initLeft, top: initTop, scale: 1,
    duration: 0.4, ease: 'back.out(1.3)',
    onComplete: () => {
      item.state = 'compact';
    },
  });
}

/** 折叠浮卡内部的动画逻辑 */
function _collapseCard(item: FloatingCardItem): void {
  const el = item.el;
  anim.to(item.contentEl, { opacity: 0, duration: 0.1, ease: 'none', onComplete: () => {
    if (item.contentEl) {
      item.onDeactivate?.(item.contentEl);
      _renderCompactContent(item.contentEl, item.name);
    }
    anim.to(item.contentEl, { opacity: 1, duration: 0.15, ease: 'none' });
  }});

  const brSvg2 = item.brOrb?.children[1] as HTMLElement;
  if (brSvg2) brSvg2.innerHTML = '';
  const expLeft = parseFloat(el.style.left) || 0;
  const expTop = parseFloat(el.style.top) || 0;
  const foldW = item.compactMemW;
  const foldH = item.compactMemH;
  const MARGIN = 8;
  const expW = item.cardWidth;
  const expH = item.cardHeight;
  const anchorRight = expLeft + expW;
  const anchorBottom = expTop + expH;
  const clampedFoldW = Math.max(item.compactMemW || 1, Math.min(foldW, anchorRight - MARGIN));
  const clampedFoldH = Math.max(item.compactMemH || 1, Math.min(foldH, anchorBottom - MARGIN));
  const foldLeft = anchorRight - clampedFoldW;
  const foldTop = anchorBottom - clampedFoldH;
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
      if (item.brOrb) {
        item.brOrb.style.left = (w - rightOff - cornerSize) + 'px';
        item.brOrb.style.top = (h - bottomOff - cornerSize) + 'px';
      }
    },
    onComplete: () => {
      item.cardWidth = clampedFoldW;
      item.cardHeight = clampedFoldH;
      if (item.brOrb) {
        item.brOrb.style.left = (clampedFoldW - rightOff - cornerSize) + 'px';
        item.brOrb.style.top = (clampedFoldH - bottomOff - cornerSize) + 'px';
      }
      if (item.tlOrb) { item.tlOrb.remove(); item.tlOrb = null; }
      if (item.trOrb) { item.trOrb.remove(); item.trOrb = null; }
      if (item.blOrb) { item.blOrb.remove(); item.blOrb = null; }
      item.state = 'compact';
    },
  });
}

// ========== 发射浮卡（从卡片堆）==========

export function launchFocusedCard(): void {
  animateStackPullFeedback();
  const focusIdx = getFocusIndex();
  const cardRect = getFocusedCardRect();
  if (!cardRect) return;
  const cc = getCurrentAccent(focusIdx);
  if (!cc) return;

  createFloatingCard({
    id: 'card-stack-' + focusIdx + '-' + Date.now(),
    name: getCardName(focusIdx),
    compactWidth: 54,
    compactHeight: 54,
    activeWidth: 155,
    activeHeight: 68,
    minWidth: 54,
    minHeight: 54,
    cornerTL: true,
    cornerTR: true,
    cornerBL: true,
    alwaysOnTop: false,
    inputBarAvoid: false,
    accentColor: cc.color2,
    initialPosition: { right: window.innerWidth - cardRect.left, bottom: window.innerHeight - cardRect.top },
    onActivate(contentEl) {
      const cardId = getCardId(focusIdx);
      if (cardId) getCardHandler(cardId)?.activate?.(contentEl);
    },
    onDeactivate(contentEl) {
      const cardId = getCardId(focusIdx);
      if (cardId) getCardHandler(cardId)?.deactivate?.(contentEl);
    },
  });
}

// ========== 停用浮卡 ==========

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
    // 尝试通过 card-stack 的 handler 清理
    const _id = getCardId?.(item.sourceIndex);
    if (_id) getCardHandler?.(_id)?.deactivate?.(item.contentEl);
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

// ========== 初始化浮卡引擎 ==========

/** 注册浮卡 BR 光球拖拽手势（gesture-registry 统一管理） */
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
        const glowDiv = orbEl.firstElementChild as HTMLElement;
        if (glowDiv) glowDiv.dataset.initBoxShadow = glowDiv.style.boxShadow;
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
        const rawX = _fStartOrbX + dx;
        const rawY = _fStartOrbY + dy;
        const clamped = _fClamp(rawX, rawY);
        const minX = _fStartCardL + (_fItem.minWidth || 54) - _frightOff - _fRS;
        const minY = _fStartCardT + (_fItem.minHeight || 54) - _fbottomOff - _fRS;
        const ox = Math.max(minX, clamped.x);
        const oy = Math.max(minY, clamped.y);

        const newW = Math.max(_fItem.minWidth || 54, ox - _fStartCardL + _frightOff + _fRS);
        const newH = Math.max(_fItem.minHeight || 54, oy - _fStartCardT + _fbottomOff + _fRS);
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
        const rawX = _fStartOrbX + dx;
        const rawY = _fStartOrbY + dy;
        const clamped = _fClamp(rawX, rawY);

        const orbCX = clamped.x + _fRH;
        const orbCY = clamped.y + _fRH;

        const availLeft = orbCX - _fMARGIN;
        const availTop = orbCY - _fMARGIN;
        const renderW = Math.max(0, Math.min(_fStartCardW, availLeft));
        const renderH = Math.max(0, Math.min(_fStartCardH, availTop));
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
