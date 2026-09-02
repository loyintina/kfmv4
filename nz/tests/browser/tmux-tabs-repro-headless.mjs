/**
 * tests/browser/tmux-tabs-repro-headless.mjs
 * 复现「点击已聚焦标签 → 命令历史被清空 + 命令行闪烁两下」问题。
 * 观测手段：Playwright headless 逐帧截图 + 钩子读数。
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_REPRO_DIR || '/tmp/nz-tmux-tabs-repro';
const SESS = 'repro-' + Date.now();

const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line.startsWith('repro-')) tmux(['kill-session', '-t', line]);
}
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() =>
  !!window.__kfmNzTermInject && !!window.__kfmNzTermScreen && !!window.__kfmNzTmuxTabs,
  null, { timeout: 30000 },
);

const screen = () => page.evaluate(() => window.__kfmNzTermScreen());
const rt = () => page.evaluate(() => {
  const r = window.__kfmNzTmuxTabs?.() ?? {};
  return { state: r.state, attached: r.attachedSession, expanded: r.expanded };
});
const shot = async (name) => {
  const p = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
};

// 1. 先在 shell 里产生一些命令历史
checkLog('shell 历史前置');
await page.evaluate(() => window.__kfmNzTermInject?.('echo hist-before-1\r'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__kfmNzTermInject?.('echo hist-before-2\r'));
await page.waitForTimeout(400);
const beforeHistory = await screen();
console.log('[前置历史] 含 hist-before-1/2:', beforeHistory.includes('hist-before-1') && beforeHistory.includes('hist-before-2'));

// 2. attach 到 tmux 会话
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(200);
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', SESS);
await page.click('[data-tmux-confirm="1"]');

const okAttach = await (async () => {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const s = await screen();
    const r = await rt();
    if (r.attached === SESS && s.includes(`[${SESS}]`)) return true;
    await page.waitForTimeout(200);
  }
  return false;
})();
console.log('[attach]', okAttach);

// 在 tmux 里产生一些输出
await page.evaluate(() => window.__kfmNzTermInject?.('echo inside-tmux-1\r'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__kfmNzTermInject?.('echo inside-tmux-2\r'));
await page.waitForTimeout(400);
await shot('01-inside-tmux');

// 3. 展开标签排（若已展开则跳过），点已聚焦标签（触发 detach + 清屏）
const rPreClick = await rt();
if (!rPreClick.expanded) {
  await page.click('[data-tmux-tabs="HANDLE"]');
  await page.waitForTimeout(200);
}

// 开始逐帧截图：detach 前 1 帧，detach 后 10 帧（100ms 间隔）
const frames = [];
frames.push({ t: 'pre-click', p: await shot('02-pre-click') });
await page.click(`[data-tmux-id="${SESS}"]`);

for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(100);
  frames.push({ t: `post-${i * 100}ms`, p: await shot(`03-post-${String(i).padStart(2, '0')}0ms`) });
}

// 4. 读取 detach 后状态
const afterState = await rt();
const afterScreen = await screen();
console.log('[detach 后状态]', afterState);
console.log('[detach 后屏幕]', afterScreen.slice(0, 200));

// 判断 bug：读取 historyDiv（scrollback 区）看是否还有 hist-before-1/2
const scrollbackText = await page.evaluate(() => {
  const hist = document.querySelector('.nz-term > div:first-child');
  return hist?.innerText || '';
});
console.log('[scrollback 内容]', scrollbackText.slice(0, 300));
const scrollbackHasHistory = scrollbackText.includes('hist-before-1') || scrollbackText.includes('hist-before-2');
console.log('[BUG 当前屏历史丢失]', !afterScreen.includes('hist-before-1'));
console.log('[BUG scrollback 历史丢失]', !scrollbackHasHistory);
console.log('[帧序列]', frames.map((f) => f.t).join(', '));

// 清理
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line === SESS) tmux(['kill-session', '-t', line]);
}
await browser.close();

function checkLog(label) {
  console.log(`[REPRO] ${label}`);
}
