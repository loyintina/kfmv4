/**
 * terminal-card-04.ts — 03 号终端卡 xterm.js 集成
 *
 * 职责边界：
 *   通用终端基础设施。负责 xterm.js 终端的全生命周期管理——创建、挂载、滚动、销毁。
 *   不关心终端里跑的是什么（bash/tmux/其他）。业务逻辑层（如 tmux session 管理）在 card04 tmux-card.ts。
 *
 * 生命周期：
 *   init（首次打开）
 *     ↓ initTerminalCore()  → 新建 Terminal + FitAddon + WS 事件绑定
 *   active
 *     ↓ 点击 BR 光球 compact
 *   compact（DOM 拔除 → Terminal 对象 + WS 连接保留）
 *     ↓ 点击 BR 光球 activate
 *   active（appendChild 插回 DOM → 重建 ResizeObserver）
 *     ↓ 点击 TR 光球 dismiss
 *   disposeTerminalCore() → 完整销毁
 *
 * 关键设计决策：
 *   1. compact 只拔 DOM 不销毁终端对象——即缩回再展开时，输出不中断、连接不重连。
 *   2. init 和 compact→active 两条路径走同一个入口 initTerminalCore()，
 *      通过 card.meta._term 是否存在来区分（存在=复挂，不存在=新建）。
 *   3. 滚动手势检测 xterm 内部的 coreMouseService：
 *      - 若 tmux 已启用 mouse protocol（SGR/X10）→ 编码 SGR 序列发 WS，让 tmux 自己滚动
 *      - 若 mouse protocol 为 NONE → 调 term.scrollLines() 直接滚动
 *      这个判断是动态的——因为 tmux 接管后 scrollLines 不再有效。
 *
 * 导出接口：
 *   initTerminalCore()    — card03 + card04 共用：init / compact→active 复挂
 *   disposeTerminalCore() — dismiss 时完整销毁
 *   compactTerminalCore() — active→compact：拔 DOM、断 observer，保留 Terminal + WS
 *   createTerminal04Handler() — 注册 card03 的 CardContentHandler
 *
 * meta 字段（_ 前缀为内部用）：
 *   terminalId: number     — cardRegistry.allocId('card03') 分配
 *   sessionId: string      — WS 会话 ID
 *   _term: Terminal        — xterm 实例
 *   _fit: FitAddon         — 自动尺寸适配
 *   _xtermEl: HTMLElement  — 挂 touch-action: none 的 .xterm 元素
 *   _termEl: HTMLElement   — 终端 DOM 容器
 *   _observer: ResizeObserver — 窗口/卡片大小变化时 fit()
 *   _onOutput: function    — WS terminal-output 回调（offMessage 时用）
 *   _onExit: function      — WS terminal-exit 回调
 *   _onOpened: function    — WS terminal-opened 回调
 *   _openTag: string       — terminal-open 请求标识（用于匹配回复）
 *   _welcomed: boolean     — 欢迎语只打印一次
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { cardRegistry, type CardInstance, type CardContentHandler } from './card-registry.js';
import { gestures } from './gesture-registry.js';
import { log } from './logger.js';
import { currentTheme } from './theme.js';
import { openSidebar } from './ui.js';
import { openCardStack } from './card-stack.js';
import { Z } from './z-index-layers.js';

// ========== 终端卡 meta 类型定义 ==========

export interface TerminalCardMeta {
  terminalId?: number;
  sessionId?: string;
  _term?: Terminal;
  _fit?: FitAddon;
  _xtermEl?: HTMLElement;
  _termEl?: HTMLElement;
  _observer?: ResizeObserver;
  _onOutput?: (p: unknown) => void;
  _onExit?: (p: unknown) => void;
  _onOpened?: (p: unknown) => void;
  _onReconnect?: () => void;   // WS 重连后重新打开 PTY 的回调
  _openTag?: string;
  _welcomed?: boolean;
  _selfHeal?: ReturnType<typeof setInterval>;
  _onVisible?: () => void; // 锁屏恢复：强制重绘+fit
  _pinTimer?: ReturnType<typeof setTimeout>; // 贴底 debounce timer（onOutput 防抖用）
  _tmuxSettling?: number; // tmux 卡 attach/重入/IME resize 后强制贴底 settle 截止时间戳
  _settleBuffer?: string; // tmux settle 期间输出缓存（批量写入，避免逐 chunk 慢滚）
  _settleFlushTimer?: ReturnType<typeof setTimeout>; // settle buffer idle flush 定时器
  _settleFlushMaxTimer?: ReturnType<typeof setTimeout>; // settle buffer 硬上限 flush 定时器
}

/** 窄化守卫：将通用 CardInstance 窄化为 TerminalCardMeta 特化。全文件唯一 as 逃逸。 */
/** fit 健壮化：多阶段（立即 + rAF + 150ms 延迟）——覆盖浮动卡动画中途的中间尺寸 */
// 智能贴底钩子（2026-08-23）：fit/resize 后若视口已跟随底部（viewportY>=baseY-1）就钉回底，
// 否则不钉（尊重用户上滚）。由各终端 mount 时赋值；robustFit 末尾统一调用，覆盖所有 fit 路径。
let _pinBottomIfFollowing: (() => void) | null = null;
function robustFit(fit: FitAddon) {
  try { fit.fit(); } catch {}
  requestAnimationFrame(() => { try { fit.fit(); } catch {} });
  setTimeout(() => {
    try { fit.fit(); } catch {}
    try { _pinBottomIfFollowing?.(); } catch {}
  }, 150);
}

