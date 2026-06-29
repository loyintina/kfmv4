/**
 * terminal-card-04.ts — Phase 9: 04 号终端卡 ContentHandler（Row-with-Runs）
 *
 * 使用 LineRenderer（terminal-renderer-v2.ts），行优先模型。
 * 独立于 03 卡，共用 WS 通道基础设施。
 */

import { LineRenderer } from './terminal-renderer-v2.js';
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { cardRegistry, type CardInstance } from './card-registry.js';
import { gestures } from './gesture-registry.js';

// 04 号卡滚动：单指上下滑（上滑→画面上移→过滚，下滑→画面下移→历史）
const _scrollRenderers = new Map<HTMLElement, LineRenderer>();
let _activeRenderer: LineRenderer | null = null;
let _scrollStartY = 0;

gestures.register({
  id: 'terminal-scroll-04',
  targetFilter: '.terminal-canvas-v2',
  priority: 61,
  onStart(e) {
    const canvas = (e.target as HTMLElement).closest('.terminal-canvas-v2') as HTMLElement | null;
    const r = canvas ? _scrollRenderers.get(canvas) : undefined;
    if (!r) return;
    _activeRenderer = r;
    _scrollStartY = e.clientY;
    r.touchScrollStart(e.clientY);
  },
  onMove(e) {
    if (!_activeRenderer) return;
    _activeRenderer.touchScrollMove(e.clientY, _scrollStartY);
  },
  onEnd() {
    if (_activeRenderer) { _activeRenderer.startFling(); _activeRenderer = null; }
  },
  stopPropagation: true,
});

export function createTerminal04Handler(_meta: Record<string, unknown>): {
  activate: (contentEl: HTMLElement, card: CardInstance, reason: 'init' | 'compact') => void;
  deactivate: (contentEl: HTMLElement, card: CardInstance, reason: 'compact' | 'dismiss') => void;
} {
  return {
    activate(contentEl, card) {
      if (!card.meta.terminalId) {
        card.meta.terminalId = cardRegistry.allocId('card04');
      }
      const terminalName = 'v2 终端 ' + card.meta.terminalId;
      const c1 = card.accents.color1;
      const c2 = card.accents.color2;
      const { bodyEl } = buildCardLayout(contentEl, '> ' + terminalName, c1, c2);

      const renderer = new LineRenderer();
      renderer.setAccent(c1);
      renderer.mount(bodyEl);
      _scrollRenderers.set(bodyEl.querySelector('.terminal-canvas-v2')!, renderer);

      renderer.onInput((data: string) => {
        if (card.meta.sessionId) {
          wsChannel.sendMessage('terminal-input', {
            sessionId: card.meta.sessionId as string, input: data,
          });
        }
      });

      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      renderer.onResize((cols, rows) => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (card.meta.sessionId) {
            wsChannel.sendMessage('terminal-resize', {
              sessionId: card.meta.sessionId, cols, rows,
            });
          }
          resizeTimer = null;
        }, 200);
      });

      wsChannel.onMessage('error', function onErr(p: unknown) {
        const d = p as { message: string };
        renderer.setStatus('err:' + (d?.message || '').substring(0, 24));
      });

      const onOutput = (p: unknown) => {
        const d = p as { sessionId: string; data: string };
        if (d.sessionId === card.meta.sessionId) {
          renderer.write(d.data);
        }
      };
      wsChannel.onMessage('terminal-output', onOutput);
      card.meta._onOutput = onOutput;

      const onExit = (p: unknown) => {
        const d = p as { sessionId: string; code: number };
        if (d.sessionId === card.meta.sessionId) {
          renderer.write('\r\n\x1b[33m[进程已退出，码: ' + d.code + ']\x1b[0m\r\n');
        }
      };
      wsChannel.onMessage('terminal-exit', onExit);
      card.meta._onExit = onExit;

      if (!wsChannel.connected) {
        renderer.setStatus('WS:off');
      } else {
        renderer.setStatus('connecting...');
        wsChannel.sendMessage('terminal-open', {});
        wsChannel.onMessage('terminal-opened', function onOpened(p: unknown) {
          const d = p as { sessionId: string };
          wsChannel.offMessage('terminal-opened', onOpened);
          card.meta.sessionId = d.sessionId;
          renderer.setStatus('S' + d.sessionId.substring(0, 4));
          renderer.write('\x1b[34mKFM v2 终端已连接 — ' + terminalName + '\x1b[0m\r\n');
        });
        setTimeout(() => {
          if (!card.meta.sessionId) renderer.setStatus('timeout');
        }, 3000);
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

      if (reason === 'dismiss') {
        if (card.meta.terminalId) {
          cardRegistry.freeId('card04', card.meta.terminalId as number);
        }
        delete card.meta.sessionId;
        delete card.meta.terminalId;
      }

      contentEl.innerHTML = '';
    },
  };
}
