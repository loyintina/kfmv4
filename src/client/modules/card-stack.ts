/**
 * KFM v4 - 堆叠卡片面板
 *
 * 右侧边缘左滑唤出，7 张卡片按暮光光谱堆叠。
 * 垂直滑动切换聚焦卡片，点击聚焦卡打开对应盒子（TODO），点击背景关闭。
 */

// ========== 暮光配色 (Twilight) ==========
const CARD_COLORS = [
  { border: '#D4899B', bg: 'rgba(212,137,155,0.12)', iconBg: 'rgba(212,137,155,0.18)' },  // Dusty Rose
  { border: '#D4A080', bg: 'rgba(212,160,128,0.12)', iconBg: 'rgba(212,160,128,0.18)' },  // Terracotta
  { border: '#C9B07A', bg: 'rgba(201,176,122,0.12)', iconBg: 'rgba(201,176,122,0.18)' },  // Antique Gold
  { border: '#8FB58F', bg: 'rgba(143,181,143,0.12)', iconBg: 'rgba(143,181,143,0.18)' },  // Sage
  { border: '#7DA8B8', bg: 'rgba(125,168,184,0.12)', iconBg: 'rgba(125,168,184,0.18)' },  // Dusty Teal
  { border: '#8E8EB8', bg: 'rgba(142,142,184,0.12)', iconBg: 'rgba(142,142,184,0.18)' },  // Muted Lavender
  { border: '#A08CC4', bg: 'rgba(160,140,196,0.12)', iconBg: 'rgba(160,140,196,0.18)' },  // Soft Violet
];

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

// ========== 状态 ==========
let _isOpen = false;
let _focusIndex = 0;
let _panelEl: HTMLElement | null = null;
let _overlayEl: HTMLElement | null = null;
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

  const topPx = Math.round(window.innerHeight * 0.12 + index * 36);
  el.style.cssText = [
    'position:absolute',
    'right:16px',
    'top:' + topPx + 'px',
    'width:min(85%, 260px)',
    'height:68px',
    'border-radius:12px',
    'padding:12px 14px',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
    'border:1.5px solid ' + color.border,
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
  // 背景遮罩
  const overlay = document.createElement('div');
  overlay.className = 'stack-overlay';
  overlay.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
    'z-index:600', 'background:rgba(0,0,0,0.5)',
    'opacity:0', 'pointer-events:none',
    'transition:opacity 0.3s ease',
  ].join(';');
  overlay.addEventListener('click', closeCardStack);
  overlay.addEventListener('touchend', (e) => {
    // 点击遮罩本身才关闭（防止卡片事件冒泡误触）
    if (e.target === overlay) closeCardStack();
  }, { passive: true });
  document.body.appendChild(overlay);
  _overlayEl = overlay;

  // 面板容器
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

  // 面板触摸事件
  panel.addEventListener('touchstart', (e: TouchEvent) => {
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

    // 右滑超过阈值 -> 关闭
    if (dx > 50) {
      closeCardStack();
      return;
    }

    // 垂直滑动切换聚焦
    if (Math.abs(dy) > 30) {
      const dir = dy < 0 ? 1 : -1; // 上滑 = index++ (往下翻), 下滑 = index--
      const newIndex = _focusIndex + dir;
      if (newIndex >= 0 && newIndex < CARDS.length) {
        _focusIndex = newIndex;
        _touchStartY = t.clientY;
        updateFocus();
      }
    }
  }, { passive: true });

  panel.addEventListener('touchend', () => {
    // 点击（无移动、短暂触摸）-> 打开对应盒子（TODO）
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
      // 聚焦卡片：高亮边框、向右弹出、完全可见
      el.style.transform = 'translateX(-12px) scale(1.04)';
      el.style.opacity = '1';
      el.style.zIndex = '20';
      el.style.borderWidth = '2px';
      const idxEl = el.querySelector('.stack-card-index') as HTMLElement;
      if (idxEl) idxEl.style.opacity = '0.8';
    } else {
      // 非聚焦：回退、渐隐
      el.style.transform = 'translateX(0px) scale(1)';
      el.style.opacity = String(Math.max(0.12, 1 - dist * 0.28));
      el.style.zIndex = String(10 - i);
      el.style.borderWidth = '1.5px';
      const idxEl = el.querySelector('.stack-card-index') as HTMLElement;
      if (idxEl) idxEl.style.opacity = '0.3';
    }
  }
}

// ========== 窗口自适应 ==========
function repositionCards(): void {
  if (!_panelEl) return;
  for (let i = 0; i < _cardEls.length; i++) {
    _cardEls[i].style.top = Math.round(window.innerHeight * 0.12 + i * 36) + 'px';
  }
}

// ========== 公开 API ==========

export function openCardStack(): void {
  if (_isOpen) return;
  _isOpen = true;
  _focusIndex = 0;
  if (_overlayEl) {
    _overlayEl.style.opacity = '1';
    _overlayEl.style.pointerEvents = 'auto';
  }
  if (_panelEl) {
    _panelEl.style.transform = 'translateX(0)';
    _panelEl.style.pointerEvents = 'auto';
  }
  repositionCards();
  updateFocus();
}

export function closeCardStack(): void {
  if (!_isOpen) return;
  _isOpen = false;
  if (_overlayEl) {
    _overlayEl.style.opacity = '0';
    _overlayEl.style.pointerEvents = 'none';
  }
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
