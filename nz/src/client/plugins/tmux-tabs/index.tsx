/**
 * src/client/plugins/tmux-tabs/index.tsx — tmux 标签条 v2.1（宪法 §6 Step 2
 * client 侧；状态机清单 docs/tmux-tabs-v2-state-machine.md）。
 *
 * 0902 用户四次仲裁：**标签从「窗」改回「会话」**——真机使用实锤，用户
 * 心智模型里标签=服务器上的 tmux 会话（amp/dsh/kfm-na/psh），而非单会话
 * 内的窗。数据源=服务器会话表轮询（tmux ls，3s 拍、变化才推）；窗级
 * TmuxControl 控制通道标签条不再使用（模块保留归 term-contract）。
 *
 * 状态机（清单 §一；state 由本组件唯一推导=可观测单源）：
 *   HANDLE（收起把手，常在）↔ EXPANDED（标签排）
 *   EXPANDED → OVERLAY_NEW（＋建会话毛玻璃）：确认=T5/T6、取消=T7
 *   EXPANDED → OVERLAY_CLOSE（×杀会话毛玻璃）：确认=T9、取消=T10
 * 附着语义（清单 §二）：
 *   点标签=attach 该会话（已附其他=先 detach 再附，T2s 嵌套禁止）；
 *   点聚焦标签=detach 回终端态；聚焦指示=本终端附着的会话。
 * 可观测：__kfmNzTmuxTabs() 报
 *   {state, sessions, attachedSession, expanded, overlay, history}。
 */
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { UiPlugin, UiPluginHandle } from '../../kernel/ui-kernel.js';

export interface TmuxSessionInfo {
  name: string;
  windows: number;
  attached: boolean;
}

/** 状态机词汇表（docs/tmux-tabs-v2-state-machine.md §一，清单外名字禁止） */
export type TmuxTabsState = 'HANDLE' | 'EXPANDED' | 'OVERLAY_NEW' | 'OVERLAY_CLOSE';

// ========== 脑（纯 TS：会话表 WS + 重试 + 发帧 + 环境事件，不碰 DOM） ==========

export interface SessionsLink {
  sessions: TmuxSessionInfo[];
  newSession(name: string): void;
  killSession(name: string): void;
  close(): void;
}

