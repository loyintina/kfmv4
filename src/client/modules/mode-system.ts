/**
 * mode-system.ts — 临时卡片堆模式按钮系统
 *
 * 从 tree-swipe.ts 拆分。管理 copy/move/delete 模式切换、
 * 工具栏 DOM 创建、背景卡渲染、光标联动。
 *
 * 与 tree-swipe.ts 的通信通过回调注入：
 *   initModeSystem({ deployCb, dismissCb, executeCb })
 */

import { anim } from './animation-registry.js';
import { currentTheme as theme } from './theme.js';
import { gestures } from './gesture-registry.js';
import { setCursorColor, setModeAccent, setLiquidColor } from './canvas-cursor.js';
import { rgba, hslToHex } from './color-utils.js';

// ========== 模块状态 ==========

let _selectedMode: string | null = null;
const _modeWrappers: HTMLElement[] = [];
let _okBtn: HTMLElement | null = null;
let _cancelBtn: HTMLElement | null = null;
let _toolbar: HTMLElement | null = null;
let _bgCard: HTMLElement | null = null;
let _bgMaxH = 0;
let _pressedBtn: HTMLElement | null = null;

let _currentBtnDim = 'linear-gradient(90deg,rgba(0,212,255,0.2),rgba(124,58,237,0.15))';
let _currentBtnGlow = 'linear-gradient(90deg,rgba(0,212,255,0.6),rgba(124,58,237,0.4))';

// ========== 回调封装（由 tree-swipe.ts 注入）==========

interface ModeCallbacks {
  deployCb: () => void;
  dismissCb: () => void;
  executeCb: () => Promise<void>;
}

let _callbacks: ModeCallbacks | null = null;

export function initModeSystem(cbs: ModeCallbacks): void {
  _callbacks = cbs;
  // 只注册一次，多次调用不重复
}

// ========== 手势注册（只在首次 initModeSystem 时生效）==========

gestures.register({
  id: 'mode-btn',
  targetFilter: '[data-mode-btn]',
  condition: () => _bgCard !== null,
  priority: 90,
  stopPropagation: { start: true },
  onStart: (e) => {
    const key = (e.target as HTMLElement).closest('[data-mode-btn]')?.getAttribute('data-mode-btn');
    if (!key) return;
    _selectedMode = _selectedMode === key ? null : key;
    updateModeSelection();
  },
});

