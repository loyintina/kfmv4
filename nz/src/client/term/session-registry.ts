/**
 * src/client/term/session-registry.ts — tmux 会话注册表（R1 断链自愈②）。
 *
 * 「应存在哪些会话」的本地账（localStorage）：服务器重启/机器重启 tmux
 * 死透后，这张账是重建名单的唯一来源（na 实录：四窗全靠手敲逐个建）。
 * 登记策略（v1 从简）：一切活会话自动登记（agent 手敲建的也算用户资产），
 * 标签 × 杀死/横幅「忽略」= 显式除名；容量封顶 FIFO（防病态膨胀）。
 * storage 可注入（A 档考卷用 Map 账本，不碰真 localStorage）。
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

/** 并入活会话（保序：账上旧名在前，新名接尾），超帽掐头。返回新账。 */
export function registryAddLive(live: string[], storage?: KvStorage): string[] {
  const cur = loadRegistry(storage);
  const set = new Set(cur);
  let changed = false;
  for (const n of live) {
    if (!set.has(n)) {
      cur.push(n);
      set.add(n);
      changed = true;
    }
  }
  const next = cur.length > REGISTRY_CAP ? cur.slice(cur.length - REGISTRY_CAP) : cur;
  if (changed || next.length !== cur.length) saveRegistry(next, storage);
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
