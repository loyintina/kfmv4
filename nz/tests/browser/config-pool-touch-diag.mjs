/**
 * config-pool-touch-diag.mjs — 右滑返回真机不响的复现/定位诊断
 * （2026-09-05 用户真机报告：左滑开池真机响、池页开着右滑关不响）
 *
 * 手段：Playwright 起 hasTouch 上下文 → CDP Session Input.dispatchTouchEvent
 * 发**浏览器级真触摸序列**（非合成 JS 事件——touch-action/pointercancel/
 * 触摸采样全走浏览器输入管线），document 捕获阶段架 pointer/touch 事件
 * 记录带（type/x/y/pointerType/target/cancelable），对比左滑开（预期响）
 * 与右滑关（用户报告不响）的事件流差异。
 *
 * 跑法：node tests/browser/config-pool-touch-diag.mjs [BASE]
 *   BASE 缺省 http://127.0.0.1:8023/（dev 实例；诊断只读池数据不写真账——
 *   只做开/关池手势，不 CRUD 不激活）
 */
import { launchBrowser } from './launch.mjs';

const BASE = process.argv[2] || process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 900, height: 620 }, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 200)));
const cdp = await context.newCDPSession(page);

await page.goto(`${BASE}?nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
{ // 维护态闸（2026-09-11 nz 结项）：AI 系插件已摘除 → 本卷整体跳过
  await new Promise((r) => setTimeout(r, 2000));
  const alive = await page.evaluate(() => typeof (window).__kfmNzAiChat === 'function' || typeof (window).__kfmNzPool === 'function').catch(() => false);
  if (!alive) {
    console.log('[skip] ai 系插件已摘除（nz 维护态）——本卷整体跳过');
    if (typeof browser !== 'undefined') await browser.close().catch(() => {});
    process.exit(0);
  }
}
await page.waitForFunction(() => !!(window).__kfmNzPool && !!(window).__kfmNzTermScroll, null, { timeout: 20000, polling: 250 });
await page.waitForTimeout(2500); // PTY 提示符稳定

// 事件记录带：pointer 系 + touch 系全量（捕获阶段，先于一切业务监听）
await page.evaluate(() => {
  const win = (window);
  win.__tapeline = [];
  const desc = (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return String(t?.tagName ?? String(t));
    const anchor = t.closest('[data-pool-row],[data-pool-zone],[data-pool-header],[data-kfm-pool],[data-kfm-aichat-bar],[data-kfm-keybar],.nz-term');
    const tag = t.getAttribute('data-pool-tab') !== null ? 'tab' : t.tagName;
    return tag + (anchor ? `<${anchor.tagName}${anchor.getAttribute('data-pool-row') ? ':' + anchor.getAttribute('data-pool-row') : ''}>` : '');
  };
  for (const ty of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    document.addEventListener(ty, (e) => {
      const t = e.touches?.[0] ?? e;
      win.__tapeline.push({
        ty, pt: e.pointerType ?? '-', x: Math.round(t.clientX ?? 0), y: Math.round(t.clientY ?? 0),
        btn: e.button ?? -1, cancelable: e.cancelable, prevented: e.defaultPrevented,
        tgt: desc(e), t: Date.now() % 100000,
      });
    }, { capture: true, passive: true });
  }
  // 分发核内部探针：preMatch 钩在 button 检查之后——它不 fire = button 闸咬掉
  try {
    (window).__kfmNz.gestures.addPreMatchHook((e) => {
      win.__tapeline.push({ ty: 'prematch', pt: e.pointerType, btn: e.button, x: Math.round(e.clientX), y: Math.round(e.clientY), tgt: 'prematch(probe)', cancelable: e.cancelable, prevented: false, t: Date.now() % 100000 });
    });
  } catch (err) { console.log('[probe-err]', String(err).slice(0, 80)); }
  // handler 关卡桩：condition/targetFilter 各关判定值逐拍落带
  try {
    const h = (window).__kfmNz.gestures._handlers[0];
    win.__hlog = [];
    const oc = h.condition, of = h.targetFilter;
    if (oc) h.condition = (...a) => { const v = oc(...a); win.__hlog.push({ gate: 'cond', v, ai: document.documentElement.hasAttribute('data-kfm-aichat-open'), alt: (() => { try { return (window).__kfmNzTermScroll?.().alt; } catch { return 'err'; } })() }); return v; };
    h.targetFilter = (...a) => { const v = of(...a); win.__hlog.push({ gate: 'tf', v, tgt: a[0]?.tagName, cls: String(a[0]?.className ?? '').slice(0, 30) }); return v; };
  } catch (err) { console.log('[hprobe-err]', String(err).slice(0, 100)); }
  win.__touchDiag = (name) => {
    const line = win.__tapeline;
    win.__tapeline = [];
    const moves = line.filter((e) => e.ty === 'pointermove');
    const downs = line.filter((e) => e.ty === 'pointerdown');
    const ups = line.filter((e) => e.ty === 'pointerup');
    const cancels = line.filter((e) => e.ty === 'pointercancel');
    const summary = {
      name,
      downs: downs.map((d) => `${d.tgt}@${d.x},${d.y}`),
      firstMove: moves[0] ? `${moves[0].x},${moves[0].y}` : null,
      lastMove: moves.at(-1) ? `${moves.at(-1).x},${moves.at(-1).y}` : null,
      moveCount: moves.length,
      ups: ups.length, cancels: cancels.length,
      cancelAt: cancels.map((c) => `${c.x},${c.y}`),
      touchEnds: line.filter((e) => e.ty === 'touchend').length,
      activeAfter: (() => { const a = (window).__kfmNz?.gestures?._active; return a ? `${a.handler.id}@start(${a.startX},${a.startY})` : null; })(),
      hlog: win.__hlog ?? [],
      handlers: (window).__kfmNz?.gestures?.handlerCount,
      bodyTouchAction: getComputedStyle(document.body).touchAction,
      poolTouchAction: (() => { const p = document.querySelector('[data-kfm-pool]'); return p ? getComputedStyle(p).touchAction : null; })(),
      zoneOverflow: (() => { const z = document.querySelector('[data-pool-zone]'); return z ? getComputedStyle(z).overflowY : null; })(),
    };
    console.log('[DIAG]', JSON.stringify(summary));
    return { summary, line };
  };
});

const poolState = () => page.evaluate(() => { const r = (window).__kfmNzPool?.(); return r ? `${r.page}/${r.pool}/${r.pageState}` : 'no-hook'; });
const stroke = async (x0, y0, x1, y1, steps = 14, hold = 0) => {
  const touch = (p) => cdp.send('Input.dispatchTouchEvent', { type: p.type, touchPoints: p.points });
  await touch({ type: 'touchStart', points: [{ x: x0, y: y0, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await touch({ type: 'touchMove', points: [{ x: Math.round(x0 + ((x1 - x0) * i) / steps), y: Math.round(y0 + ((y1 - y0) * i) / steps), id: 1 }] });
    await page.waitForTimeout(12);
  }
  if (hold) await page.waitForTimeout(hold);
  await touch({ type: 'touchEnd', points: [] });
  await page.waitForTimeout(400);
};

console.log('== 几何探针 ==');
console.log(await page.evaluate(() => {
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { sel, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) }; };
  return {
    efp412: (() => { const e = document.elementFromPoint(420, 412); return e ? e.className || e.tagName : null; })(),
    efp300: (() => { const e = document.elementFromPoint(420, 300); return e ? e.className || e.tagName : null; })(),
    term: r('.nz-term'), keybar: r('.kfm-term-keybar'), bar: r('[data-kfm-aichat-bar]'),
    composerH: getComputedStyle(document.documentElement).getPropertyValue('--kfm-aichat-composer-h'),
    vh: window.innerHeight, vv: window.visualViewport?.height,
  };
}));

// headless 退化布局（.nz-term 仅 16px 高→touch adjustment 改判 keybar）使
// touch 左滑在 headless 不可复现真机行为；开池动作以 mouse 走（B 卷同款，
// 等价真机「池页已开」前提），病灶复现聚焦 Case B 池页右滑。
console.log('== 开池（mouse 拖动，B 卷同款） ==');
{
  const c = await page.evaluate(() => { const e = document.querySelector('.nz-term').getBoundingClientRect(); return { x: Math.min(e.x + e.width / 2, 420), y: Math.max(8, Math.min(e.y + e.height / 2, 400)) }; });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(c.x - (180 * i) / 14, c.y); await page.waitForTimeout(8); }
  await page.mouse.up();
  await page.waitForTimeout(400);
  console.log('pool after mouse-left:', await poolState());
}

console.log('== Case B: 池开着，池页列表右滑（用户报告：真机不响） ==');
let diagB = null;
if ((await poolState()).startsWith('POOL_OPEN')) {
  const cB = await page.evaluate(() => { const e = document.querySelector('[data-kfm-pool]').getBoundingClientRect(); return { x: e.x + Math.min(e.width / 2, 420), y: e.y + Math.min(e.height / 2, 300) }; });
  await stroke(cB.x, cB.y, cB.x + 180, cB.y);
  diagB = await page.evaluate(() => (window).__touchDiag('B: pool-open right-swipe'));
  console.log('after:', await poolState());
  console.log('[SUMMARY-B]', JSON.stringify(diagB.summary));
  await page.screenshot({ path: 'tests/assets/config-pool-diag-b-right-before-fix.png' }).catch(() => {});
}



for (const e of diagA.line) console.log(` ${e.ty.padEnd(13)} ${e.pt.padEnd(7)} ${String(e.x).padStart(4)},${String(e.y).padStart(4)} tgt=${e.tgt.slice(0, 60)} cancelable=${e.cancelable ? 1 : 0}`);
if (diagB) {
  console.log('\n== 事件带 B（右滑关） ==');
  for (const e of diagB.line) console.log(` ${e.ty.padEnd(13)} ${e.pt.padEnd(7)} ${String(e.x).padStart(4)},${String(e.y).padStart(4)} tgt=${e.tgt.slice(0, 60)} cancelable=${e.cancelable ? 1 : 0}`);
}

await browser.close();
