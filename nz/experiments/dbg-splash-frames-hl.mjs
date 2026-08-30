import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const DIR = '/tmp/splash-frames';
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 384, height: 854 } });
const shots = [];
const t0 = Date.now();
await page.goto('http://127.0.0.1:8023/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
for (let i = 0; i < 40; i++) { // 150ms × 40 = 6s
  const buf = await page.screenshot({ type: 'jpeg', quality: 55 }).catch(() => null);
  if (buf) { const f = `${DIR}/h${String(i).padStart(2, '0')}-${Date.now() - t0}ms.jpg`; writeFileSync(f, buf); shots.push(f); }
  await sleep(150);
}
console.log('shots:', shots.length);
await browser.close();
