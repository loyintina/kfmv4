import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('8023'));
const r = await page.evaluate(() => window.__kfmNz.plugtest.testOne('splash')
  .then((x) => ({ code: x.code, leaks: x.leaks, trace: x.trace })));
console.log(JSON.stringify(r, null, 1));
await browser.close();
