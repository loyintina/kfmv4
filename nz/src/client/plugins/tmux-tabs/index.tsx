/**
 * src/client/plugins/tmux-tabs/index.tsx — tmux 标签条（宪法 §6 Step 2
 * client 侧；v1 观测环回装 + 评审四修正吸收，2026-09-01）。
 *
 * 脑（纯 TS）：WS 连接 + 3s 重试腿 + E1 环境事件（visible 立即补测）+
 * select/new-window/kill-window 发帧。tmux 本尊是唯一事实源。
 * 皮（React）：顶部覆盖条（HANDLE 收起把手 / EXPANDED 标签排 / HIDDEN
 * 隐藏），状态机词汇表=docs/tmux-tabs-v2-state-machine.md（清单外
 * 状态名=规格外状态，禁止）。
 */
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { UiPlugin, UiPluginHandle } from '../../kernel/ui-kernel.js';

export interface TmuxWindow {
  id: string;
  name: string;
  active: boolean;
}

/** 状态机词汇表（docs/tmux-tabs-v2-state-machine.md §一，清单外名字禁止） */
export type TmuxTabsState = 'HIDDEN' | 'HANDLE' | 'EXPANDED';

// ========== 脑（纯 TS：WS 连接 + 重试 + 发帧 + 环境事件，不碰 DOM） ==========

export interface TmuxLink {
  windows: TmuxWindow[];
  linkUp: boolean;
  lastSelected: string;
  select(id: string): void;
  close(): void;
}