/** 半屏自愈：低频校验容器高度 vs canvas 高度，偏差 >20% re-fit（错过 resize 也能自愈） */
function startSelfHeal(tc: CardInstance<TerminalCardMeta>, fit: FitAddon) {
  if (tc.meta._selfHeal) clearInterval(tc.meta._selfHeal);
  tc.meta._selfHeal = setInterval(() => {
    try {
      const el = tc.meta._termEl;
      const canvas = el?.querySelector('.xterm canvas') as HTMLElement | null;
      if (!el || !canvas) return;
      const containerH = el.clientHeight;
      const canvasH = canvas.clientHeight;
      if (containerH > 40 && canvasH > 0 && Math.abs(containerH - canvasH) / containerH > 0.2) {
        fit.fit();
      }
    } catch {}
  }, 60_000);
}

/** tmux settle 缓冲 flush：把缓存的输出一次性写入 xterm 并立即贴底 */
function flushTmuxSettleBuffer(tc: CardInstance<TerminalCardMeta>, term: Terminal) {
  if (!tc.meta._settleBuffer) return;
  const buf = tc.meta._settleBuffer;
  tc.meta._settleBuffer = '';
  try {
    term.write(buf);
    term.scrollToBottom();
  } catch { /* noop */ }
}

/** 清理 settle 相关定时器 */
function clearSettleTimers(tc: CardInstance<TerminalCardMeta>) {
  if (tc.meta._settleFlushTimer) {
    clearTimeout(tc.meta._settleFlushTimer);
    tc.meta._settleFlushTimer = undefined;
  }
  if (tc.meta._settleFlushMaxTimer) {
    clearTimeout(tc.meta._settleFlushMaxTimer);
    tc.meta._settleFlushMaxTimer = undefined;
  }
}

/** settle 期输出缓存调度：idle 80ms 刷新，硬上限 150ms，防止 xterm 逐 chunk 渲染导致慢滚 */
function scheduleSettleFlush(tc: CardInstance<TerminalCardMeta>, term: Terminal) {
  if (tc.meta._settleFlushTimer) clearTimeout(tc.meta._settleFlushTimer);
  tc.meta._settleFlushTimer = setTimeout(() => {
    flushTmuxSettleBuffer(tc, term);
    clearSettleTimers(tc);
  }, 80);
  if (!tc.meta._settleFlushMaxTimer) {
    tc.meta._settleFlushMaxTimer = setTimeout(() => {
      flushTmuxSettleBuffer(tc, term);
      clearSettleTimers(tc);
    }, 150);
  }
}

function tcard(card: CardInstance): CardInstance<TerminalCardMeta> {
  return card as CardInstance<TerminalCardMeta>;
}

// ========== 主题映射 ==========

function xtermTheme(cursor: string) {
  return {
    background: '#0a0a0f',
    foreground: '#e0e0e0',
    cursor,
    selectionBackground: 'rgba(0,212,255,0.3)',
    black: '#1a1a2e', red: '#f07178', green: '#50a880', yellow: '#b4aa50',
    blue: '#5088c8', magenta: '#9650c8', cyan: '#00d4ff', white: '#e0e0e0',
    brightBlack: '#4a4a5e', brightRed: '#f78c6c', brightGreen: '#6cdf9c', brightYellow: '#ffd54f',
    brightBlue: '#82aaff', brightMagenta: '#c792ea', brightCyan: '#89ddff', brightWhite: '#ffffff',
  };
}

// ========== 滚动手势 ==========

const _termMap = new Map<HTMLElement, Terminal>();
const _sidMap = new Map<HTMLElement, string>();
let _activeTerm: Terminal | null = null;
let _activeSid = '';
let _startY = 0;
let _startX = 0;
let _actionTaken = false;
let _sgrAccum = 0;

gestures.register({
  id: 'xterm-scroll',
  targetFilter: '.xterm',
  priority: 61,
  onStart(e) {
    const el = (e.target as HTMLElement).closest('.xterm') as HTMLElement | null;
    const term = el ? _termMap.get(el) : undefined;
    const sid = el ? _sidMap.get(el) || '' : '';
    if (!term) return;
    _activeTerm = term;
    _activeSid = sid;
    _startY = e.clientY;
    _startX = e.clientX;
    _actionTaken = false;
    _sgrAccum = 0;
    _xEl = el!;
    _lp = setTimeout(() => {
      if (!_activeTerm || _actionTaken) return;
      _dismiss(); _sel = true;
      const p = _cp(el!, _startX, _startY, _activeTerm.cols, _activeTerm.rows);
      _sCol = _eCol = p.col; _sRow = _eRow = p.row;
      _activeTerm.select(p.col, p.row, 1);
      _ballL = _mkBall('left'); _ballR = _mkBall('right');
      _stemL = _mkStem(); _stemR = _mkStem();
      _sync(el!, _activeTerm.cols, _activeTerm.rows);
    }, 400);
  },
  onMove(e) {
    if (!_activeTerm) return;
    if (_sel) {
      _actionTaken = true;
      const p = _cp(_xEl!, e.clientX, e.clientY, _activeTerm.cols, _activeTerm.rows);
      _showMag(_xEl!, e.clientX, e.clientY, _activeTerm.cols, _activeTerm.rows);
      _eCol = p.col; _eRow = p.row;
      _as(_activeTerm, _activeTerm.cols);
      _sync(_xEl!, _activeTerm.cols, _activeTerm.rows);
      if (_cpBtn) { _cpBtn.remove(); _cpBtn = null; }
      return;
    }
    
    // 全屏模式下检测水平滑动
    const target = e.target as HTMLElement;
    const card = target?.closest('.floating-card');
    if (card?.classList.contains('fullscreen')) {
      const dx = e.clientX - _startX;
      const dy = e.clientY - _startY;
      if (!_actionTaken && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        if (_lp) { clearTimeout(_lp); _lp = null; }
      }
      if (!_actionTaken && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
        if (dx > 0) openSidebar();
        else openCardStack();
        _actionTaken = true;
        return;
      }
    }
    
    const dy = _startY - e.clientY;
    if (Math.abs(dy) < 4) return;
    _sgrAccum += dy;
    const absAccum = Math.abs(_sgrAccum);
    if (absAccum >= 9) {
      const lines = Math.floor(absAccum / 9);
      const dir = _sgrAccum > 0 ? 1 : -1;

      if (_activeSid) {
        // 通过 WS 发送 SGR 鼠标事件给 tmux——每条触发一行滚动
        // 不合并成一条消息发送（tmux 只处理第 1 个），逐条通过 WS 发
        const btn = dir > 0 ? 65 : 64;
        const term = _activeTerm;
        const cx = Math.max(1, Math.min(term.cols, Math.round(term.cols / 2)));
        const cy = Math.max(1, Math.min(term.rows, Math.round(term.rows / 2)));
        const sgr = '\x1b[<' + btn + ';' + cx + ';' + cy + 'M';
        for (let i = 0; i < lines; i++) {
          wsChannel.sendMessage('terminal-input', { sessionId: _activeSid, input: sgr });
        }
      } else {
        // 无会话：直接调 xterm scrollLines 滚动缓冲区
        _activeTerm.scrollLines(dir * lines);
      }

      _sgrAccum -= lines * 9 * dir;
    }
    _startY = e.clientY;
  },
  onEnd() {
    if (_lp) { clearTimeout(_lp); _lp = null; }
    _hideMag();
    if (_sel && _activeTerm && _xEl) _showCopy(_xEl, _activeTerm.rows);
    if (!_sel) { _activeTerm = null; _activeSid = ''; _actionTaken = false; _sgrAccum = 0; }
  },
  stopPropagation: true,
});

