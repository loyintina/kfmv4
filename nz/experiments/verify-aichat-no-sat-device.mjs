/**
 * experiments/verify-aichat-no-sat-device.mjs — 拍板⑰ 真机验收：
 * AI 页标题栏不吃 --sat 垫（不避挖孔屏）。
 * 判据：①bundle=v=d2a1e98e（新码）；②真机 --sat 读数（挖孔屏地形，
 *   可能=0——则声明环境局限）；③开 AI 页后 [data-aichat-header] 顶=0、
 *   高≤34px（一行）；④截图存证。
 * 安全：只读几何+点 orb+截图，不碰其它客户端。
 */
import { chromium } from 'playwright';

const CDP = process.env.NZ_CDP_URL || 'http://127.0.0.1:8026';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.connectOverCDP(CDP);
let page = null;
for (const p of browser.contexts().flatMap((c) => c.pages())) {
  if (!p.url().includes('8023')) continue;
  const ok = await p.evaluate(() => typeof window.__kfmNzAiChat === 'function').catch(() => false);
  if (ok) { page = p; break; }
}
if (!page) { console.log('❌ 无前台页'); process.exit(1); }

await page.reload({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForFunction(() => typeof window.__kfmNzAiChat === 'function', { timeout: 15000 });
await sleep(2500);

const boot = await page.evaluate(() => ({
  v: document.querySelector('script[src*="bundle"]')?.getAttribute('src') ?? '',
  sat: getComputedStyle(document.documentElement).getPropertyValue('--sat').trim(),
}));
console.log('bundle:', boot.v, 'sat:', JSON.stringify(boot.sat));

// 开 AI 页（点 orb）
await page.evaluate(() => document.querySelector('[data-kfm-aichat-orb]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await page.click('[data-kfm-aichat-orb]').catch(() => {});
await page.waitForFunction(() => window.__kfmNzAiChat?.().page === 'AI_PAGE', { timeout: 8000 }).catch(() => {});
await sleep(600); // 滑入动画播完

const geo = await page.evaluate(() => {
  const pg = document.querySelector('[data-kfm-aichat]');
  const hdr = document.querySelector('[data-aichat-header]');
  if (!pg || !hdr) return null;
  return {
    pageTop: pg.getBoundingClientRect().top,
    hdrTop: hdr.getBoundingClientRect().top,
    hdrH: hdr.getBoundingClientRect().height,
    btn: !!document.querySelector('[data-aichat-config-btn]'),
  };
});
console.log('geo:', JSON.stringify(geo));
const pass = !!geo && geo.pageTop === 0 && geo.hdrTop === 0 && geo.hdrH <= 34 && geo.hdrH > 20 && geo.btn;
console.log(pass ? '✅ 拍板⑰真机验收：标题栏顶=视口顶一行高（不吃 sat）' : '❌ 真机几何不达标');
await page.screenshot({ path: new URL('../tests/assets/ai-chat-no-sat-device.png', import.meta.url).pathname });
console.log('shot: tests/assets/ai-chat-no-sat-device.png');
// 收页还原现场
await page.click('[data-kfm-aichat-orb]').catch(() => {});
await sleep(500);
await browser.close();
process.exit(pass ? 0 : 1);
