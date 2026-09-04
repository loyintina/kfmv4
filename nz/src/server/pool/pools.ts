/**
 * pools.ts — 池描述表（设计清单 §2.3：server 侧统一 CRUD 的枢纽）
 *
 * 新池 = 表内加一条（「池类可追加」在 server 侧的落点）：声明存储适配
 * （单文件数组型 loadAll/saveAll，或目录型 loadRaw/saveEntry/deleteEntry
 * 一文件一条目）、validate（schema 校验，null=过，string=人话）、reliers
 * （谁引用我，§2.5 守卫扫描声明）、refs（我引用谁，断引用 dangling 标注用）、
 * fuseEntry（落盘前密钥代字 fuse，provider 池首用例）。
 *
 * 与清单 §2.3 接口的两处落实差异（诚实登记）：
 *   1. fuse 钩子命名 fuseEntry 且发生在「校验后、落盘前」——清单写
 *      afterSave，但 fuse 语义（§2.6）要求池文件只留代字，必须在落盘前
 *      变换条目，afterSave 会把明文写进池文件再补救，违背 P4；
 *   2. 目录型池给 per-entry 适配（loadRaw/saveEntry/deleteEntry）而非
 *      全量 save(entries)——~/.kfmv4 与 kfmv4 双端共读，整目录 reconcile
 *      重写会毁 8.x 既有字段（压缩投影/messageCount）与 mtime；per-entry
 *      写只动目标文件，merge 保留未知字段。
 *
 * v0 引用图（§2.5，箭头只向下）：
 *   session.providerId/modelId → provider 池条目；
 *   激活总账 providerId/roleFile/sessionId → 对应池条目（视同 relied）；
 *   role 池 v0 无池内引用者（组合池未来是消费者，接口已就位）。
 */
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  providersPath, rolesDir, sessionsDir,
  readActive, atomicWriteJson,
  type ActiveLedger,
} from './store.ts';
import { fuseApiKey, isEnvRef } from './fuse.ts';

export type PoolId = 'basic' | 'provider' | 'prompt' | 'session';

export interface PoolEntry {
  id: string;
  [k: string]: unknown;
}

export interface ReliedBy {
  pool: string;
  id: string;
  field: string;
}

export interface PoolDescriptor {
  pool: PoolId;
  title: string;
  readonly?: boolean;
  /** 出 API 的投影条目集（provider 出代字形态，session 出核心壳） */
  list(dir: string): PoolEntry[];
  /** schema 校验：null=过，string=人话（400 用） */
  validate(entry: Record<string, unknown>): string | null;
  /** create 前补默认（id/时间戳/空数组），不覆盖已给字段 */
  prepare?(entry: Record<string, unknown>): Record<string, unknown>;
  /** 谁引用我（relied 守卫扫描声明，§2.5） */
  reliers: Array<{ pool: PoolId; field: string }>;
  /** 我引用谁（断引用 dangling 降级标注用） */
  refs?: Array<{ field: string; pool: PoolId }>;
  /** 引用匹配（默认 id 相等；provider 扩到 name/models） */
  matchRef?(entry: PoolEntry, value: string): boolean;
  /** 落盘前 fuse（provider 密钥代字；§2.6 语义必须在落盘前） */
  fuseEntry?(dir: string, entry: PoolEntry, siblings: PoolEntry[]): PoolEntry;
  /** 存储适配：单文件数组型（providers.json 例外，§八③） */
  loadAll?(dir: string): PoolEntry[];
  saveAll?(dir: string, entries: PoolEntry[]): void;
  /** 存储适配：目录型（一文件一条目，merge 保留未知字段——双端共读） */
  loadRaw?(dir: string, id: string): PoolEntry | null;
  saveEntry?(dir: string, entry: PoolEntry): void;
  deleteEntry?(dir: string, id: string): void;
}

// ========== 校验小件 ==========

const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
/** 文件名裸名安全闸：可中文，禁路径分隔符与 . / ..（一文件一条目落盘用） */
const isBareName = (v: unknown): v is string =>
  isStr(v) && v.length > 0 && !v.includes('/') && !v.includes('\\') && v !== '.' && v !== '..';

const now = () => new Date().toISOString();

// ========== 目录型存储适配小件（roles/sessions 同构） ==========

