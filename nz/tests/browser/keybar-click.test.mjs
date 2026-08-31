/**
 * tests/browser/keybar-click.test.mjs — 「仿 Termux 按键栏可点击性」浏览器 E2E 标准
 * 重构版：用 tests/browser/clickability.mjs 的通用断言（可点达/点即有果/焦点保持）。
 * 8.8.3b 布局 bug（终端盖住 keybar）用这套 A 档断言钉死；9.0 修后转绿。
 */
import { launchBrowser } from './launch.mjs';
import { reachable, clickSends, focusKept, summarize } from './clickability.mjs';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(()=>{});
await page.waitForSelector('.kfm-term-keybar', { timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(3000);

const KB = { selector: '.kfm-term-keybar div' };
const results = [];
const grid = () => page.evaluate(() => (document.querySelector('.nz-term')?.textContent || ''));
const enterLoc = page.locator('.kfm-term-keybar div', { hasText: /^ENTER$/ }).first();
const ctrlLoc = page.locator('.kfm-term-keybar div', { hasText: /^CTRL$/ }).first();

// ① 可点达：每个按钮 elementFromPoint 命中自身（无重叠）。先列所有键，逐一查。
const keys = await page.evaluate(() => [...document.querySelectorAll('.kfm-term-keybar div')].map(d => d.textContent));
for (const k of keys) {
  results.push(await reachable(page, { label: `键 ${k}`, selector: KB.selector, text: k }));
}

// ② 点即有果：点 ENTER → \r 送到 → 终端内容变（放未回车文本再点 ENTER 应执行）
await page.evaluate(() => document.querySelector('textarea.kfm-term-kb')?.focus());
await page.keyboard.type('echo T', { delay: 10 });
await page.waitForTimeout(400);
results.push(await clickSends(page, {
  label: 'ENTER 发送 \\r',
  locator: enterLoc,
  snapshot: grid,
}));

// ③ 焦点保持：点 CTRL → 焦点仍在诱饵（软键盘不塌）+ 粘滞灯亮（syncMods，再单独断言）
results.push(await focusKept(page, {
  label: 'CTRL 焦点保持(诱饵)',
  locator: ctrlLoc,
  focusSel: 'textarea.kfm-term-kb',
}));
// 粘滞灯亮：点 CTRL 后 syncMods 应点亮
const bgBefore = await page.evaluate(() => { const e=[...document.querySelectorAll('.kfm-term-keybar div')].find(d=>d.textContent==='CTRL'); return e?getComputedStyle(e).backgroundColor:null; });
await ctrlLoc.click({ force: true }).catch(()=>{});
await page.waitForTimeout(150);
const bgAfter = await page.evaluate(() => { const e=[...document.querySelectorAll('.kfm-term-keybar div')].find(d=>d.textContent==='CTRL'); return e?getComputedStyle(e).backgroundColor:null; });
results.push({ name: '点CTRL 粘滞灯亮(syncMods)', ok: bgBefore !== bgAfter, detail: `${bgBefore} → ${bgAfter}` });

// ④ 点按钮不召唤 IME（2026-08-24 两痛点①，button-ime-tui-overflow-review 回归钉）：
// 未聚焦状态点 ENTER → 焦点不得被抢到 IME 诱饵（容器 click→kb.focus 冒泡已断）；
// 反向钉：点终端文本区 → 焦点应落诱饵（聚焦通路未堵死）。
await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
await page.waitForTimeout(100);
await enterLoc.click({ force: true }).catch(()=>{});
await page.waitForTimeout(200);
const notKb = await page.evaluate(() => !document.querySelector('textarea.kfm-term-kb')?.matches(':focus')
  && !(document.activeElement?.classList.contains('kfm-term-kb')));
results.push({ name: '点按钮不召唤IME(失焦点ENTER→焦点不落诱饵)', ok: notKb,
  detail: await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName || 'none') });
await page.locator('.nz-term').click({ force: true, position: { x: 100, y: 60 } }).catch(()=>{});
await page.waitForTimeout(200);
const kbGot = await page.evaluate(() => document.activeElement?.classList.contains('kfm-term-kb') === true);
results.push({ name: '点终端文本区→焦点落诱饵(聚焦通路正常)', ok: kbGot,
  detail: await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName || 'none') });

await browser.close();
const { allOk } = summarize(results);
process.exit(allOk ? 0 : 1);
