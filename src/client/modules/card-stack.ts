import { gestures } from "./gesture-registry.js";
import { anim, AnimTimeline } from './animation-registry.js';
import { currentTheme as theme } from './theme.js';

/**
 * KFM v4 - 堆叠卡片面板
 *
 * 全屏左滑唤出，7 张卡片按星云光谱堆叠。
 * 垂直滑动切换聚焦卡片，点击聚焦卡打开对应盒子（TODO）。
 * 无遮罩 + 卡片只露部分，像半开的抽屉。
 */

// ========== 卡片内容定义 ==========
const CARD_BG = theme.stack.cardBg;  // 深色毛玻璃底

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

// ========== 星云配色 (Nebula) ==========
const CARD_COLORS = theme.cardAccents;

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
  // 循环色谱：首尾相连，形成闭合色环
  const prevIdx = (i - 1 + n) % n;
  const nextIdx = (i + 1) % n;
  const prev = hexToRgba(CARD_COLORS[prevIdx].border, alpha);
  const next = hexToRgba(CARD_COLORS[nextIdx].border, alpha);
  return [prev, mainRgba, next];
}

/** 生成左边框垂直渐变：三色从上到下均匀过渡，卡片堆叠时可见区域三色均衡 */
function getBorderGradient(i: number, alpha: number): string {
  const [c1, c2, c3] = getTriple(i, alpha);
  // 对角线渐变：33%→上缘左1/3处过渡到c2，50%→左缘中点处过渡到c3
  return "linear-gradient(to bottom right, " + c1 + " 0%, " + c2 + " 33%, " + c3 + " 50%)";
}

// ========== 配置 ==========
/** 卡片垂直间距 px */
const CARD_GAP = theme.stack.cardGap;
/** 卡片高度 px */
const CARD_HEIGHT = theme.stack.cardHeight;
/** 堆叠起始位置（距顶部比例） */
const STACK_TOP_RATIO = 0.12;

