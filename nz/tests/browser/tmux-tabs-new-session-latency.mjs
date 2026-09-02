/**
 * tests/browser/tmux-tabs-new-session-latency.mjs
 * 测量「点击 + 新建会话并自动 attach」的延迟来源。
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_NEW_SESS_DIR || '/tmp/nz-tmux-tabs-new-session';
const PREFIX = 'new-' + Date.now();
const SESS = `${PREFIX}-a`;

const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };
for (const line of String(execFileSync('tmux', ['ls', '-F', '#{session_name}'], { timeout: 4000 })).split('\n').filter(Boolean)) {
  if (line.startsWith('new-')) tmux(['kill-session', '-t', line]);
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

// 展开标签栏
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(200);

// 点击 +，输入名字，确认
await page.click('[data-tmux-plus="1"]');
await page.waitForTimeout(100);
await page.fill('[data-tmux-new-name]', SESS);
const tConfirm = Date.now();
await page.click('[data-tmux-confirm="1"]');

let attachedMs = -1;
let screenMs = -1;
for (let i = 0; i < 100; i++) {
  await page.waitForTimeout(20);
  const now = Date.now();
  const r = await rt();
  if (attachedMs < 0 && r.attached === SESS) attachedMs = now - tConfirm;
  if (screenMs < 0 && r.attached === SESS && hasTmuxStatus(await screen())) {
    screenMs = now - tConfirm;
    break;
  }
}
console.log('[新建会话 attach 本地翻转延迟]', attachedMs, 'ms');
console.log('[新建会话屏幕状态行出现延迟]', screenMs, 'ms');

await page.screenshot({ path: join(OUT_DIR, 'final.png') });

if (tmux(['has-session', '-t', SESS])) tmux(['kill-session', '-t', SESS]);
await browser.close();
