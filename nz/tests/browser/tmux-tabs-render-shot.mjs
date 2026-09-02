/**
 * tests/browser/tmux-tabs-render-shot.mjs
 * tmux-tabs v2.3+ 的「贴近用户体验」验证路径：Playwright 真实渲染截图。
 * 本路径作为 nz/AGENTS.md 要求的「至少一条贴近用户体验的验证」落地样本。
 * 观测手段：像素截图 + 屏幕文本钩子互证 + 人工/评审可复核的落盘图片。
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_SHOT_DIR || '/tmp/nz-tmux-tabs-shots';
const SESS = 'shot-probe-' + Date.now();

const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line.startsWith('shot-probe')) tmux(['kill-session', '-t', line]);
}
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() =>
  !!window.__kfmNzTermInject && !!window.__kfmNzTermClear && !!window.__kfmNzTermScreen && !!window.__kfmNzTmuxTabs,
  null, { timeout: 30000 },
);

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const rt = () => page.evaluate(() => {
  const r = window.__kfmNzTmuxTabs?.() ?? {};
  return { state: r.state, attached: r.attachedSession, expanded: r.expanded };
});
const screen = () => page.evaluate(() => window.__kfmNzTermScreen());
const shot = async (name) => {
  const p = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
};

// 1. 展开标签排并 attach 到新会话
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', SESS);
await page.click('[data-tmux-confirm="1"]');

// 等待 attach 完成
const okAttach = await (async () => {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const r = await rt();
    const s = await screen();
    if (r.attached === SESS && s.includes(`[${SESS}]`)) return true;
    await page.waitForTimeout(250);
  }
  return false;
})();
check('attach 成功（截图路径前置）', okAttach, `attached=${(await rt()).attached}`);

// 1b. 在 tmux 会话里产生一些可见内容，让 detach 前后对比更明显
await page.evaluate(() => window.__kfmNzTermInject?.('echo hello-tmux-content\r'));
await page.waitForTimeout(600);

// 2. attach 后截图 A
const shotA = await shot('01-attached');
const textA = await screen();
const hasTmuxA = textA.includes('hello-tmux-content') && textA.includes(`[${SESS}]`);
check('截图 A 含 tmux 内容（像素证据前置）', hasTmuxA, `path=${shotA}`);

// 3. 点聚焦标签 detach
await page.click(`[data-tmux-id="${SESS}"]`);

// 4. 等待清屏完成（500+300+缓冲）
await page.waitForTimeout(1400);
const shotB = await shot('02-detached-cleared');
const textB = await screen();
const hasTmuxB = textB.includes(`[${SESS}]`);
const rB = await rt();

check('detach 后标签排仍展开（state=EXPANDED）', rB.state === 'EXPANDED', `state=${rB.state}`);
check('detach 后屏幕不再含 tmux 内容（文本断言）', !hasTmuxB && !textB.includes('hello-tmux-content'), `text=${textB.slice(0, 120)}`);
check('detach 后清屏截图已落盘（像素路径）', !!shotB, `path=${shotB}`);

// 5. 操作屏幕：点击终端区域，标签栏应收起且终端能同步响应（无卡顿）
// 通过点终端后截图 C，验证标签排已收起（dom 上只剩 HANDLE）
await page.click('.nz-term', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(300);
const shotC = await shot('03-screen-op');
const rC = await rt();
const domC = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
check('点终端后标签栏收起（state=HANDLE+dom=HANDLE）',
      rC.state === 'HANDLE' && domC === 'HANDLE', `state=${rC.state} dom=${domC} path=${shotC}`);

// 清理
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line === SESS) tmux(['kill-session', '-t', line]);
}
await browser.close();

const fails = results.filter((x) => !x.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
console.log(`截图落盘: ${OUT_DIR}`);
if (fails.length > 0) process.exit(1);
