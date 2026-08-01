/**
 * floating-fullscreen.ts — 浮卡全屏/退出/关闭逻辑
 *
 * 从 floating-card.ts 拆分。floating-card.ts 负责浮卡创建/状态机/手势，
 * 本模块负责 enterFullscreen / exitFullscreen / dismissFullscreen。
 */

import { anim } from './animation-registry.js';
import { FLOATING_CARD_W, FLOATING_CARD_H } from './interaction-constants.js';
import {
  type FloatingCardItem,
  _floatingCards, _allocZ, _hexToRgba,
  _scatterPosition, _dismissOne, Z_FULLSCREEN, _cornerLayout,
} from './floating-shared.js';

// ========== 全屏逻辑 ==========

/** 进入全屏态 */
export function enterFullscreen(item: FloatingCardItem): void {
  if (item.state === 'fullscreen' || item.state === 'dismissing') return;

  // 如果有其他全屏卡，先完全关闭（全屏唯一槽位：新来旧关，不再窗口化退回）
  for (const other of _floatingCards) {
    if (other !== item && other.state === 'fullscreen') {
      dismissFullscreen(other);
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
  const contentWrap = item.contentEl?.firstElementChild as HTMLElement | null;
  const headerEl = contentWrap?.firstElementChild as HTMLElement | null;
  const lineEl = headerEl?.nextElementSibling as HTMLElement | null;
  if (contentWrap && headerEl) {
    headerEl.style.margin = '0 30px';
    if (lineEl) lineEl.style.margin = '0 30px';

    const windowizeBtn = document.createElement('div');
    windowizeBtn.style.cssText = 'position:absolute;left:8px;top:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;z-index:1'; // zindex-ok: 全屏卡标题栏按钮，局部 stacking 非全局层
    windowizeBtn.title = '窗口化';
    windowizeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="8" rx="1" stroke="' + _hexToRgba(item.config.color1, 1) + '" stroke-width="1.5" fill="none"/><line x1="2" y1="6" x2="14" y2="6" stroke="' + _hexToRgba(item.config.color1, 1) + '" stroke-width="1.5"/></svg>';
    windowizeBtn.addEventListener('click', () => exitFullscreen(item));

    const closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'position:absolute;right:8px;top:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;z-index:1'; // zindex-ok: 全屏卡标题栏按钮，局部 stacking 非全局层
    closeBtn.title = '关闭';
    closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12" stroke="' + _hexToRgba(item.config.color2, 1) + '" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="4" x2="4" y2="12" stroke="' + _hexToRgba(item.config.color2, 1) + '" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.addEventListener('click', () => dismissFullscreen(item));

    contentWrap.insertBefore(windowizeBtn, headerEl);
    contentWrap.appendChild(closeBtn);
    item.fullscreenBtns = { windowize: windowizeBtn, close: closeBtn };
  }

  // 动画到全屏尺寸
  const bar = document.getElementById('aiInputBar');
  const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight;
  const targetH = barTop - 2;

  item.state = 'fullscreen';
  item.isFullscreen = true;

  item.el.classList.add('fullscreen');
  if (item.contentEl) {
    item.contentEl.style.touchAction = 'pan-y';
    for (const child of item.contentEl.querySelectorAll<HTMLElement>('*')) {
      child.style.touchAction = 'pan-y';
    }
    for (const xtermEl of item.contentEl.querySelectorAll<HTMLElement>('.xterm')) {
      xtermEl.style.touchAction = 'none';
    }
  }
  anim.to(item.el, {
    left: 0, top: 0,
    width: window.innerWidth, height: targetH,
    duration: 0.3, ease: 'power2.out',
    onUpdate: () => {
      const w = parseFloat(item.el.style.width) || window.innerWidth;
      const h = parseFloat(item.el.style.height) || targetH;
      item.cardWidth = w;
      item.cardHeight = h;
    },
  });

  // 键盘避让
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
export function exitFullscreen(item: FloatingCardItem): void {
  if (item.state !== 'fullscreen') return;

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

  const contentWrap = item.contentEl?.firstElementChild as HTMLElement | null;
  const headerEl = contentWrap?.firstElementChild as HTMLElement | null;
  const lineEl = headerEl?.nextElementSibling as HTMLElement | null;
  if (headerEl) headerEl.style.margin = '';
  if (lineEl) lineEl.style.margin = '';

  if (item.contentEl) item.contentEl.style.touchAction = 'pan-y';
  item.el.classList.remove('fullscreen');

  if (item.tlOrb) item.tlOrb.style.display = 'flex';
  if (item.trOrb) item.trOrb.style.display = 'flex';
  if (item.blOrb) item.blOrb.style.display = 'flex';
  if (item.brOrb) item.brOrb.style.display = 'flex';
  if (item.topMidOrb) item.topMidOrb.style.display = 'flex';

  item.zLocked = false;
  item.zIndex = _allocZ();
  item.el.style.zIndex = String(item.zIndex);

  const saved = item._fullscreenSaved;
  const { cornerSize, rightOff, bottomOff } = _cornerLayout;
  if (saved) {
    item.state = 'active';
    item.isFullscreen = false;
    anim.to(item.el, {
      left: saved.left, top: saved.top,
      width: saved.width, height: saved.height,
      duration: 0.3, ease: 'power2.out',
      onUpdate: () => {
        const w = parseFloat(item.el.style.width) || saved.width;
        const h = parseFloat(item.el.style.height) || saved.height;
        item.cardWidth = w; item.cardHeight = h;
        if (item.topMidOrb) item.topMidOrb.style.left = (w / 2 - cornerSize / 2) + 'px';
        if (item.brOrb) { item.brOrb.style.left = (w - rightOff - cornerSize) + 'px'; item.brOrb.style.top = (h - bottomOff - cornerSize) + 'px'; }
        if (item.trOrb) item.trOrb.style.left = (w - rightOff - cornerSize) + 'px';
        if (item.blOrb) item.blOrb.style.top = (h - bottomOff - cornerSize) + 'px';
      },
      onComplete: () => { item._fullscreenSaved = null; },
    });
  } else {
    item.state = 'active';
    item.isFullscreen = false;
    item._fullscreenSaved = null;
    const targetPos = _scatterPosition(_floatingCards.length);
    anim.to(item.el, {
      left: targetPos.left, top: targetPos.top,
      width: FLOATING_CARD_W, height: FLOATING_CARD_H,
      duration: 0.3, ease: 'power2.out',
      onUpdate: () => {
        const w = parseFloat(item.el.style.width) || FLOATING_CARD_W;
        const h = parseFloat(item.el.style.height) || FLOATING_CARD_H;
        item.cardWidth = w; item.cardHeight = h;
        if (item.topMidOrb) item.topMidOrb.style.left = (w / 2 - cornerSize / 2) + 'px';
        if (item.brOrb) { item.brOrb.style.left = (w - rightOff - cornerSize) + 'px'; item.brOrb.style.top = (h - bottomOff - cornerSize) + 'px'; }
        if (item.trOrb) item.trOrb.style.left = (w - rightOff - cornerSize) + 'px';
        if (item.blOrb) item.blOrb.style.top = (h - bottomOff - cornerSize) + 'px';
      },
    });
  }
}

/** 完全关闭全屏卡 */
export function dismissFullscreen(item: FloatingCardItem): void {
  if (item.state !== 'fullscreen') return;

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

  if (item.contentEl) item.contentEl.style.touchAction = 'pan-y';
  item.el.classList.remove('fullscreen');
  _dismissOne(item, true);
}
