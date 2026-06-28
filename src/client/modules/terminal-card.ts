/**
 * terminal-card.ts — Phase 8: 03 号终端卡 ContentHandler
 *
 * 组装 Canvas 终端渲染器 + WebSocket PTY 桥接。
 * 每次 activate 独立 Track 状态（支持多卡同时运行）。
 *
 * 设计文档：docs/design/TERMINAL_CARD_SPEC.md
 */

import { TerminalRenderer } from './terminal-renderer.js';
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';

let _terminalId = 0;

interface CardState {
  renderer: TerminalRenderer;
  sessionId: string | null;
  name: string;
  onOutput: (p: unknown) => void;
  onExit: (p: unknown) => void;
}

const _states = new Map<HTMLElement, CardState>();

export function createTerminalHandler(): {
  activate: (contentEl: HTMLElement) => void;
  deactivate: (contentEl: HTMLElement) => void;
} {
  return {
    activate(contentEl) {
      _terminalId++;
      const terminalName = '终端 ' + _terminalId;
      const c1 = contentEl.dataset.cardAccent1!;
      const c2 = contentEl.dataset.cardAccent2!;
      const { bodyEl } = buildCardLayout(contentEl, '> ' + terminalName, c1, c2);

      const renderer = new TerminalRenderer();
      renderer.setAccent(c1);
      renderer.mount(bodyEl);

      const state: CardState = {
        renderer,
        sessionId: null,
        name: terminalName,
        onOutput: () => {},
        onExit: () => {},
      };
      _states.set(contentEl, state);

      // 键盘 → WS
      renderer.onInput((data: string) => {
        if (state.sessionId) {
          wsChannel.sendMessage('terminal-input', { sessionId: state.sessionId, input: data });
        }
      });

      // WS error
      wsChannel.onMessage('error', function onErr(p: unknown) {
        const d = p as { message: string };
        renderer.setStatus('err:' + (d?.message || '').substring(0, 24));
      });

      // WS → 终端输出
      state.onOutput = (p: unknown) => {
        const d = p as { sessionId: string; data: string };
        if (d.sessionId === state.sessionId) {
          renderer.write(d.data);
        }
      };
      wsChannel.onMessage('terminal-output', state.onOutput);

      // PTY 退出
      state.onExit = (p: unknown) => {
        const d = p as { sessionId: string; code: number };
        if (d.sessionId === state.sessionId) {
          renderer.write('\r\n\x1b[33m[进程已退出，码: ' + d.code + ']\x1b[0m\r\n');
        }
      };
      wsChannel.onMessage('terminal-exit', state.onExit);

      // 打开 PTY 会话
      if (!wsChannel.connected) {
        renderer.setStatus('WS:off');
      } else {
        renderer.setStatus('connecting...');
        wsChannel.sendMessage('terminal-open', {});
        wsChannel.onMessage('terminal-opened', function onOpened(p: unknown) {
          const d = p as { sessionId: string };
          wsChannel.offMessage('terminal-opened', onOpened);
          state.sessionId = d.sessionId;
          renderer.setStatus('S' + d.sessionId.substring(0, 4));
          renderer.write('\x1b[34mKFM 终端已连接 — ' + terminalName + '\x1b[0m\r\n');
        });
        setTimeout(() => {
          if (!state.sessionId) renderer.setStatus('timeout');
        }, 3000);
      }
    },

    deactivate(contentEl) {
      const state = _states.get(contentEl);
      if (state) {
        if (state.sessionId) {
          wsChannel.sendMessage('terminal-close', { sessionId: state.sessionId });
        }
        wsChannel.offMessage('terminal-output', state.onOutput);
        wsChannel.offMessage('terminal-exit', state.onExit);
        state.renderer.dispose();
        _states.delete(contentEl);
      }
      contentEl.innerHTML = '';
    },
  };
}
