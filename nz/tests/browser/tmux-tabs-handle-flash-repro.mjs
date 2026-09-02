/**
 * tests/browser/tmux-tabs-handle-flash-repro.mjs
 * 用真实鼠标事件序列反复点击把手，复现「展开→瞬间收起→又展开」闪烁。
 * 记录每次点击前后的状态历史，捕获一帧回弹。
 */
import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_FLASH_DIR || '/tmp/nz-tmux-tabs-handle-flash';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() =>
  !!window.__kfmNzTermInject && !!window.__kfmNzTmuxTabs,
  null, { timeout: 30000 },
);

const rt = () => page.evaluate(() => {
  const r = window.__kfmNzTmuxTabs?.() ?? {};
  return { state: r.state, attached: r.attachedSession, expanded: r.expanded, history: r.history };
});
const shot = async (name) => {
  const p = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
};

// 先确保在 HANDLE 态
const r0 = await rt();
if (r0.expanded) {
  await page.evaluate(() => {
    const h = document.querySelector('[data-tmux-orb="1"]');
    if (h) h.click();
  });
  await page.waitForTimeout(300);
}

// 清理历史
await page.evaluate(() => { window.__kfmNzTmuxTabsSnap?.ring.splice(0); });

const cycles = 10;
const flashes = [];

for (let i = 0; i < cycles; i++) {
  const before = await rt();
  const startState = before.state;
  const t0 = Date.now();

  // 真实点击把手（触发完整 pointerdown/click 序列）
  // 兼容 HANDLE 态和 EXPANDED 态（把手一直都在，只是 data 属性不同）
  const handle = page.locator('[data-tmux-orb="1"]').or(page.locator('[data-tmux-tabs="HANDLE"]')).first();
  await handle.click();

  // 点击后高频率采样状态（20ms * 25 = 500ms）
  const samples = [];
  for (let j = 0; j < 25; j++) {
    await page.waitForTimeout(20);
    const r = await rt();
    samples.push({ t: Date.now() - t0, state: r.state, expanded: r.expanded });
  }

  // 检测回弹：同一轮点击内出现 expanded true->false->true 或 false->true->false
  const states = samples.map((s) => s.state);
  const rebound = states.join(',').includes('EXPANDED,HANDLE,EXPANDED')
    || states.join(',').includes('HANDLE,EXPANDED,HANDLE');
  if (rebound) {
    flashes.push({ cycle: i, startState, samples });
  }
}

await shot('final');

const final = await rt();
console.log('[循环次数]', cycles);
console.log('[闪烁次数]', flashes.length);
if (flashes.length) {
  console.log('[闪烁详情]', JSON.stringify(flashes, null, 2));
}
console.log('[最终状态]', { state: final.state, expanded: final.expanded });

writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify({ cycles, flashes, final }, null, 2));
await browser.close();