// ========== 选择模式 ==========

let _sel = false, _sCol = 0, _sRow = 0, _eCol = 0, _eRow = 0;
let _ballL: HTMLElement | null = null, _ballR: HTMLElement | null = null;
let _stemL: HTMLElement | null = null, _stemR: HTMLElement | null = null;
let _cpBtn: HTMLElement | null = null, _lp: ReturnType<typeof setTimeout> | null = null;
let _hSC = 0, _hSR = 0, _hOC = 0, _hOR = 0, _hOC2 = 0, _hOR2 = 0;
let _xEl: HTMLElement | null = null, _mag: HTMLElement | null = null;
let _magCv: HTMLCanvasElement | null = null, _magTxt: HTMLElement | null = null;


function _cp(el: HTMLElement, cx: number, cy: number, cols: number, rows: number) {
  const r = el.getBoundingClientRect(), cw = r.width / cols, rh = r.height / rows;
  return { col: Math.max(0, Math.min(cols - 1, Math.floor((cx - r.left) / cw))), row: Math.max(0, Math.min(rows - 1, Math.floor((cy - r.top) / rh))) };
}
function _as(term: Terminal, cols: number) {
  const si = _sRow * cols + _sCol, ei = _eRow * cols + _eCol;
  term.select(si <= ei ? _sCol : _eCol, si <= ei ? _sRow : _eRow, Math.abs(ei - si) + 1);
}
function _sz(el: HTMLElement, rows: number) {
  const rh = el.getBoundingClientRect().height / rows;
  return { bD: Math.round(rh * 1.5), sH: Math.round(rh * 1.2), rh };
}
function _mkBall(side: string) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:' + Z.TERMINAL_HANDLE + ';border-radius:50%;background:rgba(0,212,255,0.9);box-shadow:0 0 6px rgba(0,212,255,0.4);pointer-events:auto;cursor:grab';
  d.dataset.selH = side; document.body.appendChild(d); return d;
}
function _mkStem() {
  const s = document.createElement('div');
  s.style.cssText = 'position:fixed;z-index:' + Z.TERMINAL_STEM + ';width:2px;background:rgba(0,212,255,0.5);pointer-events:none';
  document.body.appendChild(s); return s;
}
function _sync(el: HTMLElement, cols: number, rows: number) {
  if (!_ballL || !_ballR || !_stemL || !_stemR || !_sel) return;
  const r = el.getBoundingClientRect(), cw = r.width / cols;
  const { bD, sH, rh } = _sz(el, rows);
  const le = _sRow * cols + _sCol <= _eRow * cols + _eCol;
  const lc = le ? _sCol : _eCol, lr = le ? _sRow : _eRow;
  const rc = le ? _eCol : _sCol, rr = le ? _eRow : _sRow;
  const rx = r.left + (rc + 1) * cw - cw * 1.17;
  _ballL.style.width = _ballL.style.height = bD + 'px';
  _ballL.style.left = (r.left + lc * cw - bD / 2) + 'px';
  _ballL.style.top = (r.top + lr * rh - bD) + 'px';
  _stemL.style.left = (r.left + lc * cw - cw * 0.5) + 'px';
  _stemL.style.top = (r.top + lr * rh) + 'px';
  _stemL.style.height = sH + 'px';
  _stemR.style.left = (rx - 1) + 'px';
  _stemR.style.top = (r.top + rr * rh) + 'px';
  _stemR.style.height = sH + 'px';
  _ballR.style.width = _ballR.style.height = bD + 'px';
  _ballR.style.left = (rx - bD / 2) + 'px';
  _ballR.style.top = (r.top + rr * rh + rh) + 'px';
}
function _dismiss() {
  _sel = false;
  if (_ballL) { _ballL.remove(); _ballL = null; }
  if (_ballR) { _ballR.remove(); _ballR = null; }
  if (_stemL) { _stemL.remove(); _stemL = null; }
  if (_stemR) { _stemR.remove(); _stemR = null; }
  if (_cpBtn) { _cpBtn.remove(); _cpBtn = null; }
  _hideMag();
  if (_activeTerm) _activeTerm.clearSelection();
}
// 横胶囊视觉放大镜：采样 xterm canvas 手指下方区域放大绘制，叠十字准星 + 角标行列
const MAG_W = 132, MAG_H = 56, MAG_ZOOM = 2;
function _showMag(el: HTMLElement, cx: number, cy: number, cols: number, rows: number) {
  // 取 xterm 渲染 canvas（Canvas 渲染器）；取不到则回退纯坐标气泡
  const srcCv = el.querySelector('canvas') as HTMLCanvasElement | null;
  const p = _cp(el, cx, cy, cols, rows);
  if (!_mag) {
    _mag = document.createElement('div');
    _mag.style.cssText = 'position:fixed;z-index:' + Z.TERMINAL_MAGNIFIER + ';width:' + MAG_W + 'px;height:' + MAG_H + 'px;border-radius:' + (MAG_H / 2) + 'px;overflow:hidden;background:#0a0a0f;border:1.5px solid rgba(0,212,255,0.7);box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:none';
    _magCv = document.createElement('canvas');
    _magCv.width = MAG_W; _magCv.height = MAG_H;
    _magCv.style.cssText = 'width:100%;height:100%;display:block';
    _mag.appendChild(_magCv);
    _magTxt = document.createElement('div');
    _magTxt.style.cssText = 'position:absolute;right:8px;bottom:3px;font-size:9px;font-family:monospace;color:rgba(0,212,255,0.9);text-shadow:0 1px 2px #000;pointer-events:none';
    _mag.appendChild(_magTxt);
    document.body.appendChild(_mag);
  }
  _magTxt!.textContent = (p.col + 1) + ':' + (p.row + 1);
  const ctx = _magCv!.getContext('2d');
  if (ctx && srcCv) {
    // 源采样：以手指为中心，宽 = MAG_W/ZOOM 的 CSS 像素，换算到 canvas 内部像素（含 DPR）
    const r = srcCv.getBoundingClientRect();
    const scaleX = srcCv.width / r.width, scaleY = srcCv.height / r.height;
    const swCss = MAG_W / MAG_ZOOM, shCss = MAG_H / MAG_ZOOM;
    const sx = (cx - r.left - swCss / 2) * scaleX;
    const sy = (cy - r.top - shCss / 2) * scaleY;
    const sw = swCss * scaleX, sh = shCss * scaleY;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, MAG_W, MAG_H);
    try { ctx.drawImage(srcCv, sx, sy, sw, sh, 0, 0, MAG_W, MAG_H); } catch {}
    // 十字准星（当前采样中心）
    ctx.strokeStyle = 'rgba(0,212,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MAG_W / 2, 0); ctx.lineTo(MAG_W / 2, MAG_H);
    ctx.moveTo(0, MAG_H / 2); ctx.lineTo(MAG_W, MAG_H / 2);
    ctx.stroke();
  } else if (ctx) {
    // 无 canvas 源（DOM 渲染器回退）：仅显示坐标
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, MAG_W, MAG_H);
  }
  // 定位：手指上方，左右钳制不出屏
  _mag.style.left = Math.max(4, Math.min(window.innerWidth - MAG_W - 4, cx - MAG_W / 2)) + 'px';
  _mag.style.top = Math.max(4, cy - MAG_H - 24) + 'px';
}
function _hideMag() { if (_mag) { _mag.remove(); _mag = null; _magCv = null; _magTxt = null; } }
function _showCopy(el: HTMLElement, rows: number) {
  if (_cpBtn) _cpBtn.remove();
  const t = _activeTerm?.getSelection() || ''; if (!t) return;
  const r = el.getBoundingClientRect(), rh = r.height / rows;
  const btnY = Math.min(_sRow, _eRow) * rh + r.top;
  const top = btnY > r.top + 60 ? btnY - 32 : btnY + Math.abs(_eRow - _sRow + 1) * rh + r.top + 4;
  const b = document.createElement('div'); b.textContent = '复制';
  b.style.cssText = `position:fixed;left:${r.left+r.width/2-28}px;top:${top}px;z-index:${Z.TERMINAL_COPY_BTN};padding:3px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;color:#fff;background:rgba(0,0,0,0.85);border:1px solid rgba(0,212,255,0.5);pointer-events:auto`;
  b.onclick = (ev) => { ev.stopPropagation(); navigator.clipboard?.writeText(t); _dismiss(); };
  document.body.appendChild(b); _cpBtn = b;
}

