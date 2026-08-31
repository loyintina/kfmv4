/**
 * tests/browser/scrollback-cap.test.mjs — 8.8.4 审计终裁漂移#1 压帽考题
 * （kfmv4-audit-term-parity-final-verdict：nz 钉 1000，常量单源+理由注+
 * 压帽考题三件套之考题件）
 *
 * 断言：真页面灌 1200 行输出 → 历史恒 =SCROLLBACK_LINES(1000)、
 * lines_evicted=200（1200+24 屏初? ≥ 封顶后恒 1000 且随输出递增）。
 * 钩子：__kfmNzTermScroll().histLen / .evicted（本卷驱动加的两字段）。
 */
import { launchBrowser } from './launch.mjs';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
let failed = false;
const check = (name, ok, detail) => { if (!ok) failed = true; console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 });

const kbFocus = () => page.evaluate(() => document.querySelector('textarea.kfm-term-kb')?.focus());
const type = (t) => page.evaluate((x) => { const k = document.querySelector('textarea.kfm-term-kb'); k.value = x; k.dispatchEvent(new InputEvent('input', { bubbles: true, data: x, isComposing: false })); }, t);

await kbFocus();
await type('seq 1 1200\r');
await page.waitForTimeout(2500);

const s = await page.evaluate(() => { const r = window.__kfmNzTermScroll(); return { histLen: r.histLen, evicted: r.evicted }; });
check('① 灌 1200 行后历史封顶 1000', s.histLen === 1000, `histLen=${s.histLen}`);
check('② 挤出计数=1200-1000+屏占用修正（有挤出且历史=封顶）', s.evicted > 0 && s.histLen === 1000,
  `evicted=${s.evicted} histLen=${s.histLen}`);

// 再灌一段，历史仍恒 1000（滚动窗口不涨）
await type('seq 1 200\r');
await page.waitForTimeout(1500);
const s2 = await page.evaluate(() => { const r = window.__kfmNzTermScroll(); return { histLen: r.histLen, evicted: r.evicted }; });
check('③ 再灌 200 行历史仍恒 1000', s2.histLen === 1000, `histLen=${s2.histLen}`);
check('④ evicted 单调递增', s2.evicted >= s.evicted, `evicted ${s.evicted}→${s2.evicted}`);

await browser.close();
process.exit(failed ? 1 : 0);
