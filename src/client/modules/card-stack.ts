/**
 * KFM v4 - 堆叠卡片面板
 *
 * 全屏左滑唤出，7 张卡片按暮光光谱堆叠。
 * 垂直滑动切换聚焦卡片，点击聚焦卡打开对应盒子（TODO）。
 * 无遮罩 + 卡片只露部分，像半开的抽屉。
 */

// ========== 暮光配色 (Twilight) ==========
const CARD_COLORS = [
  { border: '#D4899B', bg: 'rgba(212,137,155,0.12)', iconBg: 'rgba(212,137,155,0.18)' },
  { border: '#D4A080', bg: 'rgba(212,160,128,0.12)', iconBg: 'rgba(212,160,128,0.18)' },
  { border: '#C9B07A', bg: 'rgba(201,176,122,0.12)', iconBg: 'rgba(201,176,122,0.18)' },
  { border: '#8FB58F', bg: 'rgba(143,181,143,0.12)', iconBg: 'rgba(143,181,143,0.18)' },
  { border: '#7DA8B8', bg: 'rgba(125,168,184,0.12)', iconBg: 'rgba(125,168,184,0.18)' },
  { border: '#8E8EB8', bg: 'rgba(142,142,184,0.12)', iconBg: 'rgba(142,142,184,0.18)' },
  { border: '#A08CC4', bg: 'rgba(160,140,196,0.12)', iconBg: 'rgba(160,140,196,0.18)' },
];

// 颜色工具：生成浅/中/深三色
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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

  const topPx = Math.round(window.innerHeight * STACK_TOP_RATIO + index * CARD_GAP);

  // 同 AI 输入框/光球面板的渐变边框技法
  const light = adjustColor(color.border, 45);
  const dark = adjustColor(color.border, -35);

  el.style.cssText = [
    'position:absolute',
    'right:16px',
    'top:' + topPx + 'px',
    'width:min(85%, 260px)',
    'height:' + CARD_HEIGHT + 'px',
    'border-radius:12px',
    'padding:12px 14px',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
    'border:1px solid transparent',
    'border-left-width:3px',
    'border-image:linear-gradient(135deg,' + light + ',' + color.border + ',' + dark + ') 1',
    'background:' + color.bg,
    'box-shadow:-6px 6px 24px rgba(0,0,0,0.5)',
    'cursor:pointer',
    'transition:all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    'z-index:' + (10 - index),
    'opacity:' + (1 - index * 0.12),
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

  return el;
}

function buildPanel(): void {
  const panel = document.createElement('div');
  panel.className = 'stack-panel';
  panel.style.cssText = [
    'position:fixed', 'top:0', 'right:0',
    'height:100%',
    'width:min(85%, 300px)',
    'z-index:610',
    'transform:translateX(100%)',
    'transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
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
}

function updateFocus(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dist = Math.abs(i - _focusIndex);

    if (dist === 0) {
      el.style.transform = 'translateX(-12px) scale(1.04)';
      el.style.opacity = '1';
      el.style.zIndex = '20';
      const idxEl = el.querySelector('.stack-card-index') as HTMLElement;
      if (idxEl) idxEl.style.opacity = '0.8';
    } else {
      el.style.transform = 'translateX(0px) scale(1)';
      el.style.opacity = String(Math.max(0.12, 1 - dist * 0.28));
      el.style.zIndex = String(10 - i);
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

/** 面板完全露出的 translateX */
function getPeekX(): number {
  return (1 - PEEK_RATIO) * 100;
}

export function openCardStack(): void {
  if (_isOpen) return;
  _isOpen = true;
  _focusIndex = 0;
  if (_panelEl) {
    _panelEl.style.transform = 'translateX(' + getPeekX() + '%)';
    _panelEl.style.pointerEvents = 'auto';
  }
  repositionCards();
  updateFocus();
}

export function closeCardStack(): void {
  if (!_isOpen) return;
  _isOpen = false;
  if (_panelEl) {
    _panelEl.style.transform = 'translateX(100%)';
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
  window.addEventListener('resize', repositionCards);
}