document.addEventListener('pointerdown', (e) => {
  if (!_sel) return;
  const t = e.target as HTMLElement;
  if (t.closest('.xterm') || t.closest('[data-sel-h]') || t === _cpBtn) return;
  _dismiss();
});

gestures.register({
  id: 'xterm-sel-handle',
  targetFilter: '[data-sel-h]',
  priority: 105,
  onStart(e) {
    if (!_xEl || !_activeTerm) return;
    const p = _cp(_xEl, e.clientX, e.clientY, _activeTerm.cols, _activeTerm.rows);
    _hSC = p.col; _hSR = p.row;
    _hOC = _sCol; _hOR = _sRow;
    _hOC2 = _eCol; _hOR2 = _eRow;
  },
  onMove(e) {
    if (!_xEl || !_activeTerm) return;
    const p = _cp(_xEl, e.clientX, e.clientY, _activeTerm.cols, _activeTerm.rows);
    const h = (e.target as HTMLElement).closest('[data-sel-h]') as HTMLElement;
    if (!h) return;
    const dCol = p.col - _hSC;
    const dRow = p.row - _hSR;
    if (h.dataset.selH === 'left') { _sCol = _hOC + dCol; _sRow = _hOR + dRow; }
    else { _eCol = _hOC2 + dCol; _eRow = _hOR2 + dRow; }
    _as(_activeTerm, _activeTerm.cols);
    _sync(_xEl, _activeTerm.cols, _activeTerm.rows);
    if (_cpBtn) { _cpBtn.remove(); _cpBtn = null; }
  },
  onEnd() { if (_sel && _xEl && _activeTerm) _showCopy(_xEl, _activeTerm.rows); },
});

export function initTerminalCore(
  container: HTMLElement,
  card: CardInstance,
  terminalName: string,
  poolName: string,
  onReady?: (sessionId: string) => void,
  autoOpen = true,
): void {
  const tc = tcard(card);

  if (!tc.meta.terminalId) {
    tc.meta.terminalId = cardRegistry.allocId(poolName);
  }

  // 紧缩→展开：插回已有 DOM
  if (tc.meta._term) {
    const term = tc.meta._term;
    const fit = tc.meta._fit;
    const termEl = tc.meta._termEl;
    const xtermEl = termEl!.querySelector('.xterm') as HTMLElement;
    container.appendChild(termEl!);
    if (xtermEl) { xtermEl.style.touchAction = 'none'; _termMap.set(xtermEl, term!); }
    robustFit(fit!);
    // 2026-08-28 tmux 卡 compact→active 重插 DOM 后长缓冲会从顶开始滚：强制贴底 settle。
    if (terminalName === 'tmux') {
      flushTmuxSettleBuffer(tc, term!); // 旧 settle 残留先冲掉，避免新 settle 期混写
      try { term!.scrollToBottom(); } catch { /* noop */ }
      tc.meta._tmuxSettling = Date.now() + 1500;
    }
    tc.meta._xtermEl = xtermEl;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      try { fit!.fit(); } catch {}
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (tc.meta.sessionId) {
          wsChannel.sendMessage('terminal-resize', {
            sessionId: tc.meta.sessionId, cols: term!.cols, rows: term!.rows,
          });
        }
        // 2026-08-28 tmux 卡容器 resize（IME 弹/收/键盘浮条）后强制贴底 settle。
        if (terminalName === 'tmux') {
          flushTmuxSettleBuffer(tc, term!); // 旧缓冲先落盘，再钉新位置
          try { term!.scrollToBottom(); } catch { /* noop */ }
          tc.meta._tmuxSettling = Date.now() + 1000;
        }
        resizeTimer = null;
      }, 200);
    });
    observer.observe(termEl!);
    tc.meta._observer = observer;
    if (onReady && tc.meta.sessionId) onReady(tc.meta.sessionId);
    return;
  }

  // 加载存储的字号偏好
  const storedFontSize = localStorage.getItem('kfm-fontsize-card03');
  let initialFontSize = 9;
  if (storedFontSize) {
    try {
      const parsed = JSON.parse(storedFontSize);
      if (typeof parsed.fontSize === 'number') {
        initialFontSize = Math.max(7, Math.min(14, parsed.fontSize));
      }
    } catch { /* ignore */ }
  }

  const term = new Terminal({
    fontSize: initialFontSize,
    fontFamily: 'monospace',
    theme: xtermTheme(card.accents.color1),
    cursorBlink: false,
    allowProposedApi: true,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);

  const termEl = document.createElement('div');
  termEl.style.cssText = 'flex:1;overflow:hidden';
  container.appendChild(termEl);
  term.open(termEl);

  // 加载/刷新/软键盘 resize 后贴底（2026-08-23 用户报：刷新/首开 tmux 卡、召唤/收起输入法
  // 都会让 code 重新滚动）。智能贴底：视口已跟随底部才钉回 -- 加载/首开/闪 resize 不乱滚，
  // 用户上滚看历史时不被拉回底。重连不重臂（本函数被 robustFit 统一调用，mount 时赋一次）。
  _pinBottomIfFollowing = () => {
    try {
      const b = term.buffer.active;
      if (b.viewportY >= b.baseY - 1) { term.scrollToBottom(); }
    } catch { /* noop */ }
  };
  // xterm 自身内部 ResizeObserver（IME 弹/收让容器变矮 → term 内部 resize → 重锚定滚动）
  // 也接上智能贴底（视口在底部才钉）——补上 robustFit 之外的 IME 内部 resize 路径。
  // 2026-08-28 追加：tmux 卡 IME 弹/收时用户需要立即回到输入行，故 tmux 强制贴底，
  // 其他终端保持智能贴底（避免上滚看历史时被输入法拉回底）。
  term.onResize(() => {
    try {
      if (terminalName === 'tmux') {
        flushTmuxSettleBuffer(tc, term); // resize 前把缓存冲掉，避免 resize 后错位
        term.scrollToBottom();
        tc.meta._tmuxSettling = Date.now() + 1000;
      } else { _pinBottomIfFollowing?.(); }
    } catch { /* noop */ }
  });


  initAuxBar(container, term);
  // 动态加载 Canvas 渲染器（替代 DOM 渲染器，避免布局回流）
  import('@xterm/addon-canvas').then(({ CanvasAddon }) => {
    try {
      const canvasAddon = new CanvasAddon();
      term.loadAddon(canvasAddon);
    } catch (e) {
      log('[terminal] Canvas renderer not available, falling back to DOM renderer');
    }
  }).catch(() => {
    log('[terminal] Canvas addon not available, falling back to DOM renderer');
  });

  const xtermEl = termEl.querySelector('.xterm') as HTMLElement;
  if (xtermEl) {
    xtermEl.style.touchAction = 'none';
    _termMap.set(xtermEl, term);
  }
  robustFit(fit);
  startSelfHeal(tc, fit);

  // 锁屏恢复（渲染抑制后 canvas 帧缓存错乱——「复制行追加」病灶）：强制全屏重绘 + fit
  if (!tc.meta._onVisible) {
    tc.meta._onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      try { term.refresh(0, term.rows - 1); } catch {}
      robustFit(fit);
    };
    document.addEventListener('visibilitychange', tc.meta._onVisible);
  }

  tc.meta._term = term;
  tc.meta._fit = fit;
  tc.meta._xtermEl = xtermEl;
  tc.meta._termEl = termEl;

  term.onData((data: string) => {
    if (tc.meta.sessionId) {
      wsChannel.sendMessage('terminal-input', {
        sessionId: tc.meta.sessionId, input: data,
      });
    }
  });

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new ResizeObserver(() => {
    try { fit.fit(); } catch {}
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (tc.meta.sessionId) {
        wsChannel.sendMessage('terminal-resize', {
          sessionId: tc.meta.sessionId, cols: term.cols, rows: term.rows,
        });
      }
      // 2026-08-28 tmux 卡容器 resize（IME 弹/收/键盘浮条）后强制贴底 settle。
      if (terminalName === 'tmux') {
        flushTmuxSettleBuffer(tc, term); // 旧缓冲先落盘，再钉新位置
        try { term.scrollToBottom(); } catch { /* noop */ }
        tc.meta._tmuxSettling = Date.now() + 1000;
      }
      resizeTimer = null;
    }, 200);
  });
  observer.observe(termEl);
  if (termEl.parentElement) observer.observe(termEl.parentElement); // 容器父链——canvas 锁高时 termEl contentRect 可能失效
  tc.meta._observer = observer;

  wsChannel.onMessage('error', function onErr(p: unknown) {
    const d = p as { message: string };
    term.write('\x1b[31m[err:' + (d?.message || '').substring(0, 24) + ']\x1b[0m\r\n');
  });

  const onOutput = (p: unknown) => {
    const d = p as { sessionId: string; data: string };
    if (d.sessionId !== tc.meta.sessionId) return;

    const inSettle = terminalName === 'tmux' && tc.meta._tmuxSettling && Date.now() < tc.meta._tmuxSettling;

    if (inSettle) {
      // tmux 卡 settle 期间缓存输出，批量写入，避免 xterm 逐 chunk 渲染导致从顶部慢滚。
      tc.meta._settleBuffer = (tc.meta._settleBuffer || '') + d.data;
      scheduleSettleFlush(tc, term);
      return;
    }

    // 退出 settle 前先把残留 buffer 冲掉，保证顺序和落点正确。
    flushTmuxSettleBuffer(tc, term);

    term.write(d.data);
    // 内容灌入后贴底（防抖）：跟随底部才钉，避免中途大量内容滚回顶（慢滚/永不 settle）
    if (tc.meta._pinTimer) clearTimeout(tc.meta._pinTimer);
    tc.meta._pinTimer = setTimeout(() => {
      try { _pinBottomIfFollowing?.(); } catch { /* noop */ }
    }, 250);
  };
  wsChannel.onMessage('terminal-output', onOutput);
  tc.meta._onOutput = onOutput;

  const onExit = (p: unknown) => {
    const d = p as { sessionId: string; code: number };
    if (d.sessionId === tc.meta.sessionId) {
      term.write('\r\n\x1b[33m[进程已退出，码: ' + d.code + ']\x1b[0m\r\n');
    }
  };
  wsChannel.onMessage('terminal-exit', onExit);
  tc.meta._onExit = onExit;

  // WS 重连后自动重新打开 PTY：WS 断线重连 → 旧 PTY/sessionId 在服务端已消失，
  // 必须重新 terminal-open 拿新 sessionId，否则终端变死（无法输入/无输出）。
  // tmux 卡跳过本回调——它的重连由 tmux-card.ts 的 _onWsReconnect 处理（发 tmux
  // attach 重开）；若两个回调都发 terminal-open 会一次重连 spawn 两个 PTY，
  // 基础 PTY 无人认领成孤儿（BAR-RECONNECT-01）。
  if (tc.meta._onReconnect) wsChannel.offReconnect(tc.meta._onReconnect);
  const onReconnect = () => {
    if (terminalName === 'tmux') return;
    // WS 刚重连：服务端是全新状态，旧 sessionId 无效，重新 spawn 基础 PTY。
    delete tc.meta.sessionId;
    term.write('\r\n\x1b[33m[WS 已重连，自动恢复终端]\x1b[0m\r\n');
    const t = card.instanceId + '-' + Date.now();
    tc.meta._openTag = t;
    wsChannel.sendMessage('terminal-open', { tag: t });
  };
  tc.meta._onReconnect = onReconnect;
  wsChannel.onReconnect(onReconnect);

  if (!wsChannel.connected) {
    term.write('\x1b[31mWS:off\x1b[0m\r\n');
    if (onReady) onReady('');
  } else {
    // terminal-opened handler 永久注册（card04 re-open 共用）
    const onOpened = (p: unknown) => {
      const d = p as { sessionId: string; tag?: string };
      if (d.tag !== tc.meta._openTag) return; // 不是本卡发出的 terminal-open 回复
      tc.meta.sessionId = d.sessionId;
      if (tc.meta._xtermEl) {
        _sidMap.set(tc.meta._xtermEl, d.sessionId);
      }
      if (!tc.meta._welcomed) {
        tc.meta._welcomed = true;
        term.write('\x1b[34mKFM 终端已连接 — ' + terminalName + '\x1b[0m\r\n');
      }
      if (onReady) onReady(d.sessionId);
      // 重连后 PTY 重建（默认 24 行）——必须主动 fit + resize 让 PTY 尺寸跟上
      // xterm 可视（ResizeObserver 不触发：xterm DOM 尺寸没变）——否则内容只填
      // 上半屏（PTY 行数 < 可视行数 = 半屏病灶）
      robustFit(fit);
      // tmux 卡 attach/重开后直接贴底：长缓冲会话若从顶开始滚，要滚很久才能输入。
      // 2026-08-28 用户报：切换 tmux 卡时内容从顶部慢滚到底。此处无条件贴底，
      // 与 _pinBottomIfFollowing 的智能贴底不冲突（那个管运行中输出，这个管打开瞬间）。
      if (terminalName === 'tmux') {
        flushTmuxSettleBuffer(tc, term); // 旧 settle 残留先冲掉
        try { term.scrollToBottom(); } catch { /* noop */ }
        tc.meta._tmuxSettling = Date.now() + 2000;
      }
      setTimeout(() => {
        if (tc.meta.sessionId) {
          wsChannel.sendMessage('terminal-resize', {
            sessionId: tc.meta.sessionId, cols: term.cols, rows: term.rows,
          });
        }
        // 延迟再贴一次底：xterm fit/resize 是异步的，首次 open 后 buffer 位置可能又漂回顶。
        if (terminalName === 'tmux') {
          flushTmuxSettleBuffer(tc, term); // 异步窗口期缓冲先冲掉
          try { term.scrollToBottom(); } catch { /* noop */ }
          tc.meta._tmuxSettling = Date.now() + 1500;
        }
      }, 200);
    };
    wsChannel.onMessage('terminal-opened', onOpened);
    tc.meta._onOpened = onOpened;

    if (autoOpen) {
      const t = card.instanceId + '-' + Date.now();
      tc.meta._openTag = t;
      wsChannel.sendMessage('terminal-open', { tag: t });
    } else {
      if (onReady) onReady('');
    }
  }
}

/** 销毁终端：清理 WS、xterm、cardRegistry */
export function disposeTerminalCore(card: CardInstance, poolName: string): void {
  const tc = tcard(card);
  if (tc.meta.sessionId) {
    wsChannel.sendMessage('terminal-close', { sessionId: tc.meta.sessionId });
  }
  if (tc.meta._onOutput) {
    wsChannel.offMessage('terminal-output', tc.meta._onOutput);
  }
  if (tc.meta._onExit) {
    wsChannel.offMessage('terminal-exit', tc.meta._onExit);
  }
  if (tc.meta._onOpened) {
    wsChannel.offMessage('terminal-opened', tc.meta._onOpened);
  }
  if (tc.meta._onReconnect) {
    wsChannel.offReconnect(tc.meta._onReconnect);
    delete tc.meta._onReconnect;
  }
  if (tc.meta._xtermEl) {
    _termMap.delete(tc.meta._xtermEl);
    _sidMap.delete(tc.meta._xtermEl);
  }
  clearSettleTimers(tc);
  delete tc.meta._settleBuffer;
  if (tc.meta._term) {
    tc.meta._term.dispose();
  }
  if (tc.meta.terminalId) {
    cardRegistry.freeId(poolName, tc.meta.terminalId);
  }
  delete tc.meta.sessionId;
  delete tc.meta.terminalId;
  delete tc.meta._term;
  delete tc.meta._fit;
  delete tc.meta._onOutput;
  delete tc.meta._onExit;
  delete tc.meta._onOpened;
  delete tc.meta._openTag;
}

