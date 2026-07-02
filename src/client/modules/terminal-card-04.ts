/**
 * terminal-card-04.ts — 03 号终端卡 xterm.js 集成
 *
 * 使用 xterm.js 替代自研渲染器。触控滚动走 GestureRegistry → term.scrollLines()。
 * 导出 initTerminalCore 供 card04（tmux）复用。
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { cardRegistry, type CardInstance, type CardContentHandler } from './card-registry.js';
import { gestures } from './gesture-registry.js';
import { log } from './logger.js';
import { currentTheme } from './theme.js';

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
  },
  onMove(e) {
    if (!_activeTerm) return;
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
  if (!card.meta.terminalId) {
    card.meta.terminalId = cardRegistry.allocId(poolName);
  }

  // 紧缩→展开：插回已有 DOM
  if (card.meta._term) {
    const term = card.meta._term as Terminal;
    const fit = card.meta._fit as FitAddon;
    const termEl = card.meta._termEl as HTMLElement;
    const xtermEl = termEl.querySelector('.xterm') as HTMLElement;
    container.appendChild(termEl);
    if (xtermEl) { xtermEl.style.touchAction = 'none'; _termMap.set(xtermEl, term); }
    requestAnimationFrame(() => { fit.fit(); });
    card.meta._xtermEl = xtermEl;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      try { fit.fit(); } catch {}
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (card.meta.sessionId) {
          wsChannel.sendMessage('terminal-resize', {
            sessionId: card.meta.sessionId, cols: term.cols, rows: term.rows,
          });
        }
        resizeTimer = null;
      }, 200);
    });
    observer.observe(termEl);
    card.meta._observer = observer;
    if (onReady && card.meta.sessionId) onReady(card.meta.sessionId as string);
    return;
  }

  const term = new Terminal({
    fontSize: 9,
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

  card.meta._term = term;
  card.meta._fit = fit;
  card.meta._xtermEl = xtermEl;
  card.meta._termEl = termEl;

  term.onData((data: string) => {
    if (card.meta.sessionId) {
      wsChannel.sendMessage('terminal-input', {
        sessionId: card.meta.sessionId as string, input: data,
      });
    }
  });

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new ResizeObserver(() => {
    try { fit.fit(); } catch {}
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (card.meta.sessionId) {
        wsChannel.sendMessage('terminal-resize', {
          sessionId: card.meta.sessionId, cols: term.cols, rows: term.rows,
        });
      }
      resizeTimer = null;
    }, 200);
  });
  observer.observe(termEl);
  card.meta._observer = observer;

  wsChannel.onMessage('error', function onErr(p: unknown) {
    const d = p as { message: string };
    term.write('\x1b[31m[err:' + (d?.message || '').substring(0, 24) + ']\x1b[0m\r\n');
  });

  const onOutput = (p: unknown) => {
    const d = p as { sessionId: string; data: string };
    if (d.sessionId === card.meta.sessionId) {
      term.write(d.data);
    }
  };
  wsChannel.onMessage('terminal-output', onOutput);
  card.meta._onOutput = onOutput;

  const onExit = (p: unknown) => {
    const d = p as { sessionId: string; code: number };
    if (d.sessionId === card.meta.sessionId) {
      term.write('\r\n\x1b[33m[进程已退出，码: ' + d.code + ']\x1b[0m\r\n');
    }
  };
  wsChannel.onMessage('terminal-exit', onExit);
  card.meta._onExit = onExit;

  if (!wsChannel.connected) {
    term.write('\x1b[31mWS:off\x1b[0m\r\n');
    if (onReady) onReady('');
  } else {
    // terminal-opened handler 永久注册（card04 re-open 共用）
    const tag = card.instanceId;
    const onOpened = (p: unknown) => {
      const d = p as { sessionId: string; tag?: string };
      if (d.tag !== card.meta._openTag) return; // 不是本卡发出的 terminal-open 回复
      card.meta.sessionId = d.sessionId;
      _sidMap.set(card.meta._xtermEl as HTMLElement, d.sessionId);
      if (!card.meta._welcomed) {
        card.meta._welcomed = true;
        term.write('\x1b[34mKFM 终端已连接 — ' + terminalName + '\x1b[0m\r\n');
      }
      if (onReady) onReady(d.sessionId);
    };
    wsChannel.onMessage('terminal-opened', onOpened);
    card.meta._onOpened = onOpened;

    if (autoOpen) {
      const t = tag + '-' + Date.now();
      card.meta._openTag = t;
      wsChannel.sendMessage('terminal-open', { tag: t });
    } else {
      if (onReady) onReady('');
    }
  }
}

/** 销毁终端：清理 WS、xterm、cardRegistry */
export function disposeTerminalCore(card: CardInstance, poolName: string): void {
  if (card.meta.sessionId) {
    wsChannel.sendMessage('terminal-close', { sessionId: card.meta.sessionId as string });
  }
  if (card.meta._onOutput) {
    wsChannel.offMessage('terminal-output', card.meta._onOutput as (p: unknown) => void);
  }
  if (card.meta._onExit) {
    wsChannel.offMessage('terminal-exit', card.meta._onExit as (p: unknown) => void);
  }
  if (card.meta._onOpened) {
    wsChannel.offMessage('terminal-opened', card.meta._onOpened as (p: unknown) => void);
  }
  if (card.meta._xtermEl) {
    _termMap.delete(card.meta._xtermEl as HTMLElement);
    _sidMap.delete(card.meta._xtermEl as HTMLElement);
  }
  if (card.meta._term) {
    (card.meta._term as Terminal).dispose();
  }
  if (card.meta.terminalId) {
    cardRegistry.freeId(poolName, card.meta.terminalId as number);
  }
  delete card.meta.sessionId;
  delete card.meta.terminalId;
  delete card.meta._term;
  delete card.meta._fit;
  delete card.meta._onOutput;
  delete card.meta._onExit;
  delete card.meta._onOpened;
  delete card.meta._openTag;
}

/** 紧缩态：保留 Terminal + WS，只拔 xterm DOM */
export function compactTerminalCore(card: CardInstance): void {
  if (card.meta._observer) {
    (card.meta._observer as ResizeObserver).disconnect();
  }
  if (card.meta._xtermEl) {
    _termMap.delete(card.meta._xtermEl as HTMLElement);
    _sidMap.delete(card.meta._xtermEl as HTMLElement);
  }
  const termEl = card.meta._termEl as HTMLElement | undefined;
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
