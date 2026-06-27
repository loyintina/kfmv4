/**
 * terminal-card.ts — Phase 8: 03 号终端卡 ContentHandler
 *
 * 组装 Canvas 终端渲染器 + WebSocket PTY 桥接。
 * 布局骨架由 buildCardLayout 提供。
 *
 * 设计文档：docs/design/TERMINAL_CARD_SPEC.md
 */

import { TerminalRenderer } from './terminal-renderer.js';
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';

let _terminalCounter = 0;

export function createTerminalHandler(): {
  activate: (contentEl: HTMLElement) => void;
  deactivate: (contentEl: HTMLElement) => void;
} {
  _terminalCounter++;
  const terminalName = '终端 ' + _terminalCounter;

  let _renderer: TerminalRenderer | null = null;
  let _sessionId: string | null = null;
  let _onOutput: ((p: unknown) => void) | null = null;
  let _onExit: ((p: unknown) => void) | null = null;

  return {
    activate(contentEl) {
      const c1 = contentEl.dataset.cardAccent1!;
      const c2 = contentEl.dataset.cardAccent2!;
      const { bodyEl } = buildCardLayout(contentEl, '> ' + terminalName, c1, c2);

      _renderer = new TerminalRenderer();
      _renderer.setAccent(c1);
      _renderer.mount(bodyEl);

      // 键盘 → WS
      _renderer.onInput((data: string) => {
        if (_sessionId) {
          wsChannel.sendMessage('terminal-input', { sessionId: _sessionId, input: data });
        }
      });

      // WS → 终端输出
      _onOutput = (p: unknown) => {
        const d = p as { sessionId: string; data: string };
        if (d.sessionId === _sessionId && _renderer) {
          _renderer.write(d.data);
        }
      };
      wsChannel.onMessage('terminal-output', _onOutput);

      // PTY 退出
      _onExit = (p: unknown) => {
        const d = p as { sessionId: string; code: number };
        if (d.sessionId === _sessionId && _renderer) {
          _renderer.write('\r\n\x1b[33m[进程已退出，码: ' + d.code + ']\x1b[0m\r\n');
        }
      };
      wsChannel.onMessage('terminal-exit', _onExit);

      // 打开 PTY 会话
      wsChannel.sendMessage('terminal-open', {});
      wsChannel.onMessage('terminal-opened', function onOpened(p: unknown) {
        const d = p as { sessionId: string };
        wsChannel.offMessage('terminal-opened', onOpened);
        _sessionId = d.sessionId;
        if (_renderer) {
          _renderer.write('\x1b[34mKFM 终端已连接 — ' + terminalName + '\x1b[0m\r\n');
        }
      });
    },

    deactivate(contentEl) {
      if (_sessionId) {
        wsChannel.sendMessage('terminal-close', { sessionId: _sessionId });
      }
      if (_onOutput) { wsChannel.offMessage('terminal-output', _onOutput); _onOutput = null; }
      if (_onExit) { wsChannel.offMessage('terminal-exit', _onExit); _onExit = null; }
      if (_renderer) { _renderer.dispose(); _renderer = null; }
      _sessionId = null;
      contentEl.innerHTML = '';
    },
  };
}
