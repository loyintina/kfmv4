/**
 * tmux-card.ts — 04 号 tmux 终端卡
 *
 * 职责边界：
 *   在 card03 终端基础设施之上实现 tmux session 管理。负责检测、选择、attach、切换 tmux session。
 *   不关心终端的渲染/滚动/WS 通信——那些委托给 terminal-card-04 的 initTerminalCore()。
 *
 * 生命周期：
 *   activate（init / compact→active）
 *     ↓ buildCardLayout → 创建 tabBar 容器 → initTerminalCore(autoOpen=false)
 *     ↓ WS 连接就绪 → onReady 回调发 tmux-cmd list-sessions
 *     ↓ 服务端返回结果：
 *       ├─ 0 session      → 显示创建表单（输入名字 + 创建按钮）
 *       ├─ 1 session      → reopenWithCommand('tmux attach -t <session>')
 *       └─ 多个 session    → reopenWithCommand('tmux attach -t <first>') + 显示 tab 栏
 *                              ↓ 用户点击 tab → switchSession() 发 prefix + :switch-client
 *   deactivate
 *     ├─ compact → compactTerminalCore（拔 DOM，保留终端 + WS）
 *     └─ dismiss → disposeTerminalCore（完整销毁）
 *
 * 切换机制：
 *   通过服务端 tmux switch-client -c <tty> -t <session> 实现无缝切换。
 *   服务端通过 PTY 的 /proc/pid/fd/0 获取 tty 路径，直接告诉 tmux 切换客户端。
 *   不经过 PTY 输入流，AI 工具无感知。PTY 不关不重建，旧 session 挂起继续跑。
 */
import { buildCardLayout } from './floating-card.js';
import { wsChannel } from './ws-channel.js';
import { gestures } from './gesture-registry.js';
import { initTerminalCore, disposeTerminalCore, compactTerminalCore } from './terminal-card-04.js';
import type { CardContentHandler, CardInstance } from './card-registry.js';

// ========== tmux 卡 meta 类型定义 ==========

export interface TmuxCardMeta {
  _openTag?: string;
}

function tmcard(card: CardInstance): CardInstance<TmuxCardMeta> {
  return card as CardInstance<TmuxCardMeta>;
}

