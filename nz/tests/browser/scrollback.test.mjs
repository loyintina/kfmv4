/**
 * tests/browser/scrollback.test.mjs — 8.8.3c scrollback 历史上滑 A 档标准（修卷 v2）
 * 修两处考卷 artifact（9.0 判，评审复核确认）：
 *  ①b 原用 /^...$/m 锚在 textContent（行间无换行）→ 改读"顶栏可见行"文本；
 *  ②b 原用"打字"生成新输出 → 打字=输入回底(纪律)，必回 max → 改后台延时命令生成
 *     "非输入输出"，测"上滑+非输入输出→不拽回"。
 * 钩子契约：window.__kfmNzTermScroll() → {scrollTop, scrollHeight, clientHeight, isAtBottom}
 *            .getContainer() → 可滚动容器(overflow:auto)
 */
import { launchBrowser } from './launch.mjs';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok?'✅':'❌'} ${name}${detail?' — '+detail:''}`); };

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil:'networkidle', timeout:25000 }).catch(()=>{});
await page.waitForSelector('.nz-term', { timeout:15000 }).catch(()=>{});
await page.waitForTimeout(3000);

const scroll = () => page.evaluate(() => window.__kfmNzTermScroll?.() ?? null);
const kbFocus = () => page.evaluate(()=>document.querySelector('textarea.kfm-term-kb')?.focus());
const type = (t) => page.evaluate((x)=>{const k=document.querySelector('textarea.kfm-term-kb');k.value=x,k.dispatchEvent(new InputEvent('input',{bubbles:true,data:x,isComposing:false}));}, t);

// 灌 100 行（>屏幕行数）
await kbFocus();
await type('seq 1 100\r');
await page.waitForTimeout(1200);

// ① 历史渲染+翻页（可滚 + 上滑可见早期行）
const s0 = await scroll();
const canScroll = s0 && s0.scrollHeight > s0.clientHeight + 5;
check('①历史渲染+翻页（scrollHeight>clientHeight 可滚）', !!canScroll, s0 ? `sh=${s0.scrollHeight} ch=${s0.clientHeight}` : '无 scroll 钩子');

// *修①b*：滚到顶(scrollTop=0)，读"顶栏可见行"，应显示最早内容（seq 命令行）
if (canScroll) {
  await page.evaluate(() => { const c=window.__kfmNzTermScroll().getContainer(); if(c) c.scrollTop = 0; });
  await page.waitForTimeout(400);
  const topVisible = await page.evaluate(() => {
    const c = window.__kfmNzTermScroll().getContainer();
    const cr = c.getBoundingClientRect();
    const rows=[...document.querySelectorAll('.nz-term > div')].filter(r=>r.textContent.trim()!=='');
    let vis = rows.filter(r=>r.getBoundingClientRect().top >= cr.top - 2);
    if (!vis.length) return null;
    vis.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
    return vis[0].textContent.trim();
  });
  const isEarliest = topVisible && (topVisible.includes('seq') || /^1\s*$/.test(topVisible));
  check('①b 滚到顶可见最早内容（seq 命令行）', isEarliest === true, `topVisible="${topVisible}"`);
} else { check('①b 上滑可见早期历史行', false, '不可滚'); }

// ②a 在底+新输出→保持底
if (canScroll) {
  await page.evaluate(() => { const c=window.__kfmNzTermScroll().getContainer(); if(c) c.scrollTop = c.scrollHeight; });
  await page.waitForTimeout(300);
  await type('echo BOTTOM_KEEP\r');
  await page.waitForTimeout(600);
  const afterA = await scroll();
  check('②a 在底+新输出→跟随底', afterA?.isAtBottom === true, `isAtBottom=${afterA?.isAtBottom}`);
} else { check('②a 跟底', false, '不可滚'); }

// *修②b*：上滑后"非输入输出"（后台延时命令输出）→ 不拽回
if (canScroll) {
  // 先起后台延时命令（此刻打字=已回底），再上滑，等其输出（非输入）到达
  await kbFocus();
  await type('sh -c "sleep 3; seq 200 250"\r');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const c=window.__kfmNzTermScroll().getContainer(); if(c) c.scrollTop = Math.floor((c.scrollHeight-c.clientHeight)/3); });
  await page.waitForTimeout(300);
  const beforeB = await scroll();
  await page.waitForTimeout(4500);   // 等后台输出(seq 200 250)到达——非输入
  const afterB = await scroll();
  const stayedUp = afterB && beforeB && (afterB.scrollTop < afterB.scrollHeight - afterB.clientHeight - 5);
  check('②b 上滑+非输入输出→不被拽回', stayedUp === true, `scrollTop ${beforeB?.scrollTop}→${afterB?.scrollTop} / max ${afterB?(afterB.scrollHeight-afterB.clientHeight):'?'} isAtBottom=${afterB?.isAtBottom}`);
} else { check('②b 不拽回', false, '不可滚'); }

// ③ 打字→输入回底
if (canScroll) {
  await page.evaluate(() => { const c=window.__kfmNzTermScroll().getContainer(); if(c) c.scrollTop = Math.floor((c.scrollHeight-c.clientHeight)/3); });
  await page.waitForTimeout(300);
  const before3 = await scroll();
  await type('echo BACK_BOTTOM\r');
  await page.waitForTimeout(600);
  const after3 = await scroll();
  check('③打字→输入回底', after3?.isAtBottom === true, `isAtBottom ${before3?.isAtBottom}→${after3?.isAtBottom}`);
} else { check('③输入回底', false, '不可滚'); }

await browser.close();
const allOk = results.every(r=>r.ok);
console.log(`\n=== scrollback A 档：${results.filter(r=>r.ok).length}/${results.length} 通过 ===`);
process.exit(allOk ? 0 : 1);
