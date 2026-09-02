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

// 点聚焦标签：detach 回终端态，但标签排保持展开（EXPANDED），屏幕清掉 tmux 状态行
await page.click(`[data-tmux-id="${SESS}"]`);
const l1c = await (async () => {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    const s = await screen();
    const r = await rt();
    if (r.attached === null && r.state === 'EXPANDED' && !s.includes(`[${SESS}]`)) return { ok: true, r, s };
    await page.waitForTimeout(250);
  }
  return { ok: false, r: await rt(), s: await screen() };
})();
const serverLines2 = serverSessions();
const l2Line2 = serverLines2.find(l => l.startsWith(SESS + ' '));
const l2b = l2Line2 ? l2Line2.split(' ')[1] === '0' : false;

check('L1c 浏览器钩子：点聚焦标签→detach 后标签排仍展开（state=EXPANDED, attached=null, tmux状态行消失）',
      l1c.ok, JSON.stringify({ attached: l1c.r?.attached, state: l1c.r?.state, screenHas: l1c.s?.includes(`[${SESS}]`) }));

check('L2b 服务端真值：detach 后 SESS attached=0',
      l2b, `line=${l2Line2 ?? 'MISSING'} all=${JSON.stringify(serverLines2)}`);

// 操作屏幕：键盘输入→收起标签栏
await page.keyboard.press('b');
const l1d = await (async () => {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
    const r = await rt();
    if (r.state === 'HANDLE' && !r.expanded) return { ok: true, r };
    await page.waitForTimeout(200);
  }
  return { ok: false, r: await rt() };
})();
const dom4 = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
check('L1d 浏览器钩子：键盘输入→标签栏收起（state=HANDLE, dom=HANDLE）',
      l1d.ok && dom4 === 'HANDLE', `state=${l1d.r?.state} dom=${dom4}`);

// 清理
for (const line of serverSessions()) {
  const [name] = line.split(' ');
  if (name === SESS) tmux(['kill-session', '-t', name]);
}
await browser.close();

const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
if (fails.length > 0) process.exit(1);
