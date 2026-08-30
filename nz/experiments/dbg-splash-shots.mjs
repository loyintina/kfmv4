import { chromium } from 'playwright';
const SHOTS = '/root/kfmv4/docs/active/nine-zero/assets/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const find = (b) => b.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('8023'));
const browser = await chromium.connectOverCDP('http://127.0.0.1:8026');
let page = find(browser);
await page.goto('http://127.0.0.1:8023/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
await sleep(450);
await page.screenshot({ path: SHOTS + 'splash-boot-mid.png' }).catch((e) => console.log('mid shot fail', e.message));
await sleep(4500);
page = find(browser) || page; // 热更重载后 target 可能重建，重枚举
const st = await page.evaluate(() => {
  const el = document.getElementById('nz-splash');
  return { cls: el ? el.className : null, term: !!document.querySelector('.nz-term') };
}).catch((e) => ({ err: e.message }));
await page.screenshot({ path: SHOTS + 'splash-boot-terminal.png' }).catch((e) => console.log('after shot fail', e.message));
console.log(JSON.stringify(st));
await browser.close();
