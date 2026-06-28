/**
 * terminal-card.ts — Phase 8: 03 号终端卡 ContentHandler
 *
 * 组装 Canvas 终端渲染器 + WebSocket PTY 桥接。
 * 状态通过 CardRegistry + CardInstance.meta 管理，不再自建 _states Map。
 *
 * 设计文档：docs/design/TERMINAL_CARD_SPEC.md
 */

import { TerminalRenderer } from './terminal-renderer.js';
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { cardRegistry, type CardInstance } from './card-registry.js';
import { gestures } from './gesture-registry.js';

// 终端卡滚动手势：单指上下滑浏览历史
const _scrollRenderers = new Map<HTMLElement, TerminalRenderer>();
let _prevDy = 0;

gestures.register({
  id: 'terminal-scroll',
  targetFilter: '.terminal-canvas',
  priority: 61,
  onStart() { _prevDy = 0; },
  onMove(e, _dx, dy) {
    const inc = dy - _prevDy;
    _prevDy = dy;
    const canvas = (e.target as HTMLElement).closest('.terminal-canvas') as HTMLElement | null;
    const renderer = canvas ? _scrollRenderers.get(canvas) : undefined;
    if (renderer) renderer.scrollBy(inc);
  },
  stopPropagation: true,
});

export function createTerminalHandler(_meta: Record<string, unknown>): {
  activate: (contentEl: HTMLElement, card: CardInstance, reason: 'init' | 'compact') => void;
  deactivate: (contentEl: HTMLElement, card: CardInstance, reason: 'compact' | 'dismiss') => void;
} {
  return {
    activate(contentEl, card) {
      // 分配终端编号（紧缩→展开时复用已有编号）
      if (!card.meta.terminalId) {
        card.meta.terminalId = cardRegistry.allocId('card03');
      }
      const terminalName = '终端 ' + card.meta.terminalId;
      const c1 = card.accents.color1;
      const c2 = card.accents.color2;
      const { bodyEl } = buildCardLayout(contentEl, '> ' + terminalName, c1, c2);

      const renderer = new TerminalRenderer();
      renderer.setAccent(c1);
      renderer.mount(bodyEl);
      _scrollRenderers.set(bodyEl.querySelector('.terminal-canvas')!, renderer);

      // 键盘 → WS
      renderer.onInput((data: string) => {
        if (card.meta.sessionId) {
          wsChannel.sendMessage('terminal-input', {
            sessionId: card.meta.sessionId as string, input: data,
          });
        }
      });

      // 尺寸变化 → WS（防抖：拖拽停止 200ms 后发一次）
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

      // WS error
      wsChannel.onMessage('error', function onErr(p: unknown) {
        const d = p as { message: string };
        renderer.setStatus('err:' + (d?.message || '').substring(0, 24));
      });

      // WS → 终端输出
      const onOutput = (p: unknown) => {
        const d = p as { sessionId: string; data: string };
        if (d.sessionId === card.meta.sessionId) {
          renderer.write(d.data);
        }
      };
      wsChannel.onMessage('terminal-output', onOutput);
      card.meta._onOutput = onOutput;

      // PTY 退出
      const onExit = (p: unknown) => {
        const d = p as { sessionId: string; code: number };
        if (d.sessionId === card.meta.sessionId) {
          renderer.write('\r\n\x1b[33m[进程已退出，码: ' + d.code + ']\x1b[0m\r\n');
        }
      };
      wsChannel.onMessage('terminal-exit', onExit);
      card.meta._onExit = onExit;

      // 打开 PTY 会话（紧缩→展开时可能是新会话，旧会话已随 deactivate 关闭）
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
          renderer.write('\x1b[34mKFM 终端已连接 — ' + terminalName + '\x1b[0m\r\n');
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
        // 卡片关闭：释放终端编号
        if (card.meta.terminalId) {
          cardRegistry.freeId('card03', card.meta.terminalId as number);
        }
        delete card.meta.sessionId;
        delete card.meta.terminalId;
      }
      // 紧缩时不释放——编号和 PTY 都可以复用

      contentEl.innerHTML = '';
    },
  };
}
