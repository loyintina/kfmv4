/**
 * tests/browser/browser-organ.test.mjs — 浏览器器官 B-线 v0 B 档考卷
 * （2026-09-11 立项；file-tree 同款自起隔离实例骨架）。
 *
 * 七枚钉：
 *   ① 普通态：kfm-browser-panel-open 事件 → 管理面板可见
 *   ② 打开链路：mock NzNative.enterBrowser → 点「打开浏览器」→ 桥收到
 *     (url, session) 且面板自隐（headless 无壳，桥以 mock 断言调用面）
 *   ③ 浮窗专态：?float=1&fs=ftA → 浮窗世界挂载（标签/终端钩在场）+
 *     键栏不在场（浮窗空间纪律）
 *   ④ 浮窗切会话：点左竖线标签 ftB → 终端屏真换到 ftB（真 inject 链路）
 *   ⑤ 会话表轮询：/api/tmux/sessions 喂标签（ftA/ftB 两枚在场）
 *   ⑥ 清场：实例端口清零（814x 僵尸案教训）
 *   ⑦ 浮窗桥手势接线（2026-09-11 手势失灵案回归钉）：假桥 addInitScript
 *     注入后，顶条点按必须调到 floatCollapse——真机案=浮窗页无桥时
 *     effect 判空 return，监听器没装，手势全死且无任何报错
 *   ⑧ 全局会话账（2026-09-12 浮窗同步案回归钉）：浮窗切→主终端跟绑、
 *     主终端切→浮窗跟绑，双向（storage 事件即时 + 2.5s 对账兜底）
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
  // TMUX 剥离（2026-09-12 嵌套传染案）：考试孵化环境若在 tmux 会话里
  // 跑，TMUX 变量进 pty → 浮窗 command 卡的 tmux 客户端拒附（④假红）
  env: { ...process.env, TMUX: '', NZ_PORT: String(PORT), NZ_NO_BELL_HOOK: '1', NZ_FS_ROOTS: FIX, NZ_AI_CONFIG_DIR: join(FIX, '.ai'), NZ_GATE_DIR: join(FIX, '.gate') },
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
  // 两段式切换的视觉合同（2026-09-12 补强）：active 芯片高亮必须跟随
  const chipHi = await fpage.evaluate(() => {
    const b = document.querySelector('[data-browser-float-tab="ftB"]');
    return b ? b.style.background.replace(/\s/g, '').includes('10,132,255') : false;
  });
  // 陈旧高亮回归钉（2026-09-12 setAttached 漏项定罪）：切到 ftB 后 ftA
  // 芯片必须退高亮——高亮滞留旧会话=attached 账与 DOM 各说各话
  const chipStale = await fpage.evaluate(() => {
    const a = document.querySelector('[data-browser-float-tab="ftA"]');
    return a ? a.style.background.replace(/\s/g, '').includes('10,132,255') : true;
  });
  // 会话级证据：tmux 状态栏必须同步显示 [ftB]（switch-client 的服务端落地）
  const barFtB = await fpage.evaluate(() => (window).__kfmNzTermScreen?.().includes('[ftB]') ?? false);
  const shot = await fpage.evaluate(() => ({ detachShot: ((window).__detachShot ?? '').slice(-80), at: (window).__switchInjectedAt ?? null }));
  const seq = await fpage.evaluate(() => { clearInterval((window).__rec); return (window).__scrSeq.map((s) => s.replace(/\s+$/,'').slice(0, 60)); });
  const dump = await fpage.evaluate(() => ({
    termCard: (window).__kfmNzTermCard,
    termText: (document.querySelector('.nz-term')?.textContent ?? '').slice(0, 120),
    probe: (window).__kfmNzTermProbe,
    bootTail: (window).__kfmNz?.bootLog?.slice(-4) ?? [],
  }));
  const scr = await fpage.evaluate(() => (window).__kfmNzTermScreen?.() ?? '');
  check('④浮窗切会话：首挂就绪后点 ftB 标签 → 终端屏真换 ftB', ready && sw && sess === 'ftB' && chipHi && !chipStale && barFtB, `barFtB=${barFtB} chipHi=${chipHi} chipStale=${chipStale} switched=${sw} session=${sess} screen=${JSON.stringify(scr.split('\n').filter((l) => l.trim()).slice(0, 3))} seq=${JSON.stringify(seq)} shot=${JSON.stringify(shot)} fErr=${JSON.stringify(fErrors.slice(-2))} dump=${JSON.stringify(dump)}`);

  // ⑧ 全局会话账（2026-09-12 浮窗同步案回归钉）：当前会话跨 WebView 单源
  //   ——浮窗切 → 主终端静默跟绑（storage 事件/2.5s 对账二选一必达）；
  //   主终端切 → 浮窗跟绑。双向都要绿，任何一环断=同步死
  // ⑧a 浮窗④切到 ftB 后，主终端应已跟绑 ftB（事件即时或对账 2.5s 兜底）
  const followedFtB = await page.waitForFunction(
    () => (window).__kfmNzTmuxTabs?.().attachedSession === 'ftB',
    null, { timeout: 12000, polling: 400 },
  ).then(() => true).catch(() => false);
  const mainAttached = await page.evaluate(() => (window).__kfmNzTmuxTabs?.().attachedSession);
  check('⑧a 浮窗切换 → 主终端静默跟绑', followedFtB, `mainAttached=${mainAttached}（expect ftB）`);
  // ⑧b 反向：主终端编程切换 ftA → 浮窗跟绑 ftA
  await page.evaluate(() => (window).__kfmNzTmuxTabsEnter?.('ftA'));
  const followedFtA = await fpage.waitForFunction(
    () => (window).__kfmBrowserFloat?.().attached === 'ftA',
    null, { timeout: 12000, polling: 400 },
  ).then(() => true).catch(() => false);
  const fstate = await fpage.evaluate(() => (window).__kfmBrowserFloat?.());
  check('⑧b 主终端切换 → 浮窗跟绑', followedFtA, `floatAttached=${JSON.stringify(fstate?.attached ?? null)}（expect ftA）`);
}

// ⑤ 会话表端点
{
  const r = await fetch(`${BASE}/api/tmux/sessions`);
  const j = await r.json().catch(() => null);
  const names = Array.isArray(j?.sessions) ? j.sessions : [];
  check('⑤/api/tmux/sessions：200+会话名表', r.status === 200 && names.includes('ftA') && names.includes('ftB'), `status=${r.status} names=${JSON.stringify(names)}`);
}

// ⑦ 浮窗桥手势接线（2026-09-11 手势失灵案回归钉，变异靶：删手势 effect
// 的 nz?.floatDragBy 判空挂载即可打红——桥不在场时监听器必须 still 装/
// 或装不上但点按可观测）：假桥注入 → 顶条点按 → floatCollapse 必达
{
  const gctx = await browser.newContext({ viewport: { width: 240, height: 520 } });
  await gctx.addInitScript(() => {
    (window).__floatCollapseCalls = [];
    (window).__floatDragCalls = [];
    (window).NzNative = {
      floatDragBy: (dx, dy) => { (window).__floatDragCalls.push([dx, dy]); },
      floatGhost: () => {},
      floatCollapse: (c) => { (window).__floatCollapseCalls.push(c); },
      browserState: () => 'mode=off;collapsed=false;ghost=false',
    };
  });
  const gpage = await gctx.newPage();
  await gpage.goto(`${BASE}/?nosplash&float=1&fs=ftA`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  const bar = await gpage.waitForSelector('[data-browser-float-bar]', { timeout: 10000 }).catch(() => null);
  let ok = false; let detail = 'no bar';
  if (bar) {
    const box = await bar.boundingBox();
    await gpage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(400);
    const calls = await gpage.evaluate(() => (window).__floatCollapseCalls);
    ok = Array.isArray(calls) && calls.length > 0;
    detail = `calls=${JSON.stringify(calls)}`;
  }
  check('⑦浮窗桥手势接线：顶条点按 → floatCollapse 必达', ok, detail);
  // ⑦b 拖拽接线（2026-09-12 卡顿案回归钉）：顶条按下+移动+抬手 →
  // floatDragBy 必达且以 (0,0) 收笔提交（translation 语义合同）
  let okB = false; let detailB = 'no bar';
  if (bar) {
    const box = await bar.boundingBox();
    await gpage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await gpage.mouse.down();
    for (let i = 1; i <= 6; i++) { await gpage.mouse.move(box.x + box.width / 2 + i * 8, box.y + box.height / 2); await sleep(30); }
    await gpage.mouse.up();
    await sleep(300);
    const calls = await gpage.evaluate(() => (window).__floatDragCalls);
    const hasMove = Array.isArray(calls) && calls.some((c) => c[0] !== 0 || c[1] !== 0);
    const hasCommit = Array.isArray(calls) && calls.some((c) => c[0] === 0 && c[1] === 0);
    okB = hasMove && hasCommit;
    detailB = `calls=${JSON.stringify(calls)}`;
  }
  check('⑦b 顶条拖拽接线：floatDragBy 必达+(0,0)收笔提交', okB, detailB);
  // ⑦c 卡身内缩（2026-09-12 「向内」终案回归钉）：浮窗态终端卡身必须
  // left:26px 跟檐——卡身 fixed 锚视口不内缩时 canvas 全宽画进檐区，
  // 文字压在芯片底下（合成眼实拍定罪）
  const insetOk = await gpage.evaluate(() => {
    const c = document.querySelector('.kfm-layout');
    const l = document.getElementById('kfm-layer-layout');
    return !!c && !!l && l.style.left === '26px' && !!l.style.transform
      && c.style.left === '0px' && getComputedStyle(c).position === 'fixed';
  });
  check('⑦c 卡身归编：float 态层 transform+left26、卡身 left0（层收编裁圆角）', insetOk,
    `layer=${await gpage.evaluate(() => document.getElementById('kfm-layer-layout')?.style.left + '/' + document.getElementById('kfm-layer-layout')?.style.transform)}, card=${await gpage.evaluate(() => document.querySelector('.kfm-layout')?.style.left)}`);
  // ⑦d 首挂注入禁绝（2026-09-12 15条命令案回归钉）：卡身 command 直拉=
  // 出生即附着，浮窗页挂载后任何时刻不得注入 tmux new-session（旧首挂
  // 轮询在屏非空后 300ms 打字=污染源；本钉防其以任何形态回归）
  {
    const ictx = await browser.newContext({ viewport: { width: 240, height: 520 } });
    await ictx.addInitScript(() => {
      (window).__injCalls = [];
      let tries = 0;
      const wrap = () => {
        const oi = (window).__kfmNzTermInject;
        if (typeof oi === 'function' && !oi.__wrapped) {
          const wrapped = function(s){ (window).__injCalls.push(String(s)); return oi.call(this, s); };
          wrapped.__wrapped = true;
          (window).__kfmNzTermInject = wrapped;
        } else if (tries++ < 50) setTimeout(wrap, 100);
      };
      wrap();
    });
    const ipage = await ictx.newPage();
    await ipage.goto(`${BASE}/?nosplash&float=1&fs=ftA`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
    await sleep(5000); // 旧轮询发射窗口（屏非空后 ~300ms 内打字）全覆盖
    const calls = await ipage.evaluate(() => (window).__injCalls || []);
    // 管道池架构合同（2026-09-12 终案）：浮窗页零注入——附着/切换全部
    // 走 OpenPty/Bind 管道池，任何 tmux 命令打字注入=回归污染源
    check('⑦d 零注入合同：浮窗页全程零 tmux 命令打字', (calls || []).length === 0, `calls=${JSON.stringify(calls)}`);
    await ictx.close().catch(() => {});
  }
  await gctx.close().catch(() => {});
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
