import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
const pages = browser.contexts().flatMap((c) => c.pages()).filter((p) => p.url().includes('8023'));
let live = null;
for (const p of pages) { const g = await p.evaluate(() => innerWidth).catch(() => 0); if (g > 0) live = p; }
if (!live) { console.log('❌ 无活页'); process.exit(1); }
const t0 = Date.now();
let n = 0;
for (let i = 0; i < 10; i++) {
  const buf = await live.screenshot({ type: 'jpeg', quality: 40, timeout: 8000 }).catch(() => null);
  if (buf) { n++; if (i === 0) writeFileSync('/tmp/burst-first.jpg', buf); }
}
const dt = Date.now() - t0;
console.log(`burst: ${n}/10 in ${dt}ms = ${(n / (dt / 1000)).toFixed(1)} fps`);
await browser.close();