export function openSessionsLink(onUpdate: () => void): SessionsLink {
  const state: SessionsLink = {
    sessions: [],
    newSession(name: string): void {
      ws?.send(JSON.stringify({ t: 'tmux-session-new', name }));
    },
    killSession(name: string): void {
      ws?.send(JSON.stringify({ t: 'tmux-session-kill', name }));
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
    ws.onopen = () => ws!.send(JSON.stringify({ t: 'tmux-sessions-open' }));
    ws.onmessage = (ev) => {
      let m: { t?: string; sessions?: TmuxSessionInfo[] };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.t === 'tmux-sessions' && Array.isArray(m.sessions)) {
        state.sessions = m.sessions;
        onUpdate();
      }
    };
    ws.onclose = () => { onUpdate(); scheduleRetry(); };
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
  sessions: TmuxSessionInfo[];
  expanded: boolean;
  attachedSession: string | null;
  overlay: null | { kind: 'new' } | { kind: 'close'; target: TmuxSessionInfo };
  onExpand: (v: boolean) => void;
  onChipClick: (s: TmuxSessionInfo) => void;
  onNewConfirm: (name: string) => void;
  onCloseConfirm: (s: TmuxSessionInfo) => void;
  onOverlayCancel: () => void;
  onAskClose: (s: TmuxSessionInfo) => void;
  onPlus: () => void;
}): React.ReactElement {
  const { sessions, expanded, attachedSession, overlay, onExpand, onChipClick, onNewConfirm, onCloseConfirm, onOverlayCancel, onAskClose, onPlus } = props;
  const [newName, setNewName] = useState('');
  // 输入状态随毛玻璃页开关清零（0901 考卷实锤：残留旧名→二次建同名）
  useEffect(() => { if (overlay?.kind === 'new') setNewName(''); }, [overlay?.kind]);

  // 常驻把手（光球规格 32px 圆、左上）：点击=展开/收起切换。
  // 收起态：把手即全部；展开态：把手仍在原位（收起开关），标签排从其右侧展开。

  // 展开排：从把手右侧展开（锚定关系），＋固定右端（新标签出现位）
  const strip = expanded ? createElement('div', {
    'data-tmux-tabs': 'EXPANDED',
    style: {
      position: 'fixed', top: 'calc(var(--sat, 0px) + 12px)', left: '52px', right: '8px',
      height: '32px', background: BAR_BG, border: `1px solid ${HAIRLINE}`,
      display: 'flex', alignItems: 'center', gap: '6px', padding: '0 6px',
      overflowX: 'auto', zIndex: 40,
    },
    onClick: () => onExpand(false),
  },
  sessions.map((s) => createElement('div', { key: s.name, style: { display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' } },
    createElement('div', {
      'data-tmux-win': s.name,
      'data-tmux-id': s.name,
      onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onChipClick(s); },
      style: {
        padding: '3px 8px', borderRadius: '7px', fontSize: '12px',
        background: attachedSession === s.name ? BAR_ACCENT : 'rgba(51,65,85,0.85)',
        color: attachedSession === s.name ? '#fff' : '#cbd5e1', cursor: 'pointer', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: '6px',
      },
    }, s.name, createElement('span', {
      style: { fontSize: '10px', opacity: 0.65 },
    }, `·${s.windows}`)),
    createElement('span', {
      'data-tmux-close': s.name,
      onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onAskClose(s); },
      style: { color: '#8A93A3', cursor: 'pointer', fontSize: '12px', lineHeight: 1 },
    }, '×'),
  )),
  createElement('div', {
    'data-tmux-plus': '1',
    onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onPlus(); },
    style: {
      marginLeft: 'auto', flex: '0 0 auto', width: '26px', height: '24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${HAIRLINE}`, color: '#F5F7FA', cursor: 'pointer', fontSize: '14px',
    },
  }, '+'),
  ) : null;

  // 收起态把手（ vocabulary：HANDLE）
  const svgGrid = createElement('svg', { width: 14, height: 14, viewBox: '0 0 14 14' },
    createElement('rect', { x: 1, y: 1, width: 5, height: 5, fill: '#8A93A3' }),
    createElement('rect', { x: 8, y: 1, width: 5, height: 5, fill: '#8A93A3' }),
    createElement('rect', { x: 1, y: 8, width: 5, height: 5, fill: '#8A93A3' }),
    createElement('rect', { x: 8, y: 8, width: 5, height: 5, fill: '#8A93A3' }));
  const orbCircle = {
    position: 'fixed' as const, top: 'calc(var(--sat, 0px) + 12px)', left: '12px',
    width: '32px', height: '32px', borderRadius: '50%', background: BAR_BG,
    border: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
    opacity: sessions.length === 0 ? 0.55 : 1,
  };
  const collapsedOrb = createElement('div', {
    'data-tmux-tabs': 'HANDLE', 'data-tmux-orb': '1',
    onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onExpand(true); },
    style: { ...orbCircle, zIndex: 41 },
  }, svgGrid);

  // 展开态：把手常驻 + 标签排（ vocabulary：EXPANDED）
  const expandedOrb = createElement('div', {
    'data-tmux-orb': '1',
    onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onExpand(false); },
    style: { ...orbCircle, zIndex: 41 },
  }, svgGrid);
  const expandedTree = createElement('div', { 'data-tmux-tabs': 'EXPANDED' },
    // 0902 用户仲裁：展开后点屏幕空白区域 = 收起标签栏。
    // pointerEvents=none：不拦截第一次点击，让终端/keybar 同步响应；
    // 实际收起由 document pointerdown 捕获阶段处理（见 TabsApp useEffect）。
    createElement('div', {
      'data-tmux-backdrop': '1',
      style: { position: 'fixed', inset: 0, zIndex: 30, background: 'transparent', pointerEvents: 'none' },
    }),
    expandedOrb,
    strip,
  );

  const base = createElement('div', { 'data-tmux-tabs-root': '1' },
    expanded ? expandedTree : collapsedOrb,
  );
  // 毛玻璃二级页（T4-T10）：覆盖在标签排之上（z=60>40），标签排留在
  // DOM 作毛玻璃后的实景。0901 考卷实锤：重构时早退分支被删=点＋无
  // 页面，这里以覆盖层形式归位（不整页替换）。
  if (overlay?.kind === 'new') {
    return createElement('div', { 'data-tmux-tabs-root': '1' },
      expandedTree,
      createElement(OverlayPage, {
        title: '新会话',
        onConfirm: () => onNewConfirm(newName.trim()),
        onCancel: onOverlayCancel,
      }, createElement('input', {
        'data-tmux-new-name': '1', autoFocus: true, value: newName,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value),
        placeholder: '会话名（留空=自动编号）',
        style: {
          background: 'none', border: `1px solid ${HAIRLINE}`, color: '#F5F7FA',
          padding: '8px 10px', fontSize: '14px', outline: 'none', borderRadius: 0,
        },
      })),
    );
  }
  if (overlay?.kind === 'close') {
    return createElement('div', { 'data-tmux-tabs-root': '1' },
      expandedTree,
      createElement(OverlayPage, {
        title: `关闭会话 '${overlay.target.name}'？`,
        onConfirm: () => onCloseConfirm(overlay.target),
        onCancel: onOverlayCancel,
      }),
    );
  }
  return base;
}

