/**
 * fs.ts — 文件树卡片 + @ 文件引用 · 服务端 API（v1 判据稿 §二，2026-09-10 签收）
 *
 * 三端点 fail-closed（判据稿 §2.2）：
 *   GET /api/fs/list  ?dir=相对路径        懒加载：只返回直接子层（排除规则过滤）
 *   GET /api/fs/index                       全量相对路径索引（@ 模糊搜索数据源）
 *   GET /api/fs/read  ?path=&max=          文本预览（NUL 探测二进制；max 截断）
 *
 * 安全模型（判据稿红线）：
 *   - 路径一律相对允许根；规范化后越界 → 404 且不透露存在性
 *   - realpath 前缀校验防逃逸（判据稿注明：目标是防逃逸；根内软链无害偏差已接受）
 *   - 排除清单单源（.obsidian/.smart-env/.trash/node_modules/.git/隐藏项）
 *   - 索引缓存 60s TTL + 在途去重；排除项不进索引
 *
 * 挂载：index.ts 静态分支之前 `const handleFs = mountFsRoutes();`
 */
import { promises as fsp } from 'node:fs';
import path from 'node:path';

/** 判据稿 §2.1 排除目录（段级命中即整枝剪除） */
const EXCLUDE_DIRS = new Set(['.obsidian', '.smart-env', '.trash', 'node_modules', '.git']);

/** 允许根解析（每请求读取——考卷可在运行时改 env） */
export function resolveRoots(): string[] {
  const spec = process.env.NZ_FS_ROOTS ?? process.env.HOME ?? '/';
  return spec.split(':').filter(Boolean).map((p) => path.resolve(p));
}

/** 排除判定：隐藏项（.开头）或段级命中排除清单 */
export function excluded(name: string): boolean {
  return name.startsWith('.') || EXCLUDE_DIRS.has(name);
}

/** 相对路径 → 根内绝对路径；越界/绝对/逃逸返回 null（调用方 404 不透露） */
export function safeJoin(root: string, rel: string): string | null {
  if (rel === '' || path.isAbsolute(rel)) return null;
  const abs = path.resolve(root, rel);
  const back = path.relative(root, abs);
  if (back === '' || back.startsWith('..') || path.isAbsolute(back)) return null;
  return abs;
}

/** 在允许根中解析相对路径：命中根 → {root, abs, realpath}；全不中 → null。
 *  realpath 前缀校验防符号链接逃逸（软链在根内解析=可用，逃出=404）。 */
export async function resolveInRoots(
  rel: string,
): Promise<{ root: string; abs: string; real: string; relReal: string } | null> {
  for (const root of resolveRoots()) {
    // rel='' = 列根目录本身（安全：root 即允许根）
    const abs = rel === '' ? root : safeJoin(root, rel);
    if (!abs) continue;
    try {
      const real = await fsp.realpath(abs);
      const rootReal = await fsp.realpath(root);
      const back = path.relative(rootReal, real);
      if (back === '' || (!back.startsWith('..') && !path.isAbsolute(back))) {
        return { root, abs, real, relReal: back === '' ? '' : back };
      }
    } catch {
      /* ENOENT 等换下一个根 */
    }
  }
  return null;
}

const toInt = (v: string | null, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
};

/** GET /api/fs/list?dir= — 懒加载直接子层 */
async function handleList(url: URL, res: import('node:http').ServerResponse): Promise<boolean> {
  const dir = url.searchParams.get('dir') ?? '';
  const hit = await resolveInRoots(dir);
  if (!hit) {
    // 越界/不存在：404 不透露存在性（路由已被挂载器认领，必须应答——
    // 09-10 悬挂案：此分支落空=请求永不完成）
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return true;
  }
  let st;
  try {
    st = await fsp.stat(hit.abs);
  } catch {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return true;
  }
  if (!st.isDirectory()) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not a directory' }));
    return true;
  }
  const names = await fsp.readdir(hit.abs);
  const entries: Array<{ name: string; type: 'dir' | 'file'; size: number; mtime: number }> = [];
  for (const name of names.sort()) {
    if (excluded(name)) continue;
    try {
      const est = await fsp.stat(path.join(hit.abs, name));
      entries.push({
        name,
        type: est.isDirectory() ? 'dir' : 'file',
        size: est.size,
        mtime: Math.floor(est.mtimeMs),
      });
    } catch {
      /* 竞态消失的条目跳过 */
    }
  }
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ dir, entries }));
  return true;
}