export function createTmuxCardHandler(): CardContentHandler {
  let _bodyEl: HTMLElement | null = null;
  let _tabBar: HTMLElement | null = null;
  let _createForm: HTMLElement | null = null;
  let _gid: string | null = null;
  let _resultHandler: ((payload: unknown) => void) | null = null;
  let _onWsReconnect: (() => void) | null = null;
  let _sessionId = '';
  let _card: CardInstance | null = null;
  let _initDone = false;
  let _lastCommand = '';
  let _attached = '';
  let _switching = false; // 切换守卫：防连点竞态
  let _prevAttached = '';  // 失败回滚用
  let _sessions: string[] = [];
  let _pendingName = '';

  function renderTabBar(sessions: string[], active: string): void {
    if (!_tabBar) return;
    _tabBar.innerHTML = '';
    _tabBar.style.display = sessions.length > 1 ? 'flex' : 'none';
    const c1 = _card ? _card.accents.color1 : '#5a9';
    for (const s of sessions) {
      const tab = document.createElement('button');
      tab.className = 'tmux-tab';
      tab.textContent = s;
      tab.setAttribute('data-session', s);
      tab.style.cssText = 'touch-action:none;border:none;padding:5px 12px;font-size:11px;border-radius:4px 4px 0 0;cursor:pointer;white-space:nowrap;color:' + (s === active ? '#fff' : 'rgba(224,224,224,0.6)') + ';background:' + (s === active ? c1 : 'rgba(255,255,255,0.06)');
      _tabBar.appendChild(tab);
    }
    const add = document.createElement('button');
    add.className = 'tmux-tab tmux-tab-add';
    add.textContent = '+';
    add.style.cssText = 'touch-action:none;border:none;padding:5px 10px;font-size:12px;border-radius:4px 4px 0 0;cursor:pointer;color:rgba(224,224,224,0.6);background:rgba(255,255,255,0.06)';
    _tabBar.appendChild(add);
  }

  function showCreateForm(): void {
    if (!_createForm) return;
    _createForm.style.display = 'flex';
    const input = _createForm.querySelector('input');
    if (input) { input.value = ''; input.focus(); }
  }

  function hideCreateForm(): void {
    if (_createForm) _createForm.style.display = 'none';
  }

  function switchSession(session: string): void {
    // 守卫只防切换进行中连点（_switching）；_attached 相等判断移除——
    // 重开/重连可能让真实 attach 与 _attached 脱节，相等判断会锁死切换
    if (_switching || !_sessionId) return;
    _switching = true;
    _prevAttached = _attached;
    _attached = session; // 乐观更新（失败回滚见 onResult）
    _lastCommand = 'tmux attach -t ' + session; // 重开时 attach 当前 session（不是旧的第一个）
    if (_tabBar) renderTabBar(_sessions, session);
    wsChannel.sendMessage('tmux-cmd', { cmd: 'switch-client', args: [session, _sessionId] });
  }

  function reopenWithCommand(command: string): void {
    if (!_card) return;
    _lastCommand = command;
    if (_sessionId) {
      wsChannel.sendMessage('terminal-close', { sessionId: _sessionId });
    }
    const tag = _card.instanceId + '-' + Date.now();
    tmcard(_card).meta._openTag = tag;
    wsChannel.sendMessage('terminal-open', { command, tag });
  }

  function refreshSessions(): void {
    wsChannel.sendMessage('tmux-cmd', { cmd: 'list-sessions', args: [] });
  }

  function handleCreate(name: string): void {
    if (!name) return;
    _pendingName = name;
    wsChannel.sendMessage('tmux-cmd', { cmd: 'new-session', args: [name] });
  }

  const onResult = (payload: unknown): void => {
    const p = payload as { cmd: string; result: { stdout: string; stderr: string; exitCode: number } };

    if (p.cmd === 'switch-client') {
      // 切换回包：成功保持，失败回滚（乐观更新的兜底）
      _switching = false;
      if (p.result.exitCode !== 0) {
        _attached = _prevAttached;
        if (_tabBar) renderTabBar(_sessions, _attached);
      }
      return;
    }

    if (p.cmd === 'new-session') {
      const name = _pendingName;
      _pendingName = '';
      if (p.result.exitCode === 0 && name) {
        hideCreateForm();
        refreshSessions();
        if (_attached) {
          setTimeout(() => switchSession(name), 200);
        } else {
          _attached = name;
          reopenWithCommand('tmux attach -t ' + name);
        }
      }
      return;
    }

    if (p.cmd === 'kill-session') {
      refreshSessions();
      return;
    }

    if (p.cmd !== 'list-sessions') return;

    if (p.result.exitCode !== 0) {
      if (_tabBar) { _tabBar.innerHTML = '<span style="padding:4px 8px;color:rgba(224,224,224,0.45);font-size:11px">tmux not available</span>'; _tabBar.style.display = 'flex'; }
      return;
    }

    const sessions = p.result.stdout.trim().split('\n').filter(Boolean);
    _sessions = sessions;

    if (sessions.length === 0) {
      if (_tabBar) _tabBar.style.display = 'none';
      showCreateForm();
      _attached = '';
    } else if (sessions.length === 1) {
      hideCreateForm();
      if (_tabBar) _tabBar.style.display = 'none';
      if (_attached !== sessions[0]) {
        _attached = sessions[0];
        reopenWithCommand('tmux attach -t ' + sessions[0]);
      }
    } else {
      hideCreateForm();
      if (!_attached || !sessions.includes(_attached)) {
        _attached = sessions[0];
        reopenWithCommand('tmux attach -t ' + sessions[0]);
      }
      renderTabBar(sessions, _attached);
    }
  };

  return {
    activate(contentEl: HTMLElement, card: CardInstance, _reason: 'init' | 'compact'): void {
      _card = card;
      const c1 = card.accents.color1;
      const c2 = card.accents.color2;

      const storedFontSize = localStorage.getItem('kfm-fontsize-card04');
      if (storedFontSize) {
        try {
          const parsed = JSON.parse(storedFontSize);
          if (typeof parsed.fontSize === 'number') {
            contentEl.style.setProperty('--card-font-size', parsed.fontSize + 'px');
          }
        } catch { /* ignore */ }
      }

      const { bodyEl } = buildCardLayout(contentEl, '\u25A3 tmux', c1, c2);
      _bodyEl = bodyEl;

      // tab 栏
      _tabBar = document.createElement('div');
      _tabBar.className = 'tmux-tabbar';
      _tabBar.style.cssText = 'display:none;align-items:center;overflow-x:auto;flex-shrink:0;gap:2px;padding:2px 0;scrollbar-width:none';
      _bodyEl.appendChild(_tabBar);

      // 创建表单
      _createForm = document.createElement('div');
      _createForm.className = 'tmux-create-form';
      _createForm.style.cssText = 'display:none;align-items:center;gap:6px;padding:8px 4px;flex-shrink:0';
      const input = document.createElement('input');
      input.className = 'tmux-create-input';
      input.placeholder = 'session name';
      input.style.cssText = 'flex:1;min-width:0;padding:5px 8px;border:1px solid rgba(255,255,255,0.15);border-radius:4px;background:rgba(0,0,0,0.3);color:#e0e0e0;font-size:11px;outline:none';
      const btn = document.createElement('button');
      btn.className = 'tmux-create-btn';
      btn.textContent = '创建';
      btn.style.cssText = 'padding:5px 12px;border:none;border-radius:4px;background:' + c1 + ';color:#fff;font-size:11px;cursor:pointer;white-space:nowrap;touch-action:none';
      _createForm.appendChild(input);
      _createForm.appendChild(btn);
      _bodyEl.appendChild(_createForm);

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { handleCreate(input.value.trim()); }
        e.stopPropagation();
      });
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
      btn.addEventListener('click', (e) => { e.stopPropagation(); handleCreate(input.value.trim()); });

      if (!_resultHandler) {
        _resultHandler = onResult;
        wsChannel.onMessage('tmux-result', onResult);
      }

      if (!_gid) {
        _gid = 'tmux-tap-' + card.instanceId;
        gestures.register({
          id: _gid,
          targetFilter: '.tmux-tab',
          priority: 70,
          stopPropagation: true,
          onBeforeStart(e: PointerEvent) { e.preventDefault(); return true; },
          onEnd(_e: PointerEvent, dx: number, dy: number) {
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return;
            const el = (_e.target as HTMLElement).closest('.tmux-tab') as HTMLElement | null;
            if (!el) return;
            if (el.classList.contains('tmux-tab-add')) {
              showCreateForm();
            } else {
              const s = el.getAttribute('data-session');
              if (s) switchSession(s);
            }
          },
        });
      }

      if (_onWsReconnect) wsChannel.offReconnect(_onWsReconnect);
      _onWsReconnect = () => {
        _sessionId = '';
        _initDone = false;
        if (_lastCommand) {
          setTimeout(() => {
            if (_lastCommand) reopenWithCommand(_lastCommand);
          }, 300);
        }
      };
      wsChannel.onReconnect(_onWsReconnect);

      initTerminalCore(_bodyEl, card, 'tmux', 'card04', (_sid: string) => {
        if (_sid) _sessionId = _sid;
        if (!_initDone) {
          _initDone = true;
          refreshSessions();
        }
      }, false);
    },

    deactivate(contentEl: HTMLElement, card: CardInstance, reason: 'compact' | 'dismiss'): void {
      if (_gid) { gestures.unregister(_gid); _gid = null; }
      if (_resultHandler) { wsChannel.offMessage('tmux-result', _resultHandler); _resultHandler = null; }
      if (_onWsReconnect) { wsChannel.offReconnect(_onWsReconnect); _onWsReconnect = null; }
      if (reason === 'dismiss') {
        disposeTerminalCore(card, 'card04');
        _lastCommand = '';
        _attached = '';
        _sessions = [];
      } else {
        compactTerminalCore(card);
      }
      _bodyEl = null;
      _tabBar = null;
      _createForm = null;
      _sessionId = '';
      _card = null;
      _initDone = false;
      contentEl.innerHTML = '';
    },
  };
}
