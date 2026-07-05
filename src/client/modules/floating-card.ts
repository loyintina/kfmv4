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
import { cardRegistry, type CardContentHandler, type CardInstance } from './card-registry.js';
import { log } from './logger.js';

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
const Z_FULLSCREEN = 30;                  // 全屏卡固定 z-index（低于浮卡，高于背景）
const TITLE_BAR_H = 28;                   // 标题栏高度

const COMPACT_W = 155;
const COMPACT_H = 68;

// ========== 编辑模式最小尺寸 ==========
const FLOATING_CARD_W_MIN = 54;
const FLOATING_CARD_H_MIN = 54;

// ========== 浮卡模板配置 ==========

export interface FloatingCardConfig {
  id: string;
  typeId: string;
  color1: string; color2: string;  // hex 主/辅色
  name: string;
  sourceX: number; sourceY: number;  // 飞入起点
  targetX?: number; targetY?: number;  // 不传则自动散落
  scatterBounds?: { left: number; top: number; right: number; bottom: number };
  contentHandler?: CardContentHandler;
}

// ========== 浮卡类型与状态 ==========

interface FloatingCardItem {
  el: HTMLElement;
  config: FloatingCardConfig;
  instanceId: string;
  zIndex: number;
  state: 'launching' | 'compact' | 'expanding' | 'active' | 'collapsing' | 'dismissing' | 'editing' | 'fullscreen';
  tlOrb: HTMLElement | null;
  trOrb: HTMLElement | null;
  blOrb: HTMLElement | null;
  brOrb: HTMLElement | null;
  topMidOrb: HTMLElement | null;          // 上沿中间光球（全屏触发）
  contentEl: HTMLElement | null;
  headerEl: HTMLElement | null;           // 标题栏元素
  cardWidth: number;
  cardHeight: number;
  compactMemW: number;
  compactMemH: number;
  activeMemW: number;
  activeMemH: number;
  accentColor: string;
  needsKeyboard: boolean;
  isFullscreen: boolean;                  // 是否全屏态
  _fullscreenSaved: { left: number; top: number; width: number; height: number } | null;
  zLocked: boolean;                       // z-index 锁（全屏卡不参与焦点竞争）
  fullscreenBtns: { windowize: HTMLElement; close: HTMLElement } | null;
  _fsResizeHandler: (() => void) | null;  // 全屏键盘避让监听器
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
    if (c.zLocked) continue;  // 跳过 z-index 锁定的卡片
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
    if (c.zLocked) continue;  // 跳过 z-index 锁定的卡片
    if (c.zIndex < item.zIndex) {
      if (!lowest || c.zIndex < lowest.zIndex) {
        lowest = c;
      }
    }
  }
  return lowest;
}

