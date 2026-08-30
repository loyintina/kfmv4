import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
const pages = browser.contexts().flatMap((c) => c.pages()).filter((p) => p.url().includes('8023'));
for (const p of pages) {
  const geo = await p.evaluate(() => ({ iw: innerWidth, ih: innerHeight })).catch(() => null);
  console.log(p.url(), 'geo:', JSON.stringify(geo));
}
const live = pages[pages.length - 1]; // 活页=有几何的那个（2665 高）
const geo = await live.evaluate(() => ({ iw: innerWidth, ih: innerHeight }));
if (!geo.iw) { console.log('❌ 末尾也不是活页'); process.exit(1); }
await live.screenshot({ path: '/tmp/fg-live.png', timeout: 8000 }).then(() => console.log('SHOT_OK')).catch((e) => console.log('SHOT_FAIL', e.message.split('\n')[0]));
// screencast 3 秒验证逐帧通道
const session = await live.context().newCDPSession(live);
let n = 0;
session.on('Page.screencastFrame', (e) => { n++; session.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {}); });
await session.send('Page.startScreencast', { format: 'jpeg', quality: 50, everyNthFrame: 2 });
await new Promise((r) => setTimeout(r, 3000));
await session.send('Page.stopScreencast').catch(() => {});
console.log('screencast frames:', n);
await browser.close();
