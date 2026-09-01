/**
 * src/client/plugins/tmux-tabs/index.tsx — tmux 标签条 v2（宪法 §6 Step 2
 * client 侧；状态机清单 docs/tmux-tabs-v2-state-machine.md，2026-09-01
 * 用户签收后实现）。
 *
 * 状态机（清单 §一/§二；state 由本组件唯一推导=可观测单源）：
 *   HIDDEN（无 tmux）↔ HANDLE（收起把手）↔ EXPANDED（标签排）
 *   EXPANDED → OVERLAY_NEW（＋建窗毛玻璃）：确认=T5/T6、取消/点罩层=T7
 *   EXPANDED → OVERLAY_CLOSE（×关窗毛玻璃）：确认=T9、取消/点罩层=T10
 * 环境事件：E1 visible 即补连；E2 毛玻璃卡锚 sat+18vh 避让键盘；E4 推送校准。
 * 可观测：__kfmNzTmuxTabs() 报全机位（state/windows/activeId/expanded/
 * overlay/lastSelected/order/history）+ 自观测环 40 拍。
 */
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { UiPlugin, UiPluginHandle } from '../../kernel/ui-kernel.js';

export interface TmuxWindow {
  id: string;
  name: string;
  active: boolean;
}

/** 状态机词汇表（docs/tmux-tabs-v2-state-machine.md §一，清单外名字禁止） */
export type TmuxTabsState = 'HANDLE' | 'EXPANDED' | 'OVERLAY_NEW' | 'OVERLAY_CLOSE';

// ========== 脑（纯 TS：WS 连接 + 重试 + 发帧 + 环境事件，不碰 DOM） ==========

export interface TmuxLink {
  windows: TmuxWindow[];
  linkUp: boolean;
  lastSelected: string;
  select(id: string): void;
  cmd(cmd: string): void;
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
    cmd(cmd: string): void {
      ws?.send(JSON.stringify({ t: 'tmux-cmd', session, cmd: cmd.slice(0, 200) }));
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
  // E1 环境事件：熄屏期定时器冻结=重试腿停走，回前台立即补测重连
  const onVis = (): void => {
    if (disposed || document.visibilityState !== 'visible') return;
    if (!ws || ws.readyState > WebSocket.OPEN) { clearTimeout(retryTimer); connect(); }
  };
  document.addEventListener('visibilitychange', onVis);
  connect();
  return state;
}

// ========== 拖动换序的脑（纯 TS 几何：乐观排序 → swap 命令串） ==========

/** 选择排序归位：当前顺序 → 期望顺序的最少 swap-window 串 */
export function swapsFor(current: TmuxWindow[], desiredIds: string[]): string[] {
  const cur = current.map((w) => w.id);
  const cmds: string[] = [];
  for (let i = 0; i < desiredIds.length; i++) {
    const want = desiredIds[i];
    const at = cur.indexOf(want);
    if (at < 0 || at === i) continue;
    const displaced = cur[i];
    cmds.push(`swap-window -s ${want} -t ${displaced}`);
    [cur[i], cur[at]] = [cur[at], cur[i]];
  }
  return cmds;
}

// ========== 皮（React 组件） ==========

const BAR_BG = 'rgba(10,16,32,0.92)';
const BAR_ACCENT = '#3B82F6';
const HAIRLINE = '#232833';

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    background: 'none', border: `1px solid ${primary ? '#F5F7FA' : HAIRLINE}`,
    color: primary ? '#F5F7FA' : '#8A93A3', padding: '6px 16px', fontSize: '13px',
    cursor: 'pointer', borderRadius: 0,
  };
}

/** 毛玻璃二级页骨架（T4-T10 共用；点罩层空白=取消） */
function OverlayPage(props: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactElement | null;
}): React.ReactElement {
  const { title, onConfirm, onCancel, children } = props;
  return createElement('div', {
    'data-tmux-overlay': '1',
    onClick: onCancel,
    style: {
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(2,6,16,0.45)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)', pointerEvents: 'auto',
    },
  }, createElement('div', {
    onClick: (e: ReactMouseEvent) => e.stopPropagation(),
    style: {
      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
      top: 'calc(var(--sat, 0px) + 18vh)', width: 'min(78vw, 320px)',
      background: 'rgba(10,14,20,0.96)', border: `1px solid ${HAIRLINE}`,
      padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '12px',
    },
  },
  createElement('div', { style: { color: '#F5F7FA', fontSize: '14px', letterSpacing: '0.04em' } }, title),
  children ?? null,
  createElement('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' } },
    createElement('button', { 'data-tmux-cancel': '1', onClick: onCancel, style: btnStyle(false) }, '取消'),
    createElement('button', { 'data-tmux-confirm': '1', onClick: onConfirm, style: btnStyle(true) }, '确认'),
  )));
}

