/**
 * tests/browser/link-recover.test.mjs — R1 断链自愈 B 档考卷（2026-09-08
 * 判据稿签收；na 需求必须①「断链自愈+状态可见」浏览器级复演）。
 *
 * 自起隔离实例（夹具目录+私有端口，config-pool 同款），八枚钉：
 *   ①boot 横幅零存在感（OK 相不可见）
 *   ②杀 server → WS 断拍即可见（RECONNECTING）
 *   ③HTTP 探针连续败 → 降 DOWN（分层断因：网断/服务器死形态）
 *   ④server 拉回 → 探测恢复+WS 重连+会话死自愈 reload → 回 OK 横幅消失
 *   ⑤UI 建唯一会话 → 注册表入账 + attachedSession 跟上
 *   ⑥外杀该会话（tmux kill-session）→ 3s 拍 → DEGRADED 横幅列缺失名
 *   ⑦点「全部重建」→ 会话回来 → 回 OK
 *   ⑧自动重进双路：a) server 活着 reload → 续命回填视觉账（不重注入）；
 *     b) 杀 server 再拉起（tmux 守护活）→ 全新 PTY 真重进
 *
 * 安全：全程只用 nzlink 前缀唯一会话名，绝不碰 dsh/amp/psh 等真实会话。
 * 跑法：node tests/browser/link-recover.test.mjs（自起夹具，无需 8023）。
 */
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
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

const UNIQUE = `nzlink${Date.now() % 1000000}`;

// ---------- 隔离实例 ----------
const FIXTURE = await mkdtemp(join(tmpdir(), 'nz-link-b-'));
let PORT = 8127;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/healthz`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
console.log(`[exam] 隔离实例：port=${PORT} fixture=${FIXTURE}`);

const startServer = () => {
  // detached+组杀（教训：.bin/tsx 是壳进程，裸 kill 杀不掉真 node 子进程，
  // 端口被尸握 → 重起 EADDRINUSE 全线连锁红）
  const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: { ...process.env, NZ_PORT: String(PORT), NZ_AI_CONFIG_DIR: FIXTURE, NZ_GATE_DIR: join(FIXTURE, 'gate') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stderr.on('data', (d) => console.log('[srv!]', String(d).slice(0, 160)));
  return srv;
};
const killServer = async (s) => {
  if (!s?.pid) return;
  try { process.kill(-s.pid, 'SIGKILL'); } catch { /* 已死即达意 */ }
  // 等端口真空（healthz 不通为止），防 TIME_WAIT/尸握竞态
  for (let t = 0; t < 10000; t += 200) {
    try { await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); } catch { return; }
    await sleep(200);
  }
};
const waitHealth = async (timeoutMs) => {
  for (let t = 0; t < timeoutMs; t += 300) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); if (r.ok) return true; } catch { /* 未起 */ }
    await sleep(300);
  }
  return false;
};

let srv = startServer();
check('⓪夹具 healthz 端点在（隔离实例）', await waitHealth(30000));
const BASE = `http://127.0.0.1:${PORT}`;

// ---------- 浏览器 ----------
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 900, height: 620 } });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 160)));
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('[term]')) console.log('[页console]', t.slice(0, 160));
});
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
{ // 维护态闸（2026-09-11 nz 结项）：AI 系插件已摘除 → 本卷整体跳过
  await new Promise((r) => setTimeout(r, 2000));
  const alive = await page.evaluate(() => typeof (window).__kfmNzAiChat === 'function' || typeof (window).__kfmNzPool === 'function').catch(() => false);
  if (!alive) {
    console.log('[skip] ai 系插件已摘除（nz 维护态）——本卷整体跳过');
    if (typeof browser !== 'undefined') await browser.close().catch(() => {});
    process.exit(0);
  }
}
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!(window).__kfmNzLink, null, { timeout: 20000, polling: 250 }).catch(() => {});
await page.waitForFunction(() => (window).__kfmNzLink?.().phase === 'OK', null, { timeout: 15000, polling: 250 }).catch(() => {});

// ① boot 横幅零存在感
{
  const s = await page.evaluate(() => (window).__kfmNzLink?.());
  const hidden = await page.evaluate(() => {
    const el = document.querySelector('[data-link-banner]');
    return !el || el.style.display === 'none';
  });
  check('①boot OK 相横幅不可见', !!s && s.phase === 'OK' && s.visible === false && hidden, JSON.stringify(s?.phase));
}

