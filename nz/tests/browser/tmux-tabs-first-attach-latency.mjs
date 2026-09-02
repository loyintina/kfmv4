/**
 * tests/browser/tmux-tabs-first-attach-latency.mjs
 * 测量「第一次点击已存在会话标签 attach」的延迟来源：
 *  1. 点击到本地 attachedSession 翻转
 *  2. 本地翻转到屏幕出现 tmux 状态行
 *  3. 总延迟
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_FIRST_ATTACH_DIR || '/tmp/nz-tmux-tabs-first-attach';
const PREFIX = 'first-' + Date.now();
const SESS = `${PREFIX}-a`;

const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line.startsWith('first-')) tmux(['kill-session', '-t', line]);
}
// 预建一个 detached 会话
tmux(['new-session', '-d', '-s', SESS]);
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

// 展开标签栏
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(200);

// 点击已存在的 SESS（第一次 attach）
const tClick = Date.now();
await page.click(`[data-tmux-id="${SESS}"]`);

let attachedMs = -1;
let screenMs = -1;
for (let i = 0; i < 100; i++) {
  await page.waitForTimeout(20);
  const now = Date.now();
  const r = await rt();
  if (attachedMs < 0 && r.attached === SESS) attachedMs = now - tClick;
  if (screenMs < 0 && r.attached === SESS && hasTmuxStatus(await screen())) {
    screenMs = now - tClick;
    break;
  }
}
console.log('[第一次 attach 本地 attached 翻转延迟]', attachedMs, 'ms');
console.log('[第一次 attach 屏幕状态行出现延迟]', screenMs, 'ms');

await page.screenshot({ path: join(OUT_DIR, 'final.png') });

tmux(['kill-session', '-t', SESS]);
await browser.close();
