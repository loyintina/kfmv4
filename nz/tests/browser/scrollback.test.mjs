/**
 * tests/browser/scrollback.test.mjs — 8.8.3c scrollback 历史上滑 A 档标准（考题先行，RED→9.0 实现→绿）
 *
 * 判 4 条 A 档行为（跟底判定两态 / 输入回底 / 历史渲染 / 截断）。依赖 9.0 提供钩子契约：
 *   window.__kfmNzTermScroll() → { scrollTop, scrollHeight, clientHeight, isAtBottom }
 *   （isAtBottom = 视口是否在底；容器 overflow:auto 后可滚，scrollTop 衡量）。
 *   gridText = 终端可见文本（上滑后应显示历史行）。
 * 跑法：起 8023 dev + node tests/browser/scrollback.test.mjs（playwright + chromium）。
 */
import { chromium } from 'playwright';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok?'✅':'❌'} ${name}${detail?' — '+detail:''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil:'networkidle', timeout:25000 }).catch(()=>{});
await page.waitForSelector('.nz-term', { timeout:15000 }).catch(()=>{});
await page.waitForTimeout(3000);

const scroll = () => page.evaluate(() => window.__kfmNzTermScroll?.() ?? null);
const grid = () => page.evaluate(() => (document.querySelector('.nz-term')?.textContent||'').replace(/\u00a0/g,' '));
const kbFocus = () => page.evaluate(()=>document.querySelector('textarea.kfm-term-kb')?.focus());
const type = (t) => page.evaluate((x)=>{const k=document.querySelector('textarea.kfm-term-kb');k.value=x,k.dispatchEvent(new InputEvent('input',{bubbles:true,data:x,isComposing:false}));}, t);

// 灌 100 行（>屏幕行数），制造历史
await kbFocus();
await type('seq 1 100\r');
await page.waitForTimeout(1200);

// —— 断言 1：历史渲染 + 翻页（滚动容器 scrollTop 可动 / 上滑可见历史行）——
const s0 = await scroll();
const canScroll = s0 && s0.scrollHeight > s0.clientHeight + 5;
check('①历史渲染+翻页（scrollHeight>clientHeight，可滚）', !!canScroll, s0 ? `sh=${s0.scrollHeight} ch=${s0.clientHeight}` : '无 scroll 钩子');

// 上滑（滚到 1/3 处）后 grid 应显示"seq 输出的较早行"
if (canScroll) {
  await page.evaluate(() => { const c=window.__kfmNzTermScroll?.getContainer?.(); if(c) c.scrollTop = Math.floor((c.scrollHeight-c.clientHeight)/3); });
  await page.waitForTimeout(400);
  const g = await grid();
  const hasOldRow = /^[ \t]*5[0-9]\s*$/m.test(g); // 早期行(如 50)应在上滑后可见
  check('①上滑后可见历史行(早期 seq 行)', hasOldRow, hasOldRow ? '可见早期行' : 'grid' + g.slice(0,60).replace(/\n/g,' | '));
} else { check('①上滑后可见历史行', false, '容器不可滚/无钩子'); }

// —— 断言 2：跟底判定两态 ——
if (canScroll) {
  // (a) 在底 + 新输出 → 保持底
  await page.evaluate(() => { const c=window.__kfmNzTermScroll?.getContainer?.(); if(c) c.scrollTop = c.scrollHeight; });
  await page.waitForTimeout(300);
  const beforeA = await scroll();
  await type('echo BOTTOM_KEEP\r');   // 新输出
  await page.waitForTimeout(600);
  const afterA = await scroll();
  check('②a 在底+新输出→跟随底', afterA?.isAtBottom === true, `isAtBottom ${beforeA?.isAtBottom}→${afterA?.isAtBottom}`);

  // (b) 上滑 + 新输出 → 不拽回
  await page.evaluate(() => { const c=window.__kfmNzTermScroll?.getContainer?.(); if(c) c.scrollTop = Math.floor((c.scrollHeight-c.clientHeight)/3); });
  await page.waitForTimeout(300);
  const beforeB = await scroll();
  await type('echo NO_YANK\r');      // 新输出（scrolled up 不拽回）
  await page.waitForTimeout(600);
  const afterB = await scroll();
  const stayedUp = afterB && beforeB && (afterB.scrollTop < afterB.scrollHeight - afterB.clientHeight - 5);
  check('②b 上滑+新输出→不被拽回', stayedUp === true, `scrollTop ${beforeB?.scrollTop}→${afterB?.scrollTop} / max ${afterB? (afterB.scrollHeight-afterB.clientHeight):'?'}`);
} else { check('②a 跟底', false, '不可滚'); check('②b 不拽回', false, '不可滚'); }

// —— 断言 3：输入回底 ——
if (canScroll) {
  await page.evaluate(() => { const c=window.__kfmNzTermScroll?.getContainer?.(); if(c) c.scrollTop = Math.floor((c.scrollHeight-c.clientHeight)/3); });
  await page.waitForTimeout(300);
  const before3 = await scroll();
  await type('echo BACK_BOTTOM\r'); // 打字 → 应回底
  await page.waitForTimeout(600);
  const after3 = await scroll();
  check('③打字→输入即回底', after3?.isAtBottom === true, `isAtBottom ${before3?.isAtBottom}→${after3?.isAtBottom}`);
} else { check('③输入回底', false, '不可滚'); }

await browser.close();
const allOk = results.every(r=>r.ok);
console.log(`\n=== scrollback A 档：${results.filter(r=>r.ok).length}/${results.length} 通过（RED=8.8.3c 未实现）===`);
process.exit(allOk ? 0 : 1);
