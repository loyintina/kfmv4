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
let _floatingCardEl: HTMLElement | null = null;  // 浮卡（从卡片堆发射到中央）

// ========== DOM 构建 ==========


function createCard(index: number): HTMLElement {
  const card = CARDS[index];
  const color = CARD_COLORS[index];

  const el = document.createElement('div');
  el.className = 'stack-card';
  el.dataset.index = String(index);

  const topPx = Math.round(window.innerHeight * STACK_TOP_RATIO + index * CARD_GAP);

  // 随机值由 randomizeCards() 在每次 open 前生成，初始设默认
  el.dataset.randomRight = '0';
  el.dataset.randomRotate = '0';

  // 三色渐变边框
  const alpha = 0.85;
  const borderGrad = getBorderGradient(index, alpha);

  // 多层阴影：立体感，像桌面上的物件
  const shadow = [
    theme.stack.blurShadow
  ].join(',');

  el.style.cssText = [
    'position:fixed',
    'right:0px',
    'top:' + topPx + 'px',
    'width:155px',
    'height:' + CARD_HEIGHT + 'px',
    'border-radius:12px',
    'padding:4px 12px',
    'display:flex',
    'align-items:flex-start',
    'gap:6px',
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'border:1px solid transparent',
    'border-left-width:3px',
    'background: linear-gradient(' + CARD_BG + ',' + CARD_BG + ') padding-box, ' + borderGrad + ' border-box',
    'box-shadow:' + shadow,
    'transform:rotate(0deg)',
    'cursor:pointer',
    'z-index:' + (10 + index),
    'opacity:1',
    'user-select:none',
    '-webkit-user-select:none',
  ].join(';');

  el.innerHTML = ''
    + '<div class="stack-card-icon" style="width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;background:' + color.iconBg + ';color:' + color.border + '">' + String(index + 1).padStart(2, '0') + '</div>'
    + '<div class="stack-card-info" style="flex:1;min-width:0">'
    + '  <div class="stack-card-name" style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + card.name + '</div>'
    + '  <div class="stack-card-desc" style="font-size:10px;opacity:0.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0px">' + card.desc + '</div>'
    + '</div>';

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
        xPercent: 0, x: -28, scale: 1.04, rotation: 0,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.backdropFilter = 'blur(16px)';
      (el.style as any).webkitBackdropFilter = 'blur(16px)';
      el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
      el.style.boxShadow = theme.stack.focusShadow;
    } else {
      // 非聚焦：恢复随机旋转、普通阴影
      const randomRotate = parseFloat(el.dataset.randomRotate || '0');
      anim.to(el, {
        xPercent: 0, x: 0, scale: 1, rotation: randomRotate,
        duration: 0.35, ease: 'back.out(1.2)',
      });
      el.style.backdropFilter = 'blur(16px)';
      (el.style as any).webkitBackdropFilter = 'blur(16px)';
      el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
      el.style.boxShadow = theme.stack.blurShadow;
    }
  }
}

// ========== 窗口自适应 + 随机化 ==========
function randomizeCards(): void {
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const right = Math.floor(Math.random() * 14) - 4;        // -4 ~ +10px（微错位）
    const rot = (Math.random() - 0.5) * 4;                   // -2deg ~ +2deg
    el.dataset.randomRight = String(right);
    el.dataset.randomRotate = String(rot);
    el.style.right = right + 'px';
    el.style.top = Math.round(window.innerHeight * STACK_TOP_RATIO + i * CARD_GAP) + 'px';
  }
}

// ========== 浮卡（从卡片堆发射到中央） ==========

const FLOATING_CARD_W = 155;
const FLOATING_CARD_H = 68;

/** 创建四角装饰框 — 不透明彩色边框 + 中心符号 */
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
  // 从 rgba(r,g,b,alpha) 中提取 RGB 分量
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  const glowC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.85)' : color;
  const glowM = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.35)' : color;
  const shadowC1 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.4)' : color;
  const shadowC2 = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',0.15)' : color;
  const symA = m && m[4] !== undefined ? m[4] : '0.9';
  const symC = m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + symA + ')' : color;
  // 光球背景 + 符号（使用 tri 色系）
  box.innerHTML =
    '<div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 30% 30%,' + glowC + ',' + glowM + ',transparent 70%);box-shadow:0 0 10px 4px ' + shadowC1 + ',0 0 20px 8px ' + shadowC2 + '"></div>' +
    '<div style="display:flex;align-items:center;justify-content:center;color:' + symC + ';-webkit-mask:linear-gradient(135deg,#000 30%,transparent 100%);mask:linear-gradient(135deg,#000 30%,transparent 100%)">' + svgInner + '</div>';
  return box;
}

