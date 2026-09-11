/**
 * tests/browser/file-tree.test.mjs — 文件树+@引用 B 档考卷（2026-09-11
 * 判据稿 §五 B 档；notify-bridge 同款自起隔离实例骨架）。
 *
 * 隔离实例 NZ_FS_ROOTS 指向临时夹具库（考卷可控的确定文件系），页面侧
 * init 脚本包一层 fetch 计数（与服务端无涉的独立观测源）。十二枚钉：
 *   ① @ 弹窗浏览档：键入 '@' → 浮层出现，首屏=根目录列表（§4.1）
 *   ② 浏览档下钻/回上级：目录行下钻 dir=docs，‥ 上级回根
 *   ③ 树页入口：弹窗「» 浏览完整文件树…」→ kfm-nz-fstree-open → 树页
 *     挂载+根行渲染（入口事件链端到端）
 *   ④ 懒加载单次：展开 docs→收起→再展开，dir=docs 网络请求恒=② 那一次
 *     （api.ts 共享缓存担保「一目录一次网络」跨消费者成立），树页记账+1
 *     （页面 fetch 计数=独立观测源 + __kfmNzFsTree().fetches 记账互证）
 *   ⑥ 动画锁：同一拍双击 src → 第二击被吞（expanded 仍含 src，§3.2）
 *   ⑤ 虚拟化窗口：展开 big(300 文件) → 行总数≥300 而 DOM 行<80；
 *     scrollTop 置中部 → 渲染窗跟着走（big/f150.txt 上屏）
 *   ⑦ 预览+引用回流：点文件 → /api/fs/read 预览浮层出文本 → 「插入
 *     @引用」→ 树页关 + composer 草稿含 `@docs/a.md`（kfm-nz-aichat-insert）
 *   ⑧ 模糊档+Enter 确认：'@deep' → docs/sub/deep.md 置顶 → Enter 插入
 *     `@docs/sub/deep.md`、弹窗关（§4.1；弹窗开着时 Enter=引用语义）
 *   ⑨ CJK 字面子串：'@笔记' → 中文目录/笔记.md 命中确认
 *   ⑩ Esc 关 + 拍板⑭回归：弹窗 Esc 关后 Enter=换行（不发送不插入）
 *   ⑪ 索引只拉一次：三次模糊后 indexFetches=1 且网络计数=1（双层缓存）
 *
 * 跑法：先 npm run build（public/bundle.js 须含新代码），再
 *   node tests/browser/file-tree.test.mjs
 */
