/**
 * tmux-card.ts — 04 号 tmux 终端卡
 *
 * 复用 card03 的 xterm 核心（initTerminalCore），自动检测 tmux session，
 * 单 session 自动 attach，多 session 显示 picker。
 */
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { gestures } from './gesture-registry.js';
import { initTerminalCore, disposeTerminalCore, compactTerminalCore } from './terminal-card-04.js';
import type { CardContentHandler, CardInstance } from './card-registry.js';

export function createTmuxCardHandler(): CardContentHandler {
  let _bodyEl: HTMLElement | null = null;
  let _picker: HTMLElement | null = null;
  let _gid: string | null = null;
  let _resultHandler: ((payload: unknown) => void) | null = null;
  let _sessionId = '';

  function renderPicker(sessions: string[]): void {
    if (!_picker) return;
    _picker.innerHTML = '';
    _picker.style.display = sessions.length > 0 ? 'flex' : 'none';
    for (const s of sessions) {
      const btn = document.createElement('button');
      btn.className = 'tmux-session-btn';
      btn.setAttribute('data-session', s);
      btn.textContent = s;
      _picker.appendChild(btn);
    }
  }

  const onResult = (payload: unknown): void => {
    const p = payload as { cmd: string; result: { stdout: string; stderr: string; exitCode: number } };
    if (p.result.exitCode !== 0) { renderPicker([]); return; }

    if (p.cmd === 'list-sessions') {
      const sessions = p.result.stdout.trim().split('\n').filter(Boolean);
      if (sessions.length === 0) {
        renderPicker([]);
      } else if (sessions.length === 1) {
        wsChannel.sendMessage('terminal-input', {
          sessionId: _sessionId,
          input: 'clear && tmux attach -t ' + sessions[0] + '\n',
        });
      } else {
        renderPicker(sessions);
      }
    }
  };

  return {
    activate(contentEl: HTMLElement, card: CardInstance, _reason: 'init' | 'compact'): void {
      const c1 = card.accents.color1;
      const c2 = card.accents.color2;
      const { bodyEl } = buildCardLayout(contentEl, '\u25A3 tmux', c1, c2);
      _bodyEl = bodyEl;

      _picker = document.createElement('div');
      _picker.className = 'tmux-picker';
      _picker.style.cssText = 'display:none;flex-wrap:wrap;gap:4px;padding:4px 0;flex-shrink:0';
      _bodyEl.appendChild(_picker);

      // 注册 tmux 消息监听
      if (!_resultHandler) {
        _resultHandler = onResult;
        wsChannel.onMessage('tmux-result', onResult);
      }

      // 注册手势（首次开或 compact→expanded 都需要）
      if (!_gid) {
        _gid = 'tmux-tap-' + card.instanceId;
        gestures.register({
          id: _gid,
          targetFilter: '.tmux-session-btn',
          priority: 70,
          stopPropagation: true,
          onBeforeStart(e: PointerEvent) { e.preventDefault(); return true; },
          onEnd(_e: PointerEvent, dx: number, dy: number) {
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return;
            const btn = (_e.target as HTMLElement).closest('[data-session]') as HTMLElement | null;
            if (!btn || !_sessionId) return;
            const session = btn.getAttribute('data-session');
            if (session) {
              wsChannel.sendMessage('terminal-input', {
                sessionId: _sessionId,
                input: 'clear && tmux attach -t ' + session + '\n',
              });
            }
          },
        });
      }

      initTerminalCore(_bodyEl, card, 'tmux', 'card04', (sid: string) => {
        _sessionId = sid;
        wsChannel.sendMessage('tmux-cmd', { cmd: 'list-sessions', args: [] });
      });
    },

    deactivate(contentEl: HTMLElement, card: CardInstance, reason: 'compact' | 'dismiss'): void {
      if (_gid) { gestures.unregister(_gid); _gid = null; }
      if (_resultHandler) { wsChannel.offMessage('tmux-result', _resultHandler); _resultHandler = null; }
      if (reason === 'dismiss') {
        disposeTerminalCore(card, 'card04');
      } else {
        compactTerminalCore(card);
      }
      _bodyEl = null;
      _picker = null;
      _sessionId = '';
      contentEl.innerHTML = '';
    },
  };
}
