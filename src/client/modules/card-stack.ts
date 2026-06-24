import { gestures } from "./gesture-registry.js";
import { anim, AnimTimeline } from './animation-registry.js';
import { getLogs, clearLogs, copyLogs, onLog } from './logger.js';
import { Registry } from './ui-registry.js';
import { wsChannel } from './ws-channel.js';
import { currentTheme as theme } from './theme.js';
import { createFloatingCard } from './floating-card.js';
import { log } from './logger.js';

/**
 * KFM v4 - 堆叠卡片面板
 *
 * 全屏左滑唤出，7 张卡片按星云光谱堆叠。
 * 垂直滑动切换聚焦卡片，点击聚焦卡打开对应盒子（TODO）。
 * 无遮罩 + 卡片只露部分，像半开的抽屉。
 */

// ========== 卡片内容定义 ==========
interface CardDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

const _cards: CardDef[] = [
  { id: 'settings', icon: '\u2699', name: '\u8BBE\u7F6E',        desc: '' },
  { id: 'debug',    icon: '\uD83D\uDD27', name: '\u65E5\u5FD7\u7BA1\u7406', desc: '' },
  { id: 'card03',   icon: '',           name: '',                desc: '' },
  { id: 'card04',   icon: '',           name: '',                desc: '' },
  { id: 'card05',   icon: '',           name: '',                desc: '' },
  { id: 'card06',   icon: '',           name: '',                desc: '' },
  { id: 'card07',   icon: '',           name: '',                desc: '' },
];
export function getCardCount(): number { return _cards.length; }
export function getCard(index: number): CardDef { return _cards[index]; }
export function getCardName(index: number): string { return _cards[index]?.name ?? ''; }
export function getCardId(index: number): string { return _cards[index]?.id ?? ''; }
// ========== 卡片内容生命周期 ==========
// 每张卡片注册 activate/deactivate，展开时激活，折叠时停用。
// 避免展开时重复创建 DOM / 订阅累积的根因级解法。

interface CardContentHandler {
  activate: (contentEl: HTMLElement) => void;
  deactivate: (contentEl: HTMLElement) => void;
}

const _cardHandlers = new Map<string, CardContentHandler>();
// 每个 contentEl 对应一个取消订阅函数，WeakMap 自动随元素销毁回收
const _activeSubs = new WeakMap<HTMLElement, () => void>();

function _registerCardHandler(id: string, handler: CardContentHandler): void {
  _cardHandlers.set(id, handler);
}

_registerCardHandler('debug', {
  activate(contentEl) {
    contentEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%';

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0 4px;flex-shrink:0';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:11px;font-weight:600;color:rgba(0,212,255,0.7)';
    title.textContent = '\u8C03\u8BD5\u65E5\u5FD7';
    header.appendChild(title);

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:6px;flex-shrink:0;margin-left:8px';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '\u590D\u5236';
    copyBtn.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(0,212,255,0.2);background:transparent;color:rgba(0,212,255,0.55)';
    copyBtn.addEventListener('click', copyLogs);
    btnWrap.appendChild(copyBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '\u6E05\u7A7A';
    clearBtn.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(0,212,255,0.2);background:transparent;color:rgba(0,212,255,0.55)';
    clearBtn.addEventListener('click', clearLogs);
    btnWrap.appendChild(clearBtn);

    header.appendChild(btnWrap);
    wrap.appendChild(header);

    // 分隔线
    const line = document.createElement('div');
    line.style.cssText = 'height:1px;flex-shrink:0;background:linear-gradient(90deg,rgba(0,212,255,0.4),rgba(124,58,237,0.3))';
    wrap.appendChild(line);

    // 日志区
    const logArea = document.createElement('div');
    logArea.style.cssText = 'flex:1;overflow-y:auto;font-family:monospace;font-size:10px;color:rgba(224,224,224,0.8);white-space:pre-wrap;word-break:break-all;padding:4px 0';
    wrap.appendChild(logArea);

    contentEl.appendChild(wrap);

    const refresh = () => {
      const logs = getLogs();
      logArea.textContent = logs.length > 0 ? logs.join('\n') : '\uFF08\u7A7A\uFF09';
      logArea.scrollTop = logArea.scrollHeight;
    };
    refresh();
    _activeSubs.set(contentEl, onLog(refresh));
  },
  deactivate(contentEl) {
    const unsub = _activeSubs.get(contentEl);
    if (unsub) { unsub(); _activeSubs.delete(contentEl); }
    contentEl.innerHTML = '';
  },
});
let _currentAccents: Array<{ color1: string; color2: string }> | null = null;

/** HSL → hex （#rrggbb） */
function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, c)));
  };
  const r = f(0), g = f(8), b = f(4);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xFF;
  const g = (num >> 8) & 0xFF;
  const b = num & 0xFF;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/** 每张卡双色独立随机，两色保持一定色相差避免撞色 */
