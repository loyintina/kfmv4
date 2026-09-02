/**
 * tests/browser/tmux-tabs-expand-latency.mjs
 * 测量点击把手展开标签栏的延迟。
 */
import { launchBrowser } from './launch.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_EXPAND_DIR || '/tmp/nz-tmux-tabs-expand';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs, null, { timeout: 30000 });

const rt = () => page.evaluate(() => {
  const r = window.__kfmNzTmuxTabs?.() ?? {};
  return { state: r.state, expanded: r.expanded };
});

// 确保收起
const r0 = await rt();
if (r0.expanded) {
  await page.click('[data-tmux-orb="1"]');
  await page.waitForTimeout(300);
}

// 直接触发 click 事件，排除 Playwright 等待稳定态的干扰
const tClick = await page.evaluate(() => {
  const h = document.querySelector('[data-tmux-tabs="HANDLE"]');
  const t = Date.now();
  if (h) h.click();
  return t;
});
let expandMs = -1;
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(20);
  const r = await rt();
  if (r.expanded) { expandMs = Date.now() - tClick; break; }
}
console.log('[把手展开延迟]', expandMs, 'ms');

await page.screenshot({ path: join(OUT_DIR, 'expanded.png') });
await browser.close();
