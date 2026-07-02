/**
 * tmux-card.ts — 04 号 tmux 终端卡
 *
 * 复用 card03 的 xterm 核心（initTerminalCore），自动检测 tmux session，
 * 单 session 自动 attach（spawn 直接启动 tmux attach，无回显），
 * 多 session 显示 picker。
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
  let _card: CardInstance | null = null;
  let _initDone = false;

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

  /** 向 PTY 发终端输入（attach 到指定 session） */
  function attachViaInput(session: string): void {
    if (_sessionId) {
      wsChannel.sendMessage('terminal-input', {
        sessionId: _sessionId,
        input: 'tmux attach -t ' + session + '\n',
      });
    }
  }

  /** 关闭旧 PTY，用 command 参数打开新 PTY */
  function reopenWithCommand(command: string): void {
    if (!_card) return;
    if (_sessionId) {
      wsChannel.sendMessage('terminal-close', { sessionId: _sessionId });
    }
    const tag = _card.instanceId + '-' + Date.now();
    _card.meta._openTag = tag;
    wsChannel.sendMessage('terminal-open', { command, tag });
  }

  const onResult = (payload: unknown): void => {
    const p = payload as { cmd: string; result: { stdout: string; stderr: string; exitCode: number } };
    if (p.result.exitCode !== 0) { renderPicker([]); return; }

    if (p.cmd === 'list-sessions') {
      const sessions = p.result.stdout.trim().split('\n').filter(Boolean);
      if (sessions.length === 0) {
        renderPicker([]);
      } else if (sessions.length === 1) {
        reopenWithCommand('tmux attach -t ' + sessions[0]);
      } else {
        reopenWithCommand('');
        renderPicker(sessions);
      }
    }
  };

  return {
    activate(contentEl: HTMLElement, card: CardInstance, _reason: 'init' | 'compact'): void {
      _card = card;
      const c1 = card.accents.color1;
      const c2 = card.accents.color2;
      const { bodyEl } = buildCardLayout(contentEl, '\u25A3 tmux', c1, c2);
      _bodyEl = bodyEl;

      _picker = document.createElement('div');
      _picker.className = 'tmux-picker';
      _picker.style.cssText = 'display:none;flex-wrap:wrap;gap:4px;padding:4px 0;flex-shrink:0';
      _bodyEl.appendChild(_picker);

      if (!_resultHandler) {
        _resultHandler = onResult;
        wsChannel.onMessage('tmux-result', onResult);
      }

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
            if (btn) {
              attachViaInput(btn.getAttribute('data-session') || '');
            }
          },
        });
      }

      // autoOpen=false → 不立即开 PTY。onReady 通知终端 DOM 就绪，然后我们发 list-sessions
      initTerminalCore(_bodyEl, card, 'tmux', 'card04', (_sid: string) => {
        if (_sid) _sessionId = _sid;
        if (!_initDone) {
          _initDone = true;
          wsChannel.sendMessage('tmux-cmd', { cmd: 'list-sessions', args: [] });
        }
      }, false);
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
      _card = null;
      _initDone = false;
      contentEl.innerHTML = '';
    },
  };
}
