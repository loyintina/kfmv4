/**
 * src/client/plugins/ai-chat/index.tsx — AI 对话插件（ai-chat A1 阶段三 +
 * 2026-09-04 真机拍板交互改版；状态机清单 = docs/ai-chat-a1-design.md §3.3，
 * 契约 §7 机检锚点）。
 *
 * 三机八态十一转换（词汇表唯一真源，清单外状态名禁止——P9）：
 *   页面机 TERMINAL ↔ AI_PAGE（A1/A2 点 orb——A2a 仲裁⑩修订：orb 从「开关」
 *     升级「AI 面板置顶/关闭切换器」，按**当前顶层**裁定：顶层=AI 页→点球=
 *     关面板（滑出动画，底下池页开着则池页复现）；顶层≠AI 页（终端态或池页
 *     盖着 AI）→点球=AI 页提到最上层出现，池页不关（提顶档 data-kfm-aichat-
 *     raised：池页降 41 让 AI 页 42 盖回池页上，球 45 恒顶）；拍板⑪：
 *     TERMINAL 态 composer 发送等效 A1 自动开页，滑入动画照播，反向不成立；
 *     切走 run 不死——server 缓冲续命，切回 attach from cursor 补流，
 *     tmux-tabs 同哲学）；
 *   运行机 IDLE → WAITING → STREAMING → IDLE（chat-link 脑驱动，A3-A9）；
 *   菜单机 CLOSED ↔ MODEL_OPEN ↔ CONFIG_OPEN（picker 数据源 /ai/providers；
 *     拍板⑫两级路由——一级 provider 列表→点 provider 下钻二级 model 列表
 *     +server 默认模型常驻行，点定 model 才收；下钻层级是 picker 内部 UI
 *     态，不进菜单机词汇；拍板⑬：点菜单外任意处即关且那一指动作同时生效
 *     ——document pointerdown 捕获阶段 passive 监听，不 preventDefault，
 *     tmux-tabs T15 同款；拍板⑯：CONFIG_OPEN=标题栏「默认会话 ▾」下拉
 *     出「角色/会话」两占位入口，选定=占位骨架一行+关菜单）。
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
          // 摘要，不回全文（§4.2）；A2a.5 三字段扩展=sessionId/sessionTitle/stats 摘要位
          messages: link.state.messages.map((m) => ({
            role: m.role,
            blocks: m.content.length,
            chars: m.content.reduce((n, b) => n + ('text' in b && typeof b.text === 'string' ? b.text.length : 0)
              + ('reasoning' in b && typeof b.reasoning === 'string' ? b.reasoning.length : 0), 0),
          })),
          sessionId: link.sessionId,
          sessionTitle: link.sessionTitle,
          lastEvents: [...link.ring],
          lastError: link.lastError,
        };
      };

      function AiChatApp(): React.ReactElement {
        const [page, setPage] = useState<PageState>('TERMINAL');
        const [menu, setMenu] = useState<MenuState>('CLOSED');
        // 拍板⑯（A2a 阶段三接真）：「角色/会话」入口=C12 路由真发——占位
        // 骨架随接真退役（config-pool-a2a-design §八⑨）
        const [closing, setClosing] = useState(false);
        const [composerH, setComposerH] = useState(0);
        const [kbRise, setKbRise] = useState(0);
        const [, setTick] = useState(0);
        // A2a.5 §五 下拉快选（D1-D7）：条目来自池，当前项来自总账；notice=D2
        // 系统提示条（不进消息核不落盘，§3.4）
        const [quick, setQuick] = useState<{
          roles: Array<{ id: string; name: string }>;
          sessions: Array<{ id: string; title: string; messageCount?: number }>;
          active: { roleFile: string; sessionId: string };
        }>({ roles: [], sessions: [], active: { roleFile: '', sessionId: '' } });
        const [notice, setNotice] = useState<string | null>(null);
        const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const showNotice = (text: string): void => {
          setNotice(text);
          if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = setTimeout(() => setNotice(null), 3500);
        };
        const listWrapRef = useRef<HTMLDivElement>(null);
        const barRef = useRef<HTMLDivElement>(null);
        const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        // 仲裁⑩（A2a 阶段三）：AI 页与池页同开时的**置顶账**——orb 把 AI 页
        // 提到池页之上（raised=true；tokens.css 据此把池页降 41 档，AI 页 42
        // 盖回池页上，球/输入栏 45 恒顶）。池页（重）开（C12 标题栏入口/事件
        // 直达；C1 左滑被 AI_PAGE 手势门禁死不会发生）→ AI 页回到池页之下。
        // 池页开闭经 config-pool 的层级闸属性 data-kfm-pool-open（跨插件 DOM
        // 通道，与 tokens.css/手势门同源）——false→true 即清提顶账。
        const aiRaisedRef = useRef(false);
        useEffect(() => {
          // C12 事件=入口意图（本插件标题栏按钮或外部路由同发）→ 池页召回
          // AI 之上：清提顶账并强制重渲染（attr 由每渲染 effect 随 ref 摘除；
          // 外部 dispatch 不经 React 事件，须手动触发渲染同步）
          const onRoute = (): void => { aiRaisedRef.current = false; setTick((x) => x + 1); };
          window.addEventListener('kfm-nz-pool-open', onRoute);
          // 仲裁⑫ 页面栈模型：池卡置顶=demote AI（清提顶账，池页复现 z44 档）——
          // 池侧手势经此事件通知，账仍归本插件（收敛 effect 落属性，不跨插件改 DOM）
          window.addEventListener('kfm-nz-aichat-demote', onRoute);
          const mo = new MutationObserver(() => {
            if (document.documentElement.hasAttribute('data-kfm-pool-open')) {
              aiRaisedRef.current = false;
              document.documentElement.removeAttribute('data-kfm-aichat-raised');
            }
          });
          mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kfm-pool-open'] });
          return () => {
            window.removeEventListener('kfm-nz-pool-open', onRoute);
            window.removeEventListener('kfm-nz-aichat-demote', onRoute);
            mo.disconnect();
            document.documentElement.removeAttribute('data-kfm-aichat-raised');
          };
        }, []);

        // 仲裁⑫ 置顶入场：提顶账 false→true 翻转沿上，AI 页重播入场动画
        // （类换名 kfm-aichat-raise-in 重启动画）。**播完不摘类**——摘类会把
        // animation-name 切回基础 page-in 导致底牌动画再播一遍（用户真机
        // 报告「播两遍」定罪）；类驻留无害，重播=移除→reflow→再加
        const prevRaisedRef = useRef(false);
        const raiseReplayRef = useRef<((el: Element) => void) | null>(null);
        raiseReplayRef.current = (el: Element): void => {
          el.classList.remove('kfm-raise');
          void el.offsetWidth; // 强制 reflow：类移除后再加，动画必重启
          el.classList.add('kfm-raise');
        };

        bump = () => { refreshRuntime(); setTick((x) => x + 1); };
        pageRef.current = page;
        menuRef.current = menu;
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => { refreshRuntime(); });

        useEffect(() => {
          void (async () => {
            await link.loadProviders();
            // A2a.5 §2.4 重开路径：总账 sessionId 在场 → 水合（「刷新即清空」退役）
            try {
              const r = await fetch('/pool/active');
              if (r.ok) {
                const led = (await r.json()) as { sessionId?: string };
                if (typeof led.sessionId === 'string' && led.sessionId) await link.loadSession(led.sessionId);
              }
            } catch { /* 总账不可得=空态新会话 */ }
          })();
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
        // display:none 隐藏（不渲染档，不是被盖）；机关即复显。
        // 仲裁⑩提顶档同步（每渲染收敛）：data-kfm-aichat-raised 只在
        // 「AI 页开+池页开+AI 被提顶」三条件同真时在场——AI 收起/池页不在场
        // 即摘（池页自然复现 z44 档）
        useEffect(() => {
          const doc = document.documentElement;
          doc.toggleAttribute('data-kfm-aichat-open', page === 'AI_PAGE');
          const raised = page === 'AI_PAGE' && aiRaisedRef.current && doc.hasAttribute('data-kfm-pool-open');
          if (raised && !doc.hasAttribute('data-kfm-aichat-raised')) {
            doc.setAttribute('data-kfm-aichat-raised', '');
            // 仲裁⑫ 置顶入场：AI 页重播从上滑入
            const el = doc.querySelector('[data-kfm-aichat]');
            if (el && !prevRaisedRef.current) raiseReplayRef.current?.(el);
          }
          if (!raised && doc.hasAttribute('data-kfm-aichat-raised')) doc.removeAttribute('data-kfm-aichat-raised');
          prevRaisedRef.current = raised;
        });

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

        // A1（仲裁⑩修订）：AI 页提到最上层出现——终端态=开页；池页开着=
        // 盖回池页上（raised 档，池页不关）。有活跃 run → attach from cursor
        // 补流。收起动画中途重开 = 作废摘除定时器、反播回滑入（动画归 CSS
        // 类切换）。已开页被池页盖住时再点球：page 不变（setPage 同值短路）
        // 也要强制重渲染同步提顶档 → setTick。
        const openPage = (): void => {
          if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
          setClosing(false);
          aiRaisedRef.current = document.documentElement.hasAttribute('data-kfm-pool-open');
          pageRef.current = 'AI_PAGE';
          setPage('AI_PAGE');
          link.resumeStream();
          refreshRuntime();
          setTick((x) => x + 1);
        };
        // A2：AI_PAGE → TERMINAL（点 orb，唯一开关）；run 不死（server 缓冲）。
        // 机先转、收起动画是呈现尾巴：translateY(0)→-100% 播完才摘 DOM（§3.0）
        const closePage = (): void => {
          link.suspendStream();
          menuRef.current = 'CLOSED';
          setMenu('CLOSED');
          aiRaisedRef.current = false; // 关 AI 即清提顶账（池页开着自然复现 z44 档）
          pageRef.current = 'TERMINAL';
          setPage('TERMINAL');
          setClosing(true);
          if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
          closeTimerRef.current = setTimeout(() => { closeTimerRef.current = null; setClosing(false); }, readDurNormalMs());
          refreshRuntime();
        };
        // A2a.5 D1：CONFIG_OPEN 打开即拉快选数据（条目=池壳投影，当前项=总账）
        useEffect(() => {
          if (menu !== 'CONFIG_OPEN') return;
          void (async () => {
            try {
              const [pr, ss, act] = await Promise.all([
                fetch('/pool/prompt'), fetch('/pool/session'), fetch('/pool/active'),
              ]);
              const roles = pr.ok ? ((await pr.json()) as Array<{ id: string; name?: string }>).map((e) => ({ id: e.id, name: e.name ?? e.id })) : [];
              const sessions = ss.ok ? ((await ss.json()) as Array<{ id: string; title?: string; messageCount?: number }>).map((e) => ({ id: e.id, title: e.title ?? e.id, messageCount: e.messageCount })) : [];
              const led = act.ok ? ((await act.json()) as { roleFile?: string; sessionId?: string }) : { roleFile: '', sessionId: '' };
              setQuick({
                roles,
                sessions,
                active: { roleFile: led.roleFile ?? '', sessionId: led.sessionId ?? '' },
              });
            } catch { /* 池不可得：菜单显示空表 */ }
          })();
        }, [menu]);
        // A2a.5 D2/D3 动作：切角色（只写总账 roleFile，D2 语义）/切会话（水合+恢复绑定）
        const selectRole = (id: string, name: string): void => {
          if (link.state.phase !== 'IDLE') return; // P18 同族：流式中不改配置
          void fetch('/pool/active', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ roleFile: id }),
          }).catch(() => { /* 尽力而为：总账写失败不影响菜单关闭 */ });
          setQuick((q) => ({ ...q, active: { ...q.active, roleFile: id } }));
          showNotice(`角色已切换为「${name}」，下一条消息起生效`);
          onMenu('CLOSED');
        };
        const selectSession = (id: string, _title: string): void => {
          if (link.state.phase !== 'IDLE') return; // P18 流式禁切会话
          void link.loadSession(id).then((ok) => {
            if (ok) {
              setQuick((q) => ({ ...q, active: { ...q.active, sessionId: id } }));
              onMenu('CLOSED');
            }
          });
        };
        const onMenu = (next: MenuState): void => {
          menuRef.current = next;
          setMenu(next);
          // A2a §3.5 接点（B6 picker ✓ 同步）：开 picker 即重取 /ai/providers
          // + /pool/active——激活标移动后（池页「设为激活」）菜单打开即随总账
          if (next === 'MODEL_OPEN') void link.loadProviders();
          refreshRuntime();
        };
        const onSelect = (provider: string, model: string): void => {
          link.selection = { provider, model };
          // A2a §3.5 接点（拍板⑥联动）：picker 选中=显式激活动作 → 写总账
          // （POST /pool/active）——刷新后读总账复原，picker 第一次有持久化
          void fetch('/pool/active', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ providerId: provider, modelId: model }),
          }).catch(() => { /* 总账暂不可得：选中仍生效（run 请求显式带） */ });
          refreshRuntime();
        };

        // 拍板⑬（2026-09-04）：picker 点菜单外任意处即关，且那一指的动作
        // **同时**生效（点终端=聚焦打字+菜单关、点消息区=交互+菜单关，无感
        // 同发）——tmux-tabs T15 同款：document pointerdown 捕获阶段 passive
        // 监听，不 preventDefault/stopPropagation，下层焦点/点击照走。菜单
        // DOM 内（下钻/选择/返回）与模型钮自身（toggle 语义）豁免；菜单机
        // 词汇不变（CLOSED↔MODEL_OPEN，P9）
        // 拍板⑯泛化：对任意开着的菜单生效（CLOSED 才短路），豁免加配置
        // 下拉钮+配置菜单 DOM——点 composer 即关菜单且焦点同指进输入框。
        useEffect(() => {
          if (menu === 'CLOSED') return;
          const onPointer = (e: PointerEvent): void => {
            const t = e.target;
            if (t instanceof Element && t.closest('[data-aichat-model-menu], [data-aichat-model-btn], [data-aichat-config-menu], [data-aichat-config-btn]')) return;
            onMenu('CLOSED');
          };
          document.addEventListener('pointerdown', onPointer, { passive: true, capture: true });
          return () => document.removeEventListener('pointerdown', onPointer, { capture: true });
        }, [menu]);

        // 常驻 orb（屏幕右中，2026-09-04 用户拍板自右上挪位——避开顶部
        // tmux 标签排伸出区）：AI 页唯一开关 + 运行指示灯；z43 恒在 AI 页
        // （z42）之上——否则页盖住球关不掉（P10 硬约束）
        // 仲裁⑩（A2a 阶段三）：球=AI 面板「置顶/关闭」切换器，按**当前顶层**
        // 裁定——顶层=AI 页（终端态开页，或池页上已提顶）→关（滑出动画）；
        // 顶层≠AI 页（终端态，或池页开着盖住 AI）→AI 页提到最上层（池页不关）
        const lit = link.state.phase !== 'IDLE';
        const orb = createElement('div', {
          'data-kfm-aichat-orb': '1',
          'data-aichat-lit': lit ? '1' : '0',
          onClick: (e: ReactMouseEvent) => {
            e.stopPropagation();
            const aiTop = pageRef.current === 'AI_PAGE'
              && !(document.documentElement.hasAttribute('data-kfm-pool-open') && !aiRaisedRef.current);
            if (aiTop) closePage(); else openPage();
          },
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
        // 键盘弹起时面板底随 composer 一起上浮=键盘顶上的 composer 顶）。
        // 拍板⑰：页顶**不吃 --sat 垫**（不避挖孔屏/刘海——sat 链只服务
        // 终端容器 edge-to-edge 拍板链，AI 页标题栏顶=视口顶恒一行高）
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
            },
          },
          // 拍板⑯（2026-09-04）标题栏一行；A2a.5 §五：下拉钮标题=当前会话名
          // （水合带回），CONFIG_OPEN=快选（D1-D7）：角色/会话两组条目+当前项
          // ✓+「管理…」跳池页；流式中禁切（P18 置灰）；点外/Escape 关=⑬同款
          createElement('div', {
            'data-aichat-header': '1',
            style: {
              position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center',
              padding: '3px 10px', borderBottom: '1px solid var(--kfm-aichat-line)',
            },
          },
          createElement('button', {
            'data-aichat-config-btn': '1',
            type: 'button',
            onClick: () => onMenu(menu === 'CONFIG_OPEN' ? 'CLOSED' : 'CONFIG_OPEN'),
            style: {
              display: 'flex', alignItems: 'center', gap: '4px', height: '26px', padding: '0 6px',
              border: 'none', background: 'none', cursor: 'pointer', borderRadius: 'var(--kfm-radius-md)',
              fontSize: '13px', color: 'var(--kfm-ink-2)',
            },
          },
          link.sessionTitle ?? '新会话',
          createElement('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--kfm-ink-3)', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' },
            createElement('path', { d: 'M6 9l6 6 6-6' })),
          ),
          menu === 'CONFIG_OPEN'
            ? createElement('div', {
                'data-aichat-config-menu': '1',
                style: {
                  position: 'absolute', left: '8px', top: '100%', marginTop: '4px', zIndex: 10,
                  minWidth: '170px', maxHeight: '50vh', overflowY: 'auto', background: 'var(--kfm-surface)',
                  /* maxHeight 禁用百分比（2026-09-05 真机截图实证）：absolute 于
                   * 33px 标题栏内，60% ≈ 20px → 条目全被裁进滚动区不可见（L1/L3
                   * 缝隙第三次实锤——DOM 钉绿而像素坏）。vh 相对视口，稳定。 */
                  borderRadius: 'var(--kfm-radius-lg)', boxShadow: 'var(--kfm-shadow-raised)', padding: '4px',
                },
              },
              // —— 角色组（快选：条目=agent-prompt 池，✓=激活 roleFile） ——
              createElement('div', {
                style: { padding: '4px 8px', fontSize: '11px', color: 'var(--kfm-ink-3)' },
              }, `角色 · ${quick.roles.length}`),
              ...quick.roles.map((r) =>
                createElement('button', {
                  key: `role-${r.id}`,
                  'data-aichat-config-entry': `role:${r.id}`,
                  type: 'button',
                  onClick: () => selectRole(r.id, r.name),
                  style: {
                    display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 8px',
                    border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                    borderRadius: 'var(--kfm-radius-sm)', fontSize: '12.5px', color: 'var(--kfm-ink)',
                    opacity: link.state.phase === 'IDLE' ? 1 : 0.45, // P18 流式禁切
                  },
                },
                createElement('span', { style: { width: '12px', color: 'var(--kfm-accent)' } },
                  quick.active.roleFile === r.id ? '✓' : ''),
                r.name,
                quick.active.roleFile === r.id ? createElement('span', { style: { fontSize: '10px', color: 'var(--kfm-ink-3)' } }, '· 激活') : null),
              ),
              quick.roles.length === 0
                ? createElement('div', { style: { padding: '4px 8px', fontSize: '11.5px', color: 'var(--kfm-ink-3)' } }, '（空）agent-prompt 池')
                : null,
              createElement('button', {
                key: 'role-manage',
                'data-aichat-config-entry': 'role:manage',
                type: 'button',
                onClick: () => {
                  onMenu('CLOSED');
                  aiRaisedRef.current = false;
                  window.dispatchEvent(new CustomEvent('kfm-nz-pool-open', { detail: { pool: 'prompt' } }));
                },
                style: {
                  display: 'flex', width: '100%', padding: '6px 8px', border: 'none', background: 'none',
                  cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--kfm-radius-sm)',
                  fontSize: '11.5px', color: 'var(--kfm-ink-3)',
                },
              }, '管理 prompt 池…'),
              // —— 会话组（快选：条目=session 池壳，✓=激活 sessionId；P18 置灰） ——
              createElement('div', {
                style: { padding: '4px 8px', borderTop: '1px solid var(--kfm-aichat-line)', marginTop: '2px', fontSize: '11px', color: 'var(--kfm-ink-3)' },
              }, `会话 · ${quick.sessions.length}`),
              ...quick.sessions.map((x) =>
                createElement('button', {
                  key: `sess-${x.id}`,
                  'data-aichat-config-entry': `session:${x.id}`,
                  type: 'button',
                  onClick: () => selectSession(x.id, x.title),
                  style: {
                    display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 8px',
                    border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
                    borderRadius: 'var(--kfm-radius-sm)', fontSize: '12.5px', color: 'var(--kfm-ink)',
                    opacity: link.state.phase === 'IDLE' ? 1 : 0.45, // P18 流式禁切
                  },
                },
                createElement('span', { style: { width: '12px', color: 'var(--kfm-accent)' } },
                  quick.active.sessionId === x.id ? '✓' : ''),
                x.title,
                typeof x.messageCount === 'number' ? createElement('span', { style: { fontSize: '10px', color: 'var(--kfm-ink-3)' } }, `· ${x.messageCount} 条`) : null,
                quick.active.sessionId === x.id ? createElement('span', { style: { fontSize: '10px', color: 'var(--kfm-ink-3)' } }, '· 激活') : null),
              ),
              quick.sessions.length === 0
                ? createElement('div', { style: { padding: '4px 8px', fontSize: '11.5px', color: 'var(--kfm-ink-3)' } }, '（空）session 池——发首条消息自动建壳')
                : null,
              createElement('button', {
                key: 'session-manage',
                'data-aichat-config-entry': 'session:manage',
                type: 'button',
                onClick: () => {
                  onMenu('CLOSED');
                  aiRaisedRef.current = false;
                  window.dispatchEvent(new CustomEvent('kfm-nz-pool-open', { detail: { pool: 'session' } }));
                },
                style: {
                  display: 'flex', width: '100%', padding: '6px 8px', border: 'none', background: 'none',
                  cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--kfm-radius-sm)',
                  fontSize: '11.5px', color: 'var(--kfm-ink-3)',
                },
              }, '管理 session 池…'),
              )
            : null,
          // A2a.5 D2 系统提示条：角色切换一次性提示（不进消息核不落盘，§3.4）
          notice
            ? createElement('div', {
                'data-aichat-notice': '1',
                style: {
                  position: 'absolute', left: 0, right: 0, top: '100%', marginTop: '0',
                  padding: '3px 10px', fontSize: '11.5px', color: 'var(--kfm-ink-3)',
                  background: 'var(--kfm-surface)', borderBottom: '1px solid var(--kfm-aichat-line)',
                },
              }, notice)
            : null,
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
      // A2a.5 诊断口：现场调用水合（控制台排障用）
      (window as unknown as Record<string, unknown>).__kfmNzAiChatLoad = (id: string) =>
        link.loadSession(id).then((ok) => ({ ok, sid: link.sessionId, msgs: link.state.messages.length, err: link.lastError }));
      refreshRuntime();
      return {
        unmount: () => {
          link.close();
          root.unmount();
          document.documentElement.removeAttribute('data-kfm-aichat-open');
          document.documentElement.removeAttribute('data-kfm-aichat-raised');
          delete (window as unknown as Record<string, unknown>).__kfmNzAiChat;
        },
      };
    },
  };
}