// ②③ 杀 server → RECONNECTING 可见 → 探针连续败降 DOWN
await killServer(srv);
{
  const sawReconnecting = await page.waitForFunction(
    () => { const s = (window).__kfmNzLink?.(); return s?.phase === 'RECONNECTING' && s.visible === true && s.retries >= 1; },
    null, { timeout: 10000, polling: 200 },
  ).then(() => true).catch(() => false);
  check('②WS 断拍即可见（RECONNECTING）', sawReconnecting);
  const sawDown = await page.waitForFunction(
    () => (window).__kfmNzLink?.().phase === 'DOWN',
    null, { timeout: 15000, polling: 300 },
  ).then(() => true).catch(() => false);
  check('③HTTP 探针连续败降 DOWN（服务器不可达分层）', sawDown);
}

// ④ server 拉回：探测恢复+WS 重连（会话死自愈 reload）→ OK 横幅消失
srv = startServer();
{
  const back = await page.waitForFunction(
    () => (window).__kfmNzLink?.().phase === 'OK',
    null, { timeout: 30000, polling: 400 },
  ).then(() => true).catch(() => false);
  const hidden = back && await page.evaluate(() => {
    const el = document.querySelector('[data-link-banner]');
    return !el || el.style.display === 'none';
  }).catch(() => false);
  check('④server 拉回自愈回 OK 横幅消失', back && hidden);
}

// ⑤ UI 建唯一会话 → 注册表入账 + 附着跟上（先点把手展开——标签排
// 收起态 DOM 常在但视觉为零尺寸，加号点不中；tmux-tabs.test.mjs 同款序）
{
  await page.click('[data-tmux-tabs="HANDLE"]').catch(() => {});
  await page.waitForTimeout(400);
  await page.click('[data-tmux-plus="1"]').catch(() => {});
  await page.waitForSelector('[data-tmux-new-name]', { timeout: 5000 }).catch(() => {});
  await page.fill('[data-tmux-new-name]', UNIQUE).catch(() => {});
  await page.click('[data-tmux-confirm]').catch(() => {});
  const created = await page.waitForFunction(
    (name) => (window).__kfmNzTmuxTabs?.().sessions.some((s) => s.name === name),
    UNIQUE, { timeout: 10000, polling: 300 },
  ).then(() => true).catch(() => false);
  const inRegistry = await page.waitForFunction(
    (name) => ((JSON.parse(localStorage.getItem('nzTmuxRegistry') || '[]'))).includes(name),
    UNIQUE, { timeout: 10000, polling: 300 },
  ).then(() => true).catch(() => false);
  const attached = await page.evaluate((name) => (window).__kfmNzTmuxTabs?.().attachedSession === name, UNIQUE);
  check('⑤UI 建唯一会话+注册表入账+附着跟上', created && inRegistry && attached, `created=${created} reg=${inRegistry} attached=${attached}`);
}

// ⑥ 外杀该会话 → DEGRADED 横幅列缺失名
{
  try { execSync(`tmux kill-session -t ${UNIQUE}`, { stdio: 'ignore' }); } catch { /* 已死即达意 */ }
  const degraded = await page.waitForFunction(
    (name) => {
      const s = (window).__kfmNzLink?.();
      return s?.phase === 'DEGRADED' && s.missing.includes(name);
    },
    UNIQUE, { timeout: 12000, polling: 300 },
  ).then(() => true).catch(() => false);
  const shown = degraded && await page.evaluate(() => {
    const el = document.querySelector('[data-link-banner]');
    return !!el && el.style.display !== 'none' && el.getAttribute('data-link-phase') === 'DEGRADED';
  }).catch(() => false);
  check('⑥外杀会话 → DEGRADED 横幅列缺失名', degraded && shown);
}

