import { gestures } from "./gesture-registry.js";
import { collapseOrbPanel } from './orb.js';
import { anim, AnimTimeline, AnimTween } from './animation-registry.js';
import { Registry } from './ui-registry.js';
import { wsChannel } from './ws-channel.js';
import { currentTheme as theme } from './theme.js';
import { createFloatingCard, updateFullscreenSavedPosition } from './floating-card.js';
import { log } from './logger.js';
import { getCardType, getAllCardTypes, type CardContentHandler } from './card-registry.js';
import { Z } from './z-index-layers.js';
import { hslToHex } from './color-utils.js';

/**
 * KFM v4 - 堆叠卡片面板
 *
 * 全屏左滑唤出，所有已注册的 kind:'tool' 卡片按注册顺序堆叠。
 * 无遮罩 + 卡片只露部分，像半开的抽屉。
 */

// ========== 卡片堆显示列表 ==========
// 从注册表读取所有 kind:'tool' 的卡片类型，决定卡片堆的显示顺序。
// 顺序由 registerCardType() 的调用顺序决定（registry.ts 的 import 顺序）。
function _stackCards() { return getAllCardTypes().filter(t => t.kind === 'tool'); }

export function getCardCount(): number { return _stackCards().length; }
export function getCard(index: number) { return _stackCards()[index]; }
export function getCardName(index: number): string { return getCard(index)?.name ?? ''; }
export function getCardId(index: number): string { return getCard(index)?.typeId ?? ''; }
// ========== 卡片内容生命周期 ==========


let _currentAccents: Array<{ color1: string; color2: string }> | null = null;

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
export function getCardHandler(id: string): CardContentHandler | undefined { return getCardType(id)?.createHandler({}); }
export function getFocusedCardRect(): DOMRect | undefined { return _cardEls[_focusIndex]?.getBoundingClientRect(); }
export function animateStackPullFeedback(): void { _animateStackPullFeedback(); }

/** 从卡片堆发射聚焦卡 → 浮卡模板 */
export function launchFocusedCard(fullscreen?: boolean): void {
  // 全屏发射时不启动拉动动画（即将关堆，无意义）
  if (!fullscreen) _animateStackPullFeedback();
  const focusIdx = _focusIndex;
  const cardRect = getFocusedCardRect();
  if (!cardRect) return;
  const cc = getCurrentAccent(focusIdx);
  if (!cc) return;

  const item = createFloatingCard({
    id: 'stack-' + focusIdx,
    typeId: getCardId(focusIdx),
    color1: cc.color1, color2: cc.color2,
    name: getCardName(focusIdx),
    sourceX: cardRect.left, sourceY: cardRect.top,
    scatterBounds: { left: 8, top: 8, right: Math.round(window.innerWidth * 0.7), bottom: window.innerHeight - 56.5 },
    contentHandler: getCardType(getCardId(focusIdx))?.createHandler({}),
    ...(fullscreen ? { startInFullscreen: true } : {}),
  });

  // 全屏发射时，将保存位置改为随机散落位置（避免退出全屏回到右侧）
  if (fullscreen && item) updateFullscreenSavedPosition(item);
}

// ========== 配置 ==========
// ========== 配置 ==========
const CARD_GAP = theme.stack.cardGap;
const CARD_HEIGHT = theme.stack.cardHeight;
const STACK_TOP_RATIO = 0.12;

// ========== z-index ==========
const Z_STACK_BASE = Z.STACK_BASE;

