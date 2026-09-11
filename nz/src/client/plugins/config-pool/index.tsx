/**
 * index.tsx — 配置池插件（A2a 阶段二：池框架 UI + 四池页 + 激活双态 + 推送
 * 校准；状态机清单 = docs/config-pool-a2a-design.md §四，契约 §7 机检锚点）。
 *
 * 形态（§1.1/§三 + 仲裁④⑥⑦⑧⑩）：
 *   · 左滑进入（GestureLayer.PageSwipe:500 新层带，仲裁④）——三重判定
 *     （§1.2）：condition 门（AI_PAGE 态/池页已开转右滑/终端 ALT-TUI 态）+
 *     targetFilter 排除（tmux 标签排/keybar/composer/orb/picker·配置菜单/
 *     删除罩层）+ 方向裁决后置（松手期 judgePoolSwipe，dx<-64 且 |dx|>2|dy|；
 *     全程不 stopPropagation 不 preventDefault=P1，裁判不抢球）；右滑返回
 *     对称（§1.2-5）；池页内左滑不绑（§八⑦）；
 *   · 一池一页：全屏页 z44（终端/tmux < AI 页 42 < 池页 44 < 输入栏+光球
 *     恒顶——仲裁⑩用户修正稿；页底=composer 顶，借 --kfm-aichat-composer-h
 *     实测单源）；顶栏标签行借 tmux 标签件词汇新写（§1.3 重写定性）；
 *     右端 × 钮与右滑双通道（C2）；
 *   · 池注册表（§1.5 client 侧 PoolPageRegistry）四池注册：标签行/路由只问
 *     注册表，新池=实现+注册一行；server /pool/list 投影互证（B3）；
 *   · pool/changed 推送（§1.6）：/ws/term 多路复用，推送到达 refetch 校准
 *     （C11/P7）；WS 断/回前台重连校准（C13）；
 *   · C12 标题栏入口路由（拍板⑯）：kfm-nz-pool-open 事件（detail.pool）——
 *     ai-chat 标题栏「角色/会话」按钮已接线（阶段三接真，占位退役）；
 *     池页已开则转对应池（C3 形状）。
 *   · orb 三态咬合（仲裁⑩阶段三）：AI 页被 orb 提到池页之上时 ai-chat 挂
 *     data-kfm-aichat-raised（tokens.css 池页降 41 不关）；本插件手势门见
 *     该属性即不响应（盖着的池页不吃右滑返回，B12b）。
 *
 * 观测钩（可观测性约束，公共契约）：
 *   __kfmNzPool() 报 {page,pool,pageState,editing,active,ring,lastEvents}；
 *   __kfmNzPoolDiag 报 {wsState,closeWs,resync}（C13 考卷/守视驱动腿，
 *   resync 与 visibilitychange 同一入口）。
 */
import { createElement, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Context } from 'cordis';
import type { UiPlugin, UiPluginHandle } from '../../kernel/ui-kernel.js';
import { GestureLayer, registerGesture } from '../../gesture.js';
import {
  createPoolLink, PoolPageRegistry, judgePoolSwipe,
  type PoolLink, type PoolEntry, type ReliedBy,
} from './pool-link.js';
import type { PoolPage } from './pool-page.js';
import { PoolPageView, DeleteOverlay } from './pages.js';

/** 左滑手势落点排除面（§1.2-3 targetFilter；池页本体不排除——右滑返回要在
 *  池页上成立；删除罩层排除=C7 罩层模态不右滑关）。导出单源：file-tree
 *  右滑入口（B1 后续手势仲裁）复用同一排除面，列表变更两处同源。 */
export const POOL_SWIPE_EXCLUDE = [
  '[data-tmux-strip]', '[data-kfm-keybar]', '[data-kfm-aichat-bar]', '[data-kfm-aichat-orb]',
  '[data-aichat-model-menu]', '[data-aichat-config-menu]', '[data-pool-overlay]',
].join(',');

/** P9：滑入/收起动画的 JS 等待时长从 token 读（ai-chat readDurNormalMs 同款） */
const readDurNormalMs = (): number => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--kfm-dur-normal').trim();
  const ms = /^([\d.]+)ms$/.exec(v);
  if (ms) return Number.parseFloat(ms[1]);
  const s = /^([\d.]+)s$/.exec(v);
  return s ? Number.parseFloat(s[1]) * 1000 : 250;
};

