import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('8023'));
await page.goto('http://127.0.0.1:8023/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
await sleep(2500);
const r = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, Math.round(o[k] ?? -1)]));
  return {
    nav: pick(nav, ['startTime','fetchStart','domainLookupStart','connectStart','requestStart','responseStart','responseEnd','domInteractive','domContentLoadedEventEnd','loadEventEnd','domComplete']),
    paint: performance.getEntriesByType('paint').map((p) => ({ name: p.name, t: Math.round(p.startTime) })),
    resources: performance.getEntriesByType('resource').filter((e) => /index|bundle|splash-core|na-main|na-cjk|build-info/.test(e.name)).map((e) => ({ n: e.name.split('/').pop().slice(0, 24), start: Math.round(e.startTime), dur: Math.round(e.duration), size: e.transferSize })),
    marks: window.__kfmNzTermBootMarks,
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
