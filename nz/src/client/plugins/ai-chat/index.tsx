/**
 * src/client/plugins/ai-chat/index.tsx — AI 对话插件（ai-chat A1 阶段三；
 * 状态机清单 = docs/ai-chat-a1-design.md §3.3，契约 §7 机检锚点）。
 *
 * 三机七态十转换（词汇表唯一真源，清单外状态名禁止——P9）：
 *   页面机 TERMINAL ↔ AI_PAGE（A1 点 orb / A2 点收起；切走 run 不死——
 *     server 缓冲续命，切回 attach from cursor 补流，tmux-tabs 同哲学）；
 *   运行机 IDLE → WAITING → STREAMING → IDLE（chat-link 脑驱动，A3-A9）；
 *   菜单机 CLOSED ↔ MODEL_OPEN（picker 极简版，数据源 /ai/providers）。
 *
 * 形态（§3.0）：常驻 orb（右上，避开左上 tmux orb）= AI 页切换钮 + 运行
 * 指示灯（闲暗 / 活跃亮，静态换色零常动帧）；点按 → 全屏 AI 页（消息列表
 * + 底部 prompt-bar）↔ 终端。
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
        const [, setTick] = useState(0);
        const listWrapRef = useRef<HTMLDivElement>(null);

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

        // 消息更新自动滚底（贴近用户真实体验的跟随，不加动画）
        useEffect(() => {
          const el = listWrapRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });

        // A1：TERMINAL → AI_PAGE；有活跃 run → attach from cursor 补流
        const openPage = (): void => {
          pageRef.current = 'AI_PAGE';
          setPage('AI_PAGE');
          link.resumeStream();
          refreshRuntime();
        };
        // A2：AI_PAGE → TERMINAL；run 不死（server 缓冲），client 断流
        const closePage = (): void => {
          link.suspendStream();
          menuRef.current = 'CLOSED';
          setMenu('CLOSED');
          pageRef.current = 'TERMINAL';
          setPage('TERMINAL');
          refreshRuntime();
        };
        const onMenu = (next: MenuState): void => { menuRef.current = next; setMenu(next); refreshRuntime(); }; // A10
        const onSelect = (provider: string, model: string): void => { link.selection = { provider, model }; refreshRuntime(); };

        // 常驻 orb（右上，避开左上 tmux orb）：AI 页切换钮 + 运行指示灯
        const lit = link.state.phase !== 'IDLE';
        const orb = createElement('div', {
          'data-kfm-aichat-orb': '1',
          'data-aichat-lit': lit ? '1' : '0',
          onClick: (e: ReactMouseEvent) => { e.stopPropagation(); if (pageRef.current === 'AI_PAGE') closePage(); else openPage(); },
          onPointerDown: (e: ReactMouseEvent) => { e.stopPropagation(); },
          style: {
            position: 'fixed', top: 'calc(var(--sat, 0px) + 12px)', right: '12px', zIndex: 41,
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--kfm-bar-bg)', border: '1px solid var(--kfm-line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          },
        }, AI_ICON);

        if (page !== 'AI_PAGE') return orb;

        // 全屏 AI 页：头部 / 消息区 / composer（借 chat.tsx 三段结构）
        return createElement('div', null,
          orb,
          createElement('div', {
            'data-kfm-aichat': '1',
            style: {
              position: 'fixed', inset: 0, zIndex: 38,
              background: 'var(--kfm-page)', color: 'var(--kfm-ink)',
              display: 'flex', flexDirection: 'column',
              fontFamily: 'var(--kfm-font-sans)',
              paddingTop: 'var(--sat, 0px)',
            },
          },
          createElement('div', {
            style: {
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
              // 左右 56px 让开常驻 orb 热区（左上 tmux orb / 右上 ai orb，z=41
              // 压在本页 z=38 之上——B1c 考卷实锤：收起钮被 tmux orb 截点）
              padding: '10px 56px', borderBottom: '1px solid var(--kfm-aichat-line)',
            },
          },
          createElement('button', {
            'data-aichat-collapse': '1',
            type: 'button',
            onClick: closePage,
            style: {
              display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none',
              color: 'var(--kfm-ink-2)', cursor: 'pointer', fontSize: '13px', padding: '4px 6px',
            },
          },
          createElement('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' },
            createElement('path', { d: 'M15 18l-6-6 6-6' })),
          '收起'),
          createElement('div', { style: { flex: 1, textAlign: 'center', fontSize: '13px', color: 'var(--kfm-ink-2)' } },
            'AI 对话'),
          createElement('div', { style: { width: '44px' } }),
          ),
          createElement('div', {
            ref: listWrapRef,
            style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
          }, createElement(MessageList, {
            messages: link.state.messages,
            msgIdx: link.state.msgIdx,
            phase: link.state.phase,
          })),
          createElement(PromptBar, {
            phase: link.state.phase,
            menu,
            selection: link.selection,
            providersInfo: link.providersInfo,
            onMenu,
            onSelect,
            onSend: (text) => { void link.send(text); },
            onStop: () => { void link.cancel(); },
          }),
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
          delete (window as unknown as Record<string, unknown>).__kfmNzAiChat;
        },
      };
    },
  };
}
