// 生成壳层静态徽标帧（8.8.6 windowBackground/根布局背景）：
// headless 开 splash-demo ?t=4000 冻结帧（扫描完成后定帧态：徽标完整、
// 光束灭、亮度=活跃动画中值），按设备纵横比截图。
import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 540, height: 1142 } }); // 384:812 同比
await page.goto('http://127.0.0.1:8023/splash-demo.html?t=4000', { waitUntil: 'networkidle', timeout: 25000 });
await sleep(600);
await page.screenshot({ path: '/root/kfmv4/nz/lab/device-agent/android/res/drawable/splash_img.png' });
await page.screenshot({ path: '/root/kfmv4/nz/lab/device-agent/android/assets/splash/splash_img.png' });
await browser.close();
console.log('OK');
