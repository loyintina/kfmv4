/**
 * tests/browser/tmux-tabs-handle-debug.mjs
 * 在 headless 中注入日志，观测点击把手时 document pointerdown 捕获阶段
 * 的行为，以及 isInsideTabs 对把手内各元素的判定。
 */
import { launchBrowser } from './launch.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_FLASH_DEBUG_DIR || '/tmp/nz-tmux-tabs-handle-debug';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() =>
  !!window.__kfmNzTermInject && !!window.__kfmNzTmuxTabs,
  null, { timeout: 30000 },
);

// 注入日志监听器
await page.evaluate(() => {
  window.__kfmHandleDebug = [];
  document.addEventListener('pointerdown', (e) => {
    const inside = !!(e.target instanceof Element && e.target.closest('[data-tmux-tabs-root]'));
    window.__kfmHandleDebug.push({
      phase: 'capture', type: e.type, target: e.target?.tagName,
      dataset: e.target instanceof HTMLElement ? e.target.dataset : null,
      inside, time: Date.now(),
    });
  }, { capture: true, passive: true });
  document.addEventListener('click', (e) => {
    const inside = !!(e.target instanceof Element && e.target.closest('[data-tmux-tabs-root]'));
    window.__kfmHandleDebug.push({
      phase: 'bubble', type: e.type, target: e.target?.tagName,
      dataset: e.target instanceof HTMLElement ? e.target.dataset : null,
      inside, time: Date.now(),
    });
  }, true);
});

const rt = () => page.evaluate(() => {
  const r = window.__kfmNzTmuxTabs?.() ?? {};
  return { state: r.state, expanded: r.expanded };
});

// 点击把手展开
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(200);
console.log('[展开后状态]', await rt());

// 点击把手收起
const handle2 = page.locator('[data-tmux-orb="1"]').or(page.locator('[data-tmux-tabs="HANDLE"]')).first();
await handle2.click();
await page.waitForTimeout(200);
console.log('[收起后状态]', await rt());

const debug = await page.evaluate(() => window.__kfmHandleDebug);
console.log('[事件日志]', JSON.stringify(debug, null, 2));

await page.screenshot({ path: join(OUT_DIR, 'final.png') });
await browser.close();
