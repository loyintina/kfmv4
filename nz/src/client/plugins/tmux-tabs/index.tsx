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
import { getLinkTracker } from '../../term/link-state.js';
import { registryAdd, registryMissing, registryRemove, registrySnapshotIfEmpty } from '../../term/session-registry.js';

export interface TmuxSessionInfo {
  name: string;
  windows: number;
  attached: boolean;
  /** R2：任一窗有输出/响铃——非聚焦徽标信号源 */
  activity: boolean;
}

/** R2 徽标可见性（A 档直考纯规则）：有活动 且 不是当前附着中的会话
 *  （附着中=内容就在屏幕上，无需提示） */
export function activityBadgeVisible(info: TmuxSessionInfo, attachedSession: string | null): boolean {
  return !!info.activity && info.name !== attachedSession;
}

/** 状态机词汇表（docs/tmux-tabs-v2-state-machine.md §一，清单外名字禁止） */
export type TmuxTabsState = 'HANDLE' | 'EXPANDED' | 'OVERLAY_NEW' | 'OVERLAY_CLOSE';

/** R1 附着陆账键：reload 后自动重进的依据（sessionStorage 世内存续） */
const AS_KEY = 'nzTmuxAttached';

// ========== 脑（纯 TS：会话表 WS + 重试 + 发帧 + 环境事件，不碰 DOM） ==========

export interface SessionsLink {
  sessions: TmuxSessionInfo[];
  newSession(name: string): void;
  killSession(name: string): void;
  close(): void;
}