/** 发射聚焦卡片到屏幕中央成为浮卡 */
export function launchFocusedCard(): void {
  // 如果已有浮卡，先移除
  dismissFloatingCard();

  const focusedCard = _cardEls[_focusIndex];
  if (!focusedCard) return;

  // 获取聚焦卡当前位置（作为动画起点）
  const cardRect = focusedCard.getBoundingClientRect();
  const color = CARD_COLORS[_focusIndex];

  // 创建浮卡容器
  const el = document.createElement('div');
  el.className = 'floating-card';
  el.dataset.index = String(_focusIndex);

  // 克隆卡片内容
  const iconClone = focusedCard.querySelector('.stack-card-icon')?.cloneNode(true) as HTMLElement;
  const infoClone = focusedCard.querySelector('.stack-card-info')?.cloneNode(true) as HTMLElement;

  // 四角装饰框颜色 — 与卡片左边框渐变的顶点同色
  const [triPrev, triMain, triNext] = getTriple(_focusIndex, 1);
  const tlDim = triPrev.replace(/,\s*1\)$/, ',0.5)');

  // 四角光球 — 置于顶层（类似主光球在面板之上的逻辑）
  const cornerSize = 26;
  const cornerOff = -13;
  const rightOff = cornerOff + 1;
  const bottomOff = cornerOff - 1;

  // 毛玻璃背景层（在内容之下）
  const cardBg = document.createElement('div');
  cardBg.style.cssText = [
    'position:absolute',
    'inset:0',
    'border-radius:12px',
    'border:1px solid transparent',
    'border-left-width:3px',
    'background: linear-gradient(' + CARD_BG + ',' + CARD_BG + ') padding-box, linear-gradient(to bottom right, ' + triPrev + ' 0%, ' + triMain + ' 33%, ' + triNext + ' 50%) border-box',
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'pointer-events:none',
  ].join(';');
  el.appendChild(cardBg);

  // 数字+文字内容（居中）
  const content = document.createElement('div');
  content.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;pointer-events:none';
  if (iconClone) {
    iconClone.style.width = '36px';
    iconClone.style.height = '36px';
    iconClone.style.fontSize = '16px';
    content.appendChild(iconClone);
  }
  if (infoClone) content.appendChild(infoClone);
  el.appendChild(content);

  // 四角光球置于顶层（浮卡内容之上，与主光球在面板之上的逻辑一致）
  el.appendChild(createDecoratedCorner(cornerOff, cornerOff, cornerSize, cornerSize, tlDim,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-0.52,-0.52) scale(0.92)"><path d="M6,10 L6,2 M6,2 L3,5 M6,2 L9,5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>'));
  el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, cornerOff, cornerSize, cornerSize, triMain,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1.48,-0.52) scale(0.92)"><line x1="4" y1="2" x2="10" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="10" y1="2" x2="4" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></g></svg>'));
  el.appendChild(createDecoratedCorner(cornerOff, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, triMain,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-0.52,1.48) scale(0.92)"><path d="M6,2 L6,10 M6,10 L3,7 M6,10 L9,7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>'));
  el.appendChild(createDecoratedCorner(FLOATING_CARD_W - rightOff - cornerSize, FLOATING_CARD_H - bottomOff - cornerSize, cornerSize, cornerSize, triNext,
    '<svg width="14" height="14" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1.48,1.48) scale(0.92)"><path d="M6,2 L6,10 M2,6 L10,6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g></svg>'));

  // 浮卡样式（毛玻璃移至 cardBg 子层）
  el.style.cssText = [
    'position:fixed',
    'left:' + cardRect.left + 'px',
    'top:' + cardRect.top + 'px',
    'width:' + FLOATING_CARD_W + 'px',
    'height:' + FLOATING_CARD_H + 'px',
    'pointer-events:auto',
    'z-index:300',
    'opacity:0',
  ].join(';');

  document.body.appendChild(el);
  _floatingCardEl = el;

  // 计算目标位置：屏幕居中
  const targetLeft = Math.round((window.innerWidth - FLOATING_CARD_W) / 2);
  const targetTop = Math.round((window.innerHeight - FLOATING_CARD_H) / 2);

  // GSAP 飞行动画（从当前位置飞到屏幕中央）
  anim.set(el, { scale: 0.8 });
  anim.to(el, {
    left: targetLeft,
    top: targetTop,
    opacity: 1,
    scale: 1,
    duration: 0.4,
    ease: 'back.out(1.3)',
  });
}

