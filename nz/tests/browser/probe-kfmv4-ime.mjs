import { chromium } from 'playwright';

// probe-kfmv4-ime — 键盘适配免手验证：tap 输入框→IME 弹→读 vv/bar 几何→收起
// 判据：IME 弹起后 vv.height 显著缩小（≈innerH-键盘高），bar.bottom≈vv 底。
const browser = await chromium.connectOverCDP('http://localhost:8030');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('_tApk')) ?? ctx.pages()[0];
console.log('[target]', page.url());

const readGeo = () => page.evaluate(() => {
  const vv = window.visualViewport;
  const bar = document.querySelector('.ai-input-bar');
  const ta = document.querySelector('.ai-input-bar textarea, .ai-input-bar input');
  const r = bar ? bar.getBoundingClientRect() : null;
  return {
    vvH: vv ? Math.round(vv.height) : null, vvTop: vv ? Math.round(vv.offsetTop) : null,
    innerH, kbVisible: !!(vv && innerHeight - vv.height > 80),
    barT: r ? Math.round(r.top) : null, barB: r ? Math.round(r.bottom) : null,
    taFocused: ta ? document.activeElement === ta : null,
  };
});

console.log('[baseline]', JSON.stringify(await readGeo()));

// tap 输入框中心（css→物理像素×dpr，走 NzNative 真触摸）
const tapBar = await page.evaluate(() => {
  const ta = document.querySelector('.ai-input-bar textarea, .ai-input-bar input');
  const bar = document.querySelector('.ai-input-bar');
  if (!ta || !bar) return 'no-bar';
  const r = bar.getBoundingClientRect();
  const x = (r.left + r.width / 2) * devicePixelRatio;
  const y = (r.top + r.height / 2) * devicePixelRatio;
  window.NzNative?.tap(x, y);
  return { tapped: [Math.round(x), Math.round(y)] };
});
console.log('[tap]', JSON.stringify(tapBar));
await page.waitForTimeout(1200); // IME 弹起动画
console.log('[ime-open]', JSON.stringify(await readGeo()));

// 收键盘
await page.evaluate(() => window.NzNative?.ime(false));
await page.waitForTimeout(800);
console.log('[ime-closed]', JSON.stringify(await readGeo()));
await browser.close();