export function openSessionsLink(
  onUpdate: () => void,
  /** R3：当前附着会话查询（通知抑制用——附着中=内容在屏上不扰） */
  isAttached: () => string | null = () => null,
): SessionsLink {
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
      let m: { t?: string; sessions?: TmuxSessionInfo[]; session?: string; message?: string };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.t === 'tmux-sessions' && Array.isArray(m.sessions)) {
        state.sessions = m.sessions;
        onUpdate();
      }
      // R3 通知帧：非聚焦会话的「需要注意」事件 → 系统通知（有桥才响，
      // 浏览器/Via 静默降级只靠 R2 活动点）。附着中=内容在屏上，不扰。
      if (m.t === 'notify' && m.session) {
        if (isAttached() === m.session) return;
        // 可见性闸：用户正看着 nz → 系统通知全抑（R2 活动点已可感知）；
        // 切后台/息屏（hidden）才上通知栏
        if (document.visibilityState === 'visible') return;
        try {
          const win = window as unknown as { NzNative?: { pushNotice?: (t: string, b: string) => void } };
          win.NzNative?.pushNotice?.(`nz · ${m.session}`, m.message || '有任务需要你');
        } catch { /* 桥缺席/失败=降级，不挡 */ }
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

const BAR_BG = 'var(--kfm-bar-bg)';
const BAR_ACCENT = 'var(--kfm-accent)';
const HAIRLINE = 'var(--kfm-line)';

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    background: 'none', border: `1px solid ${primary ? 'var(--kfm-ink)' : HAIRLINE}`,
    color: primary ? 'var(--kfm-ink)' : 'var(--kfm-ink-3)', padding: '6px 16px', fontSize: '13px',
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
      background: 'var(--kfm-overlay-bg)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)', pointerEvents: 'auto',
    },
  }, createElement('div', {
    onClick: (e: ReactMouseEvent) => e.stopPropagation(),
    style: {
      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
      top: 'calc(var(--sat, 0px) + 18vh)', width: 'min(78vw, 320px)',
      background: 'var(--kfm-bar-bg)', border: `1px solid ${HAIRLINE}`,
      padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '12px',
    },
  },
  createElement('div', { style: { color: 'var(--kfm-ink)', fontSize: '14px', letterSpacing: '0.04em' } }, title),
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

  // 常驻把手（光球规格 32px 圆、左上）：展开/收起都渲染，通过 class 控制
  // 旋转动画。收起态点击=展开；展开态点击=收起。
  const svgGrid = createElement('svg', { width: 14, height: 14, viewBox: '0 0 14 14' },
    createElement('rect', { x: 1, y: 1, width: 5, height: 5, fill: 'var(--kfm-ink-3)' }),
    createElement('rect', { x: 8, y: 1, width: 5, height: 5, fill: 'var(--kfm-ink-3)' }),
    createElement('rect', { x: 1, y: 8, width: 5, height: 5, fill: 'var(--kfm-ink-3)' }),
    createElement('rect', { x: 8, y: 8, width: 5, height: 5, fill: 'var(--kfm-ink-3)' }));
  const orbCircle = {
    position: 'fixed' as const, top: 'calc(var(--sat, 0px) + 12px)', left: '12px',
    width: '32px', height: '32px', borderRadius: '50%', background: BAR_BG,
    border: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
    opacity: sessions.length === 0 ? 0.55 : 1,
  };
  const orb = createElement('div', {
    'data-tmux-tabs': expanded ? 'EXPANDED' : 'HANDLE', 'data-tmux-orb': '1',
    className: expanded ? 'kfm-expanded' : '',
    onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onExpand(!expanded); },
    onPointerDown: (e: ReactMouseEvent) => { e.stopPropagation(); },
    style: { ...orbCircle, zIndex: 41 },
  }, svgGrid);

  // 常驻标签排：通过 class 控制伸出/收回动画（DOM 常驻，scaleX 变换）。
  // ＋固定右端（新标签出现位）
  const strip = createElement('div', {
    'data-tmux-tabs': expanded ? 'EXPANDED' : 'COLLAPSED',
    'data-tmux-strip': '1',
    className: expanded ? 'kfm-expanded' : 'kfm-collapsed',
    style: {
      // 胶囊形态+宽度随内容（2026-09-03 用户拍板）：圆把手配胶囊行，
      // max-content 动态 hug 标签群，超长才封顶滚动；origin 左中保证
      // 伸出动画仍从把手右缘展开。
      position: 'fixed', top: 'calc(var(--sat, 0px) + 12px)', left: '52px',
      width: 'max-content', maxWidth: 'calc(100vw - 68px)',
      height: '32px', background: BAR_BG, border: `1px solid ${HAIRLINE}`,
      borderRadius: 'var(--kfm-radius-pill)',
      display: 'flex', alignItems: 'center', gap: '6px', padding: '0 6px',
      overflowX: 'auto', zIndex: 40, transformOrigin: 'left center',
    },
    onClick: () => onExpand(false),
  },
  sessions.map((s) => createElement('div', { key: s.name, style: { display: 'flex', alignItems: 'center', flex: '0 0 auto' } },
    createElement('div', {
      'data-tmux-win': s.name,
      'data-tmux-id': s.name,
      onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onChipClick(s); },
      style: {
        padding: '5px 12px 5px 14px', borderRadius: 'var(--kfm-radius-md)', fontSize: '12px',
        background: attachedSession === s.name ? BAR_ACCENT : 'var(--kfm-chip-bg)',
        color: attachedSession === s.name ? 'var(--kfm-ink)' : 'var(--kfm-ink-2)', cursor: 'pointer', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' as const,
      },
    },
      // R2 活动点（判据稿③）：非聚焦会话有输出/响铃 → 名前青点；
      // 附着中不亮（内容在屏上）；点进会话自然清除
      activityBadgeVisible(s, attachedSession) ? createElement('span', {
        'data-activity': '1',
        style: {
          width: '6px', height: '6px', borderRadius: '50%', flex: '0 0 auto',
          background: BAR_ACCENT, display: 'inline-block',
        },
      }) : null,
      s.name,
      // 窗口数仅 >1 时显示（常态单窗口，·1 是纯噪音，2026-09-03 用户拍板）
      s.windows > 1 ? createElement('span', {
        style: { fontSize: '10px', opacity: 0.65 },
      }, `·${s.windows}`) : null,
      // × 收进标签内部右端（2026-09-03 用户拍板）：标签=统一整体，
      // 控制不游离于视觉之外。stopPropagation 防触发整签切换。
      // × 右移防误触（同日二拍）：margin 左分量 -4→+4，× 整体右移 8px，
      // 名字到 × glyph 视觉距离 6→14px；右缘不变（距 chip 右 12px 不贴边）；
      // 热区技巧保留（padding 4 + 右/上/下 margin -4）。
      createElement('span', {
        'data-tmux-close': s.name,
        onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onAskClose(s); },
        style: {
          // 聚焦态蓝底上 ink-3 对比度太低（实测发虚），跟随签文字色
          color: attachedSession === s.name ? 'var(--kfm-ink)' : 'var(--kfm-ink-3)',
          opacity: attachedSession === s.name ? 0.75 : 1,
          cursor: 'pointer', fontSize: '12px', lineHeight: 1, padding: '4px', margin: '-4px -4px -4px 4px',
        },
      }, '×'),
    ),
  )),
  createElement('div', {
    'data-tmux-plus': '1',
    onClick: (e: ReactMouseEvent) => { e.stopPropagation(); onPlus(); },
    style: {
      // 圆形+跟队尾（2026-09-03 用户拍板）：摘掉 marginLeft:auto 不再钉
      // 行尾，贴最后一个标签右侧——新标签就出现在它左边（浏览器标签页同款）。
      flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${HAIRLINE}`, color: 'var(--kfm-ink)', cursor: 'pointer', fontSize: '14px',
    },
  }, '+'),
  );

  // 常驻 backdrop：展开后点屏幕空白区域 = 收起标签栏。
  // pointerEvents=none：不拦截第一次点击，让终端/keybar 同步响应；
  // 实际收起由 document pointerdown 捕获阶段处理（见 TabsApp useEffect）。
  const backdrop = createElement('div', {
    'data-tmux-backdrop': '1',
    className: expanded ? 'kfm-expanded' : 'kfm-collapsed',
    style: { position: 'fixed', inset: 0, zIndex: 30, background: 'transparent', pointerEvents: 'none' },
  });

  const expandedTree = createElement('div', { 'data-tmux-tabs-tree': '1' },
    backdrop,
    orb,
    strip,
  );

  const base = createElement('div', { 'data-tmux-tabs-root': '1' },
    expandedTree,
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
          background: 'none', border: `1px solid ${HAIRLINE}`, color: 'var(--kfm-ink)',
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
        const [attachedSession, setAttachedSession] = useState<string | null>(null);
        const linkRef = useRef<SessionsLink | null>(null);
        // 附着账本（清单 §二）：终端当前 attach 的会话名；null=终端态。
        // 0902 修复：attached 同时维护 state（驱动 React 重渲染，标签聚焦
        // 视觉立即更新）和 ref（钩子/逻辑立即读，避免异步陈旧）。
        const attachedRef = useRef<string | null>(null);
        const setAttached = (name: string | null): void => {
          attachedRef.current = name;
          setAttachedSession(name);
          // R1：附着陆账（sessionStorage 世内存续）——reload 后自动重进的依据
          try {
            if (name) sessionStorage.setItem(AS_KEY, name);
            else sessionStorage.removeItem(AS_KEY);
          } catch { /* 隐私模式：重进腿退化为手动点标签 */ }
        };
        const expandedRef = useRef(false);
        const overlayRef = useRef<null | 'OVERLAY_NEW' | 'OVERLAY_CLOSE'>(null);
        const sessionsRef = useRef<TmuxSessionInfo[]>([]);
        /** R1：缺失名单重算口（sessions effect 里落实体，ignore 腿即刷用） */
        const missingRef = useRef<() => void>(() => {});
        /** R1：会话表至少到过一帧（自动重进裁决的前提，防空表竞态误判） */
        const sessionsSeenRef = useRef(false);
        const termInject = (s2: string): void => {
          (window as unknown as Record<string, unknown>).__kfmNzTermInject?.(s2);
        };
        /** 常驻管道池（2026-09-12 终案）：每会话一条专属 tmux 客户端管道
         *  常驻复用；切换=卡身换绑（tail 回放秒显）——零打字零脱附，
         *  detach 闪烁与 0902 的 0.5-0.7s 延迟随打字驱动一并终结 */
        const poolRef = useRef<Map<string, string>>(new Map());
        /** 出生 zsh 管道 id（终端态的归处；boot 后由轮询捕获） */
        const zshIdRef = useRef<string | null>(null);
        /** 本地最近一次用户切换时刻（全局会话账的对账压制窗：防对账腿
         *  拿到旧账跟在途切换打架，2026-09-12 浮窗同步案） */
        const lastLocalSwitchRef = useRef(0);
        const termHooks = (): {
          openPty?: (c: string, cols: number, rows: number) => Promise<string>;
          bind?: (id: string) => void;
          reset?: () => void;
        } => {
          const w = window as unknown as Record<string, unknown>;
          return {
            openPty: w.__kfmNzTermOpenPty as ((c: string, cols: number, rows: number) => Promise<string>) | undefined,
            bind: w.__kfmNzTermBind as ((id: string) => void) | undefined,
            reset: w.__kfmNzTermReset as (() => void) | undefined,
          };
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
        // 出生 zsh 管道捕获（boot 后 ~1s 内出现；leaveTmux 的归处）
        useEffect(() => {
          const t = setInterval(() => {
            const id = (window as unknown as Record<string, unknown>).__kfmNzTermSession as string | undefined;
            if (id) { zshIdRef.current = id; clearInterval(t); }
          }, 250);
          return () => clearInterval(t);
        }, []);
        const enterSession = (name: string, quiet = false): void => {
          // 管道池切换（2026-09-12 终案）：卡身换绑到该会话的常驻专属管道
          // （B1 清界 → attachSession → tail 回放秒显）——零打字零脱附，
          // detach 闪烁与 0902 的 0.5-0.7s 延迟随打字驱动一并终结
          const h = termHooks();
          if (typeof h.openPty !== 'function' || typeof h.bind !== 'function' || typeof h.reset !== 'function') return;
          lastLocalSwitchRef.current = Date.now();
          void (async () => {
            let id = poolRef.current.get(name);
            if (!id) {
              const g = (window as unknown as Record<string, unknown>).__kfmNzTermScroll as (() => { cols: number; rows: number }) | undefined;
              const grid = g ? g() : { cols: 80, rows: 24 };
              try {
                id = await h.openPty(`tmux new-session -A -s ${name}`, grid.cols, grid.rows);
                poolRef.current.set(name, id);
              } catch { /* 拉起失败：下一拍重试 */ }
            }
            if (!id) return;
            h.reset?.(); // B1 边界：换绑前清核（旧管道行流残余不得带入）
            h.bind(id);
            setAttached(name);
            attachedRef.current = name;
            // 全局会话账（2026-09-12 浮窗同步案）：当前会话跨 WebView 单源
            // ——写 kfmActiveSession，浮窗 storage 到账静默跟绑；等值闸防环
            // （跟随路径到账时已是本值，不再广播）
            try {
              if (localStorage.getItem('kfmActiveSession') !== name) localStorage.setItem('kfmActiveSession', name);
            } catch { /* 隐私模式不挡 */ }
            // quiet=R1 自动重进腿：恢复现场但不抢注意力（标签排保持收起）
            expandedRef.current = !quiet;
            setExpanded(!quiet);
            refreshRuntime();
          })();
        };
        const leaveTmux = (): void => {
          // 管道池：换绑回出生 zsh 管道（终端态）——当前会话的管道保持附
          // 着待命（零脱附），随时一键切回；B1 清界后 ^L 重绘 prompt，
          // 0902「已彻底回来」暗示不变
          const h = termHooks();
          const zshId = zshIdRef.current;
          if (zshId && typeof h.bind === 'function' && typeof h.reset === 'function') {
            h.reset();
            h.bind(zshId);
            termInject('\u000c');
          } else {
            termInject('\u0002d'); // 兜底：无账（理论不可达）
          }
          lastLocalSwitchRef.current = Date.now();
          setAttached(null);
          // 全局会话账：终端态=空账（浮窗读到空串不跟——它无终端态概念）
          try {
            if (localStorage.getItem('kfmActiveSession') !== '') localStorage.setItem('kfmActiveSession', '');
          } catch { /* 隐私模式不挡 */ }
          expandedRef.current = true;
          setExpanded(true);
          refreshRuntime();
        };
        const onChipClick = (s: TmuxSessionInfo): void => {
          if (attachedRef.current === s.name) leaveTmux(); // T3
          else enterSession(s.name); // T2/T2s
        };

        // 全局会话账跟随（2026-09-12 浮窗同步案）：浮窗里切标签 → 主终端
        // 静默跟绑。storage 事件只在「别的文档」触发=写作方天然收不到自己
        // （防环第一道）；2.5s 对账腿兜底事件丢失/会话表晚到（最终一致）；
        // 未入账会话不跟（new-session -A 会凭空造会话）；本地动作 3s 压制
        // 窗防对账腿拿旧账跟在途切换打架
        const enterRef = useRef(enterSession);
        enterRef.current = enterSession;
        useEffect(() => {
          const follow = (name: string): void => {
            if (!name || attachedRef.current === name) return;
            if (Date.now() - lastLocalSwitchRef.current < 3000) return;
            if (!sessionsRef.current.some((s) => s.name === name)) return;
            enterRef.current(name, true); // quiet：跟绑不弹标签排（注意力不抢）
          };
          const onStorage = (e: StorageEvent): void => {
            if (e.key === 'kfmActiveSession') follow(e.newValue || '');
          };
          const reconcile = (): void => {
            try { follow(localStorage.getItem('kfmActiveSession') || ''); } catch { /* 隐私模式不挡 */ }
          };
          window.addEventListener('storage', onStorage);
          const t = setInterval(reconcile, 2500);
          // 判卷/自动化钩子（考卷 ⑧ 与外部 agent 编程切换口）
          (window as unknown as Record<string, unknown>).__kfmNzTmuxTabsEnter = (name: string): void => enterRef.current(name);
          return () => {
            window.removeEventListener('storage', onStorage);
            clearInterval(t);
          };
        }, []);

        useEffect(() => {
          const recomputeMissing = (): void => {
            getLinkTracker().setMissing(
              registryMissing(sessionsRef.current.map((s) => s.name)),
            );
          };
          missingRef.current = recomputeMissing;
          const link = openSessionsLink(() => {
            sessionsRef.current = [...link.sessions];
            setSessions([...link.sessions]);
            sessionsSeenRef.current = true;
            // R1：首装空账快照一次（只认显式语义，不旁观收账）+ diff 喂
            // 链路状态机（DEGRADED 源）
            registrySnapshotIfEmpty(sessionsRef.current.map((s) => s.name));
            recomputeMissing();
            // 附着会话消失（被杀/外部）→ 塌回终端态
            if (attachedRef.current && !link.sessions.some((s) => s.name === attachedRef.current)) {
              setAttached(null);
              expandedRef.current = false;
              setExpanded(false);
              refreshRuntime();
            }
          }, () => attachedRef.current);
          linkRef.current = link;
          return () => link.close();
        }, []);

        // R1 自动重进（2026-09-08 判据稿④）：reload 后账上有附着会话 →
        // 等两项事实齐了再动手——①term boot 落了 __kfmNzTermResumed
        // （true=续命成功：PTY 尾迹里 tmux 现场还在，只回填视觉账，防
        // tmux 套 tmux；false=全新 PTY：tmux 会话若还活着就真重进）；
        // ②会话表已到（活没活以表为准）。超时 10s 放弃（退化手动点）。
        useEffect(() => {
          let saved: string | null = null;
          try { saved = sessionStorage.getItem(AS_KEY); } catch { /* 无账 */ }
          if (!saved) return;
          let tries = 0;
          const timer = setInterval(() => {
            tries++;
            const win = window as unknown as Record<string, unknown>;
            const resumed = win.__kfmNzTermResumed;
            // 两项事实都齐才裁决：resumed 落值 + 会话表至少到过一帧
            //（防 race：resumed 早到、表未到 → 空表误判「会话没了」清账）
            if (typeof resumed !== 'boolean' || !sessionsSeenRef.current) {
              if (tries > 40) clearInterval(timer);
              return;
            }
            clearInterval(timer);
            const live = sessionsRef.current.map((s) => s.name);
            if (resumed) {
              if (live.includes(saved!)) setAttached(saved); // 现场已在，回填账
              else setAttached(null);
            } else if (live.includes(saved!)) {
              enterSession(saved!, true); // 全新 PTY+会话活着 → 真重进
            } else {
              setAttached(null);
            }
          }, 250);
          return () => clearInterval(timer);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // R1 横幅动作接线：link-banner 只报事件（插件间零直连），重建/
        // 忽略在这里落地——新建走既有 newSession 管线；忽略=出账+即刷
        useEffect(() => {
          const namesOf = (e: Event): string[] => {
            const d = (e as CustomEvent).detail as { names?: unknown } | undefined;
            const ns = d?.names;
            return Array.isArray(ns) ? ns.filter((n): n is string => typeof n === 'string') : [];
          };
          const onRebuild = (e: Event): void => {
            for (const n of namesOf(e)) linkRef.current?.newSession(n);
          };
          const onIgnore = (e: Event): void => {
            for (const n of namesOf(e)) registryRemove(n);
            missingRef.current();
          };
          document.addEventListener('kfm-nz-link-rebuild', onRebuild);
          document.addEventListener('kfm-nz-link-ignore', onIgnore);
          return () => {
            document.removeEventListener('kfm-nz-link-rebuild', onRebuild);
            document.removeEventListener('kfm-nz-link-ignore', onIgnore);
          };
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
          // 0902 修复：把手内部是 svg 图标，svg 不是 HTMLElement 而是
          // SVGElement，原判定会把点击把手误判为「外部点击」→ 触发 dismiss
          // → 展开后瞬间收起 → 闪烁。改用 Element 父类覆盖 svg/HTMLElement。
          const isInsideTabs = (target: EventTarget | null): boolean =>
            !!(target instanceof Element && target.closest('[data-tmux-tabs-root]'));
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
          attachedRef.current = attachedSession;
          expandedRef.current = expanded;
          sessionsRef.current = sessions;
          refreshRuntime();
        });
        useEffect(() => { overlayRef.current = overlay === null ? null : overlay.kind === 'new' ? 'OVERLAY_NEW' : 'OVERLAY_CLOSE'; refreshRuntime(); }, [overlay]);

        const onNewConfirm = (name: string): void => {
          // 客户端先查重（tmux 拒绝重名=静默失败的静默源，0902 清单 T5）
          if (name && !sessionsRef.current.some((s) => s.name === name)) {
            linkRef.current?.newSession(name);
            registryAdd(name); // R1：显式创建 = 入账（重建名单的唯一合法来源）
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
          registryRemove(s.name); // R1：显式杀 = 出账（缺失名单随之少一个）
          missingRef.current();
          overlayRef.current = null;
          setOverlay(null); // T9
          refreshRuntime();
        };
        const onOverlayCancel = (): void => { overlayRef.current = null; setOverlay(null); refreshRuntime(); }; // T7/T10
        const onAskClose = (s: TmuxSessionInfo): void => { overlayRef.current = 'OVERLAY_CLOSE'; setOverlay({ kind: 'close', target: s }); refreshRuntime(); };
        const onExpand = (v: boolean): void => { expandedRef.current = v; setExpanded(v); refreshRuntime(); };

        return createElement(TmuxTabs, {
          sessions, expanded, attachedSession, overlay,
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