gestures.register({
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

// ========== 公开 API ==========

export function getSelectedMode(): string | null { return _selectedMode; }
export function getModeTheme(mode: string) { return _MODE_THEME[mode]; }
export function getTriColor(mode: string) { return _MODE_TRI_COLOR[mode]; }

export function ensureBg(sidebarW: number): void {
  if (_bgCard) return;
  const left = Math.round(sidebarW - 10);

  _toolbar = document.createElement('div');
  _toolbar.style.cssText = [
    'position:fixed', 'left:' + left + 'px', 'right:-12px',
    'z-index:1010', 'pointer-events:none',
  ].join(';');

  const okBtn = document.createElement('button');
  okBtn.innerHTML = _makeCheckSvg('#7c3aed', '#00d4ff');
  okBtn.style.cssText = _BTN_CSS + ';position:absolute;left:0;top:0';
  okBtn.setAttribute('data-toolbar-btn', 'ok');
  okBtn.addEventListener('click', () => {
    if (_selectedMode) { _callbacks?.executeCb(); } else { _callbacks?.deployCb(); }
  });
  _toolbar.appendChild(okBtn);
  _okBtn = okBtn;

  const tbW = window.innerWidth - left + 12;
  const btnW = 40, gap = 12;
  const D = Math.max(0, (tbW - btnW * 2 - gap) / 2);
  const cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = _makeCloseSvg('#7c3aed', '#00d4ff');
  cancelBtn.style.cssText = _BTN_CSS + ';position:absolute;left:' + Math.round(btnW + gap + D / 2) + 'px;top:0';
  cancelBtn.setAttribute('data-toolbar-btn', 'cancel');
  cancelBtn.addEventListener('click', () => _callbacks?.dismissCb());
  _toolbar.appendChild(cancelBtn);
  _cancelBtn = cancelBtn;

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

export function removeBg(): void {
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

export function updateBg(stackH: number, gap: number): void {
  if (!_bgCard) return;
  if (_bgMaxH === 0 && gap < 26) _bgMaxH = stackH;
  const h = (_bgMaxH > 0 ? _bgMaxH : stackH) + 40;
  const top = Math.round(window.innerHeight * 0.35 - h / 2 - 40);
  anim.to(_bgCard, {
    y: top, height: h, duration: 0.25, ease: 'power2.out',
    overwrite: 'auto',
  });
  _toolbarPos(top, h);
}

export function recolorCards(mode: string | null, cards: HTMLElement[]): void {
  const t = mode ? _MODE_THEME[mode] : null;
  const h1 = t?.hue1 ?? 220;
  const h2 = t?.hue2 ?? 265;
  const sat = t?.sat ?? 62;
  const lit = t?.lit ?? 55;
  const triColor = mode ? _MODE_TRI_COLOR[mode] : '#00d4ff';
  cards.forEach(card => {
    const tri = card.querySelector('[data-card-triangle]') as HTMLElement | null;
    if (tri) tri.style.color = triColor;
    const off1 = parseFloat(card.dataset._hueOff1 || '0');
    const off2 = parseFloat(card.dataset._hueOff2 || '0');
    const isDir = card.dataset._isDir === 'true';
    const c1 = hslToHex(h1 + off1, sat, lit);
    const c2 = hslToHex(h2 + off2, sat, lit);
    const [accent1, accent2] = isDir ? [c2, c1] : [c1, c2];
    card.style.background = `linear-gradient(135deg, ${rgba(accent1, 0.85)} 30%, ${rgba(accent2, 0.85)} 70%)`;
    card.dataset._accent1 = accent1;
    card.dataset._accent2 = accent2;
  });
}

export function applyModeTheme(mode: string | null, cards: HTMLElement[]): void {
  recolorCards(mode, cards);
  const t = mode ? _MODE_THEME[mode] : null;
  if (t?.cursorColor) {
    setCursorColor(t.cursorColor, t.cursorBg ?? null);
    setLiquidColor('rgba(0,0,0,0.85)');
    setModeAccent(t.accent ?? null);
  } else {
    setCursorColor(null, null);
    setLiquidColor(null);
    setModeAccent(null);
  }
  if (mode) {
    const tm = _MODE_THEME[mode];
    _currentBtnDim = tm.btnDim;
    _currentBtnGlow = tm.btnGlow;
    if (_bgCard) _bgCard.style.background = 'linear-gradient(rgba(16,12,24,0.7),rgba(16,12,24,0.7)) padding-box,' + tm.bgGrad + ' border-box';
    if (_okBtn) { _okBtn.innerHTML = _makeCheckSvg(tm.svgStart, tm.svgEnd); _okBtn.style.background = _FILL + tm.btnDim + ' border-box'; }
    if (_cancelBtn) { _cancelBtn.innerHTML = _makeCloseSvg(tm.svgStart, tm.svgEnd); _cancelBtn.style.background = _FILL + tm.btnDim + ' border-box'; }
  } else {
    _currentBtnDim = 'linear-gradient(90deg,rgba(0,212,255,0.2),rgba(124,58,237,0.15))';
    _currentBtnGlow = 'linear-gradient(90deg,rgba(0,212,255,0.6),rgba(124,58,237,0.4))';
    if (_bgCard) _bgCard.style.background = 'linear-gradient(rgba(16,12,24,0.7),rgba(16,12,24,0.7)) padding-box,'
      + 'linear-gradient(135deg,rgba(0,212,255,0.4),rgba(99,102,241,0.35),rgba(124,58,237,0.35)) border-box';
    if (_okBtn) { _okBtn.innerHTML = _makeCheckSvg('#7c3aed', '#00d4ff'); _okBtn.style.background = _FILL + _currentBtnDim + ' border-box'; }
    if (_cancelBtn) { _cancelBtn.innerHTML = _makeCloseSvg('#7c3aed', '#00d4ff'); _cancelBtn.style.background = _FILL + _currentBtnDim + ' border-box'; }
  }
}

export function updateModeSelection(): void {
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
  applyModeTheme(_selectedMode, []);
}

// ========== 内部函数 / 常量 ==========

function _bgGradient(): string { return theme.aiChat.panelBorderGradient; }

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
  'color:rgba(224,224,240,0.85)',
  'font-family:system-ui,-apple-system,sans-serif',
].join(';');

function _makeCheckSvg(start: string, end: string): string {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#checkGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="checkGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="' + start + '"/><stop offset="100%" stop-color="' + end + '"/></linearGradient></defs><polyline points="20 6 9 17 4 12"/></svg>';
}
function _makeCloseSvg(start: string, end: string): string {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#closeGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="closeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="' + start + '"/><stop offset="100%" stop-color="' + end + '"/></linearGradient></defs><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
}

const _BASE_SHADOW = '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)';
const _HOVER_SHADOW = '0 6px 24px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.1)';
const _BORDER_DIM = 'linear-gradient(90deg,rgba(0,212,255,0.2),rgba(124,58,237,0.15))';
const _BORDER_GLOW = 'linear-gradient(90deg,rgba(0,212,255,0.6),rgba(124,58,237,0.4))';
const _FILL = 'linear-gradient(rgba(18,18,26,0.75),rgba(18,18,26,0.75)) padding-box,';

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

const _MODE_THEME: Record<string, { bgGrad: string; btnDim: string; btnGlow: string; svgStart: string; svgEnd: string; accent?: string; hue1: number; hue2: number; sat?: number; lit?: number; cursorColor?: string; cursorBg?: string }> = {
  copy: {
    hue1: 160, hue2: 85, sat: 75, lit: 48,
    bgGrad: 'linear-gradient(135deg,rgba(132,204,22,0.4),rgba(16,185,129,0.35),rgba(15,118,110,0.35))',
    btnDim: 'linear-gradient(90deg,rgba(132,204,22,0.2),rgba(15,118,110,0.15))',
    btnGlow: 'linear-gradient(90deg,rgba(132,204,22,0.6),rgba(15,118,110,0.4))',
    svgStart: '#84cc16',
    svgEnd: '#0f766e',
    accent: '#4ade80',
    cursorColor: 'rgba(74,222,128,0.7)',
    cursorBg: 'rgba(74,222,128,0.12)',
  },
  move: {
    hue1: 40, hue2: 55,
    bgGrad: 'linear-gradient(135deg,rgba(245,158,11,0.4),rgba(234,179,8,0.35),rgba(163,230,53,0.35))',
    btnDim: 'linear-gradient(90deg,rgba(245,158,11,0.2),rgba(163,230,53,0.15))',
    btnGlow: 'linear-gradient(90deg,rgba(245,158,11,0.6),rgba(163,230,53,0.4))',
    svgStart: '#f59e0b',
    svgEnd: '#a3e635',
    accent: '#eab308',
    cursorColor: 'rgba(234,179,8,0.7)',
    cursorBg: 'rgba(234,179,8,0.12)',
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

const _MODE_SVG: Record<string, string> = {
  copy:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#copyGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="copyGrad" x1="2" y1="0" x2="22" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#84cc16"/><stop offset="100%" stop-color="#0f766e"/></linearGradient></defs><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  move:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#moveGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="moveGrad" x1="2" y1="0" x2="22" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#a3e635"/></linearGradient></defs><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 17 15 14"/></svg>',
  delete: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#delGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="delGrad" x1="3" y1="0" x2="21" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#f97316"/><stop offset="100%" stop-color="#831843"/></linearGradient></defs><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
};

function _toolbarPos(bgTop: number, bgH: number): void {
  if (!_toolbar) return;
  anim.to(_toolbar, {
    y: bgTop + bgH + 8, duration: 0.25, ease: 'power2.out',
    overwrite: 'auto',
  });
}
