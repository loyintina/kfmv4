/**
 * src/client/plugins/browser/index.tsx — 浏览器器官（B-线 v0，2026-09-11
 * 用户拍板立项）。两个挂载形态，按页面查询参数二选一（main.ts 装配）：
 *
 *   · 普通模式（默认）：createBrowserPanelPlugin() —— 全屏管理面板
 *     （kfm-browser-panel-open 事件召唤；地址+尾随会话+打开/关闭浏览器
 *     +原生态轮询）。打开/关闭经 NzNative.enterBrowser/exitBrowser 调
 *     壳三层堆叠（browserWeb 全屏目标站 + floatWeb 终端浮窗）。
 *   · 浮窗专态（?float=1&fs=<会话>）：createBrowserFloatPlugin(session)
 *     —— 左竖线会话标签（3s 轮询 /api/tmux/sessions；点击经
 *     __kfmNzTermInject 走 detach+attach 真链路切会话）。本 WebView 是
 *     第二世界，attach 同一 tmux 会话=多路复用（结项记录「双开=设计内」）。
 *
 * UI 判据（设计基础判据 + 色彩专项 + tokens 单源）：间距 4px 刻度、字阶
 * 12/14、深色无纯黑纯白（--kfm-page/--kfm-ink）、强调稀缺（一屏一处
 * accent）、层级=字重>颜色>字号。
 *
 * 观测钩：__kfmBrowser() 报 {panel, native, url, session}。
 */
import { Fragment, createElement, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { UiPlugin, UiPluginHandle } from '../../kernel/ui-kernel.js';

const native = (): NzNativeLike | null => {
  const nz = (window as unknown as Record<string, unknown>).NzNative as NzNativeLike | undefined;
  return nz ?? null;
};

interface NzNativeLike {
  enterBrowser?: (url: string, session: string) => void;
  exitBrowser?: () => void;
  browserState?: () => string;
  /** 浮窗哑原语（2026-09-11 二轮：chrome 手势在页面，壳只执行） */
  floatDragBy?: (dxPx: number, dyPx: number) => void;
  floatCollapse?: (collapsed: boolean) => void;
  floatGhost?: (on: boolean) => void;
}

/** 默认直达页（2026-09-11 用户拍板：limestart；点 orb 直进不落中间页） */
const DEFAULT_URL = 'https://www.limestart.cn/';

/** 管理面板（普通模式） */
export function createBrowserPanelPlugin(): UiPlugin {
  return {
    id: 'browser',
    stateMachine: 'docs/browser-v0-design.md',
    mount(slot: HTMLElement): UiPluginHandle {
      const root = createRoot(slot);

      function Panel(): React.ReactElement {
        const [open, setOpen] = useState(false);
        const [url, setUrl] = useState(DEFAULT_URL);
        const [session, setSession] = useState('dsh');
        const [nativeState, setNativeState] = useState('（无桥=浏览器环境，打开仅记录）');
        const urlRef = useRef<HTMLInputElement | null>(null);

        useEffect(() => {
          const onOpen = (): void => {
            // 2026-09-11 用户拍板「不要中间页」：点 orb 直进浏览器模式
            // （默认页 DEFAULT_URL + 尾随当前附着会话）；无桥（headless/
            // 纯浏览器环境）才落管理面板兜底
            try {
              const s = (window as unknown as Record<string, unknown>).__kfmNzTmuxTabs as
                (() => { attachedSession: string | null }) | undefined;
              const cur = s?.().attachedSession;
              const n = native();
              if (n?.enterBrowser) { n.enterBrowser(DEFAULT_URL, cur || 'dsh'); return; }
            } catch { /* 桥不在场，落面板 */ }
            setOpen(true);
          };
          window.addEventListener('kfm-browser-panel-open', onOpen);
          return () => window.removeEventListener('kfm-browser-panel-open', onOpen);
        }, []);

        useEffect(() => {
          if (!open) return;
          const t = setInterval(() => {
            try { setNativeState(native()?.browserState?.() ?? '（无桥）'); } catch { /* 轮询失败不挡 */ }
          }, 2000);
          return () => clearInterval(t);
        }, [open]);

        const doOpen = (): void => {
          const n = native();
          if (!n?.enterBrowser) { setNativeState('（NzNative 不在场——headless/浏览器环境仅记录）'); return; }
          n.enterBrowser(url, session);
          setOpen(false);
        };
        const doCloseBrowser = (): void => {
          try { native()?.exitBrowser?.(); } catch { /* 无桥不挡 */ }
        };

        // 判据：间距 4px 刻度（8/16/24）；字阶 12/14；强调一屏一处（打开钮）；
        // 深色无纯黑纯白（--kfm-page/--kfm-ink/--kfm-field）。
        return createElement('div', {
          'data-browser-panel': '1',
          style: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 44,
            background: 'var(--kfm-page)', color: 'var(--kfm-ink)',
            display: open ? 'flex' : 'none', flexDirection: 'column',
            fontFamily: 'var(--kfm-font-sans)', padding: '16px',
          },
        },
        createElement('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '24px' } },
          createElement('div', { style: { flex: 1, fontSize: '16px', fontWeight: 500 } }, '浏览器'),
          createElement('button', {
            type: 'button', onClick: () => setOpen(false),
            style: {
              width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--kfm-line)',
              background: 'var(--kfm-bar-bg)', color: 'var(--kfm-ink-2)', fontSize: '14px', cursor: 'pointer',
            },
          }, '×'),
        ),
        createElement('div', { style: { fontSize: '11px', color: 'var(--kfm-ink-3)', marginBottom: '8px' } }, '地址'),
        createElement('input', {
          'data-browser-url': '1',
          value: url,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value),
          onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') doOpen(); },
          placeholder: 'https://…',
          style: {
            height: '40px', background: 'var(--kfm-field)', border: '1px solid var(--kfm-aichat-line)',
            borderRadius: '12px', padding: '0 12px', fontSize: '14px', color: 'var(--kfm-ink)',
            outline: 'none', marginBottom: '16px',
          },
        }),
        createElement('div', { style: { fontSize: '11px', color: 'var(--kfm-ink-3)', marginBottom: '8px' } }, '终端浮窗尾随会话'),
        createElement('input', {
          'data-browser-session': '1',
          value: session,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSession(e.target.value),
          style: {
            height: '36px', background: 'var(--kfm-field)', border: '1px solid var(--kfm-aichat-line)',
            borderRadius: '12px', padding: '0 12px', fontSize: '14px', color: 'var(--kfm-ink)',
            outline: 'none', marginBottom: '24px',
          },
        }),
        createElement('div', { style: { display: 'flex', gap: '12px', marginBottom: '24px' } },
          createElement('button', {
            'data-browser-open': '1', type: 'button', onClick: doOpen,
            style: {
              flex: 1, height: '40px', borderRadius: '8px', border: 'none',
              background: 'var(--kfm-accent)', color: 'var(--kfm-page)',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            },
          }, '打开浏览器'),
          createElement('button', {
            'data-browser-close': '1', type: 'button', onClick: doCloseBrowser,
            style: {
              height: '40px', padding: '0 16px', borderRadius: '8px', border: '1px solid var(--kfm-line)',
              background: 'var(--kfm-bar-bg)', color: 'var(--kfm-ink-2)', fontSize: '14px', cursor: 'pointer',
            },
          }, '关闭浏览器'),
        ),
        createElement('div', { style: { fontSize: '12px', color: 'var(--kfm-ink-3)', lineHeight: 1.6 } },
          '原生态：', nativeState,
          createElement('div', null, '浮窗=完整终端（可打字/滑历史/左竖线切会话）；控制钮点按折叠、按住透明。'),
        ),
        );
      }

      root.render(createElement(Panel));
      (window as unknown as Record<string, unknown>).__kfmBrowser = () => ({
        panelMounted: true, native: !!native(),
      });
      return {
        unmount: () => {
          root.unmount();
          delete (window as unknown as Record<string, unknown>).__kfmBrowser;
        },
      };
    },
  };
}