function dirLoadRaw(base: (dir: string) => string) {
  return (dir: string, id: string): PoolEntry | null => {
    if (!isBareName(id)) return null;
    try {
      const raw = JSON.parse(readFileSync(join(base(dir), `${id}.json`), 'utf-8')) as Record<string, unknown>;
      return { ...raw, id } as PoolEntry;
    } catch {
      return null;
    }
  };
}

function dirSaveEntry(base: (dir: string) => string) {
  return (dir: string, entry: PoolEntry): void => {
    atomicWriteJson(join(base(dir), `${entry.id}.json`), entry);
  };
}

function dirDeleteEntry(base: (dir: string) => string) {
  return (dir: string, id: string): void => {
    if (!isBareName(id)) return;
    try { unlinkSync(join(base(dir), `${id}.json`)); } catch { /* 已不在=删成 */ }
  };
}

/** 目录型列表：文件名裸名=id（寻址真源），坏 JSON 跳过（降级不崩），按 id 排序 */
function dirList(base: (dir: string) => string, project: (raw: Record<string, unknown>, id: string) => PoolEntry) {
  return (dir: string): PoolEntry[] => {
    let files: string[] = [];
    try { files = readdirSync(base(dir)).filter((f) => f.endsWith('.json')).sort(); } catch { return []; }
    const out: PoolEntry[] = [];
    for (const f of files) {
      const id = f.slice(0, -'.json'.length);
      try {
        const raw = JSON.parse(readFileSync(join(base(dir), f), 'utf-8')) as Record<string, unknown>;
        out.push(project(raw, id));
      } catch { /* 坏文件跳过不拦列表 */ }
    }
    return out;
  };
}

// ========== 四池描述（§三） ==========

/** provider-model 池（§3.2）：单文件数组例外，数组顺序即文件顺序 */
const providerPool: PoolDescriptor = {
  pool: 'provider',
  title: 'Provider·Model',
  reliers: [
    { pool: 'session', field: 'providerId' },
    { pool: 'session', field: 'modelId' },
  ],
  loadAll(dir) {
    try {
      const arr = JSON.parse(readFileSync(providersPath(dir), 'utf-8')) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr.filter((e): e is PoolEntry => !!e && typeof e === 'object' && isStr((e as PoolEntry).id));
    } catch {
      return [];
    }
  },
  saveAll(dir, entries) {
    atomicWriteJson(providersPath(dir), entries, 0o600);
  },
  list(dir) {
    // P4：读取/编辑回填只出代字形态——旧明文条目掩码（出明文=钉红）
    return this.loadAll!(dir).map((e) => {
      const key = isStr(e.apiKey) ? e.apiKey : '';
      if (key === '' || isEnvRef(key)) return { ...e, apiKey: key };
      return { ...e, apiKey: '', apiKeyMasked: true };
    });
  },
  validate(e) {
    if (!isStr(e.id) || e.id.length === 0) return 'provider 条目缺 id（非空字符串）';
    if (!isStr(e.name)) return `provider「${e.id}」缺 name（字符串）`;
    if (!isStr(e.baseUrl)) return `provider「${e.id}」缺 baseUrl（字符串）`;
    if (!isStr(e.apiKey)) return `provider「${e.id}」缺 apiKey（字符串；明文保存即转代字）`;
    if (!isStrArr(e.models)) return `provider「${e.id}」的 models 应是字符串数组`;
    return null;
  },
  matchRef(entry, value) {
    return value === entry.id || value === entry.name
      || (Array.isArray(entry.models) && (entry.models as string[]).includes(value));
  },
  fuseEntry(dir, entry, siblings) {
    return { ...entry, apiKey: fuseApiKey(dir, { id: entry.id, apiKey: String(entry.apiKey ?? '') }, siblings) };
  },
};

