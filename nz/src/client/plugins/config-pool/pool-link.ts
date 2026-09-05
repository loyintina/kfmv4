/**
 * pool-link.ts — 配置池插件的脑（纯 TS，不碰 DOM 框架；宪法 §3 逻辑/皮分离）
 *
 * 两层：
 *   createPoolCore() — 池框架状态机（设计清单 §四 + §四修订①，P6 词汇表唯一真源）：
 *     页面机 POOL_CLOSED/POOL_OPEN + 池页机 DETAIL/OVERLAY_DELETE（修订①
 *     选择制：BROWSE/EDITING 两态退役，2026-09-05 用户拍板），
 *     转换 C1-C13 逐条一个入口（单源 reducer：唯一 transition 入口记账
 *     from/to/trigger，环形缓冲 ≥50 拍——可观测性约束）；清单外状态名
 *     transition 即抛（P6 机检锚点）。
 *   createPoolLink() — 统一池数据层 client（/pool/* 路由族 fetch + WS 多路
 *     复用 pool/changed 推送 §1.6 + C11/C13 校准腿）：lists/active 只是
 *     server 响应投影、推送到达即 refetch（服务器唯一真源，P7 禁第二份
 *     缓存真源）；密钥等条目全文原样透传不做本地加工（P4 出明文与 client
 *     无关——server 是唯一出代字的闸）。
 *
 * 词汇（P6）：C1 左滑进入 / C2 右滑·× 返回 / C3 切池（标签行与「前往更换」
 * 同一转换形状——池框架内部路由不另造词汇） / C4 点条目行 edit(entry|null)
 * / C5 保存成功 / C6 取消 / C7 点删除进罩层 / C8 确认删除（409 relied
 * 不转换，from==to 记账）/ C9 罩层取消回原状 / C10 激活（激活标移动，
 * 原状保持）/ C11 pool/changed 推送校准 / C12 标题栏入口路由（拍板⑯）
 * / C13 WS 断·回前台重连校准。
 */
import type { PoolId, PoolPage } from './pool-page.js';
export type { PoolId, PoolPage } from './pool-page.js';
export { PoolPageRegistry } from './pool-page.js';
export { judgePoolSwipe, POOL_SWIPE_MIN_PX, POOL_SWIPE_AXIS_RATIO } from './swipe-verdict.js';

// ========== 词汇表（§四，清单外状态名禁止——P6） ==========

export const POOL_PAGE_VOCAB = ['POOL_CLOSED', 'POOL_OPEN'] as const;
// 2026-09-05 用户拍板（老 kfmv4 池卡组织复刻）：两态（BROWSE/EDITING）退役，
// 改选择制单态——上区=当前选中条目详情编辑常驻，下区=池路由；inner 只剩
// DETAIL（详情编辑）与 OVERLAY_DELETE（删除确认罩层）。
export const POOL_INNER_VOCAB = ['DETAIL', 'OVERLAY_DELETE'] as const;
export const POOL_TRIGGER_VOCAB = [
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13',
] as const;

export type PoolPageState = (typeof POOL_PAGE_VOCAB)[number];
export type PoolInnerState = (typeof POOL_INNER_VOCAB)[number];
export type PoolTrigger = (typeof POOL_TRIGGER_VOCAB)[number];

const PAGE_SET = new Set<string>(POOL_PAGE_VOCAB);
const INNER_SET = new Set<string>(POOL_INNER_VOCAB);
const TRIGGER_SET = new Set<string>(POOL_TRIGGER_VOCAB);

/** C1 默认进基本池（§四 C1 底层动作） */
export const DEFAULT_POOL: PoolId = 'basic';

export interface EditingTarget {
  pool: PoolId;
  id: string | null; // null=新建草稿（PoolPage.edit(null)，§1.4）
  isNew: boolean;
}

export interface PoolCoreState {
  page: PoolPageState;
  pool: PoolId | null; // POOL_OPEN 语境含当前池 id
  inner: PoolInnerState;
  editing: EditingTarget | null;
  overlay: { pool: PoolId; id: string } | null;
  /** 详情表单重挂 nonce（C6 取消=丢弃草稿回存档值：rev++ 让 key 变化强制
   *  重挂；选择制下编辑目标不变，只有草稿蒸发） */
  rev: number;
}

export interface PoolTransitionRecord {
  t: number;
  trigger: PoolTrigger;
  from: { page: PoolPageState; pool: PoolId | null; inner: PoolInnerState };
  to: { page: PoolPageState; pool: PoolId | null; inner: PoolInnerState };
}

