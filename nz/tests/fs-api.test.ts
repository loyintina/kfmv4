/**
 * tests/fs-api.test.ts — 文件树/@引用 服务端 A 档考题（v1 判据稿 §五）。
 *
 * 覆盖：fail-closed（越界/绝对路径/软链逃逸 404 不透露）+ 排除清单三端点
 * 一致 + 懒加载只取直接子层 + read 截断/二进制探测 + index 正确性 +
 * 模糊引擎评分序/CJK/cap。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①safeJoin 越界判定删掉 → 钉②⑥红；
 *   ②excluded 摘掉隐藏项规则 → 钉①③红；
 *   ③read 的 NUL 探测删掉 → 钉⑤红。
 */
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { test, group, assert } from './runner.ts';
import { createNzServer } from '../src/server/index.ts';
import { resolveRoots } from '../src/server/fs.ts';
import { fuzzyScore, fuzzySearch } from '../src/client/fs/fuzzy.ts';
import type { AddressInfo } from 'node:net';

group('fs-api（文件树/@引用 服务端 A 档）');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const FIXTURE = path.join(tmpdir(), 'nz-fs-a-' + Date.now());

async function setup(): Promise<void> {
  await fsp.mkdir(path.join(FIXTURE, 'sub/deep'), { recursive: true });
  await fsp.writeFile(path.join(FIXTURE, 'a.md'), 'hello');
  await fsp.writeFile(path.join(FIXTURE, 'sub/b.md'), 'world b');
  await fsp.writeFile(path.join(FIXTURE, 'sub/deep/c.md'), 'deep c');
  await fsp.writeFile(path.join(FIXTURE, '.hidden'), 'secret');
  await fsp.mkdir(path.join(FIXTURE, '.obsidian'));
  await fsp.writeFile(path.join(FIXTURE, '.obsidian/x'), 'no');
  await fsp.writeFile(path.join(FIXTURE, 'bin.dat'), Buffer.from([1, 0, 2, 0]));
  try {
    await fsp.symlink('/etc/passwd', path.join(FIXTURE, 'escape'));
  } catch { /* 个别 FS 不允许软链：钉⑦自动跳过 */ }
}

// env 先行（fs 路由每请求读 env；其余考卷不触 /api/fs/* 不受扰）
process.env.NZ_FS_ROOTS = FIXTURE;
const server = createNzServer();
let BASE = '';

const GET = async (p: string): Promise<{ status: number; json: any }> => {
  const r = await fetch(`${BASE}${p}`, { headers: { connection: 'close' } });
  let json: any = null;
  try { json = await r.json(); } catch { /* 非 JSON */ }
  return { status: r.status, json };
};

test('⓪夹具+服务起', async () => { console.log("[fs-api] 钉⓪ 进");
  await setup();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  assert(BASE.startsWith('http'), '服务起');
});

test('①list：直接子层+排除清单生效', async () => { console.log("[fs-api] 钉① 进");
  const { status, json } = await GET('/api/fs/list?dir=');
  assert(status === 200, `status=${status}`);
  const names: string[] = json.entries.map((e: any) => e.name);
  assert(names.includes('a.md') && names.includes('sub'), `子层在场：${names}`);
  assert(!names.includes('.hidden') && !names.includes('.obsidian'), '排除清单生效（变异靶②）');
  const sub = json.entries.find((e: any) => e.name === 'sub');
  assert(sub?.type === 'dir', '类型标注');
});

test('②fail-closed：越界/绝对路径 404 不透露（变异靶①）', async () => { console.log("[fs-api] 钉② 进");
  for (const d of ['../../etc/passwd', '/etc/passwd', '....//etc']) {
    const { status } = await GET(`/api/fs/list?dir=${encodeURIComponent(d)}`);
    assert(status === 404, `越界 ${d} → 404，实得 ${status}`);
  }
});

test('③index：递归收集+排除生效', async () => { console.log("[fs-api] 钉③ 进");
  const { status, json } = await GET('/api/fs/index');
  assert(status === 200, `status=${status}`);
  const rootKey = Object.keys(json.files)[0];
  const files: string[] = json.files[rootKey];
  for (const f of ['a.md', 'sub/b.md', 'sub/deep/c.md']) {
    assert(files.includes(f), `index 缺 ${f}`);
  }
  assert(!files.some((f) => f.includes('.hidden') || f.includes('.obsidian')), '排除项不进索引');
});

test('④read：文本/截断', async () => { console.log("[fs-api] 钉④ 进");
  const full = await GET('/api/fs/read?path=a.md');
  assert(full.status === 200 && full.json.text === 'hello' && full.json.truncated === false, JSON.stringify(full.json));
  const cut = await GET('/api/fs/read?path=a.md&max=2');
  assert(cut.json.text === 'he' && cut.json.truncated === true, `截断：${JSON.stringify(cut.json)}`);
});

