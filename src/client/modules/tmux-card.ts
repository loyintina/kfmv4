import { log } from './logger.js';
import { gestures } from './gesture-registry.js';
import { wsChannel } from './ws-channel.js';
import { buildCardLayout } from './floating-card.js';
import type { CardContentHandler, CardInstance } from './card-registry.js';

export function createTmuxCardHandler(): CardContentHandler {
  let _session: string | null = null;
  let _bodyEl: HTMLElement | null = null;
  let _gid: string | null = null;
  let _resultHandler: ((payload: unknown) => void) | null = null;

  function send(cmd: string, args: string[]): void {
    wsChannel.sendMessage('tmux-cmd', { cmd, args });
  }

  function refresh(): void {
    if (_session) send('list-windows', [_session]);
  }

  function render(windows: Array<{ index: number; name: string; active: boolean }>): void {
    if (!_bodyEl) return;
    // 保留底部操作栏（最后一个 child）
    const bar = _bodyEl.lastElementChild;
    _bodyEl.innerHTML = '';
    for (const w of windows) {
      const row = document.createElement('div');
      row.className = 'tmux-row' + (w.active ? ' active' : '');
      row.setAttribute('data-window', String(w.index));
      row.innerHTML = '<span class="tmux-dot">' + (w.active ? '●' : '○') + '</span> ' + w.name;
      _bodyEl.appendChild(row);
    }
    if (bar) _bodyEl.appendChild(bar);
  }

  const onResult = (payload: unknown): void => {
    const p = payload as { cmd: string; result: { stdout: string; stderr: string; exitCode: number } };
    if (p.result.exitCode !== 0) {
      log('[tmux] %s failed exit=%d stderr=%s', p.cmd, p.result.exitCode, p.result.stderr);
      return;
    }
    const lines = p.result.stdout.trim().split('\n').filter(Boolean);

    switch (p.cmd) {
      case 'list-sessions': {
        if (lines.length === 0) { log('[tmux] no sessions'); return; }
        _session = lines[0];
        send('list-windows', [_session]);
        break;
      }
      case 'list-windows': {
        const wins = lines.map(l => {
          const parts = l.split(':', 3);
          return { index: parseInt(parts[0], 10), name: parts[1], active: parts[2] === '1' };
        });
        wins.sort((a, b) => a.index - b.index);
        render(wins);
        break;
      }
      case 'new-window': refresh(); break;
      case 'select-window': refresh(); break;
    }
  };

  return {
    activate(contentEl: HTMLElement, card: CardInstance, _reason: 'init' | 'compact'): void {
      const c1 = card.accents.color1;
      const c2 = card.accents.color2;
      const { bodyEl } = buildCardLayout(contentEl, '\u25A3 tmux', c1, c2);
      _bodyEl = bodyEl;

      _resultHandler = onResult;
      wsChannel.onMessage('tmux-result', onResult);

      // 底部操作栏
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:6px;padding-top:4px;flex-shrink:0';
      const newBtn = document.createElement('button');
      newBtn.className = 'tmux-btn';
      newBtn.setAttribute('data-action', 'new');
      newBtn.textContent = '+ New';
      const refBtn = document.createElement('button');
      refBtn.className = 'tmux-btn';
      refBtn.setAttribute('data-action', 'refresh');
      refBtn.textContent = '\u21BB';
      bar.appendChild(newBtn);
      bar.appendChild(refBtn);
      bodyEl.appendChild(bar);

      // 手势：tap 触发窗口切换 / 按钮操作
      _gid = 'tmux-tap-' + card.instanceId;
      gestures.register({
        id: _gid,
        targetFilter: '.tmux-row, .tmux-btn',
        priority: 70,
        stopPropagation: true,
        onBeforeStart(e: PointerEvent) { e.preventDefault(); return true; },
        onEnd(_e: PointerEvent, dx: number, dy: number) {
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return; // tap only
          const target = _e.target as HTMLElement;
          const row = target.closest('[data-window]') as HTMLElement | null;
          const btn = target.closest('[data-action]') as HTMLElement | null;
          if (row) {
            const idx = row.getAttribute('data-window');
            if (_session && idx) send('select-window', [_session, idx]);
          } else if (btn) {
            const action = btn.getAttribute('data-action');
            if (action === 'new' && _session) send('new-window', [_session]);
            else if (action === 'refresh') refresh();
          }
        },
      });

      send('list-sessions', []);
    },

    deactivate(_contentEl: HTMLElement, card: CardInstance, _reason: 'compact' | 'dismiss'): void {
      if (_gid) { gestures.unregister(_gid); _gid = null; }
      if (_resultHandler) { wsChannel.offMessage('tmux-result', _resultHandler); _resultHandler = null; }
      _bodyEl = null;
      _session = null;
    },
  };
}
