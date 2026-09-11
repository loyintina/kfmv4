/**
 * tests/browser/notify-bridge.test.mjs — R3 长任务通知 B 档考卷（2026-09-09
 * 判据稿签收；na 需求必须②「长任务通知」浏览器级复演）。
 *
 * 自起隔离实例（link-recover 同款骨架）+ 页面注入假 NzNative 桥捕获调用，
 * 六枚钉：
 *   ①POST /__tmux-notify → 假桥收到 notify（标题含会话名、文案透传）
 *   ②节流：同会话窗内第二条被吞（调用数不变）
 *   ③缺省文案：无 message → 「有任务需要你」
 *   ④附着抑制：附着中的会话收到 notify 帧 → 不上桥
 *
 * 跑法：node tests/browser/notify-bridge.test.mjs（自起夹具，无需 8023）。
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

const U1 = `nzntf-b-${Date.now() % 1000000}`;

// ---------- 隔离实例 ----------
const FIXTURE = await mkdtemp(join(tmpdir(), 'nz-ntf-b-'));
let PORT = 8133;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/healthz`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
console.log(`[exam] 隔离实例：port=${PORT} fixture=${FIXTURE}`);

const startServer = () => {
  const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
    cwd: process.cwd(), detached: true,
    env: { ...process.env, NZ_PORT: String(PORT), NZ_NO_BELL_HOOK: '1', NZ_AI_CONFIG_DIR: FIXTURE, NZ_GATE_DIR: join(FIXTURE, 'gate') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stderr.on('data', (d) => console.log('[srv!]', String(d).slice(0, 160)));
  return srv;
};
const killServer = async (s) => {
  if (!s?.pid) return;
  try { process.kill(-s.pid, 'SIGKILL'); } catch { /* 已死即达意 */ }
  for (let t = 0; t < 10000; t += 200) {
    try { await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); } catch { return; }
    await sleep(200);
  }
};

const srv = startServer();
let up = false;
for (let t = 0; t < 30000; t += 300) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); if (r.ok) { up = true; break; } } catch { /* 未起 */ }
  await sleep(300);
}
check('⓪夹具起（healthz）', up);
const BASE = `http://127.0.0.1:${PORT}`;
const post = async (body) => {
  const r = await fetch(`${BASE}/__tmux-notify`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
  });
  return r.status;
};

// ---------- 浏览器（假桥先于页面脚本注入） ----------
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
await context.addInitScript(() => {
  window.__notifyCalls = [];
  window.NzNative = { pushNotice: (t, b) => window.__notifyCalls.push([String(t), String(b)]) };
});
const page = await context.newPage();
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!(window).__kfmNzTmuxTabs, null, { timeout: 20000, polling: 250 }).catch(() => {});

// 页面默认置 hidden：交付类钉在「用户不在看」语义下验证（⑤再单验 visible 抑制）
const setVis = (state) => page.evaluate((st) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: st });
}, state);
await setVis('hidden');

// ① 非 focuse 会话 POST → 假桥收到（标题含会话名、文案透传）
{
  await post(`session=${U1}&kind=custom&message=${encodeURIComponent('需要拍板')}`);
  const got = await page.waitForFunction(
    () => ((window).__notifyCalls?.length ?? 0) > 0,
    null, { timeout: 8000, polling: 250 },
  ).then(() => true).catch(() => false);
  const detail = got && await page.evaluate(() => (window).__notifyCalls[0]).catch(() => null);
  check('①notify 帧 → 假桥收到（标题含会话名+文案透传）',
    got && detail?.[0] === `nz · ${U1}` && detail?.[1] === '需要拍板', JSON.stringify(detail));
}

// ② 节流：同会话窗内第二条被吞
{
  await post(`session=${U1}&message=第二条不该到`);
  await sleep(1500);
  const n = await page.evaluate(() => (window).__notifyCalls?.length ?? 0);
  check('②同会话 30s 窗内第二条被吞', n === 1, `calls=${n}`);
}

// ③ 缺省文案
{
  const U2 = `${U1}-x`;
  await post(`session=${U2}&kind=bell`);
  const got = await page.waitForFunction(
    (n) => ((window).__notifyCalls?.length ?? 0) >= 2,
    null, { timeout: 8000, polling: 250 },
  ).then(() => page.evaluate(() => (window).__notifyCalls.at(-1))).catch(() => null);
  check('③缺省文案=「有任务需要你」', got?.[0] === `nz · ${U2}` && got?.[1] === '有任务需要你', JSON.stringify(got));
}

// ④ 附着抑制：真建会话并附着，POST 该会话 → 不上桥
{
  const U3 = `nzntf-attach-${Date.now() % 100000}`;
  const tmux = (a) => { try { execSync(`tmux ${a}`, { stdio: 'ignore' }); return true; } catch { return false; } };
  tmux(`new-session -d -s ${U3} -x 120 -y 30`);
  const appeared = await page.waitForFunction(
    (name) => (window).__kfmNzTmuxTabs?.().sessions.some((s) => s.name === name),
    U3, { timeout: 10000, polling: 300 },
  ).then(() => true).catch(() => false);
  await page.click('[data-tmux-tabs="HANDLE"]').catch(() => {});
  await page.waitForTimeout(400);
  await page.click(`[data-tmux-id="${U3}"]`).catch(() => {});
  const attached = await page.waitForFunction(
    (name) => (window).__kfmNzTmuxTabs?.().attachedSession === name,
    U3, { timeout: 10000, polling: 300 },
  ).then(() => true).catch(() => false);
  const before = attached && await page.evaluate(() => (window).__notifyCalls?.length ?? 0);
  await post(`session=${U3}&message=附着中不该上桥`);
  await sleep(2000);
  const after = await page.evaluate(() => (window).__notifyCalls?.length ?? 0);
  check('④附着中的会话通知被抑制', appeared && attached && before === after, `appeared=${appeared} attached=${attached} ${before}→${after}`);
  tmux(`kill-session -t ${U3}`);
}

// ⑤⑥ 可见性闸回归钉（09-09 十四连响案）：visible=抑制 / hidden=放行
{
  const U4 = `${U1}-vis`;
  await setVis('visible');
  await post(`session=${U4}&message=可见态应抑制`);
  await sleep(2000);
  const mid = await page.evaluate(() => (window).__notifyCalls?.length ?? 0);
  check('⑤visible 态通知被抑制', mid === 2, `calls=${mid}（期望仍=2）`);
  await setVis('hidden');
  const U5 = `${U1}-hid`;
  await post(`session=${U5}&message=隐藏态应放行`);
  const got = await page.waitForFunction(
    (n) => ((window).__notifyCalls?.length ?? 0) > n,
    mid, { timeout: 8000, polling: 250 },
  ).then(() => true).catch(() => false);
  check('⑥hidden 态通知放行', got);
}

// ---------- 清场 ----------
await browser.close().catch(() => {});
await killServer(srv);

const passed = results.filter((r) => r.ok).length;
console.log(`\n[notify-bridge] ${passed}/${results.length} 钉绿`);
process.exit(passed === results.length ? 0 : 1);
