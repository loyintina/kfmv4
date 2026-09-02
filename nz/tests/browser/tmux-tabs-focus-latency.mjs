/**
 * tests/browser/tmux-tabs-focus-latency.mjs
 * 观测 tmux-tabs 聚焦状态响应延迟与视觉正确性。
 * 路径：Playwright headless 逐帧截图 + 钩子读数 + DOM 颜色采样。
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_LATENCY_DIR || '/tmp/nz-tmux-tabs-focus-latency';
const PREFIX = 'latency-' + Date.now();
const SESS_A = `${PREFIX}-a`;
const SESS_B = `${PREFIX}-b`;

const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line.startsWith('latency-')) tmux(['kill-session', '-t', line]);
}
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() =>
  !!window.__kfmNzTermInject && !!window.__kfmNzTermScreen && !!window.__kfmNzTmuxTabs,
  null, { timeout: 30000 },
);

const rt = () => page.evaluate(() => {
  const r = window.__kfmNzTmuxTabs?.() ?? {};
  return { state: r.state, attached: r.attachedSession, expanded: r.expanded };
});
const shot = async (name) => {
  const p = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
};

// 读取某个标签的背景色（聚焦指示）
const chipColor = (name) => page.evaluate((n) => {
  const el = document.querySelector(`[data-tmux-id="${n}"]`);
  return el ? getComputedStyle(el).backgroundColor : null;
}, name);

// 打开标签栏
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(200);

// 新建 SESS_A
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', SESS_A);
const tCreateA = Date.now();
await page.click('[data-tmux-confirm="1"]');

// 测量 attach A 的聚焦视觉延迟
let attachALatency = -1;
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(20);
  const col = await chipColor(SESS_A);
  const r = await rt();
  if (r.attached === SESS_A && col && col !== 'rgba(51, 65, 85, 0.85)' && col !== 'transparent' && col !== 'rgba(0, 0, 0, 0)') {
    attachALatency = Date.now() - tCreateA;
    break;
  }
}
console.log('[attach A 聚焦视觉延迟]', attachALatency, 'ms');
await shot('01-attached-a');

// 新建 SESS_B（直接点 +，当前在 A 里，会走 detach->attach 350ms 路径）
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', SESS_B);
const tCreateB = Date.now();
await page.click('[data-tmux-confirm="1"]');

let attachBLatency = -1;
for (let i = 0; i < 80; i++) {
  await page.waitForTimeout(20);
  const colA = await chipColor(SESS_A);
  const colB = await chipColor(SESS_B);
  const r = await rt();
  if (r.attached === SESS_B && colB && colB !== 'rgba(51, 65, 85, 0.85)' && colA && colA === 'rgba(51, 65, 85, 0.85)') {
    attachBLatency = Date.now() - tCreateB;
    break;
  }
}
console.log('[attach B 聚焦视觉延迟（含 detach 等待）]', attachBLatency, 'ms');
await shot('02-attached-b');

// 点击已聚焦标签 B，触发 leaveTmux
const tDetachB = Date.now();
await page.click(`[data-tmux-id="${SESS_B}"]`);

let detachBLatency = -1;
for (let i = 0; i < 80; i++) {
  await page.waitForTimeout(20);
  const colB = await chipColor(SESS_B);
  const r = await rt();
  if (r.attached === null && colB && colB === 'rgba(51, 65, 85, 0.85)') {
    detachBLatency = Date.now() - tDetachB;
    break;
  }
}
console.log('[detach B 聚焦取消视觉延迟]', detachBLatency, 'ms');
await shot('03-detached-b');

// 再点 B attach 回来
const tReattachB = Date.now();
await page.click(`[data-tmux-id="${SESS_B}"]`);
let reattachBLatency = -1;
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(20);
  const colB = await chipColor(SESS_B);
  const r = await rt();
  if (r.attached === SESS_B && colB && colB !== 'rgba(51, 65, 85, 0.85)') {
    reattachBLatency = Date.now() - tReattachB;
    break;
  }
}
console.log('[reattach B 聚焦视觉延迟]', reattachBLatency, 'ms');
await shot('04-reattached-b');

console.log('[最终状态]', await rt());

// 清理
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line === SESS_A || line === SESS_B) tmux(['kill-session', '-t', line]);
}
await browser.close();
