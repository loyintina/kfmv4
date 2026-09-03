/**
 * tests/browser/keybar-baseline-capture.mjs — keybar 迁皮**前**基线捕获
 * （docs/keybar-v3-state-machine.md §六 ㉔ 视觉白名单的「迁前」半）。
 *
 * 跑一次落两件 fixture（迁皮后由 keybar-skin.test.mjs ㉔ 消费比对）：
 *   tests/assets/keybar-baseline.png  — .kfm-term-keybar 区域截图（存证用）
 *   tests/assets/keybar-baseline.json — 栏/14 键几何（x/y/w/h）+ 键序 +
 *     computed 字号/字色。背景色故意**不录**（0903 拍板透明化=白名单豁免项，
 *     录了反而把拍板项钉死）。
 *
 * 用法：node tests/browser/keybar-baseline-capture.mjs（迁皮前对旧皮跑）。
 * 比对口径说明：headless 像素级 diff 太飘（GPU 禁用+字体光栅差异），
 * ㉔ 降级为几何+computed-style 断言，png 留作人审存证——降级原因在
 * keybar-skin.test.mjs ㉔ 注释里诚实写明。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './launch.mjs';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(ASSETS, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.kfm-term-keybar', { timeout: 15000 });
await page.waitForTimeout(3000);

const data = await page.evaluate(() => {
  const bar = document.querySelector('.kfm-term-keybar');
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  const keys = [...bar.querySelectorAll(':scope > div')].map((d) => {
    const dr = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    return {
      label: d.textContent,
      x: +dr.x.toFixed(2), y: +dr.y.toFixed(2),
      w: +dr.width.toFixed(2), h: +dr.height.toFixed(2),
      fontSize: cs.fontSize, color: cs.color,
    };
  });
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    bar: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
    keys,
  };
});
if (!data || data.keys.length !== 14) {
  console.error('基线捕获失败：栏缺失或键数≠14', JSON.stringify(data && { n: data.keys.length }));
  process.exit(1);
}

const barLoc = page.locator('.kfm-term-keybar');
await barLoc.screenshot({ path: join(ASSETS, 'keybar-baseline.png') });
writeFileSync(join(ASSETS, 'keybar-baseline.json'), JSON.stringify(data, null, 2) + '\n');
await browser.close();
console.log(`基线已落盘：${data.keys.length} 键，栏 ${data.bar.w}x${data.bar.h} @(${data.bar.x},${data.bar.y})`);