/** agent-prompt 池（§3.3）：role schema 原样，不存文本存有序文件引用 */
const promptPool: PoolDescriptor = {
  pool: 'prompt',
  title: '角色·Prompt',
  reliers: [], // v0 无池内引用者（组合池未来是消费者，接口已就位）
  list: dirList(rolesDir, (raw, id) => ({
    id,
    name: isStr(raw.name) ? raw.name : id,
    promptFiles: isStrArr(raw.promptFiles) ? raw.promptFiles : [],
    dynamicPromptFiles: isStrArr(raw.dynamicPromptFiles) ? raw.dynamicPromptFiles : [],
    createdAt: isStr(raw.createdAt) ? raw.createdAt : '',
    updatedAt: isStr(raw.updatedAt) ? raw.updatedAt : '',
  })),
  prepare(e) {
    return {
      promptFiles: [], dynamicPromptFiles: [],
      ...e,
      createdAt: isStr(e.createdAt) ? e.createdAt : now(),
      updatedAt: now(),
    };
  },
  validate(e) {
    if (!isBareName(e.id)) return 'role 条目缺 id（文件名裸名，可中文，禁路径分隔符）';
    if (!isStr(e.name) || e.name.length === 0) return `role「${e.id}」缺 name（非空字符串）`;
    if (!isStrArr(e.promptFiles)) return `role「${e.id}」的 promptFiles 应是有序字符串数组`;
    if (!isStrArr(e.dynamicPromptFiles)) return `role「${e.id}」的 dynamicPromptFiles 应是有序字符串数组`;
    return null;
  },
  loadRaw: dirLoadRaw(rolesDir),
  saveEntry: dirSaveEntry(rolesDir),
  deleteEntry: dirDeleteEntry(rolesDir),
};

/** session 池（§3.4）：核心壳，messages 恒空禁写（仲裁①/P5） */
const sessionPool: PoolDescriptor = {
  pool: 'session',
  title: '会话',
  reliers: [], // v0 无池内条目引用 session
  refs: [
    { field: 'providerId', pool: 'provider' },
    { field: 'modelId', pool: 'provider' },
  ],
  list: dirList(sessionsDir, (raw, id) => {
    // 核心壳投影：8.x 压缩投影字段不投影；messages 恒空数组（不出全文，P5）
    const shell: PoolEntry = {
      id,
      title: isStr(raw.title) ? raw.title : id,
      createdAt: isStr(raw.createdAt) ? raw.createdAt : '',
      updatedAt: isStr(raw.updatedAt) ? raw.updatedAt : '',
      messages: [],
    };
    if (typeof raw.manuallyNamed === 'boolean') shell.manuallyNamed = raw.manuallyNamed;
    if (isStr(raw.providerId)) shell.providerId = raw.providerId;
    if (isStr(raw.modelId)) shell.modelId = raw.modelId;
    return shell;
  }),
  prepare(e) {
    const title = isStr(e.title) ? e.title : '';
    return {
      ...e,
      id: isStr(e.id) && e.id ? e.id : title,
      title,
      createdAt: isStr(e.createdAt) ? e.createdAt : now(),
      updatedAt: now(),
      messages: [],
    };
  },
  validate(e) {
    if (!isBareName(e.id)) return 'session 条目缺 id（文件名裸名，可中文，禁路径分隔符）';
    if (!isStr(e.title) || e.title.length === 0) return `session「${e.id}」缺 title（非空字符串）`;
    if ('providerId' in e && !isStr(e.providerId)) return `session「${e.id}」的 providerId 应是字符串`;
    if ('modelId' in e && !isStr(e.modelId)) return `session「${e.id}」的 modelId 应是字符串`;
    return null;
  },
  loadRaw: dirLoadRaw(sessionsDir),
  saveEntry: dirSaveEntry(sessionsDir),
  deleteEntry: dirDeleteEntry(sessionsDir),
};

/** 基本池（§3.1）：只读聚合视图——激活总账的 UI 化，无存储 */
const basicPool: PoolDescriptor = {
  pool: 'basic',
  title: '基本',
  readonly: true,
  reliers: [],
  list(dir) {
    const ledger = readActive(dir);
    const providers = providerPool.loadAll!(dir);
    const roles = promptPool.list(dir);
    const sessions = sessionPool.list(dir);
    const providerAlive = ledger.providerId !== ''
      && providers.some((p) => providerPool.matchRef!(p, ledger.providerId));
    const modelAlive = ledger.modelId === '' || providers.some(
      (p) => Array.isArray(p.models) && (p.models as string[]).includes(ledger.modelId),
    );
    return [
      {
        id: 'provider',
        title: '默认 Provider·Model',
        providerId: ledger.providerId,
        modelId: ledger.modelId,
        dangling: ledger.providerId !== '' && (!providerAlive || !modelAlive),
      },
      {
        id: 'role',
        title: '激活角色',
        roleFile: ledger.roleFile,
        dangling: ledger.roleFile !== '' && !roles.some((r) => r.id === ledger.roleFile),
      },
      {
        id: 'session',
        title: '激活会话',
        sessionId: ledger.sessionId,
        dangling: ledger.sessionId !== '' && !sessions.some((s) => s.id === ledger.sessionId),
      },
    ] as PoolEntry[];
  },
  validate() {
    return '基本池是只读聚合视图，无条目 schema（§3.1）';
  },
};

