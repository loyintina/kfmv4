/**
 * tests/browser/tmux-tabs-switch-latency.mjs
 * 观测切换会话标签的延迟来源：
 *  1. 点击到本地 attachedSession 翻转（UI 聚焦切换）
 *  2. 本地 attachedSession 翻转到屏幕出现 tmux 状态行（终端内容切换）
 *  3. 总延迟
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_SWITCH_LATENCY_DIR || '/tmp/nz-tmux-tabs-switch-latency';
const PREFIX = 'switch-' + Date.now();
const SESS_A = `${PREFIX}-a`;
const SESS_B = `${PREFIX}-b`;

const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line.startsWith('switch-')) tmux(['kill-session', '-t', line]);
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
  return { attached: r.attachedSession };
});
const screen = () => page.evaluate(() => window.__kfmNzTermScreen());
const hasTmuxStatus = (s) => /\[[^\]]+\]\s+\d+:\w+/.test(s);

// 展开并新建 A
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(200);
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', SESS_A);
await page.click('[data-tmux-confirm="1"]');
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(50);
  if ((await rt()).attached === SESS_A && hasTmuxStatus(await screen())) break;
}

// 新建 B，attach 到 B
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', SESS_B);
const tClickB = Date.now();
await page.click('[data-tmux-confirm="1"]');

let attachedBLatency = -1;
let screenBLatency = -1;
for (let i = 0; i < 100; i++) {
  await page.waitForTimeout(20);
  const now = Date.now();
  const r = await rt();
  if (attachedBLatency < 0 && r.attached === SESS_B) attachedBLatency = now - tClickB;
  if (screenBLatency < 0 && r.attached === SESS_B && hasTmuxStatus(await screen())) {
    screenBLatency = now - tClickB;
    break;
  }
}
console.log('[B 本地 attached 翻转延迟]', attachedBLatency, 'ms');
console.log('[B 屏幕出现 tmux 状态行延迟]', screenBLatency, 'ms');

// 切换回 A
await page.click(`[data-tmux-id="${SESS_A}"]`);
const tClickA = Date.now();
let attachedALatency = -1;
let screenALatency = -1;
for (let i = 0; i < 100; i++) {
  await page.waitForTimeout(20);
  const now = Date.now();
  const r = await rt();
  if (attachedALatency < 0 && r.attached === SESS_A) attachedALatency = now - tClickA;
  if (screenALatency < 0 && r.attached === SESS_A && hasTmuxStatus(await screen())) {
    screenALatency = now - tClickA;
    break;
  }
}
console.log('[A 本地 attached 翻转延迟]', attachedALatency, 'ms');
console.log('[A 屏幕出现 tmux 状态行延迟]', screenALatency, 'ms');

// 截图
await page.screenshot({ path: join(OUT_DIR, 'final.png') });

// 清理
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line === SESS_A || line === SESS_B) tmux(['kill-session', '-t', line]);
}
await browser.close();
