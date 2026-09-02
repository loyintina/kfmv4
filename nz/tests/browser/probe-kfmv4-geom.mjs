import { chromium } from 'playwright';

// probe-kfmv4-geom — kfm-v4 活页面只读诊断（输入栏劈开页面症）
// 纪律：不导航不 reload 不点击；evaluate+截图均只读。
const browser = await chromium.connectOverCDP('http://localhost:8030');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('_tApk')) ?? ctx.pages()[0];
console.log('[target]', page.url());

const geo = await page.evaluate(() => {
  const out = { url: location.href, title: document.title, innerW: innerWidth, innerH: innerHeight, dpr: devicePixelRatio };
  const vv = window.visualViewport;
  if (vv) out.vv = { h: Math.round(vv.height), offsetTop: Math.round(vv.offsetTop), scale: vv.scale };
  // 输入栏：placeholder 含「输入」的输入件，兜底找「输入消息」文本
  let bar = [...document.querySelectorAll('input,textarea')].find((el) => (el.placeholder ?? '').includes('输入'));
  if (!bar) bar = [...document.querySelectorAll('*')].find((d) => d.childElementCount === 0 && d.textContent.trim() === '输入消息...');
  if (bar) {
    const r = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    out.bar = {
      tag: bar.tagName, ph: bar.placeholder ?? null,
      rect: { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), l: Math.round(r.left), r: Math.round(r.right) },
      pos: cs.position, cssTop: cs.top, cssBottom: cs.bottom, zIndex: cs.zIndex,
    };
    const chain = [];
    let p = bar;
    for (let i = 0; i < 3 && p; i++) { p = p.offsetParent; if (!p) break; const pr = p.getBoundingClientRect(); chain.push({ tag: p.tagName, cls: String(p.className).slice(0, 50), t: Math.round(pr.top), b: Math.round(pr.bottom) }); }
    out.offsetChain = chain;
  } else out.bar = 'NOT FOUND';
  // 全 fixed 元素清单（布局层系一眼看穿）
  out.fixed = [...document.querySelectorAll('body *')]
    .filter((e) => getComputedStyle(e).position === 'fixed')
    .slice(0, 14)
    .map((e) => { const r = e.getBoundingClientRect(); return { tag: e.tagName, cls: String(e.className).slice(0, 44), t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), z: getComputedStyle(e).zIndex }; });
  // 主滚动容器猜测：body 直接子层大块
  out.bodyH = document.body.scrollHeight;
  return out;
});
console.log(JSON.stringify(geo, null, 1));

await page.screenshot({ path: '/tmp/kfmv4-live-shot.png' }).then(
  () => console.log('[shot] /tmp/kfmv4-live-shot.png OK'),
  (e) => console.log('[shot FAIL]', String(e).slice(0, 120)),
);
await browser.close();
