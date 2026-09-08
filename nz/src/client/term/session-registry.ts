/**
 * src/client/term/session-registry.ts — tmux 会话注册表（R1 断链自愈②）。
 *
 * 「应存在哪些会话」的本地账（localStorage）：服务器重启/机器重启 tmux
 * 死透后，这张账是重建名单的唯一来源（na 实录：四窗全靠手敲逐个建）。
 * 登记策略（2026-09-08 真机教训修订）：**只认显式语义**——＋按钮创建入
 * 账、首装空账快照一次、× 杀死/横幅「忽略」出账；绝不自动登记旁观到的
 * 活会话（测试夹具/chain 临时会话会污染账本，死后横幅永久喊丢失）。
 * 容量封顶 FIFO（防病态膨胀）。storage 可注入（A 档考卷用 Map 账本）。
 */
const REG_KEY = 'nzTmuxRegistry';
export const REGISTRY_CAP = 16;

export interface KvStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const st = (storage?: KvStorage): KvStorage | undefined =>
  storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);

export function loadRegistry(storage?: KvStorage): string[] {
  try {
    const raw = st(storage)?.getItem(REG_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

export function saveRegistry(names: string[], storage?: KvStorage): void {
  try {
    st(storage)?.setItem(REG_KEY, JSON.stringify(names.slice(0, REGISTRY_CAP)));
  } catch {
    /* 隐私模式等：账退化为无（横幅少此腿，不挡主流程） */
  }
}

/** 并入单名（显式创建语义：＋按钮建的才入账）。返回新账。 */
export function registryAdd(name: string, storage?: KvStorage): string[] {
  const cur = loadRegistry(storage);
  if (cur.includes(name)) return cur;
  const next = [...cur, name].slice(Math.max(0, cur.length + 1 - REGISTRY_CAP));
  saveRegistry(next, storage);
  return next;
}

/** 首次空账快照（2026-09-08 真机教训：自动登记一切活会话=把测试夹具/
 *  chain 临时会话全收进账，死后横幅永久喊丢失。改为：账空且活表非空时
 *  快照一次（首装即捕获用户既有四窗），此后只认显式创建。返回新账。 */
export function registrySnapshotIfEmpty(live: string[], storage?: KvStorage): string[] {
  const cur = loadRegistry(storage);
  if (cur.length || !live.length) return cur;
  const next = live.slice(0, REGISTRY_CAP);
  saveRegistry(next, storage);
  return next;
}

export function registryRemove(name: string, storage?: KvStorage): string[] {
  const next = loadRegistry(storage).filter((n) => n !== name);
  saveRegistry(next, storage);
  return next;
}

/** 注册表 diff 活表 → 缺失名单（保账序，喂 LinkTracker.setMissing） */
export function registryMissing(live: string[], storage?: KvStorage): string[] {
  const liveSet = new Set(live);
  return loadRegistry(storage).filter((n) => !liveSet.has(n));
}
