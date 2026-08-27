/**
 * tests/browser/cjk-width-c4.test.mjs — C4 宽字符占格·同串同宽对照题（nz 侧）
 * （term-contract.md C4：CJK 恒 2cell、U+E0B0 恒 1cell、混排宽度计算一致；
 *  审计 C 表遗留互验考题，2026-08-27 领单落地）
 *
 * 判据 = 同串 → 光标推进列数（两线同构：na 断 alacritty 网格 cursor 推进，
 * nz 断 rio-vt 核 cursor() 推进；DOM 渲染层另钉「宽 span 忠实 2×cellW」）。
 *
 * 契约串与期望推进（na 侧落题请引用同表，出处 term-contract C4）：
 *   "A中A"   → +4    （1+2+1）
 *   "中中"   → +4    （2+2）
 *   "\uE0B0" → +1    （powerline 窄格，契约点名）
 *   "中文A"  → +5    （2+2+1）
 *
 * 跑法：node tests/browser/cjk-width-c4.test.mjs（nz 目录下，8023 dev 起着）
 */
import { chromium } from 'playwright';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ ok }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
  await page.waitForSelector('.nz-term', { timeout: 15000 });
  await page.waitForFunction(() => typeof window.__kfmNzTermInject === 'function', { timeout: 15000 });
  await page.waitForFunction(() => {
    const w = window.__kfmNzTermScroll?.();
    return w && w.cellW != null;
  }, { timeout: 15000 }).catch(() => {});

  // ── 核层：同串 → 光标推进列数（C4 本体判据） ─────────────────────────
  // 经真实注入管线喂串（管线语义：\r 回车），随后读核 cursor() 的 x。
  // echo 前缀也推进列——改用「差分」：同一行内喂串前后 x 差=串推进。
  const advance = async (s) => page.evaluate(async (str) => {
    const before = window.__kfmNzCursorX();
    window.__kfmNzTermInject(str);
    await new Promise((r) => setTimeout(r, 300));
    return window.__kfmNzCursorX() - before;
  }, s);

  // 钩子就绪检查（cursorX 由 term 插件并列暴露——见 index.ts 热更段旁）
  const hasCursorHook = await page.evaluate(() => typeof window.__kfmNzCursorX === 'function');
  if (!hasCursorHook) {
    check('钩子 __kfmNzCursorX 就绪', false, '缺失——term 插件未暴露核 cursor()');
  } else {
    // 定位到行首：注入 \r 后 x 应=0（行首）
    await page.evaluate(() => window.__kfmNzTermInject('\r'));
    await new Promise((r) => setTimeout(r, 300));

    let x = await advance('A中A');
    check('C4① "A中A" → +4', x === 4, `推进=${x}`);

    await page.evaluate(() => window.__kfmNzTermInject('\r'));
    await new Promise((r) => setTimeout(r, 300));
    x = await advance('中中');
    check('C4② "中中" → +4', x === 4, `推进=${x}`);

    await page.evaluate(() => window.__kfmNzTermInject('\r'));
    await new Promise((r) => setTimeout(r, 300));
    x = await advance('\uE0B0');
    check('C4③ U+E0B0 → +1（powerline 窄格）', x === 1, `推进=${x}`);

    await page.evaluate(() => window.__kfmNzTermInject('\r'));
    await new Promise((r) => setTimeout(r, 300));
    x = await advance('中文A');
    check('C4④ "中文A" → +5', x === 5, `推进=${x}`);

    // ── 渲染层：宽 span 忠实 2×cellW（核推进对，画歪了也是病） ─────────
    await page.evaluate(() => window.__kfmNzTermInject('printf "X中Y\\n"\r'));
    await new Promise((r) => setTimeout(r, 1200));
    const dom = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('.nz-term span')]
        .filter((s) => s.textContent === '中' && s.parentElement.tagName === 'DIV');
      const first = spans[spans.length - 1];
      if (!first) return null;
      const scroll = window.__kfmNzTermScroll();
      return {
        spanW: first.getBoundingClientRect().width,
        cellW: scroll.cellW,
      };
    });
    check('C4⑤ 渲染层宽 span=2×cellW（画忠实于核）',
      !!dom && Math.abs(dom.spanW - 2 * dom.cellW) < 0.6,
      dom ? `spanW=${dom.spanW.toFixed(2)} 2×cellW=${(2 * dom.cellW).toFixed(2)}` : '未找到行盒直下的「中」span');
  }
} finally {
  await browser.close();
}

const bad = results.filter((r) => !r.ok).length;
console.log(`\n${bad === 0 ? '✅ C4 同串同宽全绿' : `❌ ${bad} 项红`}（${results.length} 断言）`);
process.exit(bad === 0 ? 0 : 1);
