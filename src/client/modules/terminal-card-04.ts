/**
 * terminal-card-04.ts — 03 号终端卡 xterm.js 集成
 *
 * 使用 xterm.js 替代自研渲染器。
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { cardRegistry, type CardInstance } from './card-registry.js';
import { currentTheme } from './theme.js';

// ========== 主题映射 ==========

function xtermTheme(cursor: string) {
  return {
    background: '#0a0a0f',
    foreground: '#e0e0e0',
    cursor,
    selectionBackground: 'rgba(0,212,255,0.3)',
    black: '#1a1a2e',
    red: '#f07178',
    green: '#50a880',
    yellow: '#b4aa50',
    blue: '#5088c8',
    magenta: '#9650c8',
    cyan: '#00d4ff',
    white: '#e0e0e0',
    brightBlack: '#4a4a5e',
    brightRed: '#f78c6c',
    brightGreen: '#6cdf9c',
    brightYellow: '#ffd54f',
    brightBlue: '#82aaff',
    brightMagenta: '#c792ea',
    brightCyan: '#89ddff',
    brightWhite: '#ffffff',
  };
}

// ========== Handler ==========

export function createTerminal04Handler(_meta: Record<string, unknown>): {
  activate: (contentEl: HTMLElement, card: CardInstance, reason: 'init' | 'compact') => void;
  deactivate: (contentEl: HTMLElement, card: CardInstance, reason: 'compact' | 'dismiss') => void;
} {
  return {
    activate(contentEl, card) {
      if (!card.meta.terminalId) {
        card.meta.terminalId = cardRegistry.allocId('card03');
      }
      const terminalName = '终端 ' + card.meta.terminalId;
      const c1 = card.accents.color1;
      const c2 = card.accents.color2;
      const { bodyEl } = buildCardLayout(contentEl, '> ' + terminalName, c1, c2);

      const term = new Terminal({
        fontSize: 9,
        fontFamily: 'monospace',
        theme: xtermTheme(c1),
        cursorBlink: false,
        allowProposedApi: true,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);

      // 创建容器 mount xterm
      const termEl = document.createElement('div');
      termEl.style.cssText = 'flex:1;overflow:hidden';
      bodyEl.appendChild(termEl);
      term.open(termEl);
      fit.fit();

      card.meta._term = term;
      card.meta._fit = fit;

      // 键盘 → WS
      let inputBuf = '';
      term.onData((data: string) => {
        if (card.meta.sessionId) {
          wsChannel.sendMessage('terminal-input', {
            sessionId: card.meta.sessionId as string, input: data,
          });
        }
      });

      // 尺寸变化 → WS（防抖 200ms）
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

      // WS error
      wsChannel.onMessage('error', function onErr(p: unknown) {
        const d = p as { message: string };
        term.write('\x1b[31m[err:' + (d?.message || '').substring(0, 24) + ']\x1b[0m\r\n');
      });

      // WS → 终端输出
      const onOutput = (p: unknown) => {
        const d = p as { sessionId: string; data: string };
        if (d.sessionId === card.meta.sessionId) {
          term.write(d.data);
        }
      };
      wsChannel.onMessage('terminal-output', onOutput);
      card.meta._onOutput = onOutput;

      // PTY 退出
      const onExit = (p: unknown) => {
        const d = p as { sessionId: string; code: number };
        if (d.sessionId === card.meta.sessionId) {
          term.write('\r\n\x1b[33m[进程已退出，码: ' + d.code + ']\x1b[0m\r\n');
        }
      };
      wsChannel.onMessage('terminal-exit', onExit);
      card.meta._onExit = onExit;

      // 打开 PTY 会话
      if (!wsChannel.connected) {
        term.write('\x1b[31mWS:off\x1b[0m\r\n');
      } else {
        wsChannel.sendMessage('terminal-open', {});
        wsChannel.onMessage('terminal-opened', function onOpened(p: unknown) {
          const d = p as { sessionId: string };
          wsChannel.offMessage('terminal-opened', onOpened);
          card.meta.sessionId = d.sessionId;
          term.write('\x1b[34mKFM 终端已连接 — ' + terminalName + '\x1b[0m\r\n');
        });
      }
    },

    deactivate(contentEl, card, reason) {
      if (card.meta.sessionId) {
        wsChannel.sendMessage('terminal-close', { sessionId: card.meta.sessionId as string });
      }
      if (card.meta._onOutput) {
        wsChannel.offMessage('terminal-output', card.meta._onOutput as (p: unknown) => void);
      }
      if (card.meta._onExit) {
        wsChannel.offMessage('terminal-exit', card.meta._onExit as (p: unknown) => void);
      }
      if (card.meta._observer) {
        (card.meta._observer as ResizeObserver).disconnect();
      }
      if (card.meta._term) {
        (card.meta._term as Terminal).dispose();
      }

      if (reason === 'dismiss') {
        if (card.meta.terminalId) {
          cardRegistry.freeId('card03', card.meta.terminalId as number);
        }
        delete card.meta.sessionId;
        delete card.meta.terminalId;
      }

      contentEl.innerHTML = '';
    },
  };
}