import { spawn, execSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from './launch.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

// ---------- 夹具库（NZ_FS_ROOTS 指向这里；确定性文件系） ----------
const FIX = await mkdtemp(join(tmpdir(), 'nz-fstree-'));
const put = async (rel, content) => {
  const p = join(FIX, rel);
  await mkdir(join(p, '..'), { recursive: true });
  await writeFile(p, content);
};
for (let i = 0; i < 300; i++) await put(`big/f${String(i).padStart(3, '0')}.txt`, `f${i}\n`);
await put('readme.md', 'fixture root readme\n');
await put('docs/a.md', 'hello a\n');
await put('docs/sub/deep.md', 'deep file\n');
await put('src/index.ts', 'export {};\n');
await put('src/app.ts', 'export const app = 1;\n');
await put('中文目录/笔记.md', '中文内容\n');
await put('bin/data.bin', Buffer.from([0x4e, 0x5a, 0x00, 0x42])); // 含 NUL=二进制

// ---------- 隔离实例 ----------
let PORT = 8141;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/healthz`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
console.log(`[exam] 隔离实例：port=${PORT} fixture=${FIX}`);

const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
  cwd: process.cwd(), detached: true,
  env: { ...process.env, NZ_PORT: String(PORT), NZ_FS_ROOTS: FIX, NZ_AI_CONFIG_DIR: join(FIX, '.ai'), NZ_GATE_DIR: join(FIX, '.gate') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stderr.on('data', (d) => console.log('[srv!]', String(d).slice(0, 160)));
const killServer = async () => {
  try { process.kill(-srv.pid, 'SIGKILL'); } catch { /* 已死即达意 */ }
  // 组杀对 tsx loader 不达（loader 独立进程组，2026-09-11 僵尸泄漏案：4 实例
  // 存活致端口爬升 8141→8144）——按端口补刀直至 healthz 断气
  for (let t = 0; t < 50; t++) {
    let alive = false;
    try { await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); alive = true; } catch { return; }
    try {
      const out = execSync(`ss -ltnp 2>/dev/null | grep ':${PORT} '`).toString();
      for (const m of out.matchAll(/pid=(\d+)/g)) { try { process.kill(Number(m[1]), 'SIGKILL'); } catch { /* 竞态已死 */ } }
    } catch { /* ss 无命中=监听已空，等下一轮 healthz 确认 */ }
    await sleep(200);
  }
};

let up = false;
for (let t = 0; t < 30000; t += 300) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); if (r.ok) { up = true; break; } } catch { /* 未起 */ }
  await sleep(300);
}
check('⓪夹具起（healthz）', up);
const BASE = `http://127.0.0.1:${PORT}`;

// ---------- 浏览器（fetch 计数先于页面脚本注入=独立观测源） ----------
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
await context.addInitScript(() => {
  window.__fsFetches = [];
  const of = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (String(url).includes('/api/fs/')) window.__fsFetches.push(String(url));
    } catch { /* 计数失败不影响请求 */ }
    return of.call(this, input, init);
  };
});
const page = await context.newPage();
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!(window).__kfmNzFsAt, null, { timeout: 20000, polling: 250 }).catch(() => {});

const hookAt = () => page.evaluate(() => (window).__kfmNzFsAt?.() ?? null);
const hookTree = () => page.evaluate(() => (window).__kfmNzFsTree?.() ?? null);
const draft = () => page.evaluate(() => document.querySelector('[data-aichat-input]')?.value ?? null);
const rowInDom = (path) => page.evaluate((p) => !!document.querySelector(`[data-fstree-row="${p}"]`), path);

// ① @ 弹窗浏览档
await page.click('[data-aichat-input]');
await page.keyboard.type('@');
{
  const ok = await page.waitForSelector('[data-fsat-popup]', { timeout: 8000 }).then(() => true).catch(() => false);
  // effect 晚于首帧 commit：等 list 行真正到位再取快照（否则读到渲染#1 的空行态）
  await page.waitForFunction(() => ((window).__kfmNzFsAt?.().rows ?? 0) > 0, null, { timeout: 8000, polling: 200 }).catch(() => {});
  const h = ok && await hookAt();
  const readme = ok && await page.evaluate(() => !!document.querySelector('[data-fsat-row="readme.md"]'));
  check('①键入 @ → 弹窗浏览档（首屏=根目录列表）', ok && h?.open === true && h?.query === '' && h?.rows === 7 && readme,
    JSON.stringify(h));
}

// ② 下钻/回上级
{
  await page.click('[data-fsat-row="docs"]');
  const inDocs = await page.waitForSelector('[data-fsat-row="docs/a.md"]', { timeout: 8000 }).then(() => true).catch(() => false);
  const upRow = await page.evaluate(() => !!document.querySelector('[data-fsat-row-kind="up"]'));
  await page.click('[data-fsat-row-kind="up"]');
  await page.waitForFunction(() => (window).__kfmNzFsAt?.().dir === '', null, { timeout: 8000, polling: 200 }).catch(() => {});
  const h = await hookAt();
  check('②浏览档下钻 dir=docs/‥ 上级回根', h?.dir === '' && inDocs && upRow, `dir=${h?.dir} inDocs=${inDocs} up=${upRow}`);
}

// ③ 树页入口（弹窗 →» 行 → 事件 → 树页）
{
  await page.click('[data-fsat-row-kind="tree"]');
  const ok = await page.waitForSelector('[data-kfm-fstree]', { timeout: 8000 }).then(() => true).catch(() => false);
  const h = ok && await hookTree();
  const docsRow = ok && await rowInDom('docs');
  check('③弹窗「» 浏览完整文件树」→ 树页挂载+根行渲染', ok && h?.open === true && docsRow, JSON.stringify(h && { open: h.open, total: h.total }));
}