test('⑤read：二进制探测（变异靶③）', async () => { console.log("[fs-api] 钉⑤ 进");
  const { json } = await GET('/api/fs/read?path=bin.dat');
  assert(json.binary === true, `NUL 探测：${JSON.stringify(json)}`);
});

test('⑥read：越界 404', async () => { console.log("[fs-api] 钉⑥ 进");
  const { status } = await GET(`/api/fs/read?path=${encodeURIComponent('../../../etc/passwd')}`);
  assert(status === 404, `status=${status}`);
});

test('⑦软链逃逸 404（FS 支持软链时）', async () => { console.log("[fs-api] 钉⑦ 进");
  let ok = true;
  try { await fsp.stat(path.join(FIXTURE, 'escape')); } catch { ok = false; }
  if (!ok) return; // 软链没建成（FS 不支持）跳过
  const { status } = await GET(`/api/fs/read?path=${encodeURIComponent('escape')}`);
  assert(status === 404, `软链逃逸必须 404，实得 ${status}`);
});

// ---------- 模糊引擎（纯函数） ----------

test('⑧模糊评分序：精确>前缀>子串>子序列', () => { console.log("[fs-api] 钉⑧ 进");
  const paths = ['40-库/库.md', '40-库/库架.md', 'x/40-库/其他.md', 'zz/不匹配.md'];
  const hits = fuzzySearch(paths, '40-库');
  assert(hits[0]?.path === '40-库/库.md', `分段精确第一：${JSON.stringify(hits)}`);
  assert(hits.length === 3, '不匹配的不出现');
  const s1 = fuzzyScore('a/b', 'b')!;   // 文件段精确
  const s2 = fuzzyScore('a/bb', 'b')!;  // 文件段前缀
  const s3 = fuzzyScore('a/xb', 'b')!;  // 路径子串
  assert(s1 > s2 && s2 > s3, `精确>前缀>子串：${s1},${s2},${s3}`);
  assert(fuzzyScore('a/b.md', 'ab') !== null, '子序列命中');
  assert(fuzzyScore('a/b.md', 'zzz') === null, '全不命中=null');
});

test('⑨CJK 字面子串', () => { console.log("[fs-api] 钉⑨ 进");
  assert(fuzzyScore('40-库/技术与工程/笔记.md', '技术') !== null, 'CJK 子串命中');
  assert(fuzzyScore('40-库/技术与工程/笔记.md', '笔记') !== null, '文件名段命中');
  assert(fuzzyScore('40-库/技术与工程/笔记.md', '工') !== null, '目录段单字命中');
});

test('⑩cap 截取与排序稳定', () => { console.log("[fs-api] 钉⑩ 进");
  const paths = Array.from({ length: 50 }, (_, i) => `dir/f${i}.md`);
  const hits = fuzzySearch(paths, 'f', 20);
  assert(hits.length === 20, `cap=20，实得 ${hits.length}`);
  for (let i = 1; i < hits.length; i++) {
    assert(hits[i - 1].score >= hits[i].score, '分数降序');
  }
});

test('⑪服务卸载（先掐 keep-alive 连接再 close）', async () => { console.log("[fs-api] 钉⑪ 进");
  server.closeAllConnections();
  await sleep(50);
  await new Promise<void>((r) => server.close(() => r()));
  assert(true, '收尾');
});

test('⑫默认根收窄（§七⑨）：库存在→收窄 / 库缺→退回 HOME', async () => { console.log("[fs-api] 钉⑫ 进");
  const savedRoots = process.env.NZ_FS_ROOTS;
  const savedHome = process.env.HOME;
  try {
    delete process.env.NZ_FS_ROOTS;
    const fakeHome = path.join(FIXTURE, 'fake-home');
    await fsp.mkdir(path.join(fakeHome, '00-Loyintina'), { recursive: true });
    process.env.HOME = fakeHome;
    assert(JSON.stringify(resolveRoots()) === JSON.stringify([path.join(fakeHome, '00-Loyintina')]),
      `库存在→默认收窄到库，实得 ${JSON.stringify(resolveRoots())}`);
    await fsp.rm(path.join(fakeHome, '00-Loyintina'), { recursive: true });
    assert(JSON.stringify(resolveRoots()) === JSON.stringify([path.resolve(fakeHome)]),
      '库不存在→退回 HOME');
  } finally {
    process.env.NZ_FS_ROOTS = savedRoots; // 其余考卷不触 /api/fs/*，仍归还现场
    process.env.HOME = savedHome;
  }
});