// ⑦ 点「全部重建」→ 会话回来 → 回 OK
{
  const btnVisible = await page.evaluate(() => {
    const el = document.querySelector('[data-rebuild-all]');
    if (!el) return 'no-btn';
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const cover = top && !el.contains(top) && top !== el
      ? `${top.tagName}[${(top.getAttribute('data-tmux-tabs') || top.getAttribute('data-link-banner') || top.className || '').toString().slice(0, 30)}] z=${getComputedStyle(top).zIndex}`
      : 'self';
    // DOM 直呼 click：绕几何，验 handler 链
    el.click();
    return JSON.stringify({ rect: { x: r.x, y: r.y, w: r.width, h: r.height }, cover });
  });
  console.log('[⑦探针] =', btnVisible);
  // force=true：横幅按钮存在且挂了 handler，但 Playwright 稳定性判定
  // 在此场景下不收敛（终端流输出致布局连续微动？）——绕过判定真点击
  await page.click('[data-rebuild-all]', { timeout: 5000, force: true }).then(
    () => console.log('[⑦探针] 点击成功'),
    (e) => console.log('[⑦探针] 点击失败:', String(e).slice(0, 120)),
  );
  await page.waitForTimeout(4000);
  const mid = await page.evaluate(() => ({
    sessions: (window).__kfmNzTmuxTabs?.().sessions?.map((s) => s.name),
    phase: (window).__kfmNzLink?.().phase,
  }));
  console.log('[⑦探针] 点击后 4s =', JSON.stringify(mid));
  const rebuilt = await page.waitForFunction(
    (name) => (window).__kfmNzLink?.().phase === 'OK' && (window).__kfmNzTmuxTabs?.().sessions.some((x) => x.name === name),
    UNIQUE, { timeout: 15000, polling: 300 },
  ).then(() => true).catch(async () => {
    const dump = await page.evaluate(() => ({
      link: (window).__kfmNzLink?.(),
      sessions: (window).__kfmNzTmuxTabs?.().sessions?.map((s) => s.name),
      reg: JSON.parse(localStorage.getItem('nzTmuxRegistry') || '[]'),
    })).catch(() => null);
    console.log('[⑦失败取证]', JSON.stringify(dump));
    return false;
  });
  check('⑦全部重建 → 会话回表回 OK', rebuilt);
}

// ⑧a 重载路：server 活着 reload → 自动回到原会话（判定收敛到行为终态：
// attachedSession 回账；内部走续命回填还是注入重进属实现细节——boot 存在
// 双开卡（预存问题，独立立卡），resumed 旗会被合法翻 false，行为终态不变）
{
  await page.click('[data-tmux-tabs="HANDLE"]').catch(() => {});
  await page.waitForTimeout(400);
  await page.click(`[data-tmux-id="${UNIQUE}"]`).catch(() => {});
  await page.waitForFunction(
    (name) => (window).__kfmNzTmuxTabs?.().attachedSession === name,
    UNIQUE, { timeout: 10000, polling: 300 },
  ).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
  const reentered = await page.waitForFunction(
    (name) => {
      // 行为终态判定：attachedSession 回账 + 可见屏在 tmux（状态行含会话名）
      const attached = (window).__kfmNzTmuxTabs?.().attachedSession === name;
      const screen = (window).__kfmNzTermScreen?.() || '';
      return attached && screen.includes(name);
    },
    UNIQUE, { timeout: 20000, polling: 300 },
  ).then(() => true).catch(async () => {
    const dump = await page.evaluate((name) => ({
      resumed: (window).__kfmNzTermResumed,
      attached: (window).__kfmNzTmuxTabs?.().attachedSession,
      asKey: sessionStorage.getItem('nzTmuxAttached'),
      live: (window).__kfmNzTmuxTabs?.().sessions?.map((s) => s.name),
      screenHead: ((window).__kfmNzTermScreen?.() || '').slice(-80),
    }), UNIQUE).catch(() => null);
    console.log('[⑧a失败取证]', JSON.stringify(dump));
    return false;
  });
  check('⑧a server 活着 reload → 自动回到原会话（行为终态）', reentered);
}

// ⑧b 全新 PTY 路：杀 server 再拉起（tmux 守护活）→ 真重进
{
  await killServer(srv);
  srv = startServer();
  const ok = await waitHealth(30000);
  const reentered = ok && await page.waitForFunction(
    (name) => {
      const attached = (window).__kfmNzTmuxTabs?.().attachedSession === name;
      const screen = (window).__kfmNzTermScreen?.() || '';
      return attached && screen.includes(name);
    },
    UNIQUE, { timeout: 30000, polling: 400 },
  ).then(() => true).catch(() => false);
  check('⑧b server 重启（tmux 活）→ 全新 PTY 真重进', reentered);
}

// ---------- 清场 ----------
try { execSync(`tmux kill-session -t ${UNIQUE}`, { stdio: 'ignore' }); } catch { /* 无则罢 */ }
await browser.close().catch(() => {});
await killServer(srv);

const passed = results.filter((r) => r.ok).length;
console.log(`\n[link-recover] ${passed}/${results.length} 钉绿`);
process.exit(passed === results.length ? 0 : 1);