// ④ 懒加载单次（不变量：dir=docs 网络请求全程恒=②浏览档那次——api.ts
// 共享缓存担保「一目录一次网络」跨消费者成立；树页记账 fetchLog +1）
{
  const net0 = await page.evaluate(() => window.__fsFetches.filter((u) => u.includes('dir=docs')).length);
  const hook0 = (await hookTree())?.fetches ?? 0;
  await page.click('[data-fstree-row="docs"]');
  const opened = await page.waitForFunction(() => !!document.querySelector('[data-fstree-row="docs/a.md"]'), null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  const net1 = await page.evaluate(() => window.__fsFetches.filter((u) => u.includes('dir=docs')).length);
  const hook1 = (await hookTree())?.fetches;
  await sleep(300); // 越过收起锁 180ms
  await page.click('[data-fstree-row="docs"]'); // 收起
  await page.waitForFunction(() => !document.querySelector('[data-fstree-row="docs/a.md"]'), null, { timeout: 8000, polling: 200 }).catch(() => {});
  await sleep(300); // 越过展开锁 240ms
  await page.click('[data-fstree-row="docs"]'); // 再展开（缓存命中，零网络）
  await page.waitForFunction(() => !!document.querySelector('[data-fstree-row="docs/a.md"]'), null, { timeout: 8000, polling: 200 }).catch(() => {});
  const net2 = await page.evaluate(() => window.__fsFetches.filter((u) => u.includes('dir=docs')).length);
  const hook2 = (await hookTree())?.fetches;
  check('④懒加载：网络恒=首次（共享缓存），树页记账+1 后不再增', opened && net0 >= 1 && net1 === net0 && net2 === net0 && hook1 === hook0 + 1 && hook2 === hook1,
    `net ${net0}→${net1}→${net2} hook ${hook0}→${hook1}→${hook2} opened=${opened}`);
}

// ⑥ 动画锁（同一拍双击，第二击被吞）——先于⑤做：此刻 src 行尚在可视窗
// （⑤展开 big 后 300 子行占据列表头部，src 被虚拟化裁出 DOM）
{
  await sleep(300); // 越过④收尾的展开锁 240ms（否则双击整对被吞=锁工作太好的假红）
  await page.evaluate(() => {
    const row = document.querySelector('[data-fstree-row="src"]');
    row.click();
    row.click();
  });
  await sleep(400);
  const h = await hookTree();
  check('⑥动画锁：同拍双击 src，第二击被吞', Array.isArray(h?.expanded) && h.expanded.includes('src'), JSON.stringify(h?.expanded));
}

// ⑤ 虚拟化窗口
{
  await sleep(300); // 越过⑥的展开锁 240ms
  await page.click('[data-fstree-row="big"]');
  const grown = await page.waitForFunction(() => (window).__kfmNzFsTree?.().total >= 300, null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  const domRows = await page.evaluate(() => document.querySelectorAll('[data-fstree-row]').length);
  await page.evaluate(() => { document.querySelector('[data-kfm-fstree-list]').scrollTop = 150 * 26; });
  const scrolled = await page.waitForFunction(() => !!document.querySelector('[data-fstree-row="big/f150.txt"]'), null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  check('⑤虚拟化：total≥300 且 DOM 行<80，滚动后渲染窗跟随', grown && domRows < 80 && scrolled, `totalgrown=${grown} domRows=${domRows} scrolled=${scrolled}`);
  // 还原现场（⑦要点 docs/a.md）：收起 big+回顶——子行 300 占头部会把
  // docs/a.md 裁出渲染窗（虚拟化正确行为，非 bug）
  await sleep(300); // 越过展开锁
  await page.evaluate(() => { document.querySelector('[data-kfm-fstree-list]').scrollTop = 0; });
  await page.waitForFunction(() => !!document.querySelector('[data-fstree-row="big"]'), null, { timeout: 8000, polling: 200 }).catch(() => {});
  await page.click('[data-fstree-row="big"]');
  await page.waitForFunction(() => (window).__kfmNzFsTree?.().total < 300, null, { timeout: 8000, polling: 200 }).catch(() => {});
}

// ⑦ 预览 + 引用回流
{
  await page.click('[data-fstree-row="docs/a.md"]');
  const pv = await page.waitForSelector('[data-fstree-preview]', { timeout: 8000 }).then(() => true).catch(() => false);
  const body = pv && await page.waitForFunction(
    () => (document.querySelector('[data-fstree-preview-body]')?.textContent ?? '').includes('hello a'),
    null, { timeout: 8000, polling: 200 },
  ).then(() => page.evaluate(() => document.querySelector('[data-fstree-preview-body]')?.textContent ?? '')).catch(() => '');
  await page.click('[data-fstree-quote]');
  const closed = await page.waitForFunction(() => (window).__kfmNzFsTree?.().open === false, null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  const val = await draft();
  check('⑦预览浮层出文本 → 插入 @引用 → 树关+草稿回流', pv && (body ?? '').includes('hello a') && closed && (val ?? '').includes('@docs/a.md'),
    `pv=${pv} body=${JSON.stringify(body?.slice(0, 20))} closed=${closed} draft=${JSON.stringify(val)}`);
}

// ⑧ 模糊档 + Enter 确认
{
  await page.fill('[data-aichat-input]', '');
  await page.type('[data-aichat-input]', '@deep');
  const hit = await page.waitForSelector('[data-fsat-row="docs/sub/deep.md"]', { timeout: 8000 }).then(() => true).catch(() => false);
  await page.keyboard.press('Enter');
  await sleep(200);
  const val = await draft();
  const h = await hookAt();
  check('⑧@deep 模糊置顶 → Enter 插入相对路径+弹窗关', hit && (val ?? '').includes('@docs/sub/deep.md') && h?.open === false,
    `hit=${hit} draft=${JSON.stringify(val)} open=${h?.open}`);
}

// ⑨ CJK 字面子串
{
  await page.type('[data-aichat-input]', ' @笔记');
  const hit = await page.waitForSelector('[data-fsat-row="中文目录/笔记.md"]', { timeout: 8000 }).then(() => true).catch(() => false);
  await page.keyboard.press('Enter');
  await sleep(200);
  const val = await draft();
  check('⑨@笔记 CJK 字面命中 → Enter 确认', hit && (val ?? '').includes('@中文目录/笔记.md'), `hit=${hit} draft=${JSON.stringify(val)}`);
}

// ⑩ Esc 关 + 拍板⑭回归（弹窗关后 Enter=换行）
{
  await page.type('[data-aichat-input]', ' @deep');
  await page.waitForSelector('[data-fsat-popup]', { timeout: 8000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await sleep(150);
  const h = await hookAt();
  const before = await draft();
  await page.keyboard.press('Enter');
  await sleep(150);
  const after = await draft();
  check('⑩Esc 关弹窗；关后 Enter=换行（拍板⑭不变）', h?.open === false && (after ?? '').startsWith(before ?? 'x') && (after ?? '').endsWith('\n'),
    `open=${h?.open} before=${JSON.stringify(before?.slice(-10))} after=${JSON.stringify(after?.slice(-10))}`);
}

// ⑪ 索引只拉一次（三层模糊后：客户端记账 + 网络计数互证）
{
  const h = await hookAt();
  const net = await page.evaluate(() => window.__fsFetches.filter((u) => u.includes('/api/fs/index')).length);
  check('⑪索引只拉一次：indexFetches=1 且网络计数=1', h?.indexFetches === 1 && net === 1, `hook=${h?.indexFetches} net=${net}`);
}

// ---------- 清场 ----------
await browser.close().catch(() => {});
await killServer();

const passed = results.filter((r) => r.ok).length;
console.log(`\n[file-tree] ${passed}/${results.length} 钉绿`);
process.exit(passed === results.length ? 0 : 1);
