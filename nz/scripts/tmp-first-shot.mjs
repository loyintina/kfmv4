// 首张真机渲染截图：playwright connectOverCDP → 8026
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] ?? await ctx.newPage();
console.log('page:', page.url(), '| title:', await page.title());
await page.screenshot({ path: '/tmp/first-device-shot.png' });
// 顺带抓视口真机数据（P1 §四 自上报）
const geo = await page.evaluate(() => ({
  screen: [screen.width, screen.height],
  dpr: devicePixelRatio,
  vv: [visualViewport.width, visualViewport.height, visualViewport.offsetTop],
  inner: [innerWidth, innerHeight],
}));
console.log('geo:', JSON.stringify(geo));
await browser.close();
