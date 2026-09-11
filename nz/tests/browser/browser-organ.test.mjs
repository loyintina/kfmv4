/**
 * tests/browser/browser-organ.test.mjs — 浏览器器官 B-线 v0 B 档考卷
 * （2026-09-11 立项；file-tree 同款自起隔离实例骨架）。
 *
 * 六枚钉：
 *   ① 普通态：kfm-browser-panel-open 事件 → 管理面板可见
 *   ② 打开链路：mock NzNative.enterBrowser → 点「打开浏览器」→ 桥收到
 *     (url, session) 且面板自隐（headless 无壳，桥以 mock 断言调用面）
 *   ③ 浮窗专态：?float=1&fs=ftA → 浮窗世界挂载（标签/终端钩在场）+
 *     键栏不在场（浮窗空间纪律）
 *   ④ 浮窗切会话：点左竖线标签 ftB → 终端屏真换到 ftB（真 inject 链路）
 *   ⑤ 会话表轮询：/api/tmux/sessions 喂标签（ftA/ftB 两枚在场）
 *   ⑥ 清场：实例端口清零（814x 僵尸案教训）
 *
 * 跑法：先 npm run build（public/bundle.js 须含新代码），再
 *   node tests/browser/browser-organ.test.mjs
 */
import { spawn, execSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from './launch.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

// ---------- 隔离实例 + 夹具会话 ----------
const FIX = await mkdtemp(join(tmpdir(), 'nz-borgan-'));
let PORT = 8181;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/healthz`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
console.log(`[exam] 隔离实例：port=${PORT} fixture=${FIX}`);

const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
  cwd: process.cwd(), detached: true,
  env: { ...process.env, NZ_PORT: String(PORT), NZ_NO_BELL_HOOK: '1', NZ_FS_ROOTS: FIX, NZ_AI_CONFIG_DIR: join(FIX, '.ai'), NZ_GATE_DIR: join(FIX, '.gate') },
  stdio: ['ignore', 'ignore', 'ignore'],
});
const tmux = (a) => { try { execSync(`tmux ${a}`, { stdio: 'ignore' }); return true; } catch { return false; } };
tmux('kill-session -t ftA 2>/dev/null'); tmux('kill-session -t ftB 2>/dev/null');
tmux('new-session -d -s ftA -x 120 -y 30');
tmux(`send-keys -t ftA 'echo AMA-ORGAN-7391' Enter`);
tmux('new-session -d -s ftB -x 120 -y 30');
tmux(`send-keys -t ftB 'echo BMB-ORGAN-5248' Enter`);

const killServer = async () => {
  try { process.kill(-srv.pid, 'SIGKILL'); } catch { /* 已死即达意 */ }
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

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 220)));
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForFunction(() => !!(window).__kfmBrowser && !!(window).__kfmNzTmuxTabs, null, { timeout: 20000, polling: 250 }).catch(() => {});

// ① 面板召唤
{
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('kfm-browser-panel-open')));
  const vis = await page.waitForFunction(() => document.querySelector('[data-browser-panel]')?.style.display !== 'none', null, { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
  check('①面板召唤：kfm-browser-panel-open → 面板可见', vis, `vis=${vis}`);
}

// ② 打开链路（mock 桥断言调用面）
{
  await page.evaluate(() => {
    window.__enters = [];
    window.NzNative = {
      enterBrowser: (u, s) => window.__enters.push([u, s]),
      exitBrowser: () => window.__exited = true,
      browserState: () => 'mode=off;collapsed=false;hidden=false',
    };
  });
  await page.fill('[data-browser-url]', 'https://example.com/page');
  await page.fill('[data-browser-session]', 'ftA');
  await page.click('[data-browser-open]');
  await sleep(400);
  const enters = await page.evaluate(() => window.__enters);
  const hidden = await page.evaluate(() => document.querySelector('[data-browser-panel]')?.style.display === 'none');
  const diag2 = await page.evaluate(() => ({
    display: document.querySelector('[data-browser-panel]')?.style.display,
    rect: (() => { const r = document.querySelector('[data-browser-panel]')?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })(),
  }));
  check('②打开链路：桥收到 (url, session)，面板自隐',
    Array.isArray(enters) && enters[0]?.[0] === 'https://example.com/page' && enters[0]?.[1] === 'ftA' && hidden,
    `enters=${JSON.stringify(enters)} hidden=${hidden} diag=${JSON.stringify(diag2)} pageErrors=${JSON.stringify(pageErrors)}`);
}

// ③④ 浮窗专态
{
  const fpage = await context.newPage(); // 新 tab=独立 sessionStorage（浮窗世界不接前世续命账）
  const fErrors = [];
  fpage.on('pageerror', (e) => fErrors.push(String(e).slice(0, 220)));
  await fpage.goto(`${BASE}/?nosplash&float=1&fs=ftA`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  await fpage.waitForFunction(() => !!(window).__kfmNzTermScreen && !!(window).__kfmBrowserFloat, null, { timeout: 20000, polling: 250 }).catch(() => {});
  const noKeybar = await fpage.evaluate(() => !document.querySelector('[data-kfm-keybar]'));
  const tabs = await fpage.waitForFunction(() => !!document.querySelector('[data-browser-float-tab="ftB"]'), null, { timeout: 10000, polling: 300 }).then(() => true).catch(() => false);
  check('③浮窗专态：钩在场+键栏不在场+双标签轮询到', noKeybar && tabs, `noKeybar=${noKeybar} tabs=${tabs}`);
  await fpage.evaluate(() => { window.__scrSeq = []; window.__rec = setInterval(() => { const s = (window).__kfmNzTermScreen?.() ?? ''; const last = (window).__scrSeq.at(-1); if (s !== last) (window).__scrSeq.push(s.slice(0, 100)); if ((window).__scrSeq.length > 12) (window).__scrSeq.shift(); }, 100); });
  const ready = await fpage.waitForFunction(
    () => (window).__kfmBrowserFloat?.().attached === 'ftA', null, { timeout: 20000, polling: 300 },
  ).then(() => true).catch(() => false); // 首挂完成（门闩开）才切
  await fpage.click('[data-browser-float-tab="ftB"]');
  const sw = await fpage.waitForFunction(
    () => (window).__kfmNzTermScreen?.().includes('BMB-ORGAN-5248'), null, { timeout: 15000, polling: 300 },
  ).then(() => true).catch(() => false);
  const sess = await fpage.evaluate(() => (window).__kfmBrowserFloat?.().session);
  const shot = await fpage.evaluate(() => ({ detachShot: ((window).__detachShot ?? '').slice(-80), at: (window).__switchInjectedAt ?? null }));
  const seq = await fpage.evaluate(() => { clearInterval((window).__rec); return (window).__scrSeq.map((s) => s.replace(/\s+$/,'').slice(0, 60)); });
  const dump = await fpage.evaluate(() => ({
    termCard: (window).__kfmNzTermCard,
    termText: (document.querySelector('.nz-term')?.textContent ?? '').slice(0, 120),
    probe: (window).__kfmNzTermProbe,
    bootTail: (window).__kfmNz?.bootLog?.slice(-4) ?? [],
  }));
  const scr = await fpage.evaluate(() => (window).__kfmNzTermScreen?.() ?? '');
  check('④浮窗切会话：首挂就绪后点 ftB 标签 → 终端屏真换 ftB', ready && sw && sess === 'ftB', `switched=${sw} session=${sess} screen=${JSON.stringify(scr.split('\n').filter((l) => l.trim()).slice(0, 3))} seq=${JSON.stringify(seq)} shot=${JSON.stringify(shot)} fErr=${JSON.stringify(fErrors.slice(-2))} dump=${JSON.stringify(dump)}`);
}

// ⑤ 会话表端点
{
  const r = await fetch(`${BASE}/api/tmux/sessions`);
  const j = await r.json().catch(() => null);
  const names = Array.isArray(j?.sessions) ? j.sessions : [];
  check('⑤/api/tmux/sessions：200+会话名表', r.status === 200 && names.includes('ftA') && names.includes('ftB'), `status=${r.status} names=${JSON.stringify(names)}`);
}

// ---------- 清场 ----------
await browser.close().catch(() => {});
await killServer();
tmux('kill-session -t ftA'); tmux('kill-session -t ftB');
{
  const left = execSync('tmux ls 2>/dev/null | grep -c "ftA\\|ftB" || true').toString().trim();
  check('⑥清场：夹具会话/实例端口清零', left === '0', `leftover sessions=${left}`);
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n[browser-organ] ${passed}/${results.length} 钉绿`);
process.exit(passed === results.length ? 0 : 1);