function _swapZIndex(a: FloatingCardItem, b: FloatingCardItem): void {
  // 不允许与 zLocked 卡片交换
  if (a.zLocked || b.zLocked) return;
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
  const safeB = 100; // AI 输入栏视觉高度（76px 物理 + backdrop-filter 晕染）
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
  const { safeL, safeT, safeB } = _calcFloatingSafeBounds();
  const MIN_GAP = 54;
  const pad = 16;
  const topMin = 60;
  const rightMax = window.innerWidth - FLOATING_CARD_W - pad;
  const bottomMax = window.innerHeight - safeB - FLOATING_CARD_H;

  // 纵向堆叠 fallback
  const fallbackLeft = safeL;
  const fallbackTop = safeT + 20 + _floatingCards.length * 60;

  for (let attempt = 0; attempt < 30; attempt++) {
    const l = pad + Math.random() * Math.max(0, rightMax - pad);
    const t = topMin + Math.random() * Math.max(0, bottomMax - topMin);
    let blocked = false;
    for (const c of _floatingCards) {
      const cl = parseFloat(c.el.style.left) || 0;
      const ct = parseFloat(c.el.style.top) || 0;
      if (Math.abs(l - cl) < MIN_GAP && Math.abs(t - ct) < MIN_GAP) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
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
  // 标题栏由 handler 自己创建（buildCardLayout 或 inline），shell 不干预
  const headerEl: HTMLElement | null = null;
  const contentEl = document.createElement('div');
  contentEl.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:2px 6px;font-size:11px;font-weight:500;color:rgba(224,224,224,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:none';
  bgLayer.appendChild(contentEl);
  el.appendChild(bgLayer);

  const zIndex = _nextFloatingZ++;
  const item: FloatingCardItem = {
    el, config, zIndex, state: 'launching',
    instanceId: '',
    tlOrb: null, trOrb: null, blOrb: null, brOrb: null, topMidOrb: null, contentEl, headerEl,
    cardWidth: FLOATING_CARD_W, cardHeight: FLOATING_CARD_H,
    compactMemW: COMPACT_W, compactMemH: COMPACT_H,
    activeMemW: FLOATING_CARD_W, activeMemH: FLOATING_CARD_H,
    accentColor: config.color2,
    needsKeyboard: config.typeId === 'card03' || config.typeId === 'card04',
    isFullscreen: false,
    _fullscreenSaved: null,
    zLocked: false,
    fullscreenBtns: null,
    _fsResizeHandler: null,
  };

  // 注册到运行时实例表
  const cardInstance = cardRegistry.createInstance(
    config.typeId, el, contentEl, { color1: config.color1, color2: config.color2 },
  );
  item.instanceId = cardInstance.instanceId;

  // 四角光球颜色：左 color1，右 color2
  const leftRgba = _hexToRgba(config.color1, 1);
  const rightRgba = _hexToRgba(config.color2, 1);

  // BR — 展开态光球（+ 图标），点击触发收缩
  const brOrb = createDecoratedCorner(
    FLOATING_CARD_W - rightOff - cornerSize,
    FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, rightRgba,
    '<svg width="14" height="14" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" fill="none"/><line x1="6" y1="1.5" x2="6" y2="10.5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/><line x1="1.5" y1="6" x2="10.5" y2="6" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/></svg>');
  brOrb.style.pointerEvents = 'auto';
  brOrb.style.cursor = 'pointer';
  brOrb.classList.add('floating-br-orb');
  _brOrbToItem.set(brOrb, item);
  // 防止 touchstart 阶段浏览器自动聚焦卡内可聚焦元素（如 xterm textarea）
  brOrb.addEventListener('touchstart', e => e.preventDefault());

  // TL — 上移一层（紧凑态也显示）
  const tlColor = _hexToRgba(config.color1, orbT.tlAlpha);
  const tlOrb = createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlColor,
    '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c - sh) + ') scale(' + s + ')"><path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
  tlOrb.style.pointerEvents = 'auto'; tlOrb.style.cursor = 'pointer';
  tlOrb.title = '\u4e0a\u79fb\u4e00\u5c42';
  tlOrb.addEventListener('click', () => { const above = _cardAbove(item); if (above) _swapZIndex(item, above); });
  el.appendChild(tlOrb); item.tlOrb = tlOrb;

  // TR — 关闭
  const trOrb = createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, rightRgba,
    '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c + sh) + ',' + (c - sh) + ') scale(' + s + ')"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/></g></svg>');
  trOrb.style.pointerEvents = 'auto'; trOrb.style.cursor = 'pointer';
  trOrb.title = '\u5173\u95ed';
  trOrb.addEventListener('click', () => { if (item.state !== 'active' && item.state !== 'compact') return; dismissFloatingCard(true, el); });
  el.appendChild(trOrb); item.trOrb = trOrb;

  // BL — 下移一层
  const blOrb = createDecoratedCorner(cornerOff, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, leftRgba,
    '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + (c - sh) + ',' + (c + sh) + ') scale(' + s + ')"><path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>');
  blOrb.style.pointerEvents = 'auto'; blOrb.style.cursor = 'pointer';
  blOrb.title = '\u4e0b\u79fb\u4e00\u5c42';
  blOrb.addEventListener('click', () => { const below = _cardBelow(item); if (below) _swapZIndex(item, below); });
  el.appendChild(blOrb); item.blOrb = blOrb;

  // TopMid — 上沿中间光球（全屏触发）
  // SVG：四边中央切断的正方形（四个直角围成的形状）
  // 坐标系：viewBox="0 0 12 12" 与其他光球一致
  // 位置：top = cornerOff，与其他光球的上沿偏移一致
  const topMidColor = _hexToRgba(config.color1, orbT.tlAlpha);
  const topMidOrb = createDecoratedCorner(
    FLOATING_CARD_W / 2 - cornerSize / 2,
    cornerOff,  // 与其他光球一致：-13
    cornerSize, cornerSize,
    topMidColor,
    '<svg width="14" height="14" viewBox="0 0 12 12"><g transform="translate(' + c + ',' + c + ') scale(' + s + ')"><path d="M1,3 L1,1 L3,1 M9,1 L11,1 L11,3 M11,9 L11,11 L9,11 M3,11 L1,11 L1,9" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>'
  );
  topMidOrb.style.pointerEvents = 'auto';
  topMidOrb.style.cursor = 'pointer';
  topMidOrb.title = '\u5168\u5c4f';
  el.appendChild(topMidOrb);
  item.topMidOrb = topMidOrb;

  el.appendChild(brOrb);
  item.brOrb = brOrb;

  // 紧凑态初始样式
  // 激活内容：文件浮卡直接进入展开态
  if (config.contentHandler) {
    config.contentHandler.activate(contentEl, cardInstance, 'init');
    _renderFloatingContent(contentEl, 'active');
  }

  el.style.cssText = [
    'position:fixed',
    'left:' + config.sourceX + 'px', 'top:' + config.sourceY + 'px',
    'width:' + FLOATING_CARD_W + 'px', 'height:' + FLOATING_CARD_H + 'px',
    'border-radius:12px', 'padding:1px', 'padding-left:3px',
    'background:linear-gradient(135deg,' + _hexToRgba(config.color1, 0.85) + ' 30%,' + _hexToRgba(config.color2, 0.85) + ' 70%)',
    'pointer-events:auto', 'z-index:' + zIndex, 'opacity:1',
    'user-select:none', '-webkit-user-select:none',
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
      item.state = 'active';
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
  
  // 如果是全屏态，先清理全屏相关状态
  if (item.state === 'fullscreen') {
    const onResize = item._fsResizeHandler;
    if (onResize) {
      window.visualViewport?.removeEventListener('resize', onResize);
      item._fsResizeHandler = null;
    }
    if (item.fullscreenBtns) {
      item.fullscreenBtns.windowize.remove();
      item.fullscreenBtns.close.remove();
      item.fullscreenBtns = null;
    }
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
        el.remove();
        cardRegistry.destroyInstance(item.instanceId);
        const idx = _floatingCards.indexOf(item);
        if (idx >= 0) _floatingCards.splice(idx, 1);
      },
    });
  } else {
    el.remove();
    cardRegistry.destroyInstance(item.instanceId);
    const idx = _floatingCards.indexOf(item);
    if (idx >= 0) _floatingCards.splice(idx, 1);
  }
}