/** 池注册表（server 侧同源，§1.5）——新池=表内加一条 */
export const POOLS: Readonly<Record<PoolId, PoolDescriptor>> = {
  basic: basicPool,
  provider: providerPool,
  prompt: promptPool,
  session: sessionPool,
};

export function getPool(pool: string): PoolDescriptor | null {
  return (POOLS as Record<string, PoolDescriptor>)[pool] ?? null;
}

// ========== relied 守卫 + 断引用降级（§2.5，唯一执行点=server 池数据层） ==========

/** 激活总账各池对应字段（激活中条目视同 relied） */
const ACTIVE_FIELD_OF: Record<PoolId, keyof ActiveLedger | null> = {
  provider: 'providerId',
  prompt: 'roleFile',
  session: 'sessionId',
  basic: null,
};

function refMatches(d: PoolDescriptor, entry: PoolEntry, value: string): boolean {
  return d.matchRef ? d.matchRef(entry, value) : value === entry.id;
}

/** 加载待删条目本体（守卫匹配要用 name/models） */
export function loadEntry(dir: string, d: PoolDescriptor, id: string): PoolEntry | null {
  if (d.loadRaw) return d.loadRaw(dir, id);
  if (d.loadAll) return d.loadAll(dir).find((e) => e.id === id) ?? null;
  return null;
}

/** 引用扫描：激活总账（视同 relied）+ reliers 声明逐池逐字段 */
export function scanReliers(dir: string, d: PoolDescriptor, entry: PoolEntry): ReliedBy[] {
  const reliedBy: ReliedBy[] = [];
  const af = ACTIVE_FIELD_OF[d.pool];
  if (af) {
    const ledger = readActive(dir);
    if (ledger[af] !== '' && refMatches(d, entry, ledger[af])) {
      reliedBy.push({ pool: 'active', id: 'active', field: af });
    }
  }
  // reliers 声明按池分组扫：同一引用条目只报首个匹配字段（确认页「被谁用着」
  // 按条目数人话，不被 providerId+modelId 双字段重复计数）
  const byPool = new Map<string, string[]>();
  for (const r of d.reliers) {
    byPool.set(r.pool, [...(byPool.get(r.pool) ?? []), r.field]);
  }
  for (const [pool, fields] of byPool) {
    const rd = getPool(pool);
    if (!rd) continue; // 声明指向不存在池=登记错误，跳过不崩
    for (const e of rd.list(dir)) {
      for (const field of fields) {
        const v = e[field];
        if (isStr(v) && v !== '' && refMatches(d, entry, v)) {
          reliedBy.push({ pool, id: e.id, field });
          break;
        }
      }
    }
  }
  return reliedBy;
}

/** 断引用降级标注（9.0 契约 №3 验收项）：refs 指向不存在条目 →
 *  该字段进 dangling（已失效），列表照出不抛错不拦列表 */
export function annotateDangling(dir: string, d: PoolDescriptor, entries: PoolEntry[]): PoolEntry[] {
  if (!d.refs || d.refs.length === 0) return entries;
  return entries.map((e) => {
    const dangling: string[] = [];
    for (const ref of d.refs!) {
      const v = e[ref.field];
      if (!isStr(v) || v === '') continue;
      const rd = getPool(ref.pool);
      if (!rd) continue;
      const alive = rd.list(dir).some((target) =>
        rd.matchRef ? rd.matchRef(target, v) : target.id === v);
      if (!alive) dangling.push(ref.field);
    }
    return { ...e, dangling };
  });
}
