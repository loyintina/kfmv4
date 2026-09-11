/**
 * tests/browser/layout-composer-ghost.test.mjs — 撤 AI 后页底幽灵预留考卷
 * （2026-09-11「终端不全屏+键栏悬空 116px」案回归钉）。
 *
 * 病根：ai-chat 卸场（4729a917）后 tokens.css 静态默认
 * --kfm-aichat-composer-h: 116px 再无人覆写 → term 插件 scrollEl/barStrip
 * 的 var() 消费端永远吃到 116px：键栏悬空视口底 116px、终端区矮一截
 * （真机 CDP 实测定罪：键栏 bottom 恒 116px）。修法 = 静态定义退役
 * （tokens.css 留墓碑注），消费端 fallback 0px 生效。
 *
 * 三枚钉（普通态，无 float/无键盘）：
 *   ①var 失源：:root 上读不到 --kfm-aichat-composer-h（''）
 *   ②键栏贴底：barStrip rect.bottom === innerHeight（±1px）
 *   ③终端区吃满：scrollEl rect.bottom === innerHeight - KEYBAR_H(84)（±1px）
 *
 * 跑法：先 npm run build（吃 public/bundle.js），再
 *   node tests/browser/layout-composer-ghost.test.mjs
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

// ---------- 隔离实例（notify-bridge 同款自起骨架；纯布局卷不设 tmux 夹具） ----------
const FIX = await mkdtemp(join(tmpdir(), 'nz-layout-'));
let PORT = 8171;
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
check('⓪实例起（healthz）', up);
const BASE = `http://127.0.0.1:${PORT}`;

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
const page = await context.newPage();
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForFunction(() => !!(window).__kfmNzTermScreen, null, { timeout: 20000, polling: 250 }).catch(() => {});

const r = await page.evaluate(() => {
  const varVal = getComputedStyle(document.documentElement)
    .getPropertyValue('--kfm-aichat-composer-h').trim();
  const strip = [...document.querySelectorAll('div')].find((e) =>
    (e.style.cssText || '').includes('var(--kfm-aichat-composer-h')
    && (e.style.cssText || '').includes('height: 84px'));
  const scroll = [...document.querySelectorAll('div')].find((e) =>
    (e.style.cssText || '').includes('calc(84px'));
  const sr = strip && strip.getBoundingClientRect();
  const cr = scroll && scroll.getBoundingClientRect();
  return { varVal, ih: innerHeight, stripBottom: sr ? sr.bottom : null, scrollBottom: cr ? cr.bottom : null };
});

check('①var 失源：--kfm-aichat-composer-h 无定义', r.varVal === '', `value="${r.varVal}"`);
check('②键栏贴底：barStrip rect.bottom=innerHeight',
  r.stripBottom !== null && Math.abs(r.stripBottom - r.ih) <= 1,
  `strip=${r.stripBottom} ih=${r.ih}`);
check('③终端区吃满：scrollEl rect.bottom=innerHeight-84',
  r.scrollBottom !== null && Math.abs(r.scrollBottom - (r.ih - 84)) <= 1,
  `scroll=${r.scrollBottom} 期望=${r.ih - 84}`);

// ---------- 清场 ----------
await browser.close().catch(() => {});
await killServer();

const passed = results.filter((x) => x.ok).length;
console.log(`\n[layout-composer-ghost] ${passed}/${results.length} 钉绿`);
process.exit(passed === results.length ? 0 : 1);
