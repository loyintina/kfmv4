import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from './launch.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIX = await mkdtemp(join(tmpdir(), 'nz-fsprobe-'));
await writeFile(join(FIX, 'a.md'), 'x\n');
let PORT = 8151;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/healthz`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
  cwd: process.cwd(), detached: true,
  env: { ...process.env, NZ_PORT: String(PORT), NZ_FS_ROOTS: FIX, NZ_AI_CONFIG_DIR: join(FIX, '.ai'), NZ_GATE_DIR: join(FIX, '.gate') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stderr.on('data', (d) => console.log('[srv!]', String(d).slice(0, 200)));
for (let t = 0; t < 30000; t += 300) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); if (r.ok) break; } catch { /* 未起 */ }
  await sleep(300);
}
const browser = await launchBrowser();
const page = await (await browser.newContext({ viewport: { width: 900, height: 620 } })).newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e).slice(0, 400)}`));
await page.goto(`http://127.0.0.1:${PORT}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await sleep(1000);
const probe1 = await page.evaluate(() => ({
  kernelList: window.__kfmNzKernel?.list?.() ?? null,
  fsTreeHook: typeof window.__kfmNzFsTree,
  fsAtHook: typeof window.__kfmNzFsAt,
}));
console.log('probe1:', JSON.stringify(probe1));
// 直接发事件看树页挂不挂
await page.evaluate(() => window.dispatchEvent(new CustomEvent('kfm-nz-fstree-open')));
await sleep(800);
const probe2 = await page.evaluate(() => ({
  treeDom: !!document.querySelector('[data-kfm-fstree]'),
  hook: window.__kfmNzFsTree?.() ?? null,
}));
console.log('probe2:', JSON.stringify(probe2));
console.log('logs:\n' + logs.join('\n'));
await browser.close().catch(() => {});
try { process.kill(-srv.pid, 'SIGKILL'); } catch { /* 已死即达意 */ }
process.exit(0);
