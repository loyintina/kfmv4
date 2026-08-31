/**
 * tests/browser/cjk-inktop.test.mjs — CJK 墨迹顶对齐 A 档标准
 * （2026-08-26 ranger-cjk-baseline-fix-review：真机 ranger 中文行「上移
 * 几 px」= CJK 字形 ink 顶比 Latin 高 1-2px（同基线下的字形几何差，
 * 非行盒/非字体选择——spanH=16.25/shift=0 已证行盒无恙，换 FusionPixel
 * 同症）；修法=宽字 span position:relative;top=cjkDrop 整盒下移，drop
 * 量=canvas 同栈 actualBoundingBoxAscent 双侧差）
 *
 * 钉：终端渲染「A中A」后——
 *   ①补偿真落到 DOM：中 span 的 top > 0（无补偿旧实现=0=必红）
 *   ②补偿量正确：|(ascC−ascA)−top| ≤ 1px（ink 顶差压进 1px 阈值）
 *   ③中文仍 2 cell 宽：span 宽 ≈ 2×cellW（对齐不许牺牲字宽）
 * 诚实边界：钉的是「补偿量 vs 浏览器字体内度量」自洽；墨迹真值终审=
 * 真机 ranger 中文行观感（headless 光栅化≠手机）。
 *
 * 跑法：起 8023 dev + node tests/browser/cjk-inktop.test.mjs（playwright + chromium）。
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

const type = (t) => page.evaluate((x)=>{const k=document.querySelector('textarea.kfm-term-kb');k.value=x,k.dispatchEvent(new InputEvent('input',{bubbles:true,data:x,isComposing:false}));}, t);

await type('echo A中A\r');
await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const term = document.querySelector('.nz-term');
  // 宽字 span = 壳 appendTextCells 产物（inline-block + 单宽字）
  const spans = [...document.querySelectorAll('.nz-term span')]
    .filter(s => s.textContent === '中' && s.style.display === 'inline-block');
  const sp = spans[spans.length - 1] ?? null; // 最后一处=刚 echo 的
  if (!term || !sp) return { found: false };
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = getComputedStyle(term).font;
  const ascA = cv.measureText('A').actualBoundingBoxAscent;
  const ascC = cv.measureText('中').actualBoundingBoxAscent;
  const w0 = cv.measureText('0').width;
  return {
    found: true,
    top: parseFloat(sp.style.top || '0'),
    ascA: +ascA.toFixed(2), ascC: +ascC.toFixed(2),
    spanW: +sp.getBoundingClientRect().width.toFixed(2),
    cellW: +w0.toFixed(2),
  };
});

check('找到宽字 span（echo A中A 落格）', r.found === true, r.found ? '' : '无 inline-block 中 span');
if (r.found) {
  check('①补偿落到 DOM（top>0）', r.top > 0, `top=${r.top}`);
  const eff = (r.ascC - r.ascA) - r.top;
  check('②ink 顶差压进 ≤1px（|ascC−ascA−top|）', Math.abs(eff) <= 1,
        `ascC=${r.ascC} ascA=${r.ascA} top=${r.top} → 残余=${eff.toFixed(2)}px`);
  check('③中文仍 2 cell 宽（spanW≈2×cellW）', Math.abs(r.spanW - 2 * r.cellW) <= 1,
        `spanW=${r.spanW} 2×cellW=${(2 * r.cellW).toFixed(2)}`);
}

await browser.close();
const allOk = results.every(r=>r.ok);
console.log(`\n=== cjk-inktop A 档：${results.filter(r=>r.ok).length}/${results.length} 通过（CJK 墨迹顶对齐）===`);
process.exit(allOk ? 0 : 1);