/** provider 池激活匹配（总账 providerId 可能是 id 或 name——server matchRef 同语义） */
const matchProviderEntry = (entries: PoolEntry[], ledgerId: string): PoolEntry | null =>
  entries.find((e) => e.id === ledgerId || e.name === ledgerId) ?? null;

/** 四池 PoolPage 实现（§1.4 接口；list 走统一池数据层，禁自 fetch 文件——P5） */
function buildRegistry(link: PoolLink): PoolPageRegistry {
  const registry = new PoolPageRegistry();
  registry.register({
    pool: 'basic',
    title: '基本',
    readonly: true,
    list: () => link.fetchPool('basic'),
    edit: () => { /* 只读聚合视图无 CRUD 语义（§3.1） */ },
  } satisfies PoolPage);
  registry.register({
    pool: 'provider',
    title: 'Provider·Model',
    list: () => link.fetchPool('provider'),
    edit: (entry: PoolEntry | null) => {
      link.core.selectDetail(entry ? { id: String(entry.id), isNew: false } : { id: null, isNew: true });
    },
    activeId: async () => matchProviderEntry(link.lists.provider ?? [], link.active.providerId)?.id ?? null,
    activate: async (id: string) => {
      const e = (link.lists.provider ?? []).find((p) => p.id === id);
      const models = e && Array.isArray(e.models) ? (e.models as string[]).map(String) : [];
      await link.activate({ providerId: id, modelId: models[0] ?? '' }); // 激活单位=二元组（§3.2）
    },
  } satisfies PoolPage);
  // prompt 池 2026-09-07 随 AI 配置面瘦身退役（角色数据留盘不删）
  registry.register({
    pool: 'session',
    title: '会话',
    list: () => link.fetchPool('session'),
    edit: (entry: PoolEntry | null) => {
      link.core.selectDetail(entry ? { id: String(entry.id), isNew: false } : { id: null, isNew: true });
    },
    activeId: async () => link.active.sessionId || null,
    activate: async (id: string) => { await link.activate({ sessionId: id }); },
  } satisfies PoolPage);
  return registry;
}