// ========== 全屏逻辑 ==========

/** 进入全屏态 */
function enterFullscreen(item: FloatingCardItem): void {
  if (item.state === 'fullscreen' || item.state === 'dismissing') return;
  
  // 调试日志：检查进入全屏前的状态
  log('[enterFullscreen-BEFORE]', {
    typeId: item.config.typeId,
    state: item.state,
    cardWidth: item.cardWidth,
    cardHeight: item.cardHeight,
    elStyleWidth: item.el.style.width,
    elStyleHeight: item.el.style.height,
    elRect: item.el.getBoundingClientRect(),
    contentElChildren: item.contentEl?.children.length,
    contentWrap: item.contentEl?.firstElementChild ? {
      tagName: (item.contentEl.firstElementChild as HTMLElement).tagName,
      childCount: (item.contentEl.firstElementChild as HTMLElement).children.length,
    } : 'null',
  });
  
  // 如果有其他全屏卡，先退出
  for (const other of _floatingCards) {
    if (other !== item && other.state === 'fullscreen') {
      exitFullscreen(other);
    }
  }
  
  // 保存当前位置/尺寸
  item._fullscreenSaved = {
    left: parseFloat(item.el.style.left) || 0,
    top: parseFloat(item.el.style.top) || 0,
    width: item.cardWidth,
    height: item.cardHeight,
  };
  
  // 隐藏四角光球 + topMidOrb
  if (item.tlOrb) item.tlOrb.style.display = 'none';
  if (item.trOrb) item.trOrb.style.display = 'none';
  if (item.blOrb) item.blOrb.style.display = 'none';
  if (item.brOrb) item.brOrb.style.display = 'none';
  if (item.topMidOrb) item.topMidOrb.style.display = 'none';
  
  // 锁定 z-index
  item.zLocked = true;
  item.zIndex = Z_FULLSCREEN;
  item.el.style.zIndex = String(Z_FULLSCREEN);
  
  // 创建全屏态标题栏按钮
  // 标题栏在 contentEl 内部（由 handler 创建），结构：wrap → header + line + body
  // 查找标题栏：从 contentEl 内部查找（handler 创建的 wrap → header）
  const contentWrap = item.contentEl?.firstElementChild as HTMLElement | null;
  const headerEl = contentWrap?.firstElementChild as HTMLElement | null;
  const lineEl = headerEl?.nextElementSibling as HTMLElement | null;
  if (contentWrap && headerEl) {
    // 标题行变窄：只修改 header 和 line 的 margin，不影响内容区
    headerEl.style.margin = '0 30px';
    if (lineEl) lineEl.style.margin = '0 30px';
    
    // 左侧按钮：窗口化（插入到 header 之前）
    const windowizeBtn = document.createElement('div');
    windowizeBtn.style.cssText = 'position:absolute;left:8px;top:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;z-index:1';
    windowizeBtn.title = '\u7a97\u53e3\u5316';
    windowizeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="8" rx="1" stroke="' + _hexToRgba(item.config.color1, 1) + '" stroke-width="1.5" fill="none"/><line x1="2" y1="6" x2="14" y2="6" stroke="' + _hexToRgba(item.config.color1, 1) + '" stroke-width="1.5"/></svg>';
    windowizeBtn.addEventListener('click', () => exitFullscreen(item));
    
    // 右侧按钮：关闭（插入到 header 之后）
    const closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'position:absolute;right:8px;top:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;z-index:1';
    closeBtn.title = '\u5173\u95ed';
    closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12" stroke="' + _hexToRgba(item.config.color2, 1) + '" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="4" x2="4" y2="12" stroke="' + _hexToRgba(item.config.color2, 1) + '" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.addEventListener('click', () => dismissFullscreen(item));
    
    contentWrap.insertBefore(windowizeBtn, headerEl);
    contentWrap.appendChild(closeBtn);
    item.fullscreenBtns = { windowize: windowizeBtn, close: closeBtn };
  }
  
  // 动画到全屏尺寸
  const bar = document.getElementById('aiInputBar');
  const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight;
  const targetH = barTop - 2;  // 间距 2px
  
  item.state = 'fullscreen';
  item.isFullscreen = true;
  
  anim.to(item.el, {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: targetH,
    duration: 0.3,
    ease: 'power2.out',
    onUpdate: () => {
      const w = parseFloat(item.el.style.width) || window.innerWidth;
      const h = parseFloat(item.el.style.height) || targetH;
      item.cardWidth = w;
      item.cardHeight = h;
    },
    onComplete: () => {
      // 调试日志：检查全屏后的 DOM 结构
      const contentWrap = item.contentEl?.firstElementChild as HTMLElement | null;
      const headerEl = contentWrap?.firstElementChild as HTMLElement | null;
      const bodyEl = contentWrap?.lastElementChild as HTMLElement | null;
      log('[enterFullscreen-onComplete]', {
        cardRect: item.el.getBoundingClientRect(),
        contentWrap: contentWrap ? {
          rect: contentWrap.getBoundingClientRect(),
          style: {
            position: contentWrap.style.position,
            overflow: contentWrap.style.overflow,
            display: contentWrap.style.display,
            flexDirection: contentWrap.style.flexDirection,
          },
        } : 'null',
        headerEl: headerEl ? {
          rect: headerEl.getBoundingClientRect(),
          style: {
            flexShrink: headerEl.style.flexShrink,
            margin: headerEl.style.margin,
          },
        } : 'null',
        bodyEl: bodyEl ? {
          rect: bodyEl.getBoundingClientRect(),
          style: {
            flex: bodyEl.style.flex,
            overflow: bodyEl.style.overflow,
            position: bodyEl.style.position,
          },
        } : 'null',
      });
    },
  });
  
  // 键盘避让：监听 visualViewport 变化
  const onResize = () => {
    if (item.state !== 'fullscreen') return;
    const bar2 = document.getElementById('aiInputBar');
    const barTop2 = bar2 ? bar2.getBoundingClientRect().top : window.innerHeight;
    const newH = barTop2 - 2;
    item.el.style.height = newH + 'px';
    item.cardHeight = newH;
  };
  window.visualViewport?.addEventListener('resize', onResize);
  item._fsResizeHandler = onResize;
}