function _generateRandomAccents(): void {
  const accents = [];
  for (let i = 0; i < getCardCount(); i++) {
    const h1 = Math.random() * 360;   // color1（渐变起点）
    // color2 在色环上与 color1 保持 30°–120° 的偏差，避免过于接近或完全随机撞色
    const offset = (30 + Math.random() * 90) * (Math.random() > 0.5 ? 1 : -1);
    const h2 = ((h1 + offset) % 360 + 360) % 360;
    const sat = 45 + Math.random() * 25;
    const lit = 50 + Math.random() * 15;
    accents.push({
      color1: hslToHex(h1, sat, lit),
      color2: hslToHex(h2, sat, lit),
    });
  }
  _currentAccents = accents;
}

/** 从单张卡取双色区域渐变（右上 30% → 左下 70%） */
export function cardGradient(i: number, alpha: number): string {
  const c = _currentAccents![i];
  const a = hexToRgba(c.color1, alpha);
  const b = hexToRgba(c.color2, alpha);
  return "linear-gradient(135deg, " + a + " 30%, " + b + " 70%)";
}

/** 从单张卡的 border 派生卡片内部用色（边框/序号/毛玻璃） */
/** 卡片纯背景 */
export function cardBg(): string {
  return 'rgba(20,16,32,0.92)';
}
// ========== 访问器：供 floating-card.ts 读取本模块数据 ==========
export function getFocusIndex(): number { return _focusIndex; }
export function getCurrentAccent(index: number): { color1: string; color2: string } | undefined { return _currentAccents?.[index]; }
export function getCardHandler(id: string): CardContentHandler | undefined { return _cardHandlers.get(id); }
export function getFocusedCardRect(): DOMRect | undefined { return _cardEls[_focusIndex]?.getBoundingClientRect(); }
export function animateStackPullFeedback(): void { _animateStackPullFeedback(); }

/** 从卡片堆发射聚焦卡 → 浮卡模板 */
export function launchFocusedCard(): void {
  _animateStackPullFeedback();
  const focusIdx = _focusIndex;
  const cardRect = getFocusedCardRect();
  if (!cardRect) return;
  const cc = getCurrentAccent(focusIdx);
  if (!cc) return;

  createFloatingCard({
    id: 'stack-' + focusIdx,
    color1: cc.color1, color2: cc.color2,
    name: getCardName(focusIdx),
    sourceX: cardRect.left, sourceY: cardRect.top,
    scatterBounds: { left: 8, top: 8, right: Math.round(window.innerWidth * 0.7), bottom: window.innerHeight - 56.5 },
    contentHandler: _cardHandlers.get(getCardId(focusIdx)),
  });
}

// ========== 配置 ==========
// ========== 配置 ==========
const CARD_GAP = theme.stack.cardGap;
const CARD_HEIGHT = theme.stack.cardHeight;
const STACK_TOP_RATIO = 0.12;

// ========== z-index ==========
const Z_STACK_BASE = 150;

// ========== 状态 ==========
type StackState = 'closed' | 'opening' | 'open' | 'closing';
let _state: StackState = 'closed';
let _focusIndex = 0;
let _cardEls: HTMLElement[] = [];
let _scrollStartFocus = 0;
let _tl: AnimTimeline | null = null;



// ========== DOM 构建 ==========

