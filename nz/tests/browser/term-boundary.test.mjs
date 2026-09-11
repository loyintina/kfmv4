/**
 * tests/browser/term-boundary.test.mjs — B1 跨会话行串扰 B 档考卷
 * （2026-09-11 立卡；notify-bridge 同款自起隔离实例骨架）。
 *
 * 病根：终端卡单缓冲跨 attach 累积不清场——上一段行流残余（他窗内容/
 * 命令回显/hook 回声）混进下一段的屏与 scrollback（amp「一行 curl」事件
 * 全案证据链见 TASK §0.8 B1 卡）。修法：tmux 会话切换边界整格重建
 * （__kfmNzTermReset：核+壳全换新）。
 *
 * 七枚钉：
 *   ①进 A：标签点击 → attach → 屏现 A 标记（真链路：inject 敲
 *     `tmux new-session -A -s`）
 *   ②A 内注入活性标记 A-LIVE（inject 管线）
 *   ③切 B：屏现 B 标记，且**整卡缓冲不得含 A 活性标记**（A 世代已清场）
 *   ④切回 A：屏现 A 标记，且**整卡缓冲不得含 B 标记**
 *   ⑤回终端态（点聚焦标签 leaveTmux）：整卡缓冲 A/B 标记全无，
 *     屏非空（^L 重绘 prompt 的「已彻底回来」暗示保住）
 *   ⑥Reset 直考：注入 RESIDUE 后 __kfmNzTermReset() → 屏无残留
 *   ⑦清场：考卷自起实例端口补刀后必须清零（814x 僵尸泄漏案教训）
 *
 * 跑法：先 npm run build（吃 public/bundle.js），再
 *   node tests/browser/term-boundary.test.mjs
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

const A_MARK = 'AMA-MARKER-7391';
const B_MARK = 'BMB-MARKER-5248';

// ---------- 隔离实例 + 夹具会话 ----------
const FIX = await mkdtemp(join(tmpdir(), 'nz-boundary-'));
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
const tmux = (a) => { try { execSync(`tmux ${a}`, { stdio: 'ignore' }); return true; } catch { return false; } };
// 夹具会话：页面出生前建好（注册表首装快照口径），各自屏上放标记
tmux(`kill-session -t ftA 2>/dev/null`); tmux(`kill-session -t ftB 2>/dev/null`);
tmux(`new-session -d -s ftA -x 120 -y 30`);
tmux(`send-keys -t ftA 'echo ${A_MARK}' Enter`);
tmux(`new-session -d -s ftB -x 120 -y 30`);
tmux(`send-keys -t ftB 'echo ${B_MARK}' Enter`);

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
await page.goto(`${BASE}/?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!(window).__kfmNzTermScreen && !!(window).__kfmNzTmuxTabs, null, { timeout: 20000, polling: 250 }).catch(() => {});

const attached = () => page.evaluate(() => (window).__kfmNzTmuxTabs?.().attachedSession ?? null);
const screenText = () => page.evaluate(() => (window).__kfmNzTermScreen?.() ?? '');
const cardBuf = () => page.evaluate(() => document.querySelector('.nz-term')?.textContent ?? '');
const waitAttached = (name) => page.waitForFunction(
  (n) => (window).__kfmNzTmuxTabs?.().attachedSession === n, name, { timeout: 12000, polling: 200 },
).then(() => true).catch(() => false);
const waitScreenHas = (mark) => page.waitForFunction(
  (m) => ((window).__kfmNzTermScreen?.() ?? '').includes(m), mark, { timeout: 12000, polling: 200 },
).then(() => true).catch(() => false);
const clickTab = async (name) => {
  await page.click('[data-tmux-tabs="HANDLE"]').catch(() => {}); // 收起态先展开
  await sleep(300);
  await page.click(`[data-tmux-id="${name}"]`).catch(() => {});
};

// ① 进 A
await clickTab('ftA');
const a1 = await waitAttached('ftA');
const a2 = a1 && await waitScreenHas(A_MARK);
check('①进 A：attach 后屏现 A 标记', a1 && a2, `attached=${await attached()} screenHas=${a2}`);

// ② A 内注入活性标记
await page.evaluate(() => (window).__kfmNzTermInject?.('echo A-LIVE-9182\r'));
const a3 = await waitScreenHas('A-LIVE-9182');
check('②A 内注入活性标记', a3, `screenHas=${a3}`);

// ③ 切 B：B 标记在屏；A 世代（活性标记）不得残留在整卡缓冲
await clickTab('ftB');
const b1 = await waitAttached('ftB');
const b2 = b1 && await waitScreenHas(B_MARK);
await sleep(400);
const buf1 = await cardBuf();
check('③切 B：屏现 B 标记；缓冲无 A 世代残留', b1 && b2 && !buf1.includes('A-LIVE-9182'),
  `attached=${await attached()} screenHas=${b2} residue=${buf1.includes('A-LIVE-9182')}`);

// ④ 切回 A：A 标记在屏；B 世代不得残留
await clickTab('ftA');
const c1 = await waitAttached('ftA');
const c2 = c1 && await waitScreenHas(A_MARK);
await sleep(400);
const buf2 = await cardBuf();
check('④切回 A：屏现 A 标记；缓冲无 B 世代残留', c1 && c2 && !buf2.includes(B_MARK),
  `attached=${await attached()} screenHas=${c2} residue=${buf2.includes(B_MARK)}`);

// ⑤ 回终端态（点聚焦标签 = leaveTmux）：缓冲 A/B 标记全无，屏非空
await clickTab('ftA'); // 已聚焦 → leaveTmux
const d1 = await waitAttached(null);
await sleep(1500); // 600ms 清场定时 + ^L 重绘
const d2 = await cardBuf();
const d3 = await screenText();
check('⑤回终端态：缓冲 A/B 标记全无，屏非空（prompt 回归）',
  d1 && !d2.includes(A_MARK) && !d2.includes(B_MARK) && d3.trim().length > 0,
  `attached=${await attached()} bufA=${d2.includes(A_MARK)} bufB=${d2.includes(B_MARK)} screenLen=${d3.length}`);

// ⑥ Reset 直考
await page.evaluate(() => (window).__kfmNzTermInject?.('echo RESIDUE-3341\r'));
await waitScreenHas('RESIDUE-3341');
await page.evaluate(() => (window).__kfmNzTermReset?.());
await sleep(300);
const e1 = await screenText();
check('⑥Reset 直考：整格重建后屏无残留', !e1.includes('RESIDUE-3341'), `screenHas=${e1.includes('RESIDUE-3341')}`);

// ⑥b Nudge 钩（SIGWINCH 舞步）：钩在场 + 进入「尺寸异于页面格网」的新
// 会话后，attach 落定屏必非空（nudge 保应用重画进新网格的合同——同尺寸
// resize 被 tmux 忽略=零事件，无 nudge 时应用久未重绘的会话 attach 空屏）
{
  const hasNudge = await page.evaluate(() => typeof (window).__kfmNzTermNudge);
  tmux('new-session -d -s ftC -x 66 -y 20'); // 尺寸异于页面格网
  tmux(`send-keys -t ftC 'echo C-MARK-1101' Enter`);
  await sleep(500);
  await clickTab('ftC');
  const atC = await waitAttached('ftC');
  const cMark = atC && await waitScreenHas('C-MARK-1101');
  const nonEmpty = ((await screenText()).trim().length) > 0;
  check('⑥b Nudge：钩在场；异尺寸新会话 attach 落定屏必非空',
    hasNudge === 'function' && atC && cMark && nonEmpty,
    `nudge=${hasNudge} atC=${atC} cMark=${cMark} nonEmpty=${nonEmpty}`);
  tmux('kill-session -t ftC');
}

// ---------- 清场 ----------
await browser.close().catch(() => {});
await killServer();
tmux('kill-session -t ftA'); tmux('kill-session -t ftB');
{
  const left = execSync('tmux ls 2>/dev/null | grep -c "ftA\\|ftB\\|ftC" || true').toString().trim();
  check('⑦清场：夹具会话/实例端口清零', left === '0', `leftover sessions=${left}`);
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n[term-boundary] ${passed}/${results.length} 钉绿`);
process.exit(passed === results.length ? 0 : 1);