/** 退出全屏态，回到 active 浮卡 */
function exitFullscreen(item: FloatingCardItem): void {
  if (item.state !== 'fullscreen') return;
  
  // 移除键盘避让监听
  const onResize = item._fsResizeHandler;
  if (onResize) {
    window.visualViewport?.removeEventListener('resize', onResize);
    item._fsResizeHandler = null;
  }
  
  // 移除全屏态按钮
  if (item.fullscreenBtns) {
    item.fullscreenBtns.windowize.remove();
    item.fullscreenBtns.close.remove();
    item.fullscreenBtns = null;
  }
  
  // 恢复标题行和分隔线 margin
  const contentWrap = item.contentEl?.firstElementChild as HTMLElement | null;
  const headerEl = contentWrap?.firstElementChild as HTMLElement | null;
  const lineEl = headerEl?.nextElementSibling as HTMLElement | null;
  if (headerEl) {
    headerEl.style.margin = '';
  }
  if (lineEl) {
    lineEl.style.margin = '';
  }
  
  // 显示四角光球 + topMidOrb
  if (item.tlOrb) item.tlOrb.style.display = 'flex';
  if (item.trOrb) item.trOrb.style.display = 'flex';
  if (item.blOrb) item.blOrb.style.display = 'flex';
  if (item.brOrb) item.brOrb.style.display = 'flex';
  if (item.topMidOrb) item.topMidOrb.style.display = 'flex';
  
  // 解锁 z-index
  item.zLocked = false;
  item.zIndex = _nextFloatingZ++;
  item.el.style.zIndex = String(item.zIndex);
  
  // 恢复到保存的位置/尺寸
  const saved = item._fullscreenSaved;
  if (saved) {
    item.state = 'active';
    item.isFullscreen = false;
    
    anim.to(item.el, {
      left: saved.left,
      top: saved.top,
      width: saved.width,
      height: saved.height,
      duration: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        const w = parseFloat(item.el.style.width) || saved.width;
        const h = parseFloat(item.el.style.height) || saved.height;
        item.cardWidth = w;
        item.cardHeight = h;
        // 同步所有光球位置
        if (item.topMidOrb) {
          item.topMidOrb.style.left = (w / 2 - cornerSize / 2) + 'px';
        }
        if (item.brOrb) {
          item.brOrb.style.left = (w - rightOff - cornerSize) + 'px';
          item.brOrb.style.top = (h - bottomOff - cornerSize) + 'px';
        }
        if (item.trOrb) item.trOrb.style.left = (w - rightOff - cornerSize) + 'px';
        if (item.blOrb) item.blOrb.style.top = (h - bottomOff - cornerSize) + 'px';
      },
      onComplete: () => {
        item._fullscreenSaved = null;
        
        // 调试日志：检查退出全屏后光球和 SVG 位置
        log('[exitFullscreen-onComplete] card padding:', item.el.style.padding);
        if (item.topMidOrb) {
          const svg = item.topMidOrb.querySelector('svg');
          const svgRect = svg?.getBoundingClientRect();
          const orbRect = item.topMidOrb.getBoundingClientRect();
          log('[exitFullscreen-onComplete] topMidOrb:', {
            left: item.topMidOrb.style.left,
            top: item.topMidOrb.style.top,
            transform: item.topMidOrb.style.transform,
            orbRect: { x: orbRect.x, y: orbRect.y, w: orbRect.width, h: orbRect.height },
            svgRect: svgRect ? { x: svgRect.x, y: svgRect.y, w: svgRect.width, h: svgRect.height } : null,
            svgCenterOffset: svgRect ? {
              x: (svgRect.x + svgRect.width/2) - (orbRect.x + orbRect.width/2),
              y: (svgRect.y + svgRect.height/2) - (orbRect.y + orbRect.height/2),
            } : null,
          });
        }
        if (item.brOrb) {
          const svg = item.brOrb.querySelector('svg');
          log('[exitFullscreen-onComplete] brOrb:', {
            left: item.brOrb.style.left,
            top: item.brOrb.style.top,
            transform: item.brOrb.style.transform,
            svgTransform: svg?.getAttribute('transform'),
            svgStyleTransform: svg?.style.transform,
            rect: item.brOrb.getBoundingClientRect(),
          });
        }
      },
    });
  } else {
    // 没有保存位置，随机散落
    item.state = 'active';
    item.isFullscreen = false;
    item._fullscreenSaved = null;
    
    const targetPos = _scatterPosition(_floatingCards.length);
    anim.to(item.el, {
      left: targetPos.left,
      top: targetPos.top,
      width: FLOATING_CARD_W,
      height: FLOATING_CARD_H,
      duration: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        const w = parseFloat(item.el.style.width) || FLOATING_CARD_W;
        const h = parseFloat(item.el.style.height) || FLOATING_CARD_H;
        item.cardWidth = w;
        item.cardHeight = h;
        // 同步所有光球位置
        if (item.topMidOrb) {
          item.topMidOrb.style.left = (w / 2 - cornerSize / 2) + 'px';
        }
        if (item.brOrb) {
          item.brOrb.style.left = (w - rightOff - cornerSize) + 'px';
          item.brOrb.style.top = (h - bottomOff - cornerSize) + 'px';
        }
        if (item.trOrb) item.trOrb.style.left = (w - rightOff - cornerSize) + 'px';
        if (item.blOrb) item.blOrb.style.top = (h - bottomOff - cornerSize) + 'px';
      },
    });
  }
}