// ========== 状态 ==========
type StackState = 'closed' | 'opening' | 'open' | 'closing';
let _state: StackState = 'closed';
let _focusIndex = 0;
let _cardEls: HTMLElement[] = [];
let _scrollStartFocus = 0;
let _tl: AnimTimeline | null = null;
/** pull 反馈补间句柄（GHOST-04：opening→closing 反向关堆时只杀它、不杀 _tl） */
let _pullTweens: AnimTween[] = [];




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
      // 聚焦动画 + 投全屏卡同时开始，聚焦动画完成后关闭卡片堆
      launchFocusedCard(true);
      collapseOrbPanel(); // 手动点击投全屏 → 联动折叠面板（AI 召唤路径不经过此）
      updateFocus(() => { closeCardStack(); });
    } else {
      // 已聚焦 → 直接投卡 + 关闭
      launchFocusedCard(true);
      collapseOrbPanel();
      closeCardStack();
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

function updateFocus(onComplete?: () => void): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dist = Math.abs(i - _focusIndex);
    anim.killTweensOf(el);

    if (dist === 0) {
      anim.to(el, {
        xPercent: 50, x: -28, scale: 1.04, rotation: 0,
        duration: 0.35, ease: 'back.out(1.2)',
        onComplete: onComplete,
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
    // 两段补间都要登记：GHOST-04 要求在 opening→closing 反向关堆时精确杀掉它们
    // （不能用 killTweensOf——会连带杀掉 _tl 内部补间 → GHOST-02 空壳 timeline 卡死）
    _pullTweens.push(anim.to(el, {
      x: origX + pullDist,
      duration: 0.2,
      delay: delay,
      ease: 'power2.out',
      onComplete: () => {
        _pullTweens.push(anim.to(el, { x: origX, duration: 0.25, ease: 'back.out(1.2)' }));
      },
    }));
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
    // 反向重开：卡片就在屏幕上，绝不能重新随机配色（可见跳色）。
    // 沿用本次打开时已生成的 _currentAccents，观感一致。
    _state = 'opening';
    Registry.notifyStateChange('card-stack');
    _tl.reverse();
    return;
  }

  _generateRandomAccents();
  _updateCardStyles();

  // 状态迁移先清理在途补间（BAR-CARD-GHOST-01 不变量；closing→opening 的反向分支
  // 走 _tl.reverse() 不在此列——杀掉会取消反向）
  killAllCardTweens();

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

/** 状态迁移不变量：先清理所有卡片的在途补间，再启动新动画。
 *  教训 BAR-CARD-GHOST-01（2026-08-02）：左滑投卡路径的 pull 反馈回弹补间
 *  与关闭动画竞态，关闭完成后把卡片拉回展开位 → 幽灵堆。任何 opening/closing
 *  迁移前必须调用本函数——「迁移先杀在途」是硬规则，不是可选项。
 *  本函数顺带清空 _pullTweens 登记（killTweensOf 已按元素全杀，句柄随之失效）。 */
function killAllCardTweens(): void {
  for (const el of _cardEls) anim.killTweensOf(el);
  _pullTweens = [];
}

/** 只杀 pull 反馈补间、不碰 _tl 内部补间（BAR-CARD-GHOST-04）。
 *  GHOST-01 与 GHOST-02 两条不变量曾互斥留下缝隙：opening→closing 反向分支
 *  不敢杀任何补间，于是 opening 窗口内左滑投卡启动的 pull 回弹在 reverse 完成
 *  （state→closed）之后才触发，把卡片拉回展开位 → 幽灵堆第六次复发。
 *  句柄级追踪让两条不变量共存：反向分支杀 pull（GHOST-01 意图），_tl 完好
 *  （GHOST-02 意图）。 */
function killPullTweens(): void {
  for (const t of _pullTweens) t.kill();
  _pullTweens = [];
}

export function closeCardStack(): void {
  if (_state === 'closed' || _state === 'closing') return;

  // opening→closing 走 _tl.reverse() 反向播放，绝不能杀在途补间——killTweensOf
  // 会把 _tl 内部补间一并杀掉，空壳 timeline 的 reverse 永不触发 onReverseComplete，
  // 状态永远卡在 'closing' → 幽灵堆（BAR-CARD-GHOST-02）。与 openCardStack 的
  // closing→opening 反向分支对称。
  // 但 pull 反馈补间必须精确杀掉（GHOST-04）：它作用在同一批 DOM 上、却不属于 _tl，
  // 若放任不管，回弹会在 reverse 完成（state→closed）之后把卡片拉回展开位 → 幽灵堆。
  if (_state === 'opening' && _tl) {
    killPullTweens();
    _state = 'closing';
    Registry.notifyStateChange('card-stack');
    _tl.reverse();
    return;
  }

  // 全量关闭分支才清理在途补间（BAR-CARD-GHOST-01：pull 反馈回弹与关闭动画竞态）
  killAllCardTweens();
  // 关闭卡片堆时销毁已召唤的浮卡

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
    targetFilter: (target: HTMLElement) => {
      // 放行：卡片内容区内有 cursor:grab 的拖拽柄（角色卡文件排序等）
      const inCard = target.closest('.stack-card');
      if (inCard && target.closest('[style*="cursor:grab"]')) return false;
      return true;
    },
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
        if (dx < -50 && _prevDx >= -50) { _prevDx = dx; launchFocusedCard(false); closeCardStack(); return; }
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
    onEnd: (e, dx, dy) => {
      // 堆外 tap（未形成滑动的点击）→ 关堆。堆内卡片的点击走卡自身 click 投卡，不在此拦截
      if (_axisLock !== 'none') return;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
      const t = e.target as HTMLElement | null;
      if (t && typeof t.closest === 'function' && t.closest('.stack-card')) return;
      // 豁免召唤按钮：它是控件不是「堆外空白」。否则 onEnd 先关堆（state→closing），
      // 紧随的按钮 click 看到 isCardStackOpen()=false 又会重开 → 关 → 秒重开，
      // 表现为「按钮点了关不上」（BAR-CARD-GHOST-03 双重触发竞态）。
      if (t && typeof t.closest === 'function' && t.closest('#cardStackToggleBtn')) return;
      closeCardStack();
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
    const name = card?.name || card?.typeId || '无';
    const total = getCardCount();
    const filled = Array.from({ length: total }, (_, i) => getCardName(i)).filter(n => n !== '').length;
    return {
      id: 'card-stack-content',
      type: 'card-content',
      summary: `卡片堆: [${_focusIndex + 1}/${total}] ${name}${filled < total ? ` (${filled}张已填充)` : ''}`,
      detail: {
        visible: isCardStackOpen(),
        focus: _focusIndex + 1,          // 1-based，与 summary 一致
        count: total,
        list: Array.from({ length: total }, (_, i) => `${String(i + 1).padStart(2, '0')}${getCardName(i)}`),
      },
    };
  });

  // 注册 AI 指令处理器
  wsChannel.onCommand('open-card-stack', () => { if (!isCardStackOpen()) openCardStack(); });
  wsChannel.onCommand('close-card-stack', () => { if (isCardStackOpen()) closeCardStack(); });
  wsChannel.onCommand('focus-next-card', () => { focusNext(); });
  wsChannel.onCommand('focus-prev-card', () => { focusPrev(); });
}