// ========== 状态 ==========
// 状态机：closed → opening → open → closing → closed
type StackState = 'closed' | 'opening' | 'open' | 'closing';
let _state: StackState = 'closed';
let _focusIndex = 0;
let _cardEls: HTMLElement[] = [];
let _scrollStartFocus = 0;
let _tl: AnimTimeline | null = null;

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
  const borderGrad = getBorderGradient(index, alpha);

  // 多层阴影：立体感，像桌面上的物件
  const shadow = [
    theme.stack.blurShadow
  ].join(',');

  el.style.cssText = [
    'position:fixed',
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
    'background: linear-gradient(' + CARD_BG + ',' + CARD_BG + ') padding-box, ' + borderGrad + ' border-box',
    'box-shadow:' + shadow,
    'transform:rotate(' + randomRotate + 'deg)',
    'cursor:pointer',
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
function buildCards(): void {
  console.log("[CARD-STACK] buildCards called");
  for (let i = 0; i < CARDS.length; i++) {
    const card = createCard(i);
    // 初始状态：屏幕外，不可交互
    card.style.transform = 'translateX(100vw)';
    card.style.pointerEvents = 'none';
    document.body.appendChild(card);
    _cardEls.push(card);
  }
  console.log("[CARD-STACK] buildCards done, cards=", _cardEls.length);
}

function updateFocus(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dist = Math.abs(i - _focusIndex);

    // kill 旧 tween 防止竞态
    anim.killTweensOf(el);

    const alpha = 0.85;

    if (dist === 0) {
      // 聚焦：左移更多、取消旋转、增强阴影
      anim.to(el, {
        xPercent: 35, x: -20, scale: 1.04, rotation: 0,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.backdropFilter = 'blur(16px)';
      (el.style as any).webkitBackdropFilter = 'blur(16px)';
      el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
      el.style.boxShadow = theme.stack.focusShadow;
      const idxEl = el.querySelector('.stack-card-index') as HTMLElement;
      if (idxEl) idxEl.style.opacity = '0.8';
    } else {
      // 非聚焦：恢复随机旋转、普通阴影
      const randomRotate = parseFloat(el.dataset.randomRotate || '0');
      anim.to(el, {
        xPercent: 35, x: 0, scale: 1, rotation: randomRotate,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.backdropFilter = 'blur(16px)';
      (el.style as any).webkitBackdropFilter = 'blur(16px)';
      el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
      el.style.boxShadow = theme.stack.blurShadow;
      const idxEl = el.querySelector('.stack-card-index') as HTMLElement;
      if (idxEl) idxEl.style.opacity = '0.3';
    }
  }
}

// ========== 窗口自适应 ==========
function repositionCards(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    _cardEls[i].style.top = Math.round(window.innerHeight * STACK_TOP_RATIO + i * CARD_GAP) + 'px';
  }
}

// ========== 公开 API ==========

export function openCardStack(): void {
  // 状态机守卫
  if (_state === 'open' || _state === 'opening') return;

  // 如果正在关闭中 → reverse 回去（从当前位置丝滑反弹）
  if (_state === 'closing' && _tl) {
    _state = 'opening';
    _tl.reverse();
    return;
  }

  _state = 'opening';
  repositionCards();

  // 设置初始状态：屏幕外
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    anim.set(el, { x: '100vw', opacity: 1, pointerEvents: 'auto' });
  }

  // 构建 GSAP timeline：同时出发，随机速度 200-500ms，Q弹曲线
  _tl = anim.timeline({
    onComplete: () => {
      _state = 'open'; _tl = null;
      // 只应用样式，不做二次动画（卡片已在最终位置）
      const alpha = 0.85;
      for (let i = 0; i < _cardEls.length; i++) {
        const el = _cardEls[i];
        el.style.backdropFilter = 'blur(16px)';
        (el.style as any).webkitBackdropFilter = 'blur(16px)';
        el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
        el.style.boxShadow = (i === _focusIndex) ? theme.stack.focusShadow : theme.stack.blurShadow;
        const idxEl = el.querySelector('.stack-card-index') as HTMLElement;
        if (idxEl) idxEl.style.opacity = (i === _focusIndex) ? '0.8' : '0.3';
      }
    },
    onReverseComplete: () => { _state = 'closed'; _tl = null; }
  });

  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dur = 0.2 + Math.random() * 0.3;
    if (i === _focusIndex) {
      _tl.to(el, {
        xPercent: 35, x: -20, scale: 1.04, rotation: 0,
        duration: dur, ease: 'back.out(1.2)',
      }, 0);
    } else {
      const rot = parseFloat(el.dataset.randomRotate || '0');
      _tl.to(el, {
        xPercent: 35, x: 0, scale: 1, rotation: rot,
        duration: dur, ease: 'back.out(1.2)',
      }, 0);
    }
  }
}

export function closeCardStack(): void {
  if (_state === 'closed' || _state === 'closing') return;

  // 如果正在打开中 → reverse 回去
  if (_state === 'opening' && _tl) {
    _state = 'closing';
    _tl.reverse();
    return;
  }

  _state = 'closing';

  // 构建关闭 timeline
  _tl = anim.timeline({
    onComplete: () => { _state = 'closed'; _tl = null; },
    onReverseComplete: () => { _state = 'open'; _tl = null; updateFocus(); }
  });

  for (const el of _cardEls) {
    _tl.to(el, {
      x: '100vw',
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => { el.style.pointerEvents = 'none'; }
    }, 0);
  }
}

export function isCardStackOpen(): boolean {
  return _state === 'open' || _state === 'opening';
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
  buildCards();
  // 全局切卡手势（通过 GestureRegistry 管理）
  // 右滑关闭卡片堆、左滑预留、上下平滑切卡
  gestures.register({
    id: 'card-stack-global',
    targetFilter: () => true,
    condition: () => isCardStackOpen(),
    priority: 80,
    onStart: () => {
      _scrollStartFocus = _focusIndex;
    },
    onMove: (e, dx, dy) => {
      // 右滑：水平主导时关闭卡片堆
      if (dx > 50 && dx > Math.abs(dy)) { closeCardStack(); return; }
      // 上下：连续平滑切卡，映射滑动距离到卡片索引
      const offset = Math.round(-dy / CARD_GAP);
      const target = _scrollStartFocus + offset;
      const clamped = Math.max(0, Math.min(CARDS.length - 1, target));
      if (clamped !== _focusIndex) {
        _focusIndex = clamped;
        updateFocus();
      }
    },
  });
  window.addEventListener('resize', () => {
    repositionCards();
  });
}