/** 浮窗专态：左竖线会话标签（3s 轮询；点击走 inject 真链路切会话） */
export function createBrowserFloatPlugin(session: string): UiPlugin {
  return {
    id: 'browser-float',
    stateMachine: 'docs/browser-v0-design.md',
    mount(slot: HTMLElement): UiPluginHandle {
      const root = createRoot(slot);

      function FloatTabs(): React.ReactElement {
        const [sessions, setSessions] = useState<string[]>([session]);
        const [active, setActive] = useState(session);
        useEffect(() => {
          sessionsRef.current = sessions; activeRef.current = active;
          if (attachedRefBridge) attachedRefBridge.current = attachedRef.current;
        });

        // 窗体外挂改造（2026-09-11 用户拍板「标签朝外，盖住终端很难看」）：
        // 终端层右移 26px 成圆角窗体（DOM 自画底色/描边），左檐 26px 透明=
        // 外挂标签轨，页面透底露出下层 browserWeb。26px 与壳 gutter 同值
        // （MainActivity layoutFloat 注释有同步约定，改需两头同步）
        useEffect(() => {
          const d = document.documentElement, b = document.body;
          const prevHtml = d.style.background, prevBody = b.style.background;
          d.style.background = 'transparent'; b.style.background = 'transparent';
          const layer = document.getElementById('kfm-layer-layout');
          if (layer) {
            layer.style.left = '26px';
            layer.style.width = 'auto';
            layer.style.right = '0px';
            layer.style.borderRadius = '12px';
            layer.style.overflow = 'hidden';
            layer.style.background = '#17181A';
            layer.style.boxShadow = '0 0 0 1px #3A3B3F';
          }
          // 标签轨滚动条隐藏（多会话滚动不做可视滚动条，触摸即可滚）
          const st = document.createElement('style');
          st.textContent = '[data-browser-float-tabs]::-webkit-scrollbar{display:none}';
          document.head.appendChild(st);
          return () => {
            d.style.background = prevHtml; b.style.background = prevBody;
            st.remove();
          };
        }, []);

        useEffect(() => {
          const pull = async (): Promise<void> => {
            try {
              const r = await fetch('/api/tmux/sessions', { cache: 'no-store' });
              if (r.ok) {
                const j = (await r.json()) as { sessions: string[] };
                if (Array.isArray(j.sessions)) {
                  setSessions(j.sessions.includes(active) || j.sessions.length === 0 ? j.sessions : [...j.sessions, active]);
                }
              }
            } catch { /* 服务器不在=保持现值 */ }
            try {
              // 折叠态对账（原生侧为准，本地乐观值防漂移）
              const st = native()?.browserState?.();
              const m = st && /collapsed=(true|false)/.exec(st);
              if (m) collapsedRef.current = m[1] === 'true';
            } catch { /* 无桥不挡 */ }
          };
          void pull();
          const t = setInterval(pull, 3000);
          return () => clearInterval(t);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // 附着账（浮窗世界起家=裸 zsh 未进 tmux）：首挂由下面的就绪轮询
        // 完成；切换时才需要 C-b d 脱离舞步（已附着前提下）
        const attachedRef = useRef(session);
        const readyRef = useRef(false); // 首挂注入完成=门闩开

        // 顶条三合一·DOM 手势版（2026-09-11 二轮，壳只留哑原语桥）：拖拽=
        // floatDragBy；点按=floatCollapse 翻转；长按 400ms 且位移<slop=
        // floatGhost 临时隐身（隐身中继续拖，松手恢复）。判据同原生版
        const barRef = useRef<HTMLDivElement | null>(null);
        const collapsedRef = useRef(false);
        useEffect(() => {
          const bar = barRef.current;
          const nz = native();
          if (!bar || !nz?.floatDragBy) return; // 无桥=无浮窗可操作
          let downX = 0, downY = 0, lastX = 0, lastY = 0, trav = 0;
          let ghostTimer = 0, ghosting = false, down = false;
          const slop = 8;
          const dpr = window.devicePixelRatio || 1;
          const onDown = (e: PointerEvent): void => {
            down = true; trav = 0; ghosting = false;
            downX = lastX = e.clientX; downY = lastY = e.clientY;
            ghostTimer = window.setTimeout(() => {
              if (down && trav < slop) { ghosting = true; nz.floatGhost?.(true); }
            }, 400);
            e.preventDefault();
          };
          let pendDx = 0, pendDy = 0, dragRaf = 0;
          const flushDrag = (): void => {
            dragRaf = 0;
            const dx = pendDx, dy = pendDy;
            pendDx = 0; pendDy = 0;
            if (dx !== 0 || dy !== 0) nz.floatDragBy?.(Math.round(dx), Math.round(dy));
          };
          const onMove = (e: PointerEvent): void => {
            if (!down) return;
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            trav = Math.max(trav, Math.hypot(e.clientX - downX, e.clientY - downY));
            if (trav > slop && ghostTimer) { clearTimeout(ghostTimer); ghostTimer = 0; }
            lastX = e.clientX; lastY = e.clientY;
            if (trav > slop) {
              // rAF 批处理（2026-09-12 卡顿案）：一帧最多一发货，增量累计
              // 零损失，桥压降一个量级
              pendDx += dx * dpr; pendDy += dy * dpr;
              if (!dragRaf) dragRaf = requestAnimationFrame(flushDrag);
            }
          };
          const onUp = (): void => {
            if (!down) return;
            down = false;
            if (ghostTimer) { clearTimeout(ghostTimer); ghostTimer = 0; }
            if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
            if (ghosting) { ghosting = false; nz.floatGhost?.(false); }
            // 未发的尾货先走，再 (0,0)=壳侧收笔提交（translation 并回布局位）
            if (pendDx !== 0 || pendDy !== 0) {
              nz.floatDragBy?.(Math.round(pendDx), Math.round(pendDy));
              pendDx = 0; pendDy = 0;
            }
            if (trav > slop) nz.floatDragBy?.(0, 0);
            else {
              const c = !collapsedRef.current;
              collapsedRef.current = c;
              nz.floatCollapse?.(c);
            }
          };
          bar.addEventListener('pointerdown', onDown);
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          window.addEventListener('pointercancel', onUp);
          return () => {
            bar.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
          };
        }, []);

        useEffect(() => {
          // 首挂就绪轮询：终端钩在场且屏非空（shell prompt 已画）才注入
          const t = setInterval(() => {
            const w = window as unknown as Record<string, unknown>;
            if (typeof w.__kfmNzTermInject !== 'function') return;
            if (((w.__kfmNzTermScreen as () => string)?.() ?? '').trim() === '') return;
            clearInterval(t);
            w.__kfmNzTermInject(`tmux new-session -A -s ${session}\r`);
            attachedRef.current = session;
            readyRef.current = true; // 门闩开：此后标签切换才生效
          }, 300);
          return () => clearInterval(t);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
        const switchTo = (name: string): void => {
          if (!readyRef.current) return; // 首挂未完成：点击无效（防与初始注入竞态）
          if (name === attachedRef.current) return;
          const inject = (window as unknown as Record<string, unknown>).__kfmNzTermInject as ((s: string) => void) | undefined;
          if (!inject) return;
          if (attachedRef.current) {
            // 已附着：C-b d 脱离 → 轮询屏现 detached → 命令重进（tmux-tabs
            // 同款；盲等 350ms 在慢分离时会漏字符进 shell——「dux 命令」案）
            inject('\u0002d');
            let attempts = 0;
            const t = setInterval(() => {
              attempts++;
              const scr = (window as unknown as Record<string, unknown>).__kfmNzTermScreen as (() => string) | undefined;
              const sNow = scr?.() ?? '';
              if (sNow.includes('detached') && !(window as unknown as Record<string, unknown>).__detachShot)
                (window as unknown as Record<string, unknown>).__detachShot = sNow;
              // 稳定才注入：屏含 detached 且连续 2 拍（250ms）不变=shell
              // prompt 已重绘完毕，此刻注入零竞态（tm 被撕咬案终结方案）
              if (sNow.includes('detached')) {
                const w2 = window as unknown as Record<string, unknown>;
                if (w2.__lastScr !== sNow) { w2.__lastScr = sNow; w2.__stable = 0; }
                else w2.__stable = (Number(w2.__stable ?? 0)) + 1;
                if (Number(w2.__stable ?? 0) >= 2 || attempts > 25) {
                  clearInterval(t);
                  w2.__switchInjectedAt = new Date().toISOString().slice(11, 19);
                  inject(`tmux new-session -A -s ${name}\r`);
                  attachedRef.current = name;
                  setActive(name);
                }
              }
            }, 125);
          } else {
            inject(`tmux new-session -A -s ${name}\r`);
            attachedRef.current = name;
            setActive(name);
          }
        };

        const barEl = createElement('div', {
          'data-browser-float-bar': '1',
          ref: barRef,
          key: 'bar',
          style: {
            position: 'fixed', top: 0, left: '26px', right: 0, height: '24px',
            zIndex: 400, pointerEvents: 'auto', touchAction: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        },
        createElement('div', {
          style: {
            width: '36px', height: '4px', borderRadius: '2px',
            background: '#3A3B3F',
          },
        }),
        );
        const railEl = createElement('div', {
          'data-browser-float-tabs': '1',
          style: {
            position: 'fixed', left: 0, top: 0, bottom: 0, width: '26px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            padding: '8px 0', pointerEvents: 'auto',
            overflowY: 'auto', overflowX: 'hidden', // 多会话：标签轨触摸滚动
          },
        },
        sessions.map((name) => createElement('div', {
          key: name,
          'data-browser-float-tab': name,
          onClick: () => switchTo(name),
          style: {
            writingMode: 'vertical-rl', fontSize: '10px', letterSpacing: '1px',
            padding: '8px 3px', borderRadius: '0 6px 6px 0', cursor: 'pointer',
            background: name === active ? 'rgba(10,132,255,0.28)' : 'rgba(35,36,39,0.85)',
            opacity: 1, // 就绪态；未就绪由 switchTo 门闩兜底
            color: name === active ? '#E0E0E0' : '#A5A8AD',
            border: '1px solid #3A3B3F', borderLeft: 'none',
            maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis',
          },
        }, name)),
        );
        return createElement(Fragment, null, barEl, railEl);
      }

      root.render(createElement(FloatTabs));
      (window as unknown as Record<string, unknown>).__kfmBrowserFloat = () => ({
        session: activeRef.current, sessions: sessionsRef.current,
        attached: attachedRefBridge.current,
      });
      return {
        unmount: () => {
          root.unmount();
          delete (window as unknown as Record<string, unknown>).__kfmBrowserFloat;
        },
      };
    },
  };
}

// 浮窗标签的实时读数（render 域写、钩读——mount 域桥接，file-tree listElBridge 同款）
const sessionsRef: { current: string[] } = { current: [] };
const activeRef: { current: string } = { current: '' };
const attachedRefBridge: { current: string } = { current: '' };