// ========== 插件装配（契约签名：mount(slot, ctx) → handle） ==========

export interface TmuxTabsRuntime {
  state: TmuxTabsState;
  sessions: TmuxSessionInfo[];
  attachedSession: string | null;
  expanded: boolean;
  overlay: 'OVERLAY_NEW' | 'OVERLAY_CLOSE' | null;
  history: Array<{ t: number; state: string; expanded: boolean; n: number }>;
}

export function createTmuxTabsPlugin(): UiPlugin {
  return {
    id: 'tmux-tabs',
    stateMachine: 'docs/tmux-tabs-v2-state-machine.md',
    mount(slot: HTMLElement): UiPluginHandle {
      const runtimeRef: { current: TmuxTabsRuntime } = {
        current: { state: 'HANDLE', sessions: [], attachedSession: null, expanded: false, overlay: null, history: [] },
      };
      // 自观测环（观测先于基建）：状态名直引清单词汇
      const ring: Array<{ t: number; state: string; expanded: boolean; n: number }> = [];
      const push = (s: { t: number; state: string; expanded: boolean; n: number }): void => {
        ring.push(s);
        if (ring.length > 40) ring.shift();
      };
      (window as unknown as Record<string, unknown>).__kfmNzTmuxTabsSnap = { ring, push };

      function TabsApp(): React.ReactElement {
        const [sessions, setSessions] = useState<TmuxSessionInfo[]>([]);
        const [expanded, setExpanded] = useState(false);
        const [overlay, setOverlay] = useState<null | { kind: 'new' } | { kind: 'close'; target: TmuxSessionInfo }>(null);
        const linkRef = useRef<SessionsLink | null>(null);
        // 附着账本（清单 §二）：终端当前 attach 的会话名；null=终端态。
        // 附着会话被杀（T9/外部）→ 列表推送无它 → 塌回终端态。
        const attachedRef = useRef<string | null>(null);
        // 镜像 ref（0902 考卷⑤实锤：attach 只翻 ref 不动 useState=React
        // bail-out 不重渲，render 快照钩子报陈旧值）——钩子改读镜像，
        // ref-only 翻转处主动 refreshRuntime() 保钩子实时。
        const expandedRef = useRef(false);
        const overlayRef = useRef<null | 'OVERLAY_NEW' | 'OVERLAY_CLOSE'>(null);
        const sessionsRef = useRef<TmuxSessionInfo[]>([]);
        const termInject = (s2: string): void => {
          (window as unknown as Record<string, unknown>).__kfmNzTermInject?.(s2);
        };
        const deriveState = (): TmuxTabsState =>
          overlayRef.current === 'OVERLAY_NEW' ? 'OVERLAY_NEW'
            : overlayRef.current === 'OVERLAY_CLOSE' ? 'OVERLAY_CLOSE'
              : expandedRef.current ? 'EXPANDED' : 'HANDLE';
        const refreshRuntime = (): void => {
          runtimeRef.current = {
            state: deriveState(), sessions: sessionsRef.current,
            attachedSession: attachedRef.current, expanded: expandedRef.current,
            overlay: overlayRef.current, history: [...ring],
          };
          push({ t: Date.now(), state: runtimeRef.current.state, expanded: expandedRef.current, n: sessionsRef.current.length });
        };
        const enterSession = (name: string): void => {
          const attach = (): void => {
            termInject(`tmux new-session -A -s ${name}\r`);
            attachedRef.current = name;
            expandedRef.current = true;
            setExpanded(true);
            refreshRuntime();
          };
          if (attachedRef.current) {
            // T2s：tmux 嵌套禁止——先 detach 再附（P7）
            termInject('\u0002d');
            attachedRef.current = null;
            refreshRuntime();
            setTimeout(attach, 350);
          } else attach();
        };
        const leaveTmux = (): void => {
          termInject('\u0002d'); // Ctrl-B d：TUI 运行中也安全
          attachedRef.current = null;
          // 0902 用户仲裁：T3 回终端态时标签排保持展开（选择态），但清掉
          // tmux 残留画面；随后 Ctrl-L 重绘 prompt，给用户「已彻底回来」
          // 的视觉暗示。
          expandedRef.current = true;
          setExpanded(true);
          refreshRuntime();
          // detach 后清屏：真机 tmux 客户端退出有延迟，分两次清（500ms
          // 等退出 + 300ms 兜底），配合 ^L 让 readline 重绘 prompt。
          setTimeout(() => {
            (window as unknown as Record<string, unknown>).__kfmNzTermClear?.();
            termInject('\u000c');
            setTimeout(() => {
              (window as unknown as Record<string, unknown>).__kfmNzTermClear?.();
              termInject('\u000c');
            }, 300);
          }, 500);
        };
        const onChipClick = (s: TmuxSessionInfo): void => {
          if (attachedRef.current === s.name) leaveTmux(); // T3
          else enterSession(s.name); // T2/T2s
        };

        useEffect(() => {
          const link = openSessionsLink(() => {
            sessionsRef.current = [...link.sessions];
            setSessions([...link.sessions]);
            // 附着会话消失（被杀/外部）→ 塌回终端态
            if (attachedRef.current && !link.sessions.some((s) => s.name === attachedRef.current)) {
              attachedRef.current = null;
              expandedRef.current = false;
              setExpanded(false);
              refreshRuntime();
            }
          });
          linkRef.current = link;
          return () => link.close();
        }, []);

        // 0902 用户仲裁：选择态（EXPANDED）下点/滚/敲键盘等「开始操作屏幕」
        // 行为 = 收起标签栏；事件源在标签栏组件内部（把手/标签/+/×/毛玻璃）
        // 时不收起。
        useEffect(() => {
          const dismissIfScreenOp = (): void => {
            if (!expandedRef.current || overlayRef.current) return;
            expandedRef.current = false;
            setExpanded(false);
            refreshRuntime();
          };
          const isInsideTabs = (target: EventTarget | null): boolean =>
            !!(target instanceof HTMLElement && target.closest('[data-tmux-tabs-root]'));
          const onPointer = (e: PointerEvent): void => {
            if (!isInsideTabs(e.target)) dismissIfScreenOp();
          };
          const onWheel = (e: WheelEvent): void => {
            if (!isInsideTabs(e.target)) dismissIfScreenOp();
          };
          const onKey = (e: KeyboardEvent): void => {
            if (!expandedRef.current || overlayRef.current) return;
            if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].includes(e.key)) return;
            if (isInsideTabs(e.target)) return;
            dismissIfScreenOp();
          };
          // 捕获阶段：在事件到达终端/keybar 之前先收起标签栏（移除 backdrop），
          // 这样用户第一次点击就能同步操作屏幕，不会「先收栏再点一次」。
          document.addEventListener('pointerdown', onPointer, { passive: true, capture: true });
          document.addEventListener('wheel', onWheel, { passive: true, capture: true });
          document.addEventListener('keydown', onKey);
          return () => {
            document.removeEventListener('pointerdown', onPointer, { capture: true });
            document.removeEventListener('wheel', onWheel, { capture: true });
            document.removeEventListener('keydown', onKey);
          };
        }, []);

        // 权威镜像（渲染腿）：useState 真值回写 ref + 刷钩子
        useEffect(() => {
          expandedRef.current = expanded;
          sessionsRef.current = sessions;
          refreshRuntime();
        });
        useEffect(() => { overlayRef.current = overlay === null ? null : overlay.kind === 'new' ? 'OVERLAY_NEW' : 'OVERLAY_CLOSE'; refreshRuntime(); }, [overlay]);

        const onNewConfirm = (name: string): void => {
          // 客户端先查重（tmux 拒绝重名=静默失败的静默源，0902 清单 T5）
          if (name && !sessionsRef.current.some((s) => s.name === name)) {
            linkRef.current?.newSession(name);
            // 0902 用户仲裁：建完应直接进入并聚焦到新会话，而非收起等再点
            enterSession(name);
          }
          overlayRef.current = null;
          setOverlay(null);
          // 若重名/空名：保持展开态，让用户立即再操作；成功 attach 已由 enterSession 切 EXPANDED
          refreshRuntime();
        };
        const onCloseConfirm = (s: TmuxSessionInfo): void => {
          linkRef.current?.killSession(s.name);
          overlayRef.current = null;
          setOverlay(null); // T9
          refreshRuntime();
        };
        const onOverlayCancel = (): void => { overlayRef.current = null; setOverlay(null); refreshRuntime(); }; // T7/T10
        const onAskClose = (s: TmuxSessionInfo): void => { overlayRef.current = 'OVERLAY_CLOSE'; setOverlay({ kind: 'close', target: s }); refreshRuntime(); };
        const onExpand = (v: boolean): void => { expandedRef.current = v; setExpanded(v); refreshRuntime(); };

        return createElement(TmuxTabs, {
          sessions, expanded, attachedSession: attachedRef.current, overlay,
          onExpand, onChipClick, onNewConfirm, onCloseConfirm, onOverlayCancel,
          onAskClose,
          onPlus: () => { overlayRef.current = 'OVERLAY_NEW'; setOverlay({ kind: 'new' }); refreshRuntime(); },
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
