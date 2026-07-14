/**
 * tmux-card.ts — 04 号 tmux 终端卡
 *
 * 职责边界：
 *   在 card03 终端基础设施之上实现 tmux session 管理。负责检测、选择、attach tmux session。
 *   不关心终端的渲染/滚动/WS 通信——那些委托给 terminal-card-04 的 initTerminalCore()。
 *
 * 生命周期：
 *   activate（init / compact→active）
 *     ↓ buildCardLayout → 创建 picker 容器 → initTerminalCore(autoOpen=false)
 *     ↓ WS 连接就绪 → onReady 回调发 tmux-cmd list-sessions
 *     ↓ 服务端返回结果：
 *       ├─ 0 session      → 显示 "no tmux sessions"
 *       ├─ 1 session      → reopenWithCommand('tmux attach -t <session>')
 *       └─ 多个 session    → reopenWithCommand('') 空 PTY + 显示 picker 按钮
 *                              ↓ 用户点击 picker 按钮 → attachViaInput() 发输入
 *   deactivate
 *     ├─ compact → compactTerminalCore（拔 DOM，保留终端 + WS）
 *     └─ dismiss → disposeTerminalCore（完整销毁）
 *
 * 关键设计决策：
 *   1. 为什么单 session 用 reopenWithCommand 重新开 PTY，而不是在现有 PTY 里 attach？
 *      因为自动 attach 需要干净的环境。在现有 PTY 里发 'tmux attach' 字符串可能受 shell
 *      状态影响（如等待命令完成、prompt 不匹配）。重新 spawn 确保初始状态可控。
 *   2. 为什么多 session 时先开空 PTY 再发输入 attach？
 *      因为 tmux attach 有交互输出，需要已有的 WS 连接来展示结果。空 PTY 展示终端界面，
 *      用户点击按钮时通过 PTY 输入 'tmux attach -t <session>' 完成 attach。
 *   3. picker 的手势（tmux-tap-）在 activate 注册、deactivate 注销，不与 card03 的 xterm-scroll 冲突。
 *
 * 闭包状态（非 meta 字段，在 createTmuxCardHandler 的闭包中管理）：
 *   _bodyEl: HTMLElement    — bodyEl 引用，用于 picker 挂载
 *   _picker: HTMLElement    — session 选择器容器
 *   _gid: string            — picker 手势 ID，deactivate 时注销
 *   _sessionId: string      — 当前 WS 会话 ID
 *   _card: CardInstance     — 当前卡片实例引用
 *   _initDone: boolean      — 首次 list-sessions 只发一次
 *   _resultHandler: function— WS tmux-result 回调引用
 *
 * card.meta 字段（继承自 terminal-card-04，由 initTerminalCore 写入）：
 *   同 terminal-card-04 的 meta 字段清单（terminalId / sessionId / _term / _fit 等）
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
      btn.style.touchAction = 'none';
      btn.setAttribute('data-session', s);
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
    tmcard(_card).meta._openTag = tag;
    wsChannel.sendMessage('terminal-open', { command, tag });
  }

  const onResult = (payload: unknown): void => {
    const p = payload as { cmd: string; result: { stdout: string; stderr: string; exitCode: number } };
    if (p.result.exitCode !== 0) {
      if (_picker) { _picker.innerHTML = '<span style="padding:2px 6px;color:rgba(224,224,224,0.45);font-size:var(--card-font-size,10px)">tmux not available</span>'; _picker.style.display = 'flex'; }
      return;
    }

    if (p.cmd === 'list-sessions') {
      const sessions = p.result.stdout.trim().split('\n').filter(Boolean);
      if (sessions.length === 0) {
        if (_picker) { _picker.innerHTML = '<span style="padding:2px 6px;color:rgba(224,224,224,0.45);font-size:var(--card-font-size,10px)">no tmux sessions</span>'; _picker.style.display = 'flex'; }
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

      // 加载并应用存储的字号偏好
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