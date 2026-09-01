/**
 * src/client/plugins/tmux-tabs/index.tsx — tmux 标签条（宪法 §6 Step 2
 * client 侧，2026-09-01）：**第一个内核 React 插件**。
 *
 * 数据（脑，纯 TS）：自开一条 WS 到 /ws/term，发 tmux-open（会话名=
 * URL ?tmuxSession= 参数，缺省 'dsh'）——控制通道推 tmux-state/tmux-exit；
 * 断线/无会话 3s 自动重试；select 发 tmux-select 帧。tmux 本尊是唯一
 * 事实源，本插件不维护任何窗口语义。
 * 皮（React）：顶部覆盖条——默认收成 14px 小把手（零遮挡），点开 36px
 * 标签排，点标签=切窗并自动收起；无窗整条隐藏。
 */
import { createElement, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { UiPlugin, UiPluginHandle } from '../../kernel/ui-kernel.js';

export interface TmuxWindow {
  id: string;
  name: string;
  active: boolean;
}

// ========== 脑（纯 TS：WS 连接 + 重试 + 发帧，不碰 DOM） ==========

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
  connect();
  return state;
}

// ========== 皮（React 组件） ==========

const BAR_BG = 'rgba(10,16,32,0.92)';
const BAR_ACCENT = '#3B82F6';

function TmuxTabs(props: {
  windows: TmuxWindow[];
  onSelect: (id: string) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const { windows, onSelect } = props;
  // 自观测环（2026-09-01 用户纠偏「自观测先于基建」）：每次渲染记账快照
  // （时刻/事实形态/展开/窗数）进环形缓冲——v1 不重构内部也能被观测；
  // 观测读数与 DOM 互证（考卷钉+真机 eval 直读）。
  const kind = windows.length === 0 ? 'hidden' : expanded ? 'bar' : 'handle';
  const snap = (window as unknown as Record<string, unknown>).__kfmNzTmuxTabsSnap as {
    ring: Array<{ t: number; kind: string; expanded: boolean; wins: number }>;
    push(s: { t: number; kind: string; expanded: boolean; wins: number }): void;
  } | undefined;
  if (snap) snap.push({ t: Date.now(), kind, expanded, wins: windows.length });
  if (windows.length === 0) return createElement('div', { 'data-tmux-tabs': 'hidden' });
  if (!expanded) {
    return createElement('div', {
      'data-tmux-tabs': 'handle',
      onClick: () => setExpanded(true),
      style: {
        position: 'fixed', top: 'var(--sat, 0px)', left: '50%', transform: 'translateX(-50%)',
        width: '72px', height: '14px', borderRadius: '0 0 10px 10px', background: BAR_BG,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 40, cursor: 'pointer', color: '#64748b', fontSize: '9px', lineHeight: '14px',
      },
    }, '▾ tmux');
  }
  return createElement('div', {
    'data-tmux-tabs': 'bar',
    style: {
      position: 'fixed', top: 'var(--sat, 0px)', left: 0, right: 0, height: '36px',
      background: BAR_BG, display: 'flex', alignItems: 'center', gap: '6px',
      padding: '0 8px', overflowX: 'auto', zIndex: 40,
    },
    onClick: () => setExpanded(false),
  }, windows.map((w) => createElement('div', {
    key: w.id,
    'data-tmux-win': w.name,
    'data-tmux-id': w.id,
    onClick: (e: ReactMouseEvent) => {
      e.stopPropagation();
      // 清单 T2/T3（P4）：点非聚焦标签=切窗且标签排必停 EXPANDED；
      // 点聚焦标签=收起回把手（T3，无 select）
      if (w.active) setExpanded(false);
      else onSelect(w.id);
    },
    style: {
      flex: '0 0 auto', padding: '3px 10px', borderRadius: '7px', fontSize: '12px',
      background: w.active ? BAR_ACCENT : 'rgba(51,65,85,0.85)',
      color: w.active ? '#fff' : '#cbd5e1', cursor: 'pointer', whiteSpace: 'nowrap',
    },
  }, w.name)));
}

// ========== 插件装配（契约签名：mount(slot, ctx) → handle） ==========

export interface TmuxTabsRuntime {
  windows: TmuxWindow[];
  visible: boolean;
  lastSelected: string;
  kind: string; // 事实形态投影：hidden | handle-or-bar（精细形态看 history 末拍）
  history: Array<{ t: number; kind: string; expanded: boolean; wins: number }>;
}

export function createTmuxTabsPlugin(session: string): UiPlugin {
  return {
    id: 'tmux-tabs',
    mount(slot: HTMLElement): UiPluginHandle {
      const runtimeRef: { current: TmuxTabsRuntime } = {
        current: { windows: [], visible: false, lastSelected: '' },
      };
      // 自观测环（真源在插件侧，组件每渲染推一拍）
      const ring: Array<{ t: number; kind: string; expanded: boolean; wins: number }> = [];
      const push = (s: { t: number; kind: string; expanded: boolean; wins: number }): void => {
        ring.push(s);
        if (ring.length > 40) ring.shift();
      };
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabsSnap = { ring, push };
      function TabsApp(): React.ReactElement {
        const [windows, setWindows] = useState<TmuxWindow[]>([]);
        const linkRef = useRef<TmuxLink | null>(null);
        useEffect(() => {
          const link = openTmuxLink(session, () => setWindows([...link.windows]));
          linkRef.current = link;
          return () => link.close();
        }, []);
        runtimeRef.current = {
          windows,
          visible: windows.length > 0,
          lastSelected: linkRef.current?.lastSelected ?? '',
          kind: windows.length === 0 ? 'hidden' : 'handle-or-bar',
          history: ((window as unknown as Record<string, unknown>).__kfmNzTmuxTabsSnap as { ring: unknown[] } | undefined)?.ring ?? [],
        };
        return createElement(TmuxTabs, {
          windows,
          onSelect: (id: string) => linkRef.current?.select(id),
        });
      }
      const root = createRoot(slot);
      root.render(createElement(TabsApp));
      // 判卷钩子（观测基建，公共契约）：kernel 考卷/C 档直读
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabs = () => runtimeRef.current;
      return {
        unmount: () => {
          root.unmount(); // Effect 清理链会带出 link.close()
        },
      };
    },
  };
}
