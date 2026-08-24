/**
 * tests/browser/bottom-anchor.test.mjs — 终端「单区底锚定」A 档标准
 * （2026-08-24 用户拍板回退两区，评审验收契约信
 * kfmv4-9.0-single-zone-bottom-anchor-review；前身 fixed-input-row.test.mjs
 * 两区考卷随拍板作废，本卷接管 8.8.3d A 档）
 *
 * 模式：单一连续终端区（无独立固定输入行）——
 *   最底永远=最新一行；输出续在输入行下方、整体往上滚；空屏提示符/光标
 *   也在视口底行（上方留白，像内容已充满屏幕）；键盘占位整组上移沿用。
 *
 * 钩子契约（9.0 必须暴露）：
 *   window.__kfmNzTermScroll() → { scrollTop, scrollHeight, clientHeight,
 *     isAtBottom, getContainer }（scrollback 契约复用）
 *   .nz-term-cursor（壳光标 DOM，量 rect 判光标可视位）
 * 两区钩子 __kfmNzTermInputRow 已随单区回退退役（无独立输入行）。
 *
 * 跑法：起 8023 dev + node tests/browser/bottom-anchor.test.mjs（playwright + chromium）。
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

const kbFocus = () => page.evaluate(()=>document.querySelector('textarea.kfm-term-kb')?.focus());
const type = (t) => page.evaluate((x)=>{const k=document.querySelector('textarea.kfm-term-kb');k.value=x,k.dispatchEvent(new InputEvent('input',{bubbles:true,data:x,isComposing:false}));}, t);
// 量测一把抓：滚动钩子 + 光标/滚动区/壳画布 rect（DOM 不跨 evaluate，全在页内算）
const probe = () => page.evaluate(() => {
  const sc = window.__kfmNzTermScroll?.() ?? null;
  const cont = sc?.getContainer?.() ?? null;
  const cur = document.querySelector('.nz-term-cursor');
  const term = document.querySelector('.nz-term');
  const cr = cur?.getBoundingClientRect(), sr = cont?.getBoundingClientRect(), tr = term?.getBoundingClientRect();
  return {
    sc: sc ? { scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, isAtBottom: sc.isAtBottom } : null,
    cursor: cr ? { top: cr.top, bottom: cr.bottom, display: getComputedStyle(cur).display } : null,
    scroll: sr ? { top: sr.top, bottom: sr.bottom } : null,
    term: tr ? { top: tr.top, bottom: tr.bottom } : null,
  };
});

await kbFocus();
const base = await probe();
check('钩子存在（scroll 契约 + 光标 DOM 可读）', !!(base.sc && base.cursor && base.scroll),
      base.sc ? `isAtBottom=${base.sc.isAtBottom}` : '无 __kfmNzTermScroll');

// ③ 空屏提示符在底行（先测——页面初始即空屏态：只有提示符一行，灌输出后无此态）
if (base.sc && base.cursor && base.scroll && base.term) {
  const vh = base.scroll.bottom - base.scroll.top;
  const ok = base.cursor.display !== 'none'
    && Math.abs(base.cursor.bottom - base.scroll.bottom) <= 4   // 光标贴可视底
    && base.term.top > base.scroll.top + vh * 0.3;              // 上方留白（画布被底锚推下）
  check('③空屏提示符/光标在视口底行（上方留白）', ok,
        `cursor.bottom=${base.cursor.bottom} scroll.bottom=${base.scroll.bottom} term.top=${base.term.top} scroll.top=${base.scroll.top}`);
} else { check('③空屏提示符在底行', false, '量测缺失'); }

// ② 输出续在输入行下方：echo 回显行在上、输出行紧贴其下
await type('echo NZMARK42\r');
await page.waitForTimeout(900);
{
  const pair = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.nz-term div')]
      .filter(d => d.textContent.includes('NZMARK42') && d.getBoundingClientRect().height > 0)
      .map(d => ({ text: d.textContent.trim(), top: d.getBoundingClientRect().top }));
    return rows;
  });
  const ok = pair.length === 2 && pair[0].top < pair[1].top
    && pair[0].text.includes('echo'); // 上行=命令回显，下行=输出
  check('②输出续在输入行下方（回显在上、输出在下）', ok,
        pair.map(p => `${p.top.toFixed(0)}:${p.text.slice(0, 24)}`).join(' | ') || '未找到行对');
}

// ① 内容超屏后底行=最新行 + 整体上滚（跟底纪律复用 8.8.3c 状态机）
await type('seq 1 200\r');
await page.waitForTimeout(1500);
{
  const p = await probe();
  const lastVisible = await page.evaluate(() => {
    const cont = window.__kfmNzTermScroll?.().getContainer();
    const sr = cont.getBoundingClientRect();
    const rows = [...cont.querySelectorAll('.nz-term div')]
      .filter(d => d.getBoundingClientRect().height > 0 && d.textContent.trim() !== '');
    const vis = rows.filter(d => { const r = d.getBoundingClientRect(); return r.bottom > sr.top + 4 && r.top < sr.bottom - 4; });
    return vis.map(d => d.textContent.trim()).slice(-3);
  });
  const ok = p.sc && p.sc.isAtBottom === true
    && Math.abs(p.sc.scrollTop + p.sc.clientHeight - p.sc.scrollHeight) <= 5  // 跟底
    && p.sc.scrollTop > 0                                                     // 整体上滚发生
    && p.cursor && Math.abs(p.cursor.bottom - p.scroll.bottom) <= 5           // 最底=最新（提示符贴底）
    && lastVisible.some(t => t === '200' || t.includes('200'));               // 最新输出在可视尾部
  check('①超屏后最底=最新行（跟底+上滚+最新输出可见）', ok === true,
        `st=${p.sc?.scrollTop?.toFixed(0)} sh=${p.sc?.scrollHeight} tail=[${lastVisible.join(',')}] cursor.bottom=${p.cursor?.bottom?.toFixed(1)} scroll.bottom=${p.scroll?.bottom?.toFixed(1)}`);
}

// ④ 键盘占位整体上移不回退：vv 高度缩小（模拟键盘），滚动区底边上移且底锚保持
{
  const before = await probe();
  await page.evaluate(()=>{ try { Object.defineProperty(window.visualViewport,'height',{get:()=>400,configurable:true}); } catch(e){} window.visualViewport?.dispatchEvent(new Event('resize')); });
  await page.waitForTimeout(900); // 钉 vv 当拍 + 行列重测防抖 150ms 稳态
  const after = await probe();
  const ok = before.scroll && after.scroll
    && after.scroll.bottom < before.scroll.bottom - 100                       // 整体上移
    && after.cursor && after.cursor.display !== 'none'
    && Math.abs(after.cursor.bottom - after.scroll.bottom) <= 6;              // 底锚不回退（提示符仍贴新底）
  check('④键盘占位→整体上移且底锚不回退', ok === true,
        `before=${before.scroll?.bottom?.toFixed(1)} after=${after.scroll?.bottom?.toFixed(1)} cursor.bottom=${after.cursor?.bottom?.toFixed(1)}`);
}

await browser.close();
const allOk = results.every(r=>r.ok);
console.log(`\n=== bottom-anchor A 档：${results.filter(r=>r.ok).length}/${results.length} 通过（单区底锚定，8.8.3d 接管卷）===`);
process.exit(allOk ? 0 : 1);
