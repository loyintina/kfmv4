import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('8023'));
const r = await page.evaluate(() => {
  const el = document.getElementById('nz-splash');
  const res = performance.getEntriesByType('resource').filter((e) => e.name.includes('splash-core'));
  return {
    core: window.NzSplashCore ? window.NzSplashCore.VERSION : null,
    cls: el ? el.className : null,
    preHead: el ? el.querySelector('pre').textContent.slice(0, 60) : null,
    fetch: res.map((e) => ({ start: Math.round(e.startTime), dur: Math.round(e.duration) })),
    now: Math.round(performance.now()),
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
