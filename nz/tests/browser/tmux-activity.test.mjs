/**
 * tests/browser/tmux-activity.test.mjs — R2 多会话活动指示 B 档考卷
 * （2026-09-08 判据稿签收；na 需求必须③「多会话活动指示」浏览器级复演）。
 *
 * 自起隔离实例（link-recover 同款骨架），四枚钉：
 *   ①游离会话灌输出 → 会话表 activity=true → chip 青点亮（data-activity）
 *   ②附着该会话 → 点灭（附着中不亮，判据稿③）
 *   ③离开后再灌输出 → 再亮（可重复，非一次性）
 *   ④无活动会话恒不亮
 *
 * 安全：只用 nzact-b- 前缀一次性会话；不动 dsh/amp/psh/kfm-na。
 * 跑法：node tests/browser/tmux-activity.test.mjs（自起夹具，无需 8023）。
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

const UNIQUE = `nzact-b-${Date.now() % 1000000}`;
const tmux = (args) => { try { execSync(`tmux ${args}`, { stdio: 'ignore' }); return true; } catch { return false; } };

// ---------- 隔离实例 ----------
const FIXTURE = await mkdtemp(join(tmpdir(), 'nz-act-b-'));
let PORT = 8131;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/healthz`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
console.log(`[exam] 隔离实例：port=${PORT} fixture=${FIXTURE}`);

const startServer = () => {
  const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
    cwd: process.cwd(), detached: true,
    env: { ...process.env, NZ_PORT: String(PORT), NZ_AI_CONFIG_DIR: FIXTURE, NZ_GATE_DIR: join(FIXTURE, 'gate') },
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

let srv = startServer();
let up = false;
for (let t = 0; t < 30000; t += 300) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); if (r.ok) { up = true; break; } } catch { /* 未起 */ }
  await sleep(300);
}
check('⓪夹具起（healthz）', up);

// monitor-activity：夹具服务挂载时异步开，这里显式钉上保确定性
tmux('set -g monitor-activity on');

const BASE = `http://127.0.0.1:${PORT}`;
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
const page = await context.newPage();
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!(window).__kfmNzTmuxTabs, null, { timeout: 20000, polling: 250 }).catch(() => {});
await page.waitForFunction(() => ((window).__kfmNzTmuxTabs?.().sessions?.length ?? 0) > 0, null, { timeout: 15000, polling: 300 }).catch(() => {});

// ① 建游离会话+灌输出 → activity=true → chip 青点亮
{
  tmux(`new-session -d -s ${UNIQUE} -x 120 -y 30`);
  const appeared = await page.waitForFunction(
    (name) => (window).__kfmNzTmuxTabs?.().sessions.some((s) => s.name === name),
    UNIQUE, { timeout: 10000, polling: 300 },
  ).then(() => true).catch(() => false);
  // 清零：新会话出生即 act=1（tmux 语义），先附看一眼再离开
  tmux(`TERM=xterm timeout 2 script -qec "tmux attach -t ${UNIQUE}" /dev/null >/dev/null 2>&1`);
  await sleep(2500); // 等 3s 拍把清零推到页面
  tmux(`send-keys -t ${UNIQUE} 'echo act-b-exam' Enter`);
  const lit = await page.waitForFunction(
    (name) => {
      const s = (window).__kfmNzTmuxTabs?.().sessions.find((x) => x.name === name);
      if (!s?.activity) return false;
      return !!document.querySelector(`[data-tmux-id="${name}"] [data-activity]`);
    },
    UNIQUE, { timeout: 12000, polling: 300 },
  ).then(() => true).catch(() => false);
  check('①灌输出 → activity=true → chip 青点亮', appeared && lit, `appeared=${appeared} lit=${lit}`);
}

// ② 附着该会话 → 点灭
{
  await page.click('[data-tmux-tabs="HANDLE"]').catch(() => {});
  await page.waitForTimeout(400);
  await page.click(`[data-tmux-id="${UNIQUE}"]`).catch(() => {});
  const attached = await page.waitForFunction(
    (name) => (window).__kfmNzTmuxTabs?.().attachedSession === name,
    UNIQUE, { timeout: 10000, polling: 300 },
  ).then(() => true).catch(() => false);
  const dotGone = attached && await page.evaluate((name) =>
    !document.querySelector(`[data-tmux-id="${name}"] [data-activity]`), UNIQUE).catch(() => false);
  check('②附着该会话 → 点灭（附着中不亮）', attached && dotGone, `attached=${attached} dotGone=${dotGone}`);
}

// ③ 离开后再灌输出 → 再亮
{
  await page.click(`[data-tmux-id="${UNIQUE}"]`).catch(() => {}); // 点聚焦签=detach 回终端态
  await page.waitForFunction(
    (name) => (window).__kfmNzTmuxTabs?.().attachedSession === null,
    UNIQUE, { timeout: 8000, polling: 300 },
  ).catch(() => {});
  tmux(`send-keys -t ${UNIQUE} 'echo act-b-exam-2' Enter`);
  const relit = await page.waitForFunction(
    (name) => !!document.querySelector(`[data-tmux-id="${name}"] [data-activity]`),
    UNIQUE, { timeout: 12000, polling: 300 },
  ).then(() => true).catch(() => false);
  check('③离开后再灌输出 → 再亮（可重复）', relit);
}

// ④ 无活动会话恒不亮（用 dsh：附着中的会话规则上不亮；这里验活表里
//    activity=false 的 chip 无点——取当前表里第一个非 UNIQUE 且无活动的）
{
  const silent = await page.evaluate((name) => {
    const s = (window).__kfmNzTmuxTabs?.().sessions.find((x) => x.name !== name && !x.activity);
    if (!s) return 'no-silent-session';
    return document.querySelector(`[data-tmux-id="${s.name}"] [data-activity]`) ? 'false-lit' : 'ok';
  }, UNIQUE);
  check('④无活动会话恒不亮', silent === 'ok', String(silent));
}

// ---------- 清场 ----------
tmux(`kill-session -t ${UNIQUE}`);
await browser.close().catch(() => {});
await killServer(srv);

const passed = results.filter((r) => r.ok).length;
console.log(`\n[tmux-activity] ${passed}/${results.length} 钉绿`);
process.exit(passed === results.length ? 0 : 1);