/** 销毁浮卡 */
export function dismissFloatingCard(): void {
  if (_floatingCardEl) {
    anim.killTweensOf(_floatingCardEl);
    _floatingCardEl.remove();
    _floatingCardEl = null;
  }
}

/** 是否有浮卡 */
export function hasFloatingCard(): boolean {
  return _floatingCardEl !== null;
}

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
  randomizeCards();

  // 设置初始状态：屏幕外
  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    anim.set(el, { x: '100vw', opacity: 1, pointerEvents: 'auto' });
  }

  // 构建 GSAP timeline：同时出发，随机速度 200-500ms，Q弹曲线
  _tl = anim.timeline({
    onComplete: () => {
      _state = 'open'; _tl = null;
      const alpha = 0.85;
      for (let i = 0; i < _cardEls.length; i++) {
        const el = _cardEls[i];
        el.style.backdropFilter = 'blur(16px)';
        (el.style as any).webkitBackdropFilter = 'blur(16px)';
        el.style.background = 'linear-gradient(' + theme.stack.cardBg + ',' + theme.stack.cardBg + ') padding-box, ' + getBorderGradient(i, alpha) + ' border-box';
        el.style.boxShadow = (i === _focusIndex) ? theme.stack.focusShadow : theme.stack.blurShadow;
      }
    },
    onReverseComplete: () => { _state = 'closed'; _tl = null; }
  });

  for (let i = 0; i < _cardEls.length; i++) {
    const el = _cardEls[i];
    const dur = 0.2 + Math.random() * 0.3;
    if (i === _focusIndex) {
      _tl.to(el, {
        x: -28, scale: 1.04, rotation: 0,
        duration: dur, ease: 'back.out(1.2)',
      }, 0);
    } else {
      const rot = parseFloat(el.dataset.randomRotate || '0');
      _tl.to(el, {
        x: 0, scale: 1, rotation: rot,
        duration: dur, ease: 'back.out(1.2)',
      }, 0);
    }
  }
}

export function closeCardStack(): void {
  if (_state === 'closed' || _state === 'closing') return;

  // 关闭时销毁浮卡
  dismissFloatingCard();

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
  _focusIndex = (_focusIndex + 1) % CARDS.length;
  updateFocus();
}

export function focusPrev(): void {
  _focusIndex = (_focusIndex - 1 + CARDS.length) % CARDS.length;
  updateFocus();
}

export function initCardStack(): void {
  buildCards();
  // 全局切卡手势（通过 GestureRegistry 管理）
  // 右滑关闭卡片堆、左滑预留、上下平滑切卡
  // 轴向锁：一次手势只处理一个方向，避免斜滑误触
  type _AxisLock = 'none' | 'horizontal' | 'vertical';
  let _axisLock: _AxisLock = 'none';

  gestures.register({
    id: 'card-stack-global',
    targetFilter: () => true,
    condition: () => isCardStackOpen(),
    priority: 80,
    onStart: () => {
      _scrollStartFocus = _focusIndex;
      _axisLock = 'none';
    },
    onMove: (e, dx, dy) => {
      // 锁定轴向：首次移动超过阈值时判定主导方向
      if (_axisLock === 'none' && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        _axisLock = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      if (_axisLock === 'horizontal') {
        // 左滑：发射聚焦卡到中央成为浮卡
        if (dx < -50) { launchFocusedCard(); return; }
        // 右滑：关闭卡片堆
        if (dx > 50) { closeCardStack(); return; }
      } else if (_axisLock === 'vertical') {
        // 上下滑动：连续平滑切卡
        const offset = Math.round(-dy / CARD_GAP);
        const target = _scrollStartFocus + offset;
        const clamped = ((target % CARDS.length) + CARDS.length) % CARDS.length;
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
}

