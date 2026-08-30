import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const DIR = '/tmp/splash-frames';
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('8023'));
const session = await page.context().newCDPSession(page);
const frames = [];
session.on('Page.screencastFrame', (e) => {
  frames.push({ ts: e.metadata.timestamp, data: e.data });
  session.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
});
await session.send('Page.startScreencast', { format: 'jpeg', quality: 55, everyNthFrame: 1 });
const t0 = Date.now();
await page.goto('http://127.0.0.1:8023/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
await sleep(8000);
await session.send('Page.stopScreencast').catch(() => {});
console.log('frames:', frames.length);
// 等距抽 24 帧落盘
const n = Math.min(24, frames.length);
for (let i = 0; i < n; i++) {
  const f = frames[Math.floor((i * (frames.length - 1)) / Math.max(1, n - 1))];
  writeFileSync(`${DIR}/f${String(i).padStart(2, '0')}-${Math.round(f.ts * 1000)}.jpg`, Buffer.from(f.data, 'base64'));
}
console.log('saved', n, 'to', DIR, 'span', frames.length ? Math.round(frames[frames.length-1].ts - frames[0].ts) + 's' : '');
await browser.close();
