/**
 * tests/browser/tmux-tabs-l2-crosscheck.mjs
 * tmux-tabs v2.2 的 L1+L2 隔离互证脚本。
 * L1 = 浏览器钩子状态观测（同源但不同于考卷 v6 的 DOM 驱动）。
 * L2 = 服务端 tmux ls 真值互证。
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const SESS = 'l2-autoattach-' + Date.now();

const serverSessions = () => String(execFileSync('tmux', ['ls', '-F', '#{session_name} #{session_attached}'], { timeout: 4000 })).split('\n').filter(Boolean);
const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };

// 清理旧探针
for (const line of serverSessions()) {
  const [name] = line.split(' ');
  if (name.startsWith('l2-autoattach')) tmux(['kill-session', '-t', name]);
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject, null, { timeout: 30000 });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

// L1: 浏览器钩子读态
const rt = () => page.evaluate(() => {
  const r = window.__kfmNzTmuxTabs?.() ?? {};
  return { state: r.state, attached: r.attachedSession, expanded: r.expanded, sessions: r.sessions?.map(s => s.name) };
});
const screen = () => page.evaluate(() => window.__kfmNzTermScreen());

// 展开标签排
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);

// 建新会话
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', SESS);
await page.click('[data-tmux-confirm="1"]');

// L1: 等待浏览器报告 attach
const l1 = await (async () => {
  const end = Date.now() + 6000;
  while (Date.now() < end) {
    const r = await rt();
    const s = await screen();
    if (r.attached === SESS && r.state === 'EXPANDED' && s.includes(`[${SESS}]`)) return { ok: true, r, s };
    await page.waitForTimeout(250);
  }
  return { ok: false, r: await rt(), s: await screen() };
})();

// L2: 服务端 tmux ls 真值
await page.waitForTimeout(500); // 给服务端 tmux 稳定
const serverLines = serverSessions();
const l2Line = serverLines.find(l => l.startsWith(SESS + ' '));
const l2 = l2Line ? l2Line.split(' ')[1] === '1' : false;

check('L1 浏览器钩子：建会话后自动 attach（state=EXPANDED, attached=SESS, 屏幕含状态行）',
      l1.ok, JSON.stringify({ attached: l1.r?.attached, state: l1.r?.state, screenHas: l1.s?.includes(`[${SESS}]`) }));

check('L2 服务端真值：tmux ls 显示 SESS attached=1',
      l2, `line=${l2Line ?? 'MISSING'} all=${JSON.stringify(serverLines)}`);

// 点屏幕空白（backdrop）收起
await page.click('[data-tmux-backdrop="1"]');
await page.waitForTimeout(300);
const r3 = await rt();
const dom3 = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
check('L1b backdrop 收起：state=HANDLE, expanded=false, dom=HANDLE',
      r3.state === 'HANDLE' && !r3.expanded && dom3 === 'HANDLE',
      `state=${r3.state} expanded=${r3.expanded} dom=${dom3}`);

// 清理
for (const line of serverSessions()) {
  const [name] = line.split(' ');
  if (name === SESS) tmux(['kill-session', '-t', name]);
}
await browser.close();

const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
if (fails.length > 0) process.exit(1);
