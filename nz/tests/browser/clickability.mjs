/**
 * tests/browser/clickability.mjs — 通用「真实点击可测性」断言（A 档，可复用）
 *
 * 8.8.3b keybar 点击不可达 bug（2026-08-23）沉淀的标准：真实点击的 UI 元素用这 3 条
 * 断言验证「点一下就该有反应」——可点达/点即有果/焦点保持。任何 DOM 可点元素都能跑，
 * 判 A 档自动化；真机视觉/键盘/手势仍走 C 档守视。
 *
 * 依赖：playwright（chromium）。用法见 keybar-click.test.mjs。
 */
import { chromium } from 'playwright';

/**
 * ① 可点达：elementFromPoint(元素中心) 命中元素自身（或其子孙）——抓"被别的层盖住"。
 * @param selector CSS 选择器；@param text 可选，按文本精确匹配候选取第一个。
 */
export async function reachable(page, { label, selector, text }) {
  const ok = await page.evaluate(({ sel, txt }) => {
    const cands = [...document.querySelectorAll(sel)];
    const el = txt ? cands.find(d => d.textContent === txt) : cands[0];
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top === el || el.contains(top);
  }, { sel: selector, txt: text ?? null });
  return { name: `可点达(${label})`, ok, detail: ok ? '命中自身' : '命中其它元素/被盖' };
}

/**
 * ② 点即有果：点击后 snapshot() 返回值变化（DOM/state/frame 前后对比）。
 */
export async function clickSends(page, { label, locator, click = (l) => l.click({ force: true }), snapshot }) {
  const before = await snapshot();
  await click(locator);
  const after = await snapshot();
  const ok = after !== before;
  return { name: `点即有果(${label})`, ok, detail: ok ? '有变化' : '无变化' };
}

/**
 * ③ 焦点保持：点击后焦点仍在 focusSel（没被抢走 → 软键盘不塌）。
 */
export async function focusKept(page, { label, locator, click = (l) => l.click({ force: true }), focusSel }) {
  await page.evaluate((s) => document.querySelector(s)?.focus(), focusSel);
  await click(locator);
  const ok = await page.evaluate((s) => {
    const f = document.querySelector(s);
    return !!f && (document.activeElement === f || f.contains(document.activeElement));
  }, focusSel);
  const active = await page.evaluate(() => (document.activeElement?.className || document.activeElement?.tagName || 'none'));
  return { name: `焦点保持(${label})`, ok, detail: ok ? `仍在 ${focusSel}` : `焦点=${active}` };
}

/** 汇总：打印 + 返回 {allOk, results} */
export function summarize(results) {
  results.forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  const allOk = results.every(r => r.ok);
  console.log(`\n=== 真实点击可测性：${results.filter(r => r.ok).length}/${results.length} 通过 ===`);
  return { allOk, results };
}