function createCard(index: number): HTMLElement {
  const card = getCard(index);
  const cc = _currentAccents![index];
  const grad = cardGradient(index, 0.85);

  // 外层 shell —— 渐变背景 + 1px padding 挤出的边框
  const topPx = Math.round(window.innerHeight * STACK_TOP_RATIO + index * CARD_GAP);
  const el = document.createElement('div');
  el.className = 'stack-card';
  el.dataset.index = String(index);
  el.dataset.randomRight = '0';
  el.dataset.registryId = 'card-stack';
  el.dataset.randomRotate = '0';
  el.style.cssText = [
    'position:fixed',
    'right:0px',
    'top:' + topPx + 'px',
    'width:' + theme.stack.cardWidth + 'px',
    'height:' + CARD_HEIGHT + 'px',
    'border-radius:12px',
    'padding:1px',
    'padding-left:3px',
    'background:' + grad,
    'box-shadow:' + theme.stack.blurShadow,
    'transform:rotate(0deg)',
    'cursor:pointer',
    'z-index:' + (Z_STACK_BASE + index),
    'opacity:1',
    'user-select:none',
    '-webkit-user-select:none',
  ].join(';');

  // 内层 —— 毛玻璃 + 布局 + 内容
  const inner = document.createElement('div');
  inner.style.cssText = [
    'border-radius:11px',
    'width:100%',
    'height:100%',
    'background:' + cardBg(),
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'display:flex',
    'align-items:flex-start',
    'padding:4px 12px',
    'gap:6px',
    'box-sizing:border-box',
  ].join(';');
  inner.innerHTML = ''
    + '<div class="stack-card-icon" style="width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:' + hexToRgba(cc.color1, 0.15) + ';color:' + cc.color1 + '">' + String(index + 1).padStart(2, '0') + '</div>'
    + (card.name ? '<div class="stack-card-name" style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + card.name + '</div>' : '');


  el.appendChild(inner);

  el.addEventListener("click", (e) => {
    const idx = parseInt(el.dataset.index || "0", 10);
    if (idx !== _focusIndex) {
      _focusIndex = idx;
      updateFocus();
    }
  });
  return el;
}

function buildCards(): void {
  log("[CARD-STACK] buildCards called");
  for (let i = 0; i < getCardCount(); i++) {
    const card = createCard(i);
    card.style.transform = 'translateX(100vw)';
    card.style.pointerEvents = 'none';
    document.body.appendChild(card);
    _cardEls.push(card);
  }
  log("[CARD-STACK] buildCards done, cards=" + _cardEls.length);
}

function updateFocus(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dist = Math.abs(i - _focusIndex);
    anim.killTweensOf(el);

    if (dist === 0) {
      anim.to(el, {
        xPercent: 50, x: -28, scale: 1.04, rotation: 0,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.boxShadow = theme.stack.focusShadow;
    } else {
      const randomRotate = parseFloat(el.dataset.randomRotate || '0');
      anim.to(el, {
        xPercent: 50, x: 0, scale: 1, rotation: randomRotate,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.boxShadow = theme.stack.blurShadow;
    }
  }
  // 焦点变化后通知 Registry，确保 ws-channel 推送最新 snapshot
  Registry.notifyStateChange('card-stack');
}

function randomizeCards(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const right = Math.floor(Math.random() * 14) - 4;
    const rot = (Math.random() - 0.5) * 4;
    el.dataset.randomRight = String(right);
    el.dataset.randomRotate = String(rot);
    el.style.right = right + 'px';
    el.style.top = Math.round(window.innerHeight * STACK_TOP_RATIO + i * CARD_GAP) + 'px';
  }
}

function _animateStackPullFeedback(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const origX = i === _focusIndex ? -28 : 0;
    const pullDist = -(Math.random() * 10 + 5);
    const delay = Math.random() * 0.15;
    anim.to(el, {
      x: origX + pullDist,
      duration: 0.2,
      delay: delay,
      ease: 'power2.out',
      onComplete: () => {
        anim.to(el, { x: origX, duration: 0.25, ease: 'back.out(1.2)' });
      },
    });
  }
}

// ========== 卡片堆开/关 ==========
// ========== 卡片堆开/关 ==========

/** 用 _currentAccents 更新所有已存在卡片的 DOM 颜色（动画前调用） */
function _updateCardStyles(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const cc = _currentAccents![i];
    // 更新外层渐变边框
    el.style.background = cardGradient(i, 0.85);
    // 内层的毛玻璃从未变过，不用改
    // 内层中的图标颜色
    const icon = el.querySelector('.stack-card-icon') as HTMLElement | null;
    if (icon) {
      icon.style.background = hexToRgba(cc.color1, 0.15);
      icon.style.color = cc.color1;
    }
  }
}


export function openCardStack(): void {
  if (_state === 'open' || _state === 'opening') return;
  if (_state === 'closing' && _tl) {
    _generateRandomAccents();
    _updateCardStyles();
    _state = 'opening';
    Registry.notifyStateChange('card-stack');
    _tl.reverse();
    return;
  }

  _generateRandomAccents();
  _updateCardStyles();

  _state = 'opening';
  Registry.notifyStateChange('card-stack');
  randomizeCards();

  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    anim.set(el, { x: '100vw', opacity: 1, pointerEvents: 'auto' });
  }

  _tl = anim.timeline({
    onComplete: () => {
      _state = 'open'; _tl = null;
      Registry.notifyStateChange('card-stack');
      for (let i = 0; i < _cardEls.length; i++) {
        const el = _cardEls[i];
        el.style.boxShadow = (i === _focusIndex) ? theme.stack.focusShadow : theme.stack.blurShadow;
      }
    },
    onReverseComplete: () => { _state = 'closed'; _tl = null; Registry.notifyStateChange('card-stack'); }
  });

  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dur = 0.2 + Math.random() * 0.3;
    if (i === _focusIndex) {
      _tl.to(el, { xPercent: 50, x: -28, scale: 1.04, rotation: 0, duration: dur, ease: 'back.out(1.2)' }, 0);
    } else {
      const rot = parseFloat(el.dataset.randomRotate || '0');
      _tl.to(el, { xPercent: 50, x: 0, scale: 1, rotation: rot, duration: dur, ease: 'back.out(1.2)' }, 0);
    }
  }
}

