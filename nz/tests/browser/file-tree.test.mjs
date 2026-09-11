/**
 * tests/browser/file-tree.test.mjs — 文件树 B 档考卷（2026-09-11 结项修订版：
 * AI 系（ai-chat/config-pool）已摘除，@ 弹窗随之退役——本卷收敛为树专属，
 * 手势入口为主。历史弹窗钉（浏览档/模糊档/Esc/索引）随摘除退役，模糊引擎
 * 由 A 档 fs-api 单测覆盖；摘除前的弹窗全钉见 git 941f713b 版本）。
 *
 * 九枚钉：
 *   ① 事件开树：kfm-nz-fstree-open → 树页挂载+根行渲染
 *   ② 懒加载单次：展开 docs→收起→再展开，dir=docs 网络恒=首次
 *     （api.ts 共享缓存担保；页面 fetch 计数=独立观测源）
 *   ③ 虚拟化窗口：展开 big(300 文件) → 行总数≥300 而 DOM 行<80；
 *     scrollTop 置中部 → 渲染窗跟随（big/f150.txt 上屏）
 *   ④ 动画锁：同一拍双击 src → 第二击被吞（expanded 仍含 src，§3.2）
 *   ⑤ 预览：点文件 → /api/fs/read 文本上浮层 → × 关闭
 *   ⑥ 手势：右滑开树 / 左滑关树（FileTree:700 层全链）
 *   ⑦ 长按复制：file 行长按 → 剪贴板=相对路径+预览未弹+toast；
 *     dir 行长按 → 复制且不收起（click 消费）
 *   ⑧ Esc 关树
 *   ⑨ 清场：实例端口清零（814x 僵尸案教训）
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

// ---------- 隔离实例 ----------
let PORT = 8161;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/healthz`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
console.log(`[exam] 隔离实例：port=${PORT} fixture=${FIX}`);

const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
  cwd: process.cwd(), detached: true,
  env: { ...process.env, NZ_PORT: String(PORT), NZ_NO_BELL_HOOK: '1', NZ_FS_ROOTS: FIX, NZ_AI_CONFIG_DIR: join(FIX, '.ai'), NZ_GATE_DIR: join(FIX, '.gate') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stderr.on('data', (d) => console.log('[srv!]', String(d).slice(0, 160)));
const killServer = async () => {
  try { process.kill(-srv.pid, 'SIGKILL'); } catch { /* 已死即达意 */ }
  // 组杀对 tsx loader 不达——按端口补刀直至 healthz 断气（814x 僵尸案教训）
  for (let t = 0; t < 50; t++) {
    let alive = false;
    try { await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); alive = true; } catch { return; }
    try {
      const out = execSync(`ss -ltnp 2>/dev/null | grep ':${PORT} '`).toString();
      for (const m of out.matchAll(/pid=(\d+)/g)) { try { process.kill(Number(m[1]), 'SIGKILL'); } catch { /* 竞态已死 */ } }
    } catch { /* 监听已空 */ }
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

const context = await (await launchBrowser()).newContext({ viewport: { width: 900, height: 620 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
await context.addInitScript(() => {
  window.__fsFetches = [];
  const of = window.fetch;
  window.fetch = function (input, init) {
    try { const url = typeof input === 'string' ? input : (input && input.url) || ''; if (String(url).includes('/api/fs/')) window.__fsFetches.push(String(url)); } catch { /* 计数失败不影响请求 */ }
    return of.call(this, input, init);
  };
});
const page = await context.newPage();
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!(window).__kfmNzFsTree, null, { timeout: 20000, polling: 250 }).catch(() => {});

const hookTree = () => page.evaluate(() => (window).__kfmNzFsTree?.() ?? null);
const rowInDom = (path) => page.evaluate((p) => !!document.querySelector(`[data-fstree-row="${p}"]`), path);
const openTree = async () => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('kfm-nz-fstree-open')));
  await page.waitForFunction(() => (window).__kfmNzFsTree?.().open === true, null, { timeout: 8000, polling: 200 }).catch(() => {});
  await sleep(500); // 抽屉入场动画落定（320ms）——动画期 rect 是偏移的，量了也白量
};
const clickRow = async (sel) => {
  const c = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }, sel);
  if (c) { await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.up(); }
  return !!c;
};