const RING_CAP = 64; // ≥50 拍（可观测性约束）

// ========== 状态机核（单源 reducer） ==========

export interface PoolCore {
  readonly state: PoolCoreState;
  readonly ring: PoolTransitionRecord[];
  /** 唯一 transition 入口（from/to/trigger 记账；野词汇即抛=P6 机检锚点） */
  transition(trigger: PoolTrigger, to: Partial<Pick<PoolCoreState, 'page' | 'pool' | 'inner'>>): void;
  // —— 转换表 C1-C13 逐条入口（§四；2026-09-05 起选择制语义，见 §四修订①） ——
  openBySwipe(): void; // C1
  openRoute(pool: PoolId): void; // C12
  close(): void; // C2
  switchPool(pool: PoolId): void; // C3（标签行/前往更换同形状）
  /** C4：点池行=切换详情编辑目标（选择制；isNew=新建草稿）。自动选首条由
   *  PoolApp 效果腿负责（老卡「聚焦第一个」同语义） */
  selectDetail(target: { id: string | null; isNew: boolean }): void;
  /** C5：保存成功——选择制下编辑器**保持**载入保存后的条目；isNew 传入
   *  落盘后的真实 id（create→update 语义翻转） */
  saveDone(selectId?: string): void;
  cancelEdit(): void; // C6：草稿蒸发（rev++ 重挂回存档值），编辑目标不变
  askDelete(id: string): void; // C7
  deleteDone(): void; // C8 成功
  deleteDenied(): void; // C8 409 relied（不转换，from==to 记账）
  overlayCancel(): void; // C9
  activateDone(): void; // C10（原状保持）
  pushArrived(): void; // C11（原状保持）
  envResync(): void; // C13（原状保持）
}

export function createPoolCore(): PoolCore {
  const state: PoolCoreState = {
    page: 'POOL_CLOSED', pool: null, inner: 'DETAIL', editing: null, overlay: null, rev: 0,
  };
  const ring: PoolTransitionRecord[] = [];
  let overlayReturn: PoolInnerState = 'DETAIL'; // C9 原状账（C7 进罩层前记）

  const core: PoolCore = {
    state,
    ring,
    transition(trigger, to) {
      if (!TRIGGER_SET.has(trigger)) throw new Error(`[pool] 清单外触发器「${trigger}」（P6：触发器 ⊆ C1-C13）`);
      const page = to.page ?? state.page;
      const inner = to.inner ?? state.inner;
      if (!PAGE_SET.has(page)) throw new Error(`[pool] 清单外页面机状态「${page}」（P6）`);
      if (!INNER_SET.has(inner)) throw new Error(`[pool] 清单外池页机状态「${inner}」（P6）`);
      const from = { page: state.page, pool: state.pool, inner: state.inner };
      if (to.page !== undefined) state.page = to.page;
      if (to.pool !== undefined) state.pool = to.pool;
      if (to.inner !== undefined) state.inner = to.inner;
      ring.push({ t: Date.now(), trigger, from, to: { page: state.page, pool: state.pool, inner: state.inner } });
      if (ring.length > RING_CAP) ring.shift();
    },
    openBySwipe() {
      core.transition('C1', { page: 'POOL_OPEN', pool: DEFAULT_POOL, inner: 'DETAIL' });
    },
    openRoute(pool) {
      core.transition('C12', { page: 'POOL_OPEN', pool, inner: 'DETAIL' });
    },
    close() {
      state.editing = null; // C2 裁定：草稿蒸发（重开由自动选首条重建编辑目标）
      state.overlay = null;
      core.transition('C2', { page: 'POOL_CLOSED', pool: null, inner: 'DETAIL' });
    },
    switchPool(pool) {
      state.editing = null; // C3：旧池草稿蒸发（新池自动选首条）
      state.overlay = null;
      core.transition('C3', { pool, inner: 'DETAIL' });
    },
    selectDetail(target) {
      state.editing = { pool: state.pool ?? DEFAULT_POOL, id: target.id, isNew: target.isNew };
      state.rev++; // 重选即重挂：上一次选择的草稿（含未落盘明文）不得跨选择存活（B7 病灶）
      core.transition('C4', { inner: 'DETAIL' });
    },
    saveDone(selectId) {
      // 选择制：保存后编辑器保持载入保存后的条目（isNew 补真实 id=create→update 翻转）；
      // rev++ 重挂回存档值——密钥字段明文草稿在落盘瞬间必须从 DOM 消失
      // （代字化后重载=空输入+代字提示，B7 domClean 病灶）
      if (selectId !== undefined && state.editing) state.editing = { pool: state.editing.pool, id: selectId, isNew: false };
      state.rev++;
      core.transition('C5', { inner: 'DETAIL' });
    },
    cancelEdit() {
      state.rev++; // 草稿蒸发：表单按 rev 重挂回存档值，编辑目标不变
      core.transition('C6', { inner: 'DETAIL' });
    },
    askDelete(id) {
      overlayReturn = state.inner; // C9 原状账
      state.overlay = { pool: state.pool ?? DEFAULT_POOL, id };
      core.transition('C7', { inner: 'OVERLAY_DELETE' });
    },
    deleteDone() {
      state.overlay = null;
      state.editing = null; // 删的是正编辑条目：清目标（PoolApp 效果自动补选首条，§四 C8 修订终点）
      core.transition('C8', { inner: 'DETAIL' });
    },
    deleteDenied() {
      // 409 relied：确认页内展人话，不删不转换（§四 C8 括号）——from==to 记账
      core.transition('C8', {});
    },
    overlayCancel() {
      state.overlay = null;
      core.transition('C9', { inner: overlayReturn });
    },
    activateDone() {
      core.transition('C10', {}); // 激活标移动，原状保持
    },
    pushArrived() {
      core.transition('C11', {}); // refetch 校准，原状保持
    },
    envResync() {
      core.transition('C13', {}); // 重连/回前台 refetch，原状保持
    },
  };
  return core;
}