export function closeCardStack(): void {
  if (_state === 'closed' || _state === 'closing') return;
  // 关闭卡片堆时销毁已召唤的浮卡

  if (_state === 'opening' && _tl) {
    _state = 'closing';
    Registry.notifyStateChange('card-stack');
    _tl.reverse();
    return;
  }

  _state = 'closing';
  Registry.notifyStateChange('card-stack');
  _tl = anim.timeline({
    onComplete: () => { _state = 'closed'; _tl = null; Registry.notifyStateChange('card-stack'); },
    onReverseComplete: () => { _state = 'open'; _tl = null; updateFocus(); Registry.notifyStateChange('card-stack'); }
  });

  for (const el of _cardEls) {
    _tl.to(el, { x: '100vw', duration: 0.3, ease: 'power2.in',
      onComplete: () => { el.style.pointerEvents = 'none'; }
    }, 0);
  }
}

export function isCardStackOpen(): boolean {
  return _state === 'open' || _state === 'opening';
}

export function focusNext(): void {
  _focusIndex = (_focusIndex + 1) % getCardCount();
  updateFocus();
}

export function focusPrev(): void {
  _focusIndex = (_focusIndex - 1 + getCardCount()) % getCardCount();
  updateFocus();
}

export function initCardStack(): void {
  _generateRandomAccents();
  buildCards();
  type _AxisLock = 'none' | 'horizontal' | 'vertical';
  let _axisLock: _AxisLock = 'none';
  let _prevDx = 0;

  gestures.register({
    id: 'card-stack-global',
    targetFilter: () => true,
    condition: () => isCardStackOpen(),
    priority: 80,
    onStart: () => {
      _scrollStartFocus = _focusIndex;
      _axisLock = 'none';
      _prevDx = 0;
    },
    onMove: (_e, dx, dy) => {
      if (_axisLock === 'none' && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        _axisLock = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      if (_axisLock === 'horizontal') {
        if (dx < -50 && _prevDx >= -50) { _prevDx = dx; launchFocusedCard(); return; }
        if (dx > 50 && _prevDx <= 50) { _prevDx = dx; closeCardStack(); return; }
        _prevDx = dx;
      } else if (_axisLock === 'vertical') {
        const offset = Math.round(-dy / CARD_GAP);
        const target = _scrollStartFocus + offset;
        const clamped = ((target % getCardCount()) + getCardCount()) % getCardCount();
        if (clamped !== _focusIndex) {
          _focusIndex = clamped;
          updateFocus();
        }
      }
    },
  });


  window.addEventListener('resize', () => {
    randomizeCards();
  });

  // 注册 UI 元素
  Registry.registerElement({
    id: 'card-stack',
    type: 'panel',
    label: '堆叠卡片面板',
    description: '右侧边缘左滑唤出的堆叠卡片面板，展示信息和调试日志',
    state: 'closed',
    enabled: true,
    effect: '打开后显示卡片堆，垂直滑动切换焦点卡片，水平滑动关闭',
    source: 'card-stack.ts',
  }, () => _state);

  // 注册内容层：卡片堆当前焦点摘要（使用生成器，每次 snapshot 返回实时焦点）
  Registry.registerContentGenerator('card-stack-content', () => {
    const card = getCard(_focusIndex);
    const name = card?.name || card?.id || '无';
    const total = getCardCount();
    const filled = Array.from({ length: total }, (_, i) => getCardName(i)).filter(n => n !== '').length;
    return {
      id: 'card-stack-content',
      type: 'card-content',
      summary: `卡片堆: [${_focusIndex + 1}/${total}] ${name}${filled < total ? ` (${filled}张已填充)` : ''}`,
    };
  });

  // 注册 AI 指令处理器
  wsChannel.onCommand('open-card-stack', () => { if (!isCardStackOpen()) openCardStack(); });
  wsChannel.onCommand('close-card-stack', () => { if (isCardStackOpen()) closeCardStack(); });
  wsChannel.onCommand('focus-next-card', () => { focusNext(); });
  wsChannel.onCommand('focus-prev-card', () => { focusPrev(); });
}