/** 紧缩态：保留 Terminal + WS，只拔 xterm DOM */
export function compactTerminalCore(card: CardInstance): void {
  const tc = tcard(card);
  if (tc.meta._selfHeal) { clearInterval(tc.meta._selfHeal); tc.meta._selfHeal = undefined; }
  if (tc.meta._onVisible) { document.removeEventListener('visibilitychange', tc.meta._onVisible); tc.meta._onVisible = undefined; }
  if (tc.meta._observer) {
    tc.meta._observer.disconnect();
  }
  // compact 前把 settle 缓冲落盘，保证拔 DOM 时 term 状态一致；清理定时器防泄漏。
  if (tc.meta._term) flushTmuxSettleBuffer(tc, tc.meta._term);
  clearSettleTimers(tc);
  if (tc.meta._xtermEl) {
    _termMap.delete(tc.meta._xtermEl);
    _sidMap.delete(tc.meta._xtermEl);
  }
  const termEl = tc.meta._termEl;
  if (termEl && termEl.parentNode) {
    termEl.parentNode.removeChild(termEl);
  }
}

// ========== card03 Handler ==========

export function createTerminal04Handler(_meta: Record<string, unknown>): CardContentHandler {
  return {
    activate(contentEl: HTMLElement, card: CardInstance, _reason: 'init' | 'compact'): void {
      const terminalName = '终端 ' + (card.meta.terminalId || '');
      const c1 = card.accents.color1;
      const c2 = card.accents.color2;

      // 加载并应用存储的字号偏好
      const storedFontSize = localStorage.getItem('kfm-fontsize-card03');
      if (storedFontSize) {
        try {
          const parsed = JSON.parse(storedFontSize);
          if (typeof parsed.fontSize === 'number') {
            contentEl.style.setProperty('--card-font-size', parsed.fontSize + 'px');
          }
        } catch { /* ignore */ }
      }

      const { bodyEl } = buildCardLayout(contentEl, '> ' + terminalName, c1, c2);
      initTerminalCore(bodyEl, card, terminalName, 'card03');
    },

    deactivate(contentEl: HTMLElement, card: CardInstance, reason: 'compact' | 'dismiss'): void {
      if (reason === 'dismiss') {
        disposeTerminalCore(card, 'card03');
      } else {
        compactTerminalCore(card);
      }
      contentEl.innerHTML = '';
    },
  };
}

