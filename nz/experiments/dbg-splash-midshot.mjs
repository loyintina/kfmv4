import { chromium } from 'playwright';
const SHOTS = '/root/kfmv4/docs/active/nine-zero/assets/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 384, height: 854 } });
await page.goto('http://127.0.0.1:8023/?splash', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
await sleep(2100); // 黑场 1s + 扫描中段
await page.screenshot({ path: SHOTS + 'splash-boot-mid.png' });
await browser.close();
