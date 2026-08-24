/**
 * tests/browser/fixed-input-row.test.mjs — 终端「固定底部输入行」模式 A 档标准（考题先行，RED→9.0 实现→绿）
 *
 * 模式（用户拍板 2026-08-24）：终端拆两区——滚动区（历史/输出，可上滑）+ 固定输入行（命令行，
 * 始终钉在底部，光标在其上，键盘弹起整行同步上移）。根治"输入内容命令行消失"。
 *
 * 钩子契约（9.0 必须暴露）：
 *   window.__kfmNzTermInputRow() → { top, bottom, height, isAtBottom }
 *     （固定输入行的 rect；isAtBottom=输入行是否在视口底=光标行）
 *   window.__kfmNzTermScroll() → 滚动区（复用 scrollback 契约：scrollTop/scrollHeight/isAtBottom）
 *
 * 跑法：起 8023 dev + node tests/browser/fixed-input-row.test.mjs（playwright + chromium）。
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

const inputRow = () => page.evaluate(() => window.__kfmNzTermInputRow?.() ?? null);
const kbFocus = () => page.evaluate(()=>document.querySelector('textarea.kfm-term-kb')?.focus());
const type = (t) => page.evaluate((x)=>{const k=document.querySelector('textarea.kfm-term-kb');k.value=x,k.dispatchEvent(new InputEvent('input',{bubbles:true,data:x,isComposing:false}));}, t);

await kbFocus();
const row0 = await inputRow();
const there = row0 && row0.bottom > 0;
check('钩子存在（输入行可读）', !!row0, row0 ? `bottom=${row0.bottom}` : '无 __kfmNzTermInputRow');

// ① 输入行始终在底/可见（核心）：灌输出+打字后仍在"终端显示区底部"（语义锚 isAtBottom，不锚像素——
//    输入行垫在按键栏上方，其 bottom = innerHeight − 按键栏高，非视口底；用语义 + 底部区域判）
if (there) {
  const vhBefore = await page.evaluate(()=>window.innerHeight);
  await type('seq 1 80\r');
  await page.waitForTimeout(1000);
  await type('echo hello');
  await page.waitForTimeout(600);
  const row1 = await inputRow();
  const atBottom = row1 && row1.isAtBottom === true
    && (row1.bottom > vhBefore - 200) && (row1.bottom < vhBefore + 20); // 底部区域（垫在按键栏上方，非视口像素底）
  check('①输入行始终在底/可见（语义 isAtBottom + 底部区域）', atBottom === true, `bottom=${row1?.bottom} vh=${vhBefore} isAtBottom=${row1?.isAtBottom}`);
} else { check('①输入行始终在底', false, '无钩子'); }

// ② 输出进滚动区、输入行不动：再灌大量输出，输入行 bottom 不变
if (there) {
  const before = await inputRow();
  await type('seq 81 200\r');
  await page.waitForTimeout(1200);
  const after = await inputRow();
  check('②输出只进滚动区、输入行不动（bottom 不变）', before && after && Math.abs(after.bottom - before.bottom) < 5,
        `before=${before?.bottom} after=${after?.bottom}`);
} else { check('②输出不动输入行', false, '无钩子'); }

// ③ 滚动区可翻历史 + 跟底（复用 scrollback 契约）
const sc = () => page.evaluate(() => window.__kfmNzTermScroll?.() ?? null);
const s = await sc();
check('③滚动区可滚（上滑看历史）', !!s && s.scrollHeight > s.clientHeight + 5,
      s ? `sh=${s.scrollHeight} ch=${s.clientHeight}` : '无 scroll 钩子');

// ④ 键盘/IME 同步：模拟 vv 高度变小（键盘占位），输入行 bottom 应上移（更小）
if (there) {
  const rowBefore = await inputRow();
  // 用 vv.height 覆盖模拟键盘占位（像 keybar 上浮那样）
  await page.evaluate(()=>{ try { Object.defineProperty(window.visualViewport,'height',{get:()=>400,configurable:true}); } catch(e){} window.visualViewport?.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(500);
  const rowAfter = await inputRow();
  const movedUp = rowAfter && rowBefore && (rowAfter.bottom < rowBefore.bottom);
  check('④键盘占位→输入行同步上移（bottom 变小）', movedUp === true, `before=${rowBefore?.bottom} after=${rowAfter?.bottom}`);
} else { check('④键盘同步上移', false, '无钩子'); }

await browser.close();
const allOk = results.every(r=>r.ok);
console.log(`\n=== fixed-input-row A 档：${results.filter(r=>r.ok).length}/${results.length} 通过（RED=9.0 未实现两区模式）===`);
process.exit(allOk ? 0 : 1);