// ========== 全屏终端辅助栏（terminal-aux-bar） ==========

interface AuxBarKey {
  label: string;
  value: string;          // 输出序列
  ctrlSeq?: string;       // CTRL+key 输出序列
  altSeq?: string;        // ALT+key 输出序列
  ctrlAltSeq?: string;    // CTRL+ALT+key 输出序列
}

const AUX_KEYS: AuxBarKey[] = [
  { label: 'ESC', value: '\x1b' },
  { label: 'TAB', value: '\t' },
  { label: 'CTRL', value: '' },
  { label: 'ALT', value: '' },
  { label: '\u25C0',  value: '\x1b[D',   ctrlSeq: '\x1b[1;5D', altSeq: '\x1b[1;3D', ctrlAltSeq: '\x1b[1;7D' },
  { label: '\u25B2',  value: '\x1b[A',   ctrlSeq: '\x1b[1;5A', altSeq: '\x1b[1;3A', ctrlAltSeq: '\x1b[1;7A' },
  { label: '\u25BC',  value: '\x1b[B',   ctrlSeq: '\x1b[1;5B', altSeq: '\x1b[1;3B', ctrlAltSeq: '\x1b[1;7B' },
  { label: '\u25B6',  value: '\x1b[C',   ctrlSeq: '\x1b[1;5C', altSeq: '\x1b[1;3C', ctrlAltSeq: '\x1b[1;7C' },
];

/** 在全屏终端容器底部创建辅助按键栏。仅在 fullscreen 模式下可见。 */
function initAuxBar(container: HTMLElement, term: Terminal): void {
  const bar = document.createElement('div');
  bar.id = 'terminal-aux-bar';
  bar.style.cssText = 'display:none;height:42px;flex-shrink:0;align-items:center;justify-content:space-around;padding:0 4px;background:rgba(10,10,15,0.92);border-top:1px solid rgba(255,255,255,0.06)';

  let ctrlOn = false;
  let altOn = false;

  for (const key of AUX_KEYS) {
    const btn = document.createElement('div');
    btn.textContent = key.label;

    // CTRL/ALT 是开关按钮
    if (key.label === 'CTRL' || key.label === 'ALT') {
      const isCtrl = key.label === 'CTRL';
      btn.style.cssText = 'height:30px;min-width:40px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);cursor:pointer;user-select:none;-webkit-user-select:none;background:transparent;transition:all 0.15s';
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (isCtrl) {
          ctrlOn = !ctrlOn;
          btn.style.background = ctrlOn ? 'rgba(0,212,255,0.2)' : 'transparent';
          btn.style.color = ctrlOn ? 'rgba(0,212,255,1)' : 'rgba(255,255,255,0.7)';
          btn.style.boxShadow = ctrlOn ? '0 0 6px rgba(0,212,255,0.3)' : 'none';
        } else {
          altOn = !altOn;
          btn.style.background = altOn ? 'rgba(124,58,237,0.2)' : 'transparent';
          btn.style.color = altOn ? 'rgba(124,58,237,1)' : 'rgba(255,255,255,0.7)';
          btn.style.boxShadow = altOn ? '0 0 6px rgba(124,58,237,0.3)' : 'none';
        }
      });
      bar.appendChild(btn);
      continue;
    }

    // 普通按键（含方向键）：单击触发，长按 300ms 后以 80ms 间隔重复
    btn.style.cssText = 'height:30px;min-width:36px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.85);cursor:pointer;user-select:none;-webkit-user-select:none;background:transparent;transition:background 0.1s';

    let repeatTimer: ReturnType<typeof setTimeout> | null = null;
    let repeatInterval: ReturnType<typeof setInterval> | null = null;

    function fireKey(): void {
      if (ctrlOn && altOn && key.ctrlAltSeq) {
        term.input(key.ctrlAltSeq);
      } else if (ctrlOn && key.ctrlSeq) {
        term.input(key.ctrlSeq);
      } else if (altOn && key.altSeq) {
        term.input(key.altSeq);
      } else {
        term.input(key.value);
      }
    }

    function stopRepeat(): void {
      if (repeatInterval) { clearInterval(repeatInterval); repeatInterval = null; }
      if (repeatTimer) { clearTimeout(repeatTimer); repeatTimer = null; }
      btn.style.background = 'transparent';
    }

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.style.background = 'rgba(255,255,255,0.12)';
      fireKey();
      repeatTimer = setTimeout(() => {
        repeatInterval = setInterval(fireKey, 80);
      }, 300);
    });

    btn.addEventListener('pointerup', stopRepeat);
    btn.addEventListener('pointerleave', stopRepeat);
    bar.appendChild(btn);
  }

  container.appendChild(bar);

  // 显隐逻辑：全屏模式下始终可见。退全屏隐藏。
  function updateAuxBarVisibility(): void {
    const inFullscreen = !!container.closest('.fullscreen');
    bar.style.display = inFullscreen ? 'flex' : 'none';
  }

  // 观察全屏态变化
  const fsObserver = new MutationObserver(updateAuxBarVisibility);
  const cardEl = container.closest('.floating-card');
  if (cardEl) {
    fsObserver.observe(cardEl, { attributes: true, attributeFilter: ['class'] });
  }

  // 初始态
  updateAuxBarVisibility();
}