function TmuxTabs(props: {
  windows: TmuxWindow[];
  expanded: boolean;
  overlay: null | { kind: 'new' } | { kind: 'close'; target: TmuxWindow };
  dragId: string | null;
  onExpand: (v: boolean) => void;
  onSelect: (id: string) => void;
  onChipClick: (w: TmuxWindow) => void;
  onNewConfirm: (name: string) => void;
  onCloseConfirm: (w: TmuxWindow) => void;
  onOverlayCancel: () => void;
  onChipPointerDown: (e: ReactPointerEvent, w: TmuxWindow) => void;
  onChipPointerMove: (e: ReactPointerEvent) => void;
  onChipPointerUp: (e: ReactPointerEvent) => void;
  onAskClose: (w: TmuxWindow) => void;
  onPlus: () => void;
}): React.ReactElement {
  const { windows, expanded, overlay, dragId, onExpand, onSelect, onNewConfirm, onCloseConfirm, onOverlayCancel, onChipPointerDown, onChipPointerMove, onChipPointerUp, onAskClose, onPlus, onChipClick } = props;
  const [newName, setNewName] = useState('');
  // 输入状态随毛玻璃页开关清零（0901 考卷实锤：残留旧名→二次建同名窗）
  const chipClick = useCallback((e: ReactMouseEvent, w: TmuxWindow): void => {
    e.stopPropagation();
    // T2/T3（P4）：非聚焦=切窗且停 EXPANDED；聚焦=收起回把手（无 select）
    if (w.active) onExpand(false);
    else onSelect(w.id);
  }, [onExpand, onSelect]);

  useEffect(() => { if (overlay?.kind === 'new') setNewName(''); }, [overlay?.kind]);
  if (overlay?.kind === 'new') {
    return createElement(OverlayPage, {
      title: '新窗口',
      onConfirm: () => onNewConfirm(newName.trim()),
      onCancel: onOverlayCancel,
    }, createElement('input', {
      'data-tmux-new-name': '1', autoFocus: true, value: newName,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value),
      placeholder: '窗口名（留空=跟随程序）',
      style: {
        background: 'none', border: `1px solid ${HAIRLINE}`, color: '#F5F7FA',
        padding: '8px 10px', fontSize: '14px', outline: 'none', borderRadius: 0,
      },
    }));
  }
  if (overlay?.kind === 'close') {
    return createElement(OverlayPage, {
      title: `关闭 '${overlay.target.name}'？`,
      onConfirm: () => onCloseConfirm(overlay.target),
      onCancel: onOverlayCancel,
    });
  }
  // 把手常在（2026-09-01 用户仲裁：＋入口不随最后窗口消失）：0 窗也渲染。
  // 形态=光球规格 32px 圆、靠左（sat+12px），SVG 四格窗格图标（无字符 emoji）。
  if (!expanded) {
    return createElement('div', {
      'data-tmux-tabs': 'HANDLE',
      'data-tmux-empty': windows.length === 0 ? '1' : '0',
      onClick: () => onExpand(true),
      style: {
        position: 'fixed', top: 'calc(var(--sat, 0px) + 12px)', left: '12px',
        width: '32px', height: '32px', borderRadius: '50%', background: BAR_BG,
        border: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 40, cursor: 'pointer', opacity: windows.length === 0 ? 0.55 : 1,
      },
    }, createElement('svg', {
      width: 14, height: 14, viewBox: '0 0 14 14', 'data-tmux-grid': '1',
    }, createElement('rect', { x: 1, y: 1, width: 5, height: 5, fill: '#8A93A3' }),
       createElement('rect', { x: 8, y: 1, width: 5, height: 5, fill: '#8A93A3' }),
       createElement('rect', { x: 1, y: 8, width: 5, height: 5, fill: '#8A93A3' }),
       createElement('rect', { x: 8, y: 8, width: 5, height: 5, fill: '#8A93A3' })));
  }
  return createElement('div', {
    'data-tmux-tabs': 'EXPANDED',
    style: {
      position: 'fixed', top: 'var(--sat, 0px)', left: 0, right: 0, height: '36px',
      background: BAR_BG, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex',
      alignItems: 'center', gap: '6px', padding: '0 8px', overflowX: 'auto', zIndex: 40,
    },
    onClick: () => onExpand(false),
  },
  createElement('div', {
    'data-tmux-plus': '1',
    onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onPlus(); },
    style: {
      flex: '0 0 auto', width: '26px', height: '24px', marginLeft: '2px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${HAIRLINE}`, color: '#F5F7FA', cursor: 'pointer', fontSize: '14px',
    },
  }, '+'),
  windows.map((w) => createElement('div', { key: w.id, style: { display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' } },
    createElement('div', {
      'data-tmux-win': w.name,
      'data-tmux-id': w.id,
      onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onChipClick(w); },
      onPointerDown: (e: ReactPointerEvent) => onChipPointerDown(e, w),
      onPointerMove: onChipPointerMove,
      onPointerUp: onChipPointerUp,
      style: {
        padding: '3px 8px', borderRadius: '7px', fontSize: '12px',
        background: w.active ? BAR_ACCENT : 'rgba(51,65,85,0.85)',
        color: w.active ? '#fff' : '#cbd5e1', cursor: 'pointer', whiteSpace: 'nowrap',
        touchAction: 'none', opacity: dragId === w.id ? 0.5 : 1,
        display: 'flex', alignItems: 'center', gap: '6px',
      },
    }, w.name),
    createElement('span', {
      'data-tmux-close': w.name,
      onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onAskClose(w); },
      onPointerDown: (e: ReactPointerEvent) => e.stopPropagation(), // × 不触发拖动
      style: { color: '#8A93A3', cursor: 'pointer', fontSize: '12px', lineHeight: 1 },
    }, '×'),
  )));
}