export function openTmuxLink(session: string, onUpdate: () => void): TmuxLink {
  const state: TmuxLink = {
    windows: [], linkUp: false, lastSelected: '',
    select(id: string): void {
      state.lastSelected = id;
      ws?.send(JSON.stringify({ t: 'tmux-select', session, id }));
      onUpdate();
    },
    close(): void {
      disposed = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVis);
      try { ws?.close(); } catch { /* 已断即达意 */ }
    },
  };
  let ws: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const connect = (): void => {
    if (disposed) return;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/term`;
    ws = new WebSocket(url);
    ws.onopen = () => ws!.send(JSON.stringify({ t: 'tmux-open', session }));
    ws.onmessage = (ev) => {
      let m: { t?: string; windows?: TmuxWindow[] };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.t === 'tmux-state' && Array.isArray(m.windows)) {
        state.windows = m.windows;
        state.linkUp = true;
        onUpdate();
      } else if (m.t === 'tmux-exit') {
        state.windows = [];
        state.linkUp = false;
        onUpdate();
        scheduleRetry();
      }
    };
    ws.onclose = () => { state.linkUp = false; onUpdate(); scheduleRetry(); };
    ws.onerror = () => { try { ws?.close(); } catch { /* 重试腿接管 */ } };
  };
  const scheduleRetry = (): void => {
    if (disposed) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 3000);
  };
  // E1 环境事件（评审修正一）：熄屏期定时器冻结=重试腿停走，回前台
  // 立即补测重连——不许让用户等满 3s
  const onVis = (): void => {
    if (disposed || document.visibilityState !== 'visible') return;
    if (!ws || ws.readyState > WebSocket.OPEN) { clearTimeout(retryTimer); connect(); }
  };
  document.addEventListener('visibilitychange', onVis);
  connect();
  return state;
}

// ========== 皮（React 组件；expanded 受控——钩子要报全机位） ==========

const BAR_BG = 'rgba(10,16,32,0.92)';
const BAR_ACCENT = '#3B82F6';

function TmuxTabs(props: {
  windows: TmuxWindow[];
  expanded: boolean;
  onExpand: (v: boolean) => void;
  onSelect: (id: string) => void;
}): React.ReactElement {
  const { windows, expanded, onExpand, onSelect } = props;
  const pick = useCallback((e: ReactMouseEvent, id: string, active: boolean): void => {
    e.stopPropagation();
    // 清单 T2/T3（P4）：非聚焦=切窗且停 EXPANDED；聚焦=收起（无 select）
    if (active) onExpand(false);
    else onSelect(id);
  }, [onExpand, onSelect]);
  if (windows.length === 0) return createElement('div', { 'data-tmux-tabs': 'HIDDEN' });
  if (!expanded) {
    return createElement('div', {
      'data-tmux-tabs': 'HANDLE',
      onClick: () => onExpand(true),
      style: {
        position: 'fixed', top: 'var(--sat, 0px)', left: '50%', transform: 'translateX(-50%)',
        width: '72px', height: '14px', borderRadius: '0 0 10px 10px', background: BAR_BG,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 40, cursor: 'pointer', color: '#64748b', fontSize: '9px', lineHeight: '14px',
      },
    }, '▾ tmux');
  }
  return createElement('div', {
    'data-tmux-tabs': 'EXPANDED',
    style: {
      position: 'fixed', top: 'var(--sat, 0px)', left: 0, right: 0, height: '36px',
      background: BAR_BG, display: 'flex', alignItems: 'center', gap: '6px',
      padding: '0 8px', overflowX: 'auto', zIndex: 40,
    },
    onClick: () => onExpand(false),
  }, windows.map((w) => createElement('div', {
    key: w.id,
    'data-tmux-win': w.name,
    'data-tmux-id': w.id,
    onClick: (e: ReactMouseEvent) => pick(e, w.id, w.active),
    style: {
      flex: '0 0 auto', padding: '3px 10px', borderRadius: '7px', fontSize: '12px',
      background: w.active ? BAR_ACCENT : 'rgba(51,65,85,0.85)',
      color: w.active ? '#fff' : '#cbd5e1', cursor: 'pointer', whiteSpace: 'nowrap',
    },
  }, w.name)));
}

// ========== 插件装配（契约签名：mount(slot, ctx) → handle） ==========

export interface TmuxTabsRuntime {
  state: TmuxTabsState;
  windows: TmuxWindow[];
  activeId: string | null;
  expanded: boolean;
  overlay: null; // v2 毛玻璃页落地后：'OVERLAY_NEW' | 'OVERLAY_CLOSE'
  lastSelected: string;
  history: Array<{ t: number; state: string; expanded: boolean; wins: number }>;
}

export function createTmuxTabsPlugin(session: string): UiPlugin {
  return {
    id: 'tmux-tabs',
    stateMachine: 'docs/tmux-tabs-v2-state-machine.md',
    mount(slot: HTMLElement): UiPluginHandle {
      const runtimeRef: { current: TmuxTabsRuntime } = {
        current: { state: 'HIDDEN', windows: [], activeId: null, expanded: false, overlay: null, lastSelected: '', history: [] },
      };
      // 自观测环（观测先于基建）：状态名直引清单词汇（修正三：词汇表强制统一）
      const ring: Array<{ t: number; state: string; expanded: boolean; wins: number }> = [];
      const push = (s: { t: number; state: string; expanded: boolean; wins: number }): void => {
        ring.push(s);
        if (ring.length > 40) ring.shift();
      };
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabsSnap = { ring, push };
      function TabsApp(): React.ReactElement {
        const [windows, setWindows] = useState<TmuxWindow[]>([]);
        const [expanded, setExpanded] = useState(false);
        const linkRef = useRef<TmuxLink | null>(null);
        useEffect(() => {
          const link = openTmuxLink(session, () => setWindows([...link.windows]));
          linkRef.current = link;
          return () => link.close();
        }, []);
        const state: TmuxTabsState = windows.length === 0 ? 'HIDDEN' : expanded ? 'EXPANDED' : 'HANDLE';
        const activeId = windows.find((w) => w.active)?.id ?? null;
        runtimeRef.current = {
          state, windows, activeId, expanded, overlay: null,
          lastSelected: linkRef.current?.lastSelected ?? '',
          history: [...ring],
        };
        push({ t: Date.now(), state, expanded, wins: windows.length });
        return createElement(TmuxTabs, {
          windows, expanded,
          onExpand: setExpanded,
          onSelect: (id: string) => linkRef.current?.select(id),
        });
      }
      const root = createRoot(slot);
      root.render(createElement(TabsApp));
      // 判卷钩子（观测基建，公共契约）
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabs = () => runtimeRef.current;
      return {
        unmount: () => {
          root.unmount();
        },
      };
    },
  };
}