/** 完全关闭全屏卡 */
function dismissFullscreen(item: FloatingCardItem): void {
  if (item.state !== 'fullscreen') return;
  
  // 移除键盘避让监听
  const onResize = item._fsResizeHandler;
  if (onResize) {
    window.visualViewport?.removeEventListener('resize', onResize);
    item._fsResizeHandler = null;
  }
  
  // 移除全屏态按钮
  if (item.fullscreenBtns) {
    item.fullscreenBtns.windowize.remove();
    item.fullscreenBtns.close.remove();
    item.fullscreenBtns = null;
  }
  
  // 恢复 z-index 锁
  item.zLocked = false;
  
  // 调用 _dismissOne 完全关闭
  _dismissOne(item, true);
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
    const vvH = window.visualViewport?.height ?? window.innerHeight;
    const bar = document.getElementById('aiInputBar');
    const barY = bar ? bar.getBoundingClientRect().top : window.innerHeight;
    return Math.min(vvH, barY) - rs - margin;
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

  // BR 光球展开/收缩逻辑（GestureRegistry onTap 调用，不再走原生 click）
  const _toggleExpandCollapse = () => {
    if (!dragItem) return;
    // 光球交互 = 用户离开卡内容 → 卡内焦点应移除
    const ae = document.activeElement;
    if (ae && dragItem.el.contains(ae)) (ae as HTMLElement).blur();
    const item = dragItem;
    const el = item.el;
    const config = item.config;
    const brOrb = item.brOrb!;
    const tlOrb = item.tlOrb!;
    const contentEl = item.contentEl!;
    const zIndex = item.zIndex;

    if (item.state === 'compact') {
      item.state = 'expanding';
      anim.to(contentEl, { opacity: 0, duration: 0.1, ease: 'none' });

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

      // 展开动画开始时显示 topMidOrb
      if (item.topMidOrb) {
        item.topMidOrb.style.display = 'flex';
      }
      
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
          // 同步 topMidOrb 位置
          if (item.topMidOrb) {
            item.topMidOrb.style.left = (w / 2 - cornerSize / 2) + 'px';
          }
        },
        onComplete: () => {
          item.cardWidth = compressedW;
          item.cardHeight = compressedH;
          // 卡片已到全尺寸——此时 activate 安全，rAF 不会读到中间态
          if (item.contentEl) {
            const ci = cardRegistry.getInstance(item.instanceId);
            if (ci) item.config.contentHandler?.activate?.(item.contentEl, ci, 'compact');
            _renderFloatingContent(item.contentEl, 'active');
          }
          anim.to(contentEl, { opacity: 1, duration: 0.15, ease: 'none' });
          brOrb.style.left = (item.cardWidth - rightOff - cornerSize) + 'px';
          brOrb.style.top = (item.cardHeight - bottomOff - cornerSize) + 'px';
          if (item.trOrb) item.trOrb.style.left = (item.cardWidth - rightOff - cornerSize) + 'px';
          if (item.blOrb) item.blOrb.style.top = (item.cardHeight - bottomOff - cornerSize) + 'px';
          // 同步 topMidOrb 最终位置
          if (item.topMidOrb) {
            item.topMidOrb.style.left = (item.cardWidth / 2 - cornerSize / 2) + 'px';
          }
          item.state = 'active';
          el.style.zIndex = String(zIndex);
          
          // 调试日志：检查光球和 SVG 位置
          log('[expand-onComplete] card padding:', el.style.padding);
          if (item.topMidOrb) {
            const svg = item.topMidOrb.querySelector('svg');
            const svgRect = svg?.getBoundingClientRect();
            const orbRect = item.topMidOrb.getBoundingClientRect();
            log('[expand-onComplete] topMidOrb:', {
              left: item.topMidOrb.style.left,
              top: item.topMidOrb.style.top,
              transform: item.topMidOrb.style.transform,
              orbRect: { x: orbRect.x, y: orbRect.y, w: orbRect.width, h: orbRect.height },
              svgRect: svgRect ? { x: svgRect.x, y: svgRect.y, w: svgRect.width, h: svgRect.height } : null,
              svgCenterOffset: svgRect ? {
                x: (svgRect.x + svgRect.width/2) - (orbRect.x + orbRect.width/2),
                y: (svgRect.y + svgRect.height/2) - (orbRect.y + orbRect.height/2),
              } : null,
            });
          }
          if (item.brOrb) {
            const svg = item.brOrb.querySelector('svg');
            log('[expand-onComplete] brOrb:', {
              left: item.brOrb.style.left,
              top: item.brOrb.style.top,
              transform: item.brOrb.style.transform,
              svgTransform: svg?.getAttribute('transform'),
              svgStyleTransform: svg?.style.transform,
              rect: item.brOrb.getBoundingClientRect(),
            });
          }
        },
      });
      anim.to(tlOrb, { x: 0, y: 0, duration: 0.3, ease: 'back.out(1.1)' });
    } else if (item.state === 'active') {
      item.state = 'collapsing';
      
      // 调试日志：检查折叠前光球状态
      log('[collapse-BEFORE] topMidOrb:', item.topMidOrb ? {
        left: item.topMidOrb.style.left,
        top: item.topMidOrb.style.top,
        transform: item.topMidOrb.style.transform,
        display: item.topMidOrb.style.display,
        opacity: item.topMidOrb.style.opacity,
        rect: item.topMidOrb.getBoundingClientRect(),
      } : 'null');
      log('[collapse-BEFORE] brOrb:', {
        left: brOrb.style.left,
        top: brOrb.style.top,
        transform: brOrb.style.transform,
      });
      
      // topMidOrb 向右下角光球移动并淡出
      if (item.topMidOrb && item.brOrb) {
        const topMidLeft = parseFloat(item.topMidOrb.style.left) || 0;
        const topMidTop = parseFloat(item.topMidOrb.style.top) || 0;
        const brLeft = parseFloat(item.brOrb.style.left) || 0;
        const brTop = parseFloat(item.brOrb.style.top) || 0;
        const dx = brLeft - topMidLeft;
        const dy = brTop - topMidTop;
        
        anim.to(item.topMidOrb, {
          x: dx, y: dy, opacity: 0,
          duration: 0.25, ease: 'power2.in',
          onComplete: () => {
            log('[collapse-onComplete] topMidOrb:', item.topMidOrb ? {
              left: item.topMidOrb.style.left,
              top: item.topMidOrb.style.top,
              transform: item.topMidOrb.style.transform,
              display: item.topMidOrb.style.display,
              opacity: item.topMidOrb.style.opacity,
            } : 'null');
            if (item.topMidOrb) {
              item.topMidOrb.style.display = 'none';
              item.topMidOrb.style.opacity = '';
              item.topMidOrb.style.transform = '';
            }
          },
        });
      }
      
      anim.to(item.contentEl, { opacity: 0, duration: 0.1, ease: 'none', onComplete: () => {
        if (item.contentEl) {
          const ci = cardRegistry.getInstance(item.instanceId);
          if (ci) item.config.contentHandler?.deactivate?.(item.contentEl, ci, 'compact');
          _renderFloatingContent(item.contentEl, 'compact', item.config.name);
        }
        anim.to(item.contentEl, { opacity: 1, duration: 0.15, ease: 'none' });
      }});

      const brSvg2 = brOrb.children[1] as HTMLElement;
      if (brSvg2) brSvg2.innerHTML = '<svg width="14" height="14" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" fill="none"/><line x1="6" y1="1.5" x2="6" y2="10.5" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/><line x1="1.5" y1="6" x2="10.5" y2="6" stroke="currentColor" stroke-width="' + orbT.symStroke + '" stroke-linecap="round"/></svg>';
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
          // 折叠时不更新 topMidOrb 的 left，由 GSAP x/y 控制移动
        },
        onComplete: () => {
          item.cardWidth = clampedFoldW;
          item.cardHeight = clampedFoldH;
          brOrb.style.left = (clampedFoldW - rightOff - cornerSize) + 'px';
          brOrb.style.top = (clampedFoldH - bottomOff - cornerSize) + 'px';
          if (item.trOrb) item.trOrb.style.left = (clampedFoldW - rightOff - cornerSize) + 'px';
          if (item.blOrb) item.blOrb.style.top = (clampedFoldH - bottomOff - cornerSize) + 'px';
          // 折叠完成时隐藏 topMidOrb
          if (item.topMidOrb) {
            item.topMidOrb.style.display = 'none';
          }
          item.state = 'compact';
        },
      });
    }
  };

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
    onTap() { _toggleExpandCollapse(); },
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

  // topMidOrb 点击处理：进入全屏
  gestures.register({
    id: 'floating-topmid-orb',
    targetFilter: '[title="全屏"]',
    priority: 101,
    stopPropagation: true,
    onEnd(event) {
      const orbEl = (event.target as HTMLElement).closest('[title="全屏"]') as HTMLElement;
      if (!orbEl) return;
      // 找到对应的 item
      for (const item of _floatingCards) {
        if (item.topMidOrb === orbEl) {
          enterFullscreen(item);
          break;
        }
      }
    },
  });

  // 键盘避让：开时从 saved orb 重算 fClamp → derive card（同 onMoveNormal）；
  // 关时回 saved 原位。
  const _kbSaved = new Map<FloatingCardItem, {
    orbLeft: number; orbTop: number;
    cardLeft: number; cardTop: number;
    cardW: number; cardH: number;
  }>();
  window.visualViewport?.addEventListener('resize', () => {
    for (const item of _floatingCards) {
      if (!item.needsKeyboard || !item.brOrb) continue;
      const orbRect = item.brOrb.getBoundingClientRect();
      const clamped = fClamp(orbRect.left, orbRect.top);

      if (clamped.y < orbRect.top) {
        // 首次钳 → 记原始状态
        if (!_kbSaved.has(item)) {
          _kbSaved.set(item, {
            orbLeft: orbRect.left, orbTop: orbRect.top,
            cardLeft: parseFloat(item.el.style.left) || 0,
            cardTop: parseFloat(item.el.style.top) || 0,
            cardW: item.cardWidth, cardH: item.cardHeight,
          });
        }

        // 从 saved orb 重算 clamped（防读取当前动画中值漂移）
        const s = _kbSaved.get(item)!;
        const cs = fClamp(s.orbLeft, s.orbTop);
        const orbCX = cs.x + rh;
        const orbCY = cs.y + rh;
        const availLeft = orbCX - margin;
        const availTop = orbCY - margin;
        const rW = Math.max(FLOATING_CARD_W_MIN, Math.min(s.cardW, availLeft));
        const rH = Math.max(FLOATING_CARD_H_MIN, Math.min(s.cardH, availTop));
        const L = Math.max(margin, orbCX - rW);
        const T = Math.max(margin, orbCY - rH);

        anim.to(item.el, {
          left: L, top: T, width: rW, height: rH,
          duration: 0.15, ease: 'power2.out',
          onUpdate() {
            const w = parseFloat(item.el.style.width) || rW;
            const h = parseFloat(item.el.style.height) || rH;
            fSyncCorners(item, w, h);
          },
        });
      } else if (_kbSaved.has(item)) {
        // 键盘收 → derive card 同开路径公式（不再读 saved cardTop/cardH，防过时）
        const s = _kbSaved.get(item)!;
        const cs = fClamp(s.orbLeft, s.orbTop);
        const orbCX2 = cs.x + rh;
        const orbCY2 = cs.y + rh;
        const rW2 = Math.max(FLOATING_CARD_W_MIN, Math.min(item.cardWidth, orbCX2 - margin));
        const rH2 = Math.max(FLOATING_CARD_H_MIN, Math.min(item.cardHeight, orbCY2 - margin));
        const L2 = Math.max(margin, orbCX2 - rW2);
        const T2 = Math.max(margin, orbCY2 - rH2);

        anim.to(item.el, {
          left: L2, top: T2, width: rW2, height: rH2,
          duration: 0.15, ease: 'power2.out',
          onUpdate() {
            const w = parseFloat(item.el.style.width) || rW2;
            const h = parseFloat(item.el.style.height) || rH2;
            const t = parseFloat(item.el.style.top) || 0;
            fSyncCorners(item, w, h);
            if (Math.abs(t - T2) < 0.5 && Math.abs(h - rH2) < 0.5) {
              _kbSaved.delete(item);
            }
          },
        });
      }
    }
  });

  // 聚焦/上浮：任何对浮卡的触碰（含 orb、xterm、空白区）→ raise + focus
  gestures.addPreMatchHook((e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest('.floating-card') as HTMLElement | null;
    if (!el) return;
    const item = _floatingCards.find(i => i.el === el);
    if (!item || (item.state !== 'active' && item.state !== 'compact' && item.state !== 'editing')) return;
    item.zIndex = _nextFloatingZ++;
    item.el.style.zIndex = String(item.zIndex);
    cardRegistry.focusCard(item.instanceId);
  });
}

// ========== 卡片布局骨架（共享样板） ==========

/** 构建卡片内标题栏 + 分隔线 + body 区。返回 headerEl 和 bodyEl，调用方往里塞内容 */
export function buildCardLayout(
  contentEl: HTMLElement,
  title: string,
  accent1: string,
  accent2: string,
): { headerEl: HTMLElement; bodyEl: HTMLElement } {
  contentEl.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:0 10px';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0 4px;flex-shrink:0';

  const label = document.createElement('div');
  label.style.cssText = 'font-size:11px;font-weight:600;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0';
  label.textContent = title;
  header.appendChild(label);

  const line = document.createElement('div');
  line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,' + accent1 + ',' + accent2 + ')';

  const body = document.createElement('div');
  body.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;padding-bottom:4px';

  wrap.appendChild(header);
  wrap.appendChild(line);
  wrap.appendChild(body);
  contentEl.appendChild(wrap);

  return { headerEl: header, bodyEl: body };
}