// ========== 插件装配（契约签名：mount(slot, ctx) → handle） ==========

export interface TmuxTabsRuntime {
  state: TmuxTabsState | 'OVERLAY_NEW' | 'OVERLAY_CLOSE';
  windows: TmuxWindow[];
  activeId: string | null;
  expanded: boolean;
  overlay: 'OVERLAY_NEW' | 'OVERLAY_CLOSE' | null;
  lastSelected: string;
  order: string[];
  attached: boolean;
  history: Array<{ t: number; state: string; expanded: boolean; wins: number }>;
}

export function createTmuxTabsPlugin(session: string): UiPlugin {
  return {
    id: 'tmux-tabs',
    stateMachine: 'docs/tmux-tabs-v2-state-machine.md',
    mount(slot: HTMLElement): UiPluginHandle {
      const runtimeRef: { current: TmuxTabsRuntime } = {
        current: { state: 'HANDLE', windows: [], activeId: null, expanded: false, overlay: null, lastSelected: '', order: [], history: [] },
      };
      // 自观测环（观测先于基建）：状态名直引清单词汇（修正三）
      const ring: Array<{ t: number; state: string; expanded: boolean; wins: number }> = [];
      const push = (s: { t: number; state: string; expanded: boolean; wins: number }): void => {
        ring.push(s);
        if (ring.length > 40) ring.shift();
      };
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabsSnap = { ring, push };
      const dbg: Record<string, number> = { down: 0, move: 0, dragmove: 0, reorder: 0, swap: 0, up: 0 };
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabsDbg = dbg;

      function TabsApp(): React.ReactElement {
        const [windows, setWindows] = useState<TmuxWindow[]>([]);
        const [expanded, setExpanded] = useState(false);
        const [overlay, setOverlay] = useState<null | { kind: 'new' } | { kind: 'close'; target: TmuxWindow }>(null);
        const [dragId, setDragId] = useState<string | null>(null);
        const linkRef = useRef<TmuxLink | null>(null);
        const drag = useRef<{ id: string; x0: number; holdTimer?: ReturnType<typeof setTimeout>; dragging: boolean; startWindows: TmuxWindow[] } | null>(null);
        const orderRef = useRef<string[]>([]);
        // 附窗账本（清单 §二·b）：终端是否 attach 在会话上。注入通道=公共
        // 契约钩子 __kfmNzTermInject（attach=tmux new-session -A；detach=Ctrl-B d）。
        const attachedRef = useRef(false);
        const termInject = (s2: string): void => {
          (window as unknown as Record<string, unknown>).__kfmNzTermInject?.(s2);
        };
        const enterTmux = (w: TmuxWindow): void => {
          linkRef.current?.select(w.id); // 会话当前窗=目标，attach 即显示
          termInject(`tmux new-session -A -s ${session}\r`);
          attachedRef.current = true;
          setExpanded(true); // T2a/T3b 终点 EXPANDED
        };
        const leaveTmux = (): void => {
          termInject('\u0002d'); // Ctrl-B d：TUI 运行中也安全
          attachedRef.current = false;
          setExpanded(false); // T3 终点 HANDLE（回终端视图）
        };
        const onChipClick = (w: TmuxWindow): void => {
          // 清单 §二·b：附窗条件点选语义
          if (attachedRef.current) {
            if (w.active) leaveTmux(); // T3：点聚焦=detach 回终端态
            else linkRef.current?.select(w.id); // T2：切窗，停 EXPANDED（P4）
          } else {
            enterTmux(w); // T2a/T3b：未附时点任意标签=attach 并显示
          }
        };

        useEffect(() => {
          const link = openTmuxLink(session, () => {
            setWindows([...link.windows]);
            orderRef.current = link.windows.map((w) => w.id);
          });
          linkRef.current = link;
          return () => link.close();
        }, []);

        const state: TmuxTabsState | 'OVERLAY_NEW' | 'OVERLAY_CLOSE' =
          overlay?.kind === 'new' ? 'OVERLAY_NEW'
            : overlay?.kind === 'close' ? 'OVERLAY_CLOSE'
              : expanded ? 'EXPANDED' : 'HANDLE';
        const activeId = windows.find((w) => w.active)?.id ?? null;

        runtimeRef.current = {
          state, windows, activeId, expanded,
          overlay: overlay === null ? null : overlay.kind === 'new' ? 'OVERLAY_NEW' : 'OVERLAY_CLOSE',
          lastSelected: linkRef.current?.lastSelected ?? '',
          order: [...orderRef.current],
          attached: attachedRef.current,
          history: [...ring],
        };
        push({ t: Date.now(), state, expanded, wins: windows.length });

        // ---- 拖动（T11）：按住 300ms 起拖，本地乐观排序，松手发 swap 串 ----
        const onChipPointerDown = (e: ReactPointerEvent, w: TmuxWindow): void => {
          dbg.down++;
          if (windows.length < 2) return;
          const x0 = e.clientX;
          drag.current = { id: w.id, x0, dragging: false, startWindows: [...windows] };
          drag.current.holdTimer = setTimeout(() => {
            if (drag.current?.id === w.id) { drag.current.dragging = true; setDragId(w.id); }
          }, 300);
        };
        const onChipPointerMove = (e: ReactPointerEvent): void => {
          dbg.move++;
          const d = drag.current;
          if (!d?.dragging) return;
          dbg.dragmove++;
          // 悬停目标 = 指针下方的其他标签（几何判定，皮只上报）
          const bar = e.currentTarget.closest('[data-tmux-tabs="EXPANDED"]');
          const chips = [...(bar?.querySelectorAll('[data-tmux-id]') ?? [])];
          const over = chips.find((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            return e.clientX >= r.left && e.clientX <= r.right;
          }) as HTMLElement | undefined;
          const overId = over?.getAttribute('data-tmux-id');
          if (!overId || overId === d.id) return;
          setWindows((prev) => {
            const from = prev.findIndex((w) => w.id === d.id);
            const to = prev.findIndex((w) => w.id === overId);
            if (from < 0 || to < 0 || from === to) return prev;
            const next = [...prev];
            const [m] = next.splice(from, 1);
            next.splice(to, 0, m);
            orderRef.current = next.map((w) => w.id);
            dbg.reorder++;
            return next;
          });
        };
        const onChipPointerUp = (): void => {
          const d = drag.current;
          dbg.up++;
          drag.current = null;
          setDragId(null);
          if (!d?.dragging) return;
          // 乐观排序 → swap 串（脑层几何）。基线=起手时服务器顺序
          // （本地已被乐观排序污染，直接对比恒得零——0901 考卷 dbg 实锤）。
          // 服务器推送为准（P5）。
          const cmds = swapsFor(d.startWindows, orderRef.current);
          dbg.swap += cmds.length;
          for (const c of cmds) linkRef.current?.cmd(c);
        };

        // ---- 动作（转换的底层语义） ----
        const onNewConfirm = (name: string): void => {
          if (name) {
            linkRef.current?.cmd(`new-window -n ${name}`);
            linkRef.current?.cmd('set -w automatic-rename off'); // 当前窗=新窗，名字钉死
          } else {
            linkRef.current?.cmd('new-window');
          }
          setOverlay(null);
          setExpanded(false); // 新窗聚焦在前，收起回终端视图（T5/T6）
        };
        const onCloseConfirm = (w: TmuxWindow): void => {
          linkRef.current?.cmd(`kill-window -t ${w.id}`);
          setOverlay(null); // T9；最后一张→会话结束→HIDDEN（语义自洽）
        };
        const onOverlayCancel = (): void => setOverlay(null); // T7/T10
        const onAskClose = (w: TmuxWindow): void => setOverlay({ kind: 'close', target: w });
        const onExpand = (v: boolean): void => setExpanded(v);
        const onSelect = (id: string): void => linkRef.current?.select(id);

        return createElement(TmuxTabs, {
          windows, expanded, overlay, dragId,
          onExpand, onSelect, onNewConfirm, onCloseConfirm, onOverlayCancel,
          onChipPointerDown, onChipPointerMove, onChipPointerUp, onAskClose,
          onPlus: () => setOverlay({ kind: 'new' }),
          onChipClick,
        });
      }
      const root = createRoot(slot);
      root.render(createElement(TabsApp));
      // 判卷钩子（观测基建，公共契约）
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabs = () => runtimeRef.current;
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabsDbgGet = () => dbg;
      return {
        unmount: () => {
          root.unmount();
        },
      };
    },
  };
}
