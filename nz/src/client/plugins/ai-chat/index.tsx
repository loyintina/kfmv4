/**
 * src/client/plugins/ai-chat/index.tsx — AI 对话插件（ai-chat A1 阶段三 +
 * 2026-09-04 真机拍板交互改版；状态机清单 = docs/ai-chat-a1-design.md §3.3，
 * 契约 §7 机检锚点）。
 *
 * 三机七态十转换（词汇表唯一真源，清单外状态名禁止——P9）：
 *   页面机 TERMINAL ↔ AI_PAGE（A1/A2 点 orb——返回按钮已删，orb 即唯一
 *     开关；拍板⑪：TERMINAL 态 composer 发送等效 A1 自动开页，滑入动画
 *     照播，反向不成立；切走 run 不死——server 缓冲续命，切回 attach
 *     from cursor 补流，tmux-tabs 同哲学）；
 *   运行机 IDLE → WAITING → STREAMING → IDLE（chat-link 脑驱动，A3-A9）；
 *   菜单机 CLOSED ↔ MODEL_OPEN（picker 数据源 /ai/providers；拍板⑫两级
 *     路由——一级 provider 列表→点 provider 下钻二级 model 列表+server
 *     默认模型常驻行，点定 model 才收；下钻层级是 picker 内部 UI 态，
 *     不进菜单机词汇）。
 *
 * 形态（§3.0，2026-09-04 真机拍板四条+主会话裁定两条+同日二拍换序）：
 *   ① composer 全局化：从 AI 页拆出，钉中央终端页面**最底**全局常驻
 *      （同日二拍换序：旧=钉 keybar 正上方；新=composer 贴软键盘/视口底、
 *      keybar 钉 composer 正上方——点开软键盘时输入栏必须与键盘直接接触），
 *      随软键盘上浮，TERMINAL/AI_PAGE 两态都在且可发送；发送永远
 *      去 AI，终端输入照旧走 IME 诱饵——三者焦点不打架（P12）；
 *   ② 无返回按钮：AI orb = 唯一开关，层级恒在 AI 页之上（P10）；
 *   ③ AI 页入场动画 translateY(-100%)→0，收起反向播完才摘 DOM；时长/曲线
 *      走 --kfm-dur-normal/--kfm-ease-out（P11，JS 等待时长也读 token）；
 *   ④ 层级从底到顶：终端（含 tmux 控件/keybar）→ AI 页（z42）→ composer
 *      +AI orb（z43）；AI 页开时 tmux orb+标签栏 display:none 隐藏（不是
 *      被盖）；同日二拍换序后垂直次序（从底到顶）= 软键盘 → composer →
 *      keybar → 内容，终端 scrollEl 底部预留两条同高（--kfm-aichat-
 *      composer-h 经 ResizeObserver 实测单源下发）；拍板⑧+⑨：AI 页盖住
 *      keybar（终端与 AI 对话两套逻辑），页底=composer 顶（方案1——内容
 *      滚到底也不被钉底 composer 盖；keybar 在 composer 上方，页落到
 *      composer 顶正好仍盖着它；键盘弹起页底随 composer 一起上浮）。
 *
 * 观测钩（§4.2，公共契约）：__kfmNzAiChat() 同步报
 *   { page, menu, run{phase,runId,provider,model,cursor,deltas,chars,startedMs}|null,
 *     messages[{role,blocks,chars}], lastEvents[{t,type,idx,runId,phase,page}], lastError }
 */
import { createElement, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { UiPlugin, UiPluginHandle } from '../../kernel/ui-kernel.js';
import { createAiChatLink, type AiChatLink, type PageState, type RunPhase } from './chat-link.js';
import { MessageList } from './ui/message-list.js';
import { PromptBar, type MenuState } from './ui/prompt-bar.js';

export interface AiChatRuntime {
  page: PageState;
  menu: MenuState;
  run: {
    phase: RunPhase; runId: string; provider: string; model: string;
    cursor: number; deltas: number; chars: number; startedMs: number;
  } | null;
  messages: Array<{ role: string; blocks: number; chars: number }>;
  lastEvents: AiChatLink['ring'];
  lastError: string | null;
}

const AI_ICON = createElement('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-ink-2)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  createElement('path', { d: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' }));

// P11：收起动画的 JS 等待时长也从 token 计算样式读（--kfm-dur-normal 唯一
// 真源；B8 考卷拨 token 杠杆时等待同步跟随）
const readDurNormalMs = (): number => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--kfm-dur-normal').trim();
  const ms = /^([\d.]+)ms$/.exec(v);
  if (ms) return Number.parseFloat(ms[1]);
  const s = /^([\d.]+)s$/.exec(v);
  return s ? Number.parseFloat(s[1]) * 1000 : 250;
};

