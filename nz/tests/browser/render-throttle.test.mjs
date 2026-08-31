/**
 * tests/browser/render-throttle.test.mjs — 洪峰节流渲染 A 档
 * （2026-08-30 用户拍板「贴尾部」：attach 洪峰定罪 300KB/1.2s 到齐、
 * 135 消息=135 全屏渲染，中间帧白画还拖慢收敛）
 * 判据：
 *  ①洪峰期渲染帧数远小于等量逐消息渲染（seq 1 5000≈24KB 洪峰，
 *    帧数 delta < 30——旧实现逐消息必然更多且实测 ~50+，节流后 ~10）
 *  ②终态正确：屏幕尾部可见 5000（跳帧不丢终态，核照全喂）
 *  ③打字回显平常档不被拖慢：注入短输出 600ms 内必上屏
 * 钩子：__kfmNzTermScroll().frames（渲染帧计数）
 */
import { launchBrowser } from './launch.mjs';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok?'✅':'❌'} ${name}${detail?' — '+detail:''}`); };

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);
const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject(x), t);
const frames = () => page.evaluate(() => window.__kfmNzTermScroll().frames);
const screen = () => page.evaluate(() => window.__kfmNzTermScreen());

// ①② 洪峰：seq 1 5000 ≈ 24KB（>16KB 阈值），测帧数+终态
const f0 = await frames();
await inject('seq 1 5000\r');
await page.waitForTimeout(2500); // 洪峰流过+尾帧
const f1 = await frames();
const scr = await screen();
check('①洪峰渲染帧数节流（<30，旧逐消息档 ~50+）', f1 - f0 < 30, `frames delta=${f1 - f0}`);
check('②洪峰终态正确（屏幕尾部见 5000）', scr.includes('5000'), `尾部=${JSON.stringify(scr.split('\n').filter(l=>l.trim()).slice(-2).map(l=>l.trim().slice(0,20)))}`);

// ③ 平常档：短输出快上屏
await inject('echo THROTTLE_MARK\r');
await page.waitForTimeout(600);
const scr2 = await screen();
check('③平常档短输出 600ms 内上屏', scr2.includes('THROTTLE_MARK'), '');

await browser.close();
const allOk = results.every(r => r.ok);
console.log(`\n=== render-throttle A 档：${results.filter(r => r.ok).length}/${results.length} 通过 ===`);
process.exit(allOk ? 0 : 1);