// ① 事件开树
await openTree();
{
  const h = await hookTree();
  const docsRow = await rowInDom('docs');
  check('①事件开树：树页挂载+根行渲染', h?.open === true && docsRow, `open=${h?.open} docs=${docsRow}`);
}

// ② 懒加载单次（网络恒=首次：api.ts 共享缓存；页面 fetch 计数=独立观测源）
{
  await page.evaluate(() => window.__fsFetches = []);
  await clickRow('[data-fstree-row="docs"]');
  const opened = await page.waitForFunction(() => !!document.querySelector('[data-fstree-row="docs/a.md"]'), null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  const net1 = await page.evaluate(() => window.__fsFetches.filter((u) => u.includes('dir=docs')).length);
  await sleep(300); // 越过收起锁
  await clickRow('[data-fstree-row="docs"]');
  await page.waitForFunction(() => !document.querySelector('[data-fstree-row="docs/a.md"]'), null, { timeout: 8000, polling: 200 }).catch(() => {});
  await sleep(300);
  await clickRow('[data-fstree-row="docs"]');
  await page.waitForFunction(() => !!document.querySelector('[data-fstree-row="docs/a.md"]'), null, { timeout: 8000, polling: 200 }).catch(() => {});
  const net2 = await page.evaluate(() => window.__fsFetches.filter((u) => u.includes('dir=docs')).length);
  check('②懒加载：展开→收起→再展开，dir=docs 网络恒 1', opened && net1 === 1 && net2 === 1, `opened=${opened} net ${net1}→${net2}`);
}

// ③ 虚拟化窗口
{
  await sleep(300);
  await clickRow('[data-fstree-row="big"]');
  const grown = await page.waitForFunction(() => (window).__kfmNzFsTree?.().total >= 300, null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  const domRows = await page.evaluate(() => document.querySelectorAll('[data-fstree-row]').length);
  await page.evaluate(() => { document.querySelector('[data-kfm-fstree-list]').scrollTop = 150 * 26; });
  const scrolled = await page.waitForFunction(() => !!document.querySelector('[data-fstree-row="big/f150.txt"]'), null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  check('③虚拟化：total≥300 且 DOM 行<80，滚动后渲染窗跟随', grown && domRows < 80 && scrolled, `grown=${grown} domRows=${domRows} scrolled=${scrolled}`);
  await sleep(300);
  await page.evaluate(() => { document.querySelector('[data-kfm-fstree-list]').scrollTop = 0; });
  await page.waitForFunction(() => !!document.querySelector('[data-fstree-row="big"]'), null, { timeout: 8000, polling: 200 }).catch(() => {});
  await clickRow('[data-fstree-row="big"]');
  await page.waitForFunction(() => (window).__kfmNzFsTree?.().total < 300, null, { timeout: 8000, polling: 200 }).catch(() => {});
}

// ④ 动画锁（同一拍双击，第二击被吞）
{
  await sleep(300); // 越过③收尾的展开锁
  await page.evaluate(() => {
    const row = document.querySelector('[data-fstree-row="src"]');
    row.click(); row.click();
  });
  await sleep(400);
  const h = await hookTree();
  check('④动画锁：同拍双击 src，第二击被吞', Array.isArray(h?.expanded) && h.expanded.includes('src'), JSON.stringify(h?.expanded));
}

// ⑤ 预览
{
  await page.click('[data-fstree-row="docs/a.md"]');
  const pv = await page.waitForSelector('[data-fstree-preview]', { timeout: 8000 }).then(() => true).catch(() => false);
  const body = pv && await page.waitForFunction(
    () => (document.querySelector('[data-fstree-preview-body]')?.textContent ?? '').includes('hello a'),
    null, { timeout: 8000, polling: 200 },
  ).then(() => page.evaluate(() => document.querySelector('[data-fstree-preview-body]')?.textContent ?? '')).catch(() => '');
  await page.click('[data-fstree-preview-close]');
  await sleep(200);
  const gone = await page.evaluate(() => !document.querySelector('[data-fstree-preview]'));
  check('⑤预览：浮层出文本 → × 关闭', pv && (body ?? '').includes('hello a') && gone, `pv=${pv} body=${JSON.stringify(body?.slice(0, 20))} gone=${gone}`);
}

// ⑥ 手势（右滑开/左滑关；mouse 指针=手势核同源）
{
  await page.click('[data-fstree-close]');
  const closed0 = await page.waitForFunction(() => (window).__kfmNzFsTree?.().open === false, null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  await sleep(600); // 收起尾巴落定
  const swipe = async (x, y, dx) => {
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 14; i++) await page.mouse.move(x + (dx * i) / 14, y);
    await page.mouse.up();
  };
  await swipe(450, 260, 260);
  const opened = await page.waitForFunction(() => (window).__kfmNzFsTree?.().open === true, null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  await sleep(500);
  await swipe(450, 260, -260);
  const closed = await page.waitForFunction(() => (window).__kfmNzFsTree?.().open === false, null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  check('⑥手势：右滑开树 / 左滑关树', closed0 && opened && closed, `x-closed=${closed0} opened=${opened} closed=${closed}`);
  await sleep(600);
}

// ⑦ 长按复制（docs 世代已持久：重开即见 a.md）
{
  await openTree();
  await page.evaluate(() => { const l = document.querySelector('[data-kfm-fstree-list]'); if (l) l.scrollTop = 0; });
  await sleep(400);
  const alreadyOpen = await page.evaluate(() => (window).__kfmNzFsTree?.().expanded.includes('docs'));
  if (!alreadyOpen) await clickRow('[data-fstree-row="docs"]'); // 已展开世代再点=收起
  await page.waitForSelector('[data-fstree-row="docs/a.md"]', { timeout: 8000 }).catch(() => {});
  await sleep(700); // stagger 落定
  const row = await page.evaluate(() => { const el = document.querySelector('[data-fstree-row="docs/a.md"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; });
  await page.mouse.move(row.x, row.y);
  await page.mouse.down();
  await sleep(800); // 越过 550ms 长按阈值
  await page.mouse.up();
  const copied = await page.waitForFunction(
    () => (window).__kfmNzFsTree?.().lastCopy?.path === 'docs/a.md' && (window).__kfmNzFsTree?.().lastCopy?.ok === true,
    null, { timeout: 8000, polling: 200 },
  ).then(() => true).catch(() => false);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'READ-FAIL'));
  const h = await hookTree();
  const toast = await page.evaluate(() => document.querySelector('[data-fstree-toast]')?.textContent ?? '');
  check('⑦file 行长按：剪贴板=相对路径；预览未弹；toast+记账',
    copied && clip === 'docs/a.md' && h?.selected === null && toast.includes('已复制'),
    `copied=${copied} clip=${JSON.stringify(clip)} selected=${h?.selected} toast=${JSON.stringify(toast)}`);
  // dir 行长按（docs 已展开 → 若 click 未被消费会收起）
  const dRow = await page.evaluate(() => { const el = document.querySelector('[data-fstree-row="docs"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; });
  await page.mouse.move(dRow.x, dRow.y);
  await page.mouse.down();
  await sleep(800);
  await page.mouse.up();
  const copied2 = await page.waitForFunction(
    () => (window).__kfmNzFsTree?.().lastCopy?.path === 'docs' && (window).__kfmNzFsTree?.().lastCopy?.ok === true,
    null, { timeout: 8000, polling: 200 },
  ).then(() => true).catch(() => false);
  const clip2 = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'READ-FAIL'));
  const h2 = await hookTree();
  check('⑦b dir 行长按：复制路径且不收起（click 消费）',
    copied2 && clip2 === 'docs' && h2?.expanded.includes('docs'),
    `clip=${JSON.stringify(clip2)} expanded=${JSON.stringify(h2?.expanded)}`);
}

// ⑧ Esc 关树
{
  await openTree();
  await page.keyboard.press('Escape');
  const closed = await page.waitForFunction(() => (window).__kfmNzFsTree?.().open === false, null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  check('⑧Esc 关树', closed, `closed=${closed}`);
}

// ---------- 清场 ----------
await context.close().catch(() => {});
await killServer();

const passed = results.filter((r) => r.ok).length;
console.log(`\n[file-tree] ${passed}/${results.length} 钉绿`);
process.exit(passed === results.length ? 0 : 1);
