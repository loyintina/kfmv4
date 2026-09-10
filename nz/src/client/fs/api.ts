/**
 * src/client/fs/api.ts — 文件树/@引用 客户端 fs API 面（v1 判据稿 §二 的
 * 消费侧单点，2026-09-11 Phase 2 落地）：全量索引客户端缓存 + 拉取计数、
 * list 懒加载、read 文本预览。na Rust 化时对应「fs 服务 + 客户端缓存」
 * 一层的直译面（判据稿即规格本体）。
 *
 * 观测：fsStats().indexFetches = /api/fs/index 实际网络拉取次数（B 档
 * 「索引只拉一次」钉的观测源；缓存命中不计数，失败归还缓存位重试）。
 */

export interface FsEntry {
  name: string;
  type: 'dir' | 'file';
  size: number;
  mtime: number;
}

export interface FsReadResult {
  binary: boolean;
  truncated: boolean;
  text?: string; // binary=true 时服务端不下发 text
}

let indexPromise: Promise<string[]> | null = null;
let indexFetches = 0;
const listCache = new Map<string, Promise<FsEntry[]>>();
let listFetches = 0;

/** 全量相对路径索引（客户端会话级缓存；服务端另有 60s TTL——两层缓存
 * 语义不同：本层保「一次会话一次网络」，过期由热更 reload 天然重建） */
export function loadFsIndex(): Promise<string[]> {
  if (!indexPromise) {
    indexFetches++;
    indexPromise = fetch('/api/fs/index', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`index ${r.status}`);
        return r.json() as Promise<{ files: Record<string, string[]> }>;
      })
      .then((j) => {
        // 多根投影（server files: root→paths）摊平成相对路径域——
        // resolveInRoots 按相对路径跨根解析，@ 引用只认相对路径
        const all: string[] = [];
        for (const list of Object.values(j.files)) all.push(...list);
        return all;
      })
      .catch((e) => {
        indexPromise = null; // 失败不锁缓存位：下次触发重拉
        throw e;
      });
  }
  return indexPromise;
}

/** 懒加载：只取 dir 的直接子层（排除清单服务端过滤，fail-closed 404 透传）。
 * 客户端会话级缓存（@ 浏览档与文件树页共用同一 promise）——「一目录一次
 * 网络」不变量由本层担保；失败不锁缓存位，下次触发重试。 */
export function fetchFsList(dir: string): Promise<FsEntry[]> {
  const hit = listCache.get(dir);
  if (hit) return hit;
  listFetches++;
  const p = fetch(`/api/fs/list?dir=${encodeURIComponent(dir)}`, { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`list ${r.status}`);
      return ((await r.json()) as { entries: FsEntry[] }).entries;
    })
    .catch((e) => {
      listCache.delete(dir); // 失败逐出：重试语义
      throw e;
    });
  listCache.set(dir, p);
  return p;
}

/** 文本预览（服务端 NUL 探测二进制；默认 64KB 截断标记透传） */
export async function fetchFsRead(path: string, max = 64 * 1024): Promise<FsReadResult> {
  const r = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}&max=${max}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`read ${r.status}`);
  return (await r.json()) as FsReadResult;
}

/** 观测钩（公共契约）：考卷/守视直读（listFetches=网络拉取的目录次数，
 * 缓存命中不计数） */
export function fsStats(): { indexFetches: number; listFetches: number } {
  return { indexFetches, listFetches };
}