// ========== 统一池数据层 client（/pool/* + WS 推送腿） ==========

export interface PoolEntry { id: string; [k: string]: unknown }

export interface ActiveLedger {
  providerId: string;
  modelId: string;
  roleFile: string;
  sessionId: string;
}

export interface PoolListProjection { pool: PoolId; title: string; readonly: boolean; count: number }

export interface ReliedBy { pool: string; id: string; field: string }

export interface PoolChangedEvent { pool: string; id: string; op: string }

export interface SaveResult { ok: boolean; error?: string; reliedBy?: ReliedBy[] }

export interface PoolLink {
  core: PoolCore;
  /** server 响应投影（P7：推送到达/打开即 refetch，禁本地改写真源） */
  lists: Partial<Record<PoolId, PoolEntry[]>>;
  registry: PoolListProjection[];
  active: ActiveLedger;
  /** pool/changed 事件尾巴（观测钩 lastEvents 数据源） */
  lastEvents: Array<PoolChangedEvent & { t: number }>;
  fetchAll(): Promise<void>;
  fetchPool(pool: PoolId): Promise<PoolEntry[]>;
  save(pool: PoolId, entry: PoolEntry, isNew: boolean): Promise<SaveResult>;
  remove(pool: PoolId, id: string): Promise<SaveResult>;
  activate(patch: Partial<ActiveLedger>): Promise<SaveResult>;
  reliers(pool: PoolId, id: string): Promise<ReliedBy[]>;
  /** 观测/判卷辅腿（C13 考卷驱动用；生产路径走 visibilitychange 同款入口） */
  diag: { wsState(): string; closeWs(): void; resync(): void };
  close(): void;
}

const j = async (r: Response): Promise<unknown> => { try { return await r.json(); } catch { return null; } };

