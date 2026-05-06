import { gestures } from "./gesture-registry.js";
import { getCursorRowIndex, getRowIndexLength } from "./canvas-cursor.js";

/**
 * KFM v4 - 堆叠卡片面板
 *
 * 全屏左滑唤出，7 张卡片按暮光光谱堆叠。
 * 垂直滑动切换聚焦卡片，点击聚焦卡打开对应盒子（TODO）。
 * 无遮罩 + 卡片只露部分，像半开的抽屉。
 */

// ========== 暮光配色 (Twilight) ==========
const CARD_BG = 'rgba(20,16,32,0.92)';  // 深色毛玻璃底
const CARD_COLORS = [
  { border: '#D4899B', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(212,137,155,0.25)' },
  { border: '#D4A080', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(212,160,128,0.25)' },
  { border: '#C9B07A', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(201,176,122,0.25)' },
  { border: '#8FB58F', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(143,181,143,0.25)' },
  { border: '#7DA8B8', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(125,168,184,0.25)' },
  { border: '#8E8EB8', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(142,142,184,0.25)' },
  { border: '#A08CC4', bg: 'rgba(20,16,32,0.92)', iconBg: 'rgba(160,140,196,0.25)' },
];

// 颜色工具：hex → rgba（带 alpha）
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/** 获取卡片 i 的三色渐变 [前色, 主色, 后色]，全部 rgba 格式 */
function getTriple(i: number, alpha: number): string[] {
  const n = CARD_COLORS.length;
  const mainRgba = hexToRgba(CARD_COLORS[i].border, alpha);
  // 前/后色取相邻卡，首尾卡用自身变浅/变深
  const prev = i > 0 ? hexToRgba(CARD_COLORS[i - 1].border, alpha) : hexToRgba(CARD_COLORS[0].border, Math.min(1, alpha + 0.15));
  const next = i < n - 1 ? hexToRgba(CARD_COLORS[i + 1].border, alpha) : hexToRgba(CARD_COLORS[n - 1].border, Math.max(0.05, alpha - 0.2));
  return [prev, mainRgba, next];
}

interface CardDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

const CARDS: CardDef[] = [
  { id: 'settings', icon: '\u2699', name: '设置', desc: 'API Key \u00b7 模型选择' },
  { id: 'files',    icon: '\uD83D\uDCC1', name: '文件管理', desc: '上传 \u00b7 下载 \u00b7 整理' },
  { id: 'notes',    icon: '\uD83D\uDCDD', name: '笔记',     desc: '快速记录 \u00b7 草稿' },
  { id: 'plugins',  icon: '\uD83D\uDD0C', name: '插件',     desc: '扩展 \u00b7 集成' },
  { id: 'theme',    icon: '\uD83C\uDFA8', name: '主题',     desc: '外观 \u00b7 配色' },
  { id: 'stats',    icon: '\uD83D\uDCCA', name: '统计',     desc: '使用数据 \u00b7 趋势' },
  { id: 'about',    icon: '\uD83D\uDC8E', name: '关于',     desc: '版本 \u00b7 信息' },
];

// ========== 配置 ==========
/** 面板打开时露出比例（0-1），0.6 = 露出 60% */
const PEEK_RATIO = 0.55;
/** 卡片垂直间距 px */
const CARD_GAP = 36;
/** 卡片高度 px */
const CARD_HEIGHT = 68;
/** 堆叠起始位置（距顶部比例） */
const STACK_TOP_RATIO = 0.12;

// ========== 状态 ==========
let _isOpen = false;
let _focusIndex = 0;
let _panelEl: HTMLElement | null = null;
let _cardEls: HTMLElement[] = [];

// 触摸状态
let _touchStartY = 0;
let _swipeStartX = 0;
let _touchMoved = false;
let _touchStartTime = 0;

// ========== DOM 构建 ==========


function createCard(index: number): HTMLElement {
  const card = CARDS[index];
  const color = CARD_COLORS[index];

  const el = document.createElement('div');
  el.className = 'stack-card';
  el.dataset.index = String(index);

  // 随机偏移：让卡片看起来像是散落在桌面上
  const randomRight = 14 + Math.floor(Math.random() * 12); // 14-26px
  const randomRotate = (Math.random() - 0.5) * 4; // -2deg ~ +2deg 微倾斜
  const topPx = Math.round(window.innerHeight * STACK_TOP_RATIO + index * CARD_GAP);

  // 存储随机值供后续使用
  el.dataset.randomRight = String(randomRight);
  el.dataset.randomRotate = String(randomRotate);

  // 三色渐变边框
  const alpha = 0.85;
  const [c1, c2, c3] = getTriple(index, alpha);

  // 多层阴影：立体感，像桌面上的物件
  const shadow = [
    '0 2px 4px rgba(0,0,0,0.3)',
    '0 8px 16px rgba(0,0,0,0.25)',
    '0 16px 32px rgba(0,0,0,0.2)',
    '-4px 4px 8px rgba(0,0,0,0.15)',
  ].join(',');

  el.style.cssText = [
    'position:absolute',
    'right:' + randomRight + 'px',
    'top:' + topPx + 'px',
    'width:min(85%, 260px)',
    'height:' + CARD_HEIGHT + 'px',
    'border-radius:12px',
    'padding:12px 14px',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'border:1px solid transparent',
    'border-left-width:3px',
    'background: linear-gradient(' + CARD_BG + ',' + CARD_BG + ') padding-box, linear-gradient(135deg,' + c1 + ',' + c2 + ',' + c3 + ') border-box',
    'box-shadow:' + shadow,
    'transform:rotate(' + randomRotate + 'deg)',
    'cursor:pointer',
    'transition:all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    'z-index:' + (10 + index),
    'opacity:1',
    'user-select:none',
    '-webkit-user-select:none',
  ].join(';');

  el.innerHTML = ''
    + '<div class="stack-card-icon" style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;background:' + color.iconBg + ';color:' + color.border + '">' + card.icon + '</div>'
    + '<div class="stack-card-info" style="flex:1;min-width:0">'
    + '  <div class="stack-card-name" style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + card.name + '</div>'
    + '  <div class="stack-card-desc" style="font-size:11px;opacity:0.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">' + card.desc + '</div>'
    + '</div>'
    + '<div class="stack-card-index" style="font-size:11px;font-weight:600;opacity:0.4;width:20px;text-align:center;flex-shrink:0">' + String(index + 1).padStart(2, '0') + '</div>';

  // 点击卡片切换焦点
  el.addEventListener("click", (e) => {
    const idx = parseInt(el.dataset.index || "0", 10);
    if (idx !== _focusIndex) {
      _focusIndex = idx;
      updateFocus();
    }
  });
  return el;
}
function buildPanel(): void {
  console.log("[CARD-STACK] buildPanel called");
  const panel = document.createElement('div');
  panel.className = 'stack-panel';
  panel.style.cssText = [
    'position:fixed', 'top:0', 'right:0',
    'height:100%',
    'width:min(85%, 300px)',
    'z-index:610',
    'right:-300px',  // 关闭时右偏移（不用 transform）
    'transition:right 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(panel);
  _panelEl = panel;

  // 构建卡片
  for (let i = 0; i < CARDS.length; i++) {
    const card = createCard(i);
    panel.appendChild(card);
    _cardEls.push(card);
  }

  // 面板内触摸事件
  panel.addEventListener('touchstart', (e: TouchEvent) => {
    e.stopPropagation();
    const t = e.touches[0];
    _touchStartY = t.clientY;
    _swipeStartX = t.clientX;
    _touchMoved = false;
    _touchStartTime = Date.now();
  }, { passive: true });

  panel.addEventListener('touchmove', (e: TouchEvent) => {
    const t = e.touches[0];
    const dy = t.clientY - _touchStartY;
    const dx = t.clientX - _swipeStartX;
    _touchMoved = true;

    // 右滑 -> 关闭
    if (dx > 50) {
      closeCardStack();
      return;
    }

    // 垂直滑动切换聚焦
    if (Math.abs(dy) > 25) {
      const dir = dy < 0 ? 1 : -1;
      const newIndex = _focusIndex + dir;
      if (newIndex >= 0 && newIndex < CARDS.length) {
        _focusIndex = newIndex;
        _touchStartY = t.clientY;
        updateFocus();
      }
    }
  }, { passive: true });

  panel.addEventListener('touchend', () => {
    if (!_touchMoved && Date.now() - _touchStartTime < 300) {
      const card = CARDS[_focusIndex];
      console.log('[card-stack] select:', card.id, card.name);
      // TODO: 打开对应盒子
    }
  }, { passive: true });
  console.log("[CARD-STACK] buildPanel done, _panelEl=", _panelEl, "offsetWidth=", panel.offsetWidth);
}

function updateFocus(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dist = Math.abs(i - _focusIndex);

    if (dist === 0) {
      // 聚焦：左移更多、取消旋转、增强阴影（不改层级）
      el.style.transform = 'translateX(-20px) scale(1.04) rotate(0deg)';
      el.style.opacity = '1';
      el.style.backdropFilter = 'blur(16px)';
      (el.style as any).webkitBackdropFilter = 'blur(16px)';
      const alpha = 0.85;
      const [c1, c2, c3] = getTriple(i, alpha);
      el.style.background = 'linear-gradient(rgba(20,16,32,0.92),rgba(20,16,32,0.92)) padding-box, linear-gradient(135deg,' + c1 + ',' + c2 + ',' + c3 + ') border-box';
      // 聚焦时阴影更突出
      el.style.boxShadow = '0 4px 8px rgba(0,0,0,0.4),0 12px 24px rgba(0,0,0,0.3),0 24px 48px rgba(0,0,0,0.25),-6px 6px 12px rgba(0,0,0,0.2)';
      // 不改 zIndex，保持原有层级
      const idxEl = el.querySelector('.stack-card-index') as HTMLElement;
      if (idxEl) idxEl.style.opacity = '0.8';
    } else {
      // 非聚焦：恢复随机旋转、普通阴影
      const randomRotate = el.dataset.randomRotate || '0';
      el.style.transform = 'translateX(0px) scale(1) rotate(' + randomRotate + 'deg)';
      el.style.opacity = '1';
      // 不改 zIndex
      el.style.backdropFilter = 'blur(16px)';
      (el.style as any).webkitBackdropFilter = 'blur(16px)';
      const alpha2 = 0.85;
      const [c4, c5, c6] = getTriple(i, alpha2);
      el.style.background = 'linear-gradient(rgba(20,16,32,0.92),rgba(20,16,32,0.92)) padding-box, linear-gradient(135deg,' + c4 + ',' + c5 + ',' + c6 + ') border-box';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3),0 8px 16px rgba(0,0,0,0.25),0 16px 32px rgba(0,0,0,0.2),-4px 4px 8px rgba(0,0,0,0.15)';
      const idxEl = el.querySelector('.stack-card-index') as HTMLElement;
      if (idxEl) idxEl.style.opacity = '0.3';
    }
  }
}

// ========== 窗口自适应 ==========
function repositionCards(): void {
  if (!_panelEl) return;
  for (let i = 0; i < _cardEls.length; i++) {
    _cardEls[i].style.top = Math.round(window.innerHeight * STACK_TOP_RATIO + i * CARD_GAP) + 'px';
  }
}

// ========== 公开 API ==========

export function openCardStack(): void {
  if (_isOpen) return;
  _isOpen = true;
  // 根据文件树光标位置映射到卡片索引
  const cursorIdx = getCursorRowIndex();
  const totalRows = getRowIndexLength();
  const cardCount = CARDS.length;
  if (cursorIdx >= 0 && totalRows > 0) {
    // 光标位置映射到卡片：cursorIdx/totalRows * cardCount
    _focusIndex = Math.floor((cursorIdx / totalRows) * cardCount);
    _focusIndex = Math.max(0, Math.min(cardCount - 1, _focusIndex));
  } else {
    _focusIndex = 0;
  }
  if (_panelEl) {
    const pw = _panelEl.offsetWidth || Math.min(window.innerWidth * 0.85, 300);
    _panelEl.style.right = String(-pw * (1 - PEEK_RATIO)) + 'px';
    _panelEl.style.pointerEvents = 'auto';
  }
  repositionCards();
  updateFocus();
}

export function closeCardStack(): void {
  if (!_isOpen) return;
  _isOpen = false;
  if (_panelEl) {
    _panelEl.style.right = '-300px';
    _panelEl.style.pointerEvents = 'none';
  }
}

export function isCardStackOpen(): boolean {
  return _isOpen;
}

export function focusNext(): void {
  if (_focusIndex < CARDS.length - 1) {
    _focusIndex++;
    updateFocus();
  }
}

export function focusPrev(): void {
  if (_focusIndex > 0) {
    _focusIndex--;
    updateFocus();
  }
}

export function initCardStack(): void {
  buildPanel();
  // 全局滑动切卡（通过 GestureRegistry 管理）
  gestures.register({
    id: 'card-stack-global',
    targetFilter: () => true,
    condition: () => isCardStackOpen(),
    priority: 80,
    onMove: (e, dx, dy) => {
      if (dx > 60) { closeCardStack(); return; }
      if (Math.abs(dy) > 30) {
        const dir = dy < 0 ? 1 : -1;
        const newIndex = _focusIndex + dir;
        if (newIndex >= 0 && newIndex < CARDS.length) {
          _focusIndex = newIndex;
          updateFocus();
        }
      }
    },
  });
  window.addEventListener('resize', () => {
    repositionCards();
    if (_isOpen && _panelEl) {
      const pw = _panelEl.offsetWidth || Math.min(window.innerWidth * 0.85, 300);
      _panelEl.style.right = String(-pw * (1 - PEEK_RATIO)) + 'px';
    }
  });
}