export function createConfigPoolPlugin(ctx: Context): UiPlugin {
  return {
    id: 'config-pool',
    stateMachine: 'docs/config-pool-a2a-design.md',
    mount(slot: HTMLElement): UiPluginHandle {
      let bump: () => void = () => { /* React 未就绪前的早拍丢弃 */ };
      // C2 关页桥：React 侧渲染时把带收起动画的 closePage 挂上来（手势腿调它）
      let requestClose: () => void = () => { /* React 未就绪前无页可关 */ };
      const link = createPoolLink(() => bump());
      const registry = buildRegistry(link);
      const core = link.core;

      // ---- 左滑进入/右滑返回（§1.2 三重判定；方向裁决后置=P1 裁判不抢球） ----
      registerGesture(ctx, {
        id: 'config-pool:page-swipe',
        layer: GestureLayer.PageSwipe,
        targetFilter: (target) => !target.closest(POOL_SWIPE_EXCLUDE),
        condition: () => {
          // 仲裁⑫ 页面栈模型：任何状态手势都归本插件裁决——提顶档（AI 页盖
          // 着池页）左滑=池卡置顶、右滑在 onEnd 判（看不见的卡不隔空关）；
          // AI_PAGE 态/ALT 态无门（仲裁⑪：任何地方都能左滑）
          return true;
        },
        onEnd: (_e, dx, dy) => {
          const v = judgePoolSwipe(dx, dy); // 松手期方向裁决（§1.2-4）
          const raised = document.documentElement.hasAttribute('data-kfm-aichat-raised');
          if (v === 'left' && core.state.page === 'POOL_CLOSED') { core.openBySwipe(); bump(); }
          else if (v === 'left' && core.state.page === 'POOL_OPEN' && raised) {
            // 仲裁⑫：池卡置顶=demote AI（ai-chat 清提顶账，池页复现 z44 档）
            // +池页入场动画重播（从右滑入）。**播完不摘类**：摘类=animation-name
            // 切回基础 page-in → 底牌动画再播一遍（「播两遍」定罪，同 ai-chat）
            window.dispatchEvent(new CustomEvent('kfm-nz-aichat-demote'));
            const el = document.querySelector('[data-kfm-pool]');
            if (el) {
              el.classList.remove('kfm-raise');
              void (el as HTMLElement).offsetWidth;
              el.classList.add('kfm-raise');
            }
          }
          else if (v === 'right' && core.state.page === 'POOL_OPEN' && !raised) { requestClose(); }
          // 其余=零动作零副作用：垂直滚动自然落选；提顶档右滑不隔空关池（B12b）
        },
      });

      // ---- C12 标题栏入口路由（拍板⑯；ai-chat 按钮接线=阶段三） ----
      const onRouteOpen = (e: Event): void => {
        const pool = (e as CustomEvent).detail as { pool?: unknown } | null;
        if (!pool || typeof pool.pool !== 'string') return;
        if (!registry.get(pool.pool)) return;
        if (core.state.page === 'POOL_OPEN') core.switchPool(pool.pool);
        else core.openRoute(pool.pool);
        bump();
      };
      window.addEventListener('kfm-nz-pool-open', onRouteOpen);
      // 手势仲裁转发（2026-09-11 file-tree 右滑入口配套）：手势核单次手势
      // 只锁一个 handler——双闭态（树关+池关）由 file-tree 层claim，其
      // onEnd 判出左滑时在此还原池页的左滑开（openBySwipe 原语义不漂移）
      const onSwipeOpen = (): void => {
        if (core.state.page === 'POOL_CLOSED') { core.openBySwipe(); bump(); }
      };
      window.addEventListener('kfm-nz-pool-swipe-open', onSwipeOpen);

      function PoolApp(): React.ReactElement {
        const [, setTick] = useState(0);
        const [closing, setClosing] = useState(false);
        const [formError, setFormError] = useState<string | null>(null);
        const [relied, setRelied] = useState<{ error: string; reliedBy: ReliedBy[] } | null>(null);
        const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        bump = () => setTick((x) => x + 1);
        // 数据腿：打开即拉全量（P7 投影；WS 推送/重连自动再拉）
        useEffect(() => {
          void link.fetchAll();
          return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
        }, []);

        // 选择制自动选首条（§四 修订①：老角色卡「聚焦第一个」同语义）——开页/
        // 切池/删尽兜底后 editing 为空且池非只读 → 选首条；每渲染幂等补选
        useEffect(() => {
          if (core.state.page !== 'POOL_OPEN') return;
          const pool = core.state.pool;
          if (!pool || pool === 'basic') return; // 只读聚合无编辑目标
          const ed = core.state.editing;
          if (ed && ed.pool === pool) return;
          const list = link.lists[pool] ?? [];
          if (list.length > 0) { core.selectDetail({ id: String(list[0].id), isNew: false }); bump(); }
        });

        // 层级规则（仲裁⑩/P10）：池页开时 documentElement 挂 data-kfm-pool-open
        // ——tokens.css 据此藏 tmux 控件 + 输入栏/光球升 45 恒顶档；关（含收起
        // 动画尾巴）即复原。deps=页面机态：只在开/关翻转时落笔（cleanup 摘+
        // 重挂），页内任意重渲染（C11 推送/激活/保存 bump）不产生 remove+add
        // 抖动——那是 ai-chat 提顶账 observer 的触发面，不能被无关渲染误触
        useEffect(() => {
          document.documentElement.toggleAttribute('data-kfm-pool-open', core.state.page === 'POOL_OPEN');
          return () => document.documentElement.removeAttribute('data-kfm-pool-open');
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [core.state.page]);

        // C2：机关、收起动画是呈现尾巴（translateX(0)→100% 播完才摘 DOM）。
        // 挂上 requestClose 桥——手势腿（装配层）与 × 钮同走此入口
        const closePage = (): void => {
          core.close();
          setRelied(null);
          setFormError(null);
          setClosing(true);
          if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
          closeTimerRef.current = setTimeout(() => { closeTimerRef.current = null; setClosing(false); }, readDurNormalMs());
          bump();
        };
        requestClose = closePage;
        // 收起动画中途重开（快速双滑/事件直达）：作废摘除定时器、回滑入档
        // （ai-chat openPage 同款幂等；状态机不受呈现尾巴影响）
        useEffect(() => {
          if (core.state.page === 'POOL_OPEN' && closing) {
            if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
            setClosing(false);
          }
        });

        const snap = core.state;
        if (snap.page !== 'POOL_OPEN' && !closing) return createElement('div');
        const entries = link.lists[snap.pool ?? ''] ?? [];
        const overlayDelete = snap.overlay;

        return createElement('div', {
          'data-kfm-pool': '1',
          className: closing ? 'kfm-closing' : '',
          style: {
            position: 'fixed', top: 0, left: 0, right: 0,
            bottom: 'var(--kfm-aichat-composer-h, 116px)', // 页底=composer 顶（仲裁⑩：输入栏恒顶不青盖）
            zIndex: 44,
            background: 'var(--kfm-page)', color: 'var(--kfm-ink)',
            display: 'flex', flexDirection: 'column',
            fontFamily: 'var(--kfm-font-sans)',
          },
        },
        // 顶栏：标签行（借 tmux 标签件词汇新写 §1.3）+ × 钮（C2 双通道另一腿）
        createElement('div', {
          'data-pool-header': '1',
          style: {
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 10px', borderBottom: '1px solid var(--kfm-line)',
          },
        },
        createElement('div', {
          'data-pool-tabstrip': '1',
          className: 'kfm-pool-group-config', // 分组样式 class 钩子（v0 四池全配置组，§1.3）
          style: {
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px',
            background: 'var(--kfm-bar-bg)', border: '1px solid var(--kfm-line)',
            borderRadius: 'var(--kfm-radius-pill)', padding: '0 6px', height: '32px',
            overflowX: 'auto',
          },
        },
        registry.list().map((p) => createElement('div', {
          key: p.pool,
          'data-pool-tab': p.pool,
          onClick: () => { core.switchPool(p.pool); setFormError(null); bump(); }, // C3
          style: {
            flex: '0 0 auto', padding: '5px 12px', borderRadius: 'var(--kfm-radius-md)',
            fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
            background: snap.pool === p.pool ? 'var(--kfm-accent)' : 'var(--kfm-chip-bg)',
            color: snap.pool === p.pool ? 'var(--kfm-ink)' : 'var(--kfm-ink-2)',
          },
        }, p.title)),
        ),
        createElement('button', {
          'data-pool-close': '1', type: 'button',
          onClick: () => closePage(),
          style: {
            flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%',
            border: '1px solid var(--kfm-line)', background: 'var(--kfm-bar-bg)',
            color: 'var(--kfm-ink-2)', fontSize: '14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, '×'),
        ),
        PoolPageView({
          link, pool: snap.pool ?? 'basic', entries, active: link.active,
          formError, setFormError, bump: () => bump(),
        }),
        overlayDelete
          ? createElement(DeleteOverlay, {
              pool: overlayDelete.pool, id: overlayDelete.id, relied,
              onConfirm: () => {
                void link.remove(overlayDelete.pool, overlayDelete.id).then((r) => {
                  if (!r.ok) setRelied({ error: r.error ?? '删除被拒', reliedBy: r.reliedBy ?? [] }); // C8 409：人话留罩层
                  else setRelied(null);
                  bump();
                });
              },
              onCancel: () => { core.overlayCancel(); setRelied(null); bump(); }, // C9
            })
          : null,
        );
      }

      const root = createRoot(slot);
      root.render(createElement(PoolApp));
      // 判卷钩子（可观测性约束，公共契约）
      (window as unknown as Record<string, unknown>).__kfmNzPool = () => ({
        page: core.state.page,
        pool: core.state.pool,
        pageState: core.state.inner,
        editing: core.state.editing,
        active: { ...link.active },
        ring: [...core.ring],
        lastEvents: [...link.lastEvents],
      });
      (window as unknown as Record<string, unknown>).__kfmNzPoolDiag = link.diag;
      return {
        unmount: () => {
          window.removeEventListener('kfm-nz-pool-open', onRouteOpen);
          window.removeEventListener('kfm-nz-pool-swipe-open', onSwipeOpen);
          link.close();
          root.unmount();
          document.documentElement.removeAttribute('data-kfm-pool-open');
          delete (window as unknown as Record<string, unknown>).__kfmNzPool;
          delete (window as unknown as Record<string, unknown>).__kfmNzPoolDiag;
        },
      };
    },
  };
}