export function createAiChatPlugin(): UiPlugin {
  return {
    id: 'ai-chat',
    stateMachine: 'docs/ai-chat-a1-design.md',
    mount(slot: HTMLElement): UiPluginHandle {
      const runtimeRef: { current: AiChatRuntime } = {
        current: { page: 'TERMINAL', menu: 'CLOSED', run: null, messages: [], lastEvents: [], lastError: null },
      };
      const pageRef: { current: PageState } = { current: 'TERMINAL' };
      const menuRef: { current: MenuState } = { current: 'CLOSED' };

      const link = createAiChatLink(() => bump(), { page: () => pageRef.current });
      let bump: () => void = () => { /* React 未就绪前的早拍丢弃 */ };

      const refreshRuntime = (): void => {
        const r = link.run;
        runtimeRef.current = {
          page: pageRef.current,
          menu: menuRef.current,
          run: r ? {
            phase: link.state.phase, runId: r.runId, provider: r.provider, model: r.model,
            cursor: r.cursor, deltas: r.deltas, chars: r.chars, startedMs: r.startedMs,
          } : null,
          // 摘要，不回全文（§4.2）
          messages: link.state.messages.map((m) => ({
            role: m.role,
            blocks: m.content.length,
            chars: m.content.reduce((n, b) => n + ('text' in b && typeof b.text === 'string' ? b.text.length : 0)
              + ('reasoning' in b && typeof b.reasoning === 'string' ? b.reasoning.length : 0), 0),
          })),
          lastEvents: [...link.ring],
          lastError: link.lastError,
        };
      };

      function AiChatApp(): React.ReactElement {
        const [page, setPage] = useState<PageState>('TERMINAL');
        const [menu, setMenu] = useState<MenuState>('CLOSED');
        const [closing, setClosing] = useState(false);
        const [composerH, setComposerH] = useState(0);
        const [kbRise, setKbRise] = useState(0);
        const [, setTick] = useState(0);
        const listWrapRef = useRef<HTMLDivElement>(null);
        const barRef = useRef<HTMLDivElement>(null);
        const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        bump = () => { refreshRuntime(); setTick((x) => x + 1); };
        pageRef.current = page;
        menuRef.current = menu;
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => { refreshRuntime(); });

        useEffect(() => {
          void link.loadProviders();
          // A9 环境事件：页面回前台时活跃 run 补流（attach from cursor）
          const onVis = (): void => {
            if (document.visibilityState === 'visible') link.resumeStream();
          };
          document.addEventListener('visibilitychange', onVis);
          return () => {
            document.removeEventListener('visibilitychange', onVis);
            link.close();
          };
        }, []);

        // composer 钉最底随软键盘上浮（钉 vv 同哲学，term 容器同款）；
        // 换序后 keybar 由 term 侧钉在 composer 正上方（读同一 composer-h var）
        useEffect(() => {
          const vv = window.visualViewport;
          if (!vv) return;
          const onVv = (): void => setKbRise(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
          onVv();
          vv.addEventListener('resize', onVv);
          vv.addEventListener('scroll', onVv);
          return () => { vv.removeEventListener('resize', onVv); vv.removeEventListener('scroll', onVv); };
        }, []);

        // composer 高度 ResizeObserver 实测 → --kfm-aichat-composer-h 单源下发
        // （终端 scrollEl 底部预留 + keybar 钉位读此 var；本组件消费同一实测
        // 值做 AI 页底=composer 顶——拍板⑨方案1；覆写 tokens.css 静态默认，
        // 插件摘除时还原——§3.0/P10）
        useEffect(() => {
          const el = barRef.current;
          if (!el) return;
          const apply = (): void => {
            const h = el.getBoundingClientRect().height;
            setComposerH(h);
            document.documentElement.style.setProperty('--kfm-aichat-composer-h', `${h}px`);
          };
          apply();
          const ro = new ResizeObserver(apply);
          ro.observe(el);
          return () => { ro.disconnect(); document.documentElement.style.removeProperty('--kfm-aichat-composer-h'); };
        }, []);

        // 层级规则（拍板④+裁定⑤，P10）：AI 页打开时 tmux orb+标签栏
        // display:none 隐藏（不渲染档，不是被盖）；机关即复显
        useEffect(() => {
          document.documentElement.toggleAttribute('data-kfm-aichat-open', page === 'AI_PAGE');
        }, [page]);

        // 列表滚动纪律（term 8.8.3c 同哲学 + 拍板⑩）：
        //   真滚动件=[data-aichat-list]（wrap 是 flex 受限外壳不溢出，B12d
        //   量测实锤）——所有滚动操作只认它；
        //   被动事件（新 delta/渲染）只在「在底」时跟随，上滚阅读不拽回；
        //   主动意图（点开 AI 页 / 点输入栏聚焦 / 键盘上浮）= 追底锚定最新
        //   ——点输入栏=用户已表达「我要说话了」，覆盖上滚态是正确语义
        //   （聊天应用标准：键盘弹起即回最新，拍板⑩ 2026-09-04）
        // 在底判定**不用 scroll 事件**：程序化上滚后浏览器的 scroll 事件
        // 合并迟发且只报当前位置——若跟随 effect 抢在事件前回拽，事件以
        // 被拽回的位置到达，「上滚过」被整段抹掉（B12e0 调试实锤：手动
        //   dispatch 一枪 scroll 即不拽回=监听器在但真事件没送达）。改为
        // 渲染当拍直读 live 几何：scrollTop 与上一拍不同=外部滚动（内容
        // 增长不动 scrollTop）→按 live 位置重判在底，竞态结构性消除。
        const atBottomRef = useRef(true);
        const lastGeomRef = useRef({ st: -1, sh: -1 });
        const listScroller = (): HTMLElement | null => {
          const wrap = listWrapRef.current;
          if (!wrap) return null;
          return (wrap.firstElementChild as HTMLElement | null) ?? wrap;
        };
        const snapListToBottom = (): void => {
          atBottomRef.current = true;
          const sc = listScroller();
          if (!sc) return;
          sc.scrollTop = sc.scrollHeight;
          lastGeomRef.current = { st: sc.scrollTop, sh: sc.scrollHeight };
        };
        // 进页/收起动画期锚定最新（聊天标准开局位）
        useEffect(() => {
          if (page === 'AI_PAGE' || closing) snapListToBottom();
        }, [page, closing]);
        // 被动跟随：新内容落地仅在底时追底（上滚阅读不拽回）；先按 live
        // 位置变化重判在底，再决定跟不跟
        useEffect(() => {
          const sc = listScroller();
          if (!sc) return;
          const g = lastGeomRef.current;
          if (sc.scrollTop === g.st && sc.scrollHeight === g.sh) return;
          if (sc.scrollTop !== g.st) {
            atBottomRef.current = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 5;
          }
          if (atBottomRef.current) sc.scrollTop = sc.scrollHeight;
          lastGeomRef.current = { st: sc.scrollTop, sh: sc.scrollHeight };
        });
        // 拍板⑩触发源①：composer 聚焦（点输入栏=主动说话意图）→ 追底
        useEffect(() => {
          const bar = barRef.current;
          if (!bar) return;
          const onFocusIn = (): void => snapListToBottom();
          bar.addEventListener('focusin', onFocusIn);
          return () => bar.removeEventListener('focusin', onFocusIn);
        }, []);
        // 拍板⑩触发源②：键盘上浮（vv 收缩，面板随 composer 上浮）→ 布局
        // 落定后追底（仅上浮沿触发；收键盘不回拽阅读位）
        const prevKbRiseRef = useRef(0);
        useEffect(() => {
          if (kbRise > prevKbRiseRef.current) snapListToBottom();
          prevKbRiseRef.current = kbRise;
        }, [kbRise]);

        // A1：TERMINAL → AI_PAGE；有活跃 run → attach from cursor 补流。
        // 收起动画中途重开 = 作废摘除定时器、反播回滑入（动画归 CSS 类切换）
        const openPage = (): void => {
          if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
          setClosing(false);
          pageRef.current = 'AI_PAGE';
          setPage('AI_PAGE');
          link.resumeStream();
          refreshRuntime();
        };
        // A2：AI_PAGE → TERMINAL（点 orb，唯一开关）；run 不死（server 缓冲）。
        // 机先转、收起动画是呈现尾巴：translateY(0)→-100% 播完才摘 DOM（§3.0）
        const closePage = (): void => {
          link.suspendStream();
          menuRef.current = 'CLOSED';
          setMenu('CLOSED');
          pageRef.current = 'TERMINAL';
          setPage('TERMINAL');
          setClosing(true);
          if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
          closeTimerRef.current = setTimeout(() => { closeTimerRef.current = null; setClosing(false); }, readDurNormalMs());
          refreshRuntime();
        };
        const onMenu = (next: MenuState): void => { menuRef.current = next; setMenu(next); refreshRuntime(); }; // A10
        const onSelect = (provider: string, model: string): void => { link.selection = { provider, model }; refreshRuntime(); };

        // 常驻 orb（屏幕右中，2026-09-04 用户拍板自右上挪位——避开顶部
        // tmux 标签排伸出区）：AI 页唯一开关 + 运行指示灯；z43 恒在 AI 页
        // （z42）之上——否则页盖住球关不掉（P10 硬约束）
        const lit = link.state.phase !== 'IDLE';
        const orb = createElement('div', {
          'data-kfm-aichat-orb': '1',
          'data-aichat-lit': lit ? '1' : '0',
          onClick: (e: ReactMouseEvent) => { e.stopPropagation(); if (pageRef.current === 'AI_PAGE') closePage(); else openPage(); },
          onPointerDown: (e: ReactMouseEvent) => { e.stopPropagation(); },
          style: {
            position: 'fixed', top: '50%', right: '12px', transform: 'translateY(-50%)', zIndex: 43,
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--kfm-bar-bg)', border: '1px solid var(--kfm-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          },
        }, AI_ICON);

        // 全局 composer 条（拍板①+同日二拍换序：从 AI 页拆出钉**最底**全局
        // 常驻——bottom=键盘上浮量，无键盘时贴视口底、键盘弹起贴键盘顶
        // （输入栏与软键盘直接接触）；keybar 钉在 composer 正上方；
        // TERMINAL/AI_PAGE 两态都在且可发送——发送永远去 AI，
        // 终端 IME 诱饵照旧，三者焦点不打架 P12）
        const bar = createElement('div', {
          'data-kfm-aichat-bar': '1',
          ref: barRef,
          style: {
            position: 'fixed', left: 0, right: 0, bottom: `${kbRise}px`, zIndex: 43,
          },
        }, createElement(PromptBar, {
          phase: link.state.phase,
          menu,
          selection: link.selection,
          providersInfo: link.providersInfo,
          onMenu,
          onSelect,
          onSend: (text) => {
            // 拍板⑪（2026-09-04）：TERMINAL 态发送 = 主动说话意图，等效点
            // orb——自动开页（滑入动画照播），用户直接看到自己的消息与流式
            // 回复，不需手动再点球；反向不成立：页开着发送=页内发送，page
            // 不往返。openPage 幂等处理收起动画中途重开（作废摘除定时器）。
            if (pageRef.current !== 'AI_PAGE') openPage();
            void link.send(text);
          },
          onStop: () => { void link.cancel(); },
        }));

        if (page !== 'AI_PAGE' && !closing) return createElement('div', null, orb, bar);

        // 全屏 AI 页（z42：终端/tmux 控件之上、composer+orb 之下——P10 层序）：
        // 头部 / 消息区（借 chat.tsx 结构）；页底=composer 顶（拍板⑨方案1
        // 2026-09-04：面板落到输入栏上面——内容在面板内滚动时底部文字不再
        // 可能被钉底 composer 盖住，几何上不存在被盖可能；拍板⑧语义保持：
        // keybar 钉在 composer 正上方，面板落到 composer 顶正好仍盖着它；
        // 键盘弹起时面板底随 composer 一起上浮=键盘顶上的 composer 顶）
        return createElement('div', null,
          orb,
          bar,
          createElement('div', {
            'data-kfm-aichat': '1',
            className: closing ? 'kfm-closing' : '',
            style: {
              position: 'fixed', top: 0, left: 0, right: 0,
              bottom: `${composerH + kbRise}px`,
              zIndex: 42,
              background: 'var(--kfm-page)', color: 'var(--kfm-ink)',
              display: 'flex', flexDirection: 'column',
              fontFamily: 'var(--kfm-font-sans)',
              paddingTop: 'var(--sat, 0px)',
            },
          },
          createElement('div', {
            style: {
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              // 返回按钮已删（拍板②：orb 即唯一开关）——头部只剩居中标题
              padding: '10px 16px', borderBottom: '1px solid var(--kfm-aichat-line)',
            },
          },
          createElement('div', { style: { fontSize: '13px', color: 'var(--kfm-ink-2)' } },
            'AI 对话'),
          ),
          createElement('div', {
            ref: listWrapRef,
            style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
          }, createElement(MessageList, {
            messages: link.state.messages,
            msgIdx: link.state.msgIdx,
            phase: link.state.phase,
          })),
          ),
        );
      }

      const root = createRoot(slot);
      root.render(createElement(AiChatApp));
      // 判卷钩子（§4.2 观测基建，公共契约）
      (window as unknown as Record<string, unknown>).__kfmNzAiChat = () => runtimeRef.current;
      refreshRuntime();
      return {
        unmount: () => {
          link.close();
          root.unmount();
          document.documentElement.removeAttribute('data-kfm-aichat-open');
          delete (window as unknown as Record<string, unknown>).__kfmNzAiChat;
        },
      };
    },
  };
}