// ---------- 索引（60s TTL + 在途去重） ----------

interface IndexEntry {
  builtAt: number;
  files: Map<string, string[]>; // root → 相对路径数组
}
const indexCache = new Map<string, IndexEntry & { expires: number }>();
const INDEX_TTL = 60_000;

async function walkRoot(root: string, rootReal: string, out: string[], rel = ''): Promise<void> {
  const abs = rel === '' ? rootReal : path.join(rootReal, rel);
  let names: string[];
  try {
    names = await fsp.readdir(abs);
  } catch {
    return;
  }
  for (const name of names.sort()) {
    if (excluded(name)) continue;
    const childRel = rel === '' ? name : `${rel}/${name}`;
    let st;
    try {
      st = await fsp.lstat(path.join(rootReal, childRel));
    } catch {
      continue;
    }
    if (st.isDirectory()) await walkRoot(root, rootReal, out, childRel);
    else if (st.isFile()) out.push(childRel);
  }
}

async function buildRootIndex(root: string): Promise<string[]> {
  const rootReal = await fsp.realpath(root).catch(() => null);
  if (!rootReal) return [];
  const out: string[] = [];
  await walkRoot(root, rootReal, out);
  return out;
}

/** GET /api/fs/index — 全量索引（?root=名字 可只取单根；缺省=全部允许根） */
async function handleIndex(url: URL, res: import('node:http').ServerResponse): Promise<boolean> {
  if (url.pathname !== '/api/fs/index') return false;
  const only = url.searchParams.get('root');
  const roots = resolveRoots().filter((r) => !only || path.basename(r) === only || r === only);
  const files: Record<string, string[]> = {};
  const builtAt = Date.now();
  await Promise.all(
    roots.map(async (root) => {
      const cached = indexCache.get(root);
      if (cached && cached.expires > Date.now()) {
        files[path.basename(root) || root] = cached.files;
        return;
      }
      const p = buildRootIndex(root);
      indexCache.set(root, { builtAt, files: [], expires: 0 }); // 在途去重占位
      const list = await p;
      indexCache.set(root, { builtAt, files: list, expires: Date.now() + INDEX_TTL });
      files[path.basename(root) || root] = list;
    }),
  );
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ builtAt, files }));
  return true;
}

/** GET /api/fs/read?path=&max= — 文本预览（NUL 探测二进制；max 截断） */
async function handleRead(url: URL, res: import('node:http').ServerResponse): Promise<boolean> {
  const rel = url.searchParams.get('path') ?? '';
  const max = toInt(url.searchParams.get('max'), 64 * 1024);
  const hit = await resolveInRoots(rel);
  if (!hit) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return true;
  }
  let st;
  try {
    st = await fsp.stat(hit.abs);
  } catch {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return true;
  }
  if (!st.isFile()) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not a file' }));
    return true;
  }
  const fh = await fsp.open(hit.abs, 'r');
  try {
    const buf = Buffer.alloc(Math.min(max + 1, st.size, 1024 * 1024));
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    const data = buf.subarray(0, bytesRead);
    const binary = data.includes(0);
    const truncated = bytesRead > max || bytesRead < st.size;
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    if (binary) res.end(JSON.stringify({ path: rel, binary: true, truncated }));
    else
      res.end(
        JSON.stringify({
          path: rel,
          binary: false,
          truncated,
          size: st.size,
          text: data.toString('utf8', 0, Math.min(bytesRead, max)),
        }),
      );
    return true;
  } finally {
    await fh.close();
  }
}

/** 挂载入口（index.ts 静态分支之前；返回 true=已处理） */
export function mountFsRoutes() {
  const guard = (res: import('node:http').ServerResponse, p: Promise<boolean>) => {
    p.catch(() => {
      try {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal' }));
      } catch { /* 已写出就算了 */ }
    });
    return true;
  };
  return (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): boolean => {
    if (req.method !== 'GET') return false;
    const url = new URL(req.url ?? '/', 'http://x');
    switch (url.pathname) {
      case '/api/fs/list':
        return guard(res, handleList(url, res));
      case '/api/fs/index':
        return guard(res, handleIndex(url, res));
      case '/api/fs/read':
        return guard(res, handleRead(url, res));
      default:
        return false;
    }
  };
}