export function createPoolLink(onUpdate: () => void): PoolLink {
  const core = createPoolCore();
  const link: PoolLink = {
    core,
    lists: {},
    registry: [],
    active: { providerId: '', modelId: '', roleFile: '', sessionId: '' },
    lastEvents: [],

    async fetchAll(): Promise<void> {
      await Promise.all([
        (async () => {
          try {
            const r = await fetch('/pool/list');
            if (r.ok) link.registry = (await j(r)) as PoolListProjection[];
          } catch { /* server 暂不可得：保持上次投影 */ }
        })(),
        (async () => {
          try {
            const r = await fetch('/pool/active');
            if (r.ok) link.active = (await j(r)) as ActiveLedger;
          } catch { /* 同上 */ }
        })(),
        ...['basic', 'provider', 'prompt', 'session'].map((p) => link.fetchPool(p).then(() => undefined)),
      ]);
      onUpdate();
    },

    async fetchPool(pool): Promise<PoolEntry[]> {
      try {
        const r = await fetch(`/pool/${encodeURIComponent(pool)}`);
        if (r.ok) {
          link.lists[pool] = (await j(r)) as PoolEntry[];
          return link.lists[pool] ?? [];
        }
      } catch { /* 暂不可得保持上次投影 */ }
      return link.lists[pool] ?? [];
    },

    async save(pool, entry, isNew): Promise<SaveResult> {
      const url = isNew
        ? `/pool/${encodeURIComponent(pool)}/create`
        : `/pool/${encodeURIComponent(pool)}/${encodeURIComponent(entry.id)}/update`;
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ entry }),
        });
        const body = (await j(r)) as { error?: string; reliedBy?: ReliedBy[]; entry?: PoolEntry } | null;
        if (!r.ok) return { ok: false, error: body?.error ?? `HTTP ${r.status}`, reliedBy: body?.reliedBy }; // C5 校验败：人话回表单，不转换
        core.saveDone();
        await link.fetchAll();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: `网络错误: ${e instanceof Error ? e.message : String(e)}` };
      }
    },

    async remove(pool, id): Promise<SaveResult> {
      try {
        const r = await fetch(`/pool/${encodeURIComponent(pool)}/${encodeURIComponent(id)}/delete`, { method: 'POST' });
        const body = (await j(r)) as { error?: string; reliedBy?: ReliedBy[] } | null;
        if (!r.ok) {
          core.deleteDenied(); // C8 409：不删不转换，罩层展人话
          return { ok: false, error: body?.error ?? `HTTP ${r.status}`, reliedBy: body?.reliedBy };
        }
        core.deleteDone();
        await link.fetchAll();
        return { ok: true };
      } catch (e) {
        core.deleteDenied();
        return { ok: false, error: `网络错误: ${e instanceof Error ? e.message : String(e)}` };
      }
    },

    async activate(patch): Promise<SaveResult> {
      try {
        const r = await fetch('/pool/active', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const body = (await j(r)) as { error?: string } | null;
        if (!r.ok) return { ok: false, error: body?.error ?? `HTTP ${r.status}` };
        core.activateDone(); // C10
        await link.fetchAll();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: `网络错误: ${e instanceof Error ? e.message : String(e)}` };
      }
    },

    async reliers(pool, id): Promise<ReliedBy[]> {
      try {
        const r = await fetch(`/pool/${encodeURIComponent(pool)}/${encodeURIComponent(id)}/reliers`);
        if (r.ok) return ((await j(r)) as { reliers?: ReliedBy[] }).reliers ?? [];
      } catch { /* 尽力而为 */ }
      return [];
    },

    diag: {
      wsState: () => wsState,
      closeWs: () => { try { ws?.close(); } catch { /* 已断即达意 */ } },
      resync: () => { void onVisible(); }, // 与 visibilitychange 同一入口（C13）
    },

    close() {
      disposed = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVis);
      try { ws?.close(); } catch { /* 已断即达意 */ }
    },
  };

  // ---- pool/changed 推送腿（§1.6：复用 /ws/term 多路复用，tmux-sessions 同款） ----
  let ws: WebSocket | null = null;
  let wsState = 'closed';
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const connect = (): void => {
    if (disposed) return;
    wsState = 'connecting';
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/term`;
    ws = new WebSocket(url);
    ws.onopen = () => {
      wsState = 'open';
      ws?.send(JSON.stringify({ t: 'pool-watch' }));
      void link.fetchAll(); // C13 重连腿：连上即校准（服务器唯一真源）
    };
    ws.onmessage = (ev) => {
      let m: { t?: string; pool?: string; id?: string; op?: string };
      try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.t !== 'pool-changed') return;
      link.lastEvents.push({ t: Date.now(), pool: m.pool ?? '?', id: m.id ?? '?', op: m.op ?? '?' });
      if (link.lastEvents.length > 20) link.lastEvents.shift();
      core.pushArrived(); // C11：原状保持 + refetch 校准
      void link.fetchAll();
    };
    ws.onclose = () => { wsState = 'closed'; onUpdate(); scheduleRetry(); };
    ws.onerror = () => { try { ws?.close(); } catch { /* 重试腿接管 */ } };
  };
  const scheduleRetry = (): void => {
    if (disposed) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 3000);
  };
  // C13 环境事件：熄屏期定时器冻结=重试腿停走，回前台立即重连+校准
  const onVisible = async (): Promise<void> => {
    if (disposed || document.visibilityState !== 'visible') return;
    if (!ws || ws.readyState > WebSocket.OPEN) { clearTimeout(retryTimer); connect(); }
    else await link.fetchAll(); // 活着也校准一拍（kfmv4 侧直改文件后回前台的兜底）
    onUpdate();
  };
  const onVis = (): void => { void onVisible(); };
  document.addEventListener('visibilitychange', onVis);
  connect();

  return link;
}
