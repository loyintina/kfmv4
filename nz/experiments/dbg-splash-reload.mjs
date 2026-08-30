import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('8023'));
await page.goto('http://127.0.0.1:8023/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
for (let i = 0; i < 80; i++) { // 500ms × 80 = 40s
  const s = await page.evaluate(() => {
    const el = document.getElementById('nz-splash');
    return {
      t: Math.round(performance.now()),
      on: el ? el.classList.contains('on') : null,
      out: el ? el.classList.contains('out') : null,
      ff: (window.__kfmNzTermBootMarks || {})['first-frame'] || null,
      core: window.NzSplashCore ? window.NzSplashCore.VERSION : null,
    };
  }).catch(() => null);
  if (s) console.log(`${(i * 0.5).toFixed(1)}s pageT=${s.t} on=${s.on} out=${s.out} ff=${s.ff} core=${s.core}`);
  await sleep(500);
}
await browser.close();
