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
  _openTag?: string;
  _welcomed?: boolean;
}

/** 窄化守卫：将通用 CardInstance 窄化为 TerminalCardMeta 特化。全文件唯一 as 逃逸。 */
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
  },
  onMove(e) {
    if (!_activeTerm) return;
    
    // 全屏模式下检测水平滑动
    const target = e.target as HTMLElement;
    const card = target?.closest('.floating-card');
    if (card?.classList.contains('fullscreen')) {
      const dx = e.clientX - _startX;
      const dy = e.clientY - _startY;
      if (!_actionTaken && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
        if (dx > 0) openSidebar();
        else openCardStack();
        _actionTaken = true;
        return;
      }
    }
    
    const dy = _startY - e.clientY;
    if (Math.abs(dy) < 4) return;
    const ms = (_activeTerm as any)._core?.coreMouseService;
    const proto = ms?.activeProtocol || '?';
    const enc = ms?.activeEncoding || '?';
    if (ms && proto !== 'NONE') {
      const btn = dy > 0 ? 65 : 64;
      const cx = Math.max(1, Math.min(_activeTerm.cols, Math.round(_activeTerm.cols / 2)));
      const cy = Math.max(1, Math.min(_activeTerm.rows, Math.round(_activeTerm.rows / 2)));
      const sgr = '\x1b[<' + btn + ';' + cx + ';' + cy + 'M';
      log(['xscr', 'mouse dy=' + dy.toFixed(0) + ' proto=' + proto + ' enc=' + enc + ' sid=' + (_activeSid ? 'Y' : 'N') + ' msg=' + sgr.replace(/\x1b/g,'^[')]);
      if (_activeSid) {
        wsChannel.sendMessage('terminal-input', { sessionId: _activeSid, input: sgr });
      }
    } else {
      _activeTerm.scrollLines(Math.round(dy / 9));
      log(['xscr', 'scroll dy=' + dy.toFixed(0) + ' proto=' + proto]);
    }
    _startY = e.clientY;
  },
  onEnd() {
    _activeTerm = null;
    _activeSid = '';
    _actionTaken = false;
  },
  stopPropagation: true,
});

// ========== 共享终端核心 — card03 + card04 共用 ==========

/** 在给定容器中初始化 xterm.js 终端（首次 init）或重新挂载 DOM（compact→active） */
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
    requestAnimationFrame(() => { fit!.fit(); });
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

  const xtermEl = termEl.querySelector('.xterm') as HTMLElement;
  if (xtermEl) {
    xtermEl.style.touchAction = 'none';
    _termMap.set(xtermEl, term);
  }
  fit.fit();
  requestAnimationFrame(() => { fit.fit(); });

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
      resizeTimer = null;
    }, 200);
  });
  observer.observe(termEl);
  tc.meta._observer = observer;

  wsChannel.onMessage('error', function onErr(p: unknown) {
    const d = p as { message: string };
    term.write('\x1b[31m[err:' + (d?.message || '').substring(0, 24) + ']\x1b[0m\r\n');
  });

  const onOutput = (p: unknown) => {
    const d = p as { sessionId: string; data: string };
    if (d.sessionId === tc.meta.sessionId) {
      term.write(d.data);
    }
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

  if (!wsChannel.connected) {
    term.write('\x1b[31mWS:off\x1b[0m\r\n');
    if (onReady) onReady('');
  } else {
    // terminal-opened handler 永久注册（card04 re-open 共用）
    const tag = card.instanceId;
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
    };
    wsChannel.onMessage('terminal-opened', onOpened);
    tc.meta._onOpened = onOpened;

    if (autoOpen) {
      const t = tag + '-' + Date.now();
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
  if (tc.meta._xtermEl) {
    _termMap.delete(tc.meta._xtermEl);
    _sidMap.delete(tc.meta._xtermEl);
  }
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
  if (tc.meta._observer) {
    tc.meta._observer.disconnect();
  }
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