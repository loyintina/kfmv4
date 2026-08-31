/**
 * experiments/watch-ime-finger.mjs — 前台真键盘终验旁观器
 * 用户真手指操作 nz（tap 召唤键盘/打字/收键盘/快速弹收），本器零打扰
 * 采样终端内部态（200ms）落 /tmp/ime-finger-watch.log。
 * 判据：键盘弹收期间 rows 恒=弹前值（格网解耦）、ime 字段跟随弹收、
 * ALT 下 st 平移到底（TUI 底行露键盘上方）。rows 动=洪峰触发源回来了。
 */
import { chromium } from 'playwright';
import { appendFileSync } from 'node:fs';

const CDP = process.env.NZ_CDP_URL || 'http://127.0.0.1:8026';
const LOG = '/tmp/ime-finger-watch.log';
const DURATION = Number(process.env.WATCH_MS || 120000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.connectOverCDP(CDP);
let page = null;
for (const p of browser.contexts().flatMap((c) => c.pages())) {
  if (!p.url().includes('8023')) continue;
  const ok = await p.evaluate(() => window.__kfmNzTermScroll?.().getContainer().clientWidth > 0).catch(() => false);
  if (ok) { page = p; break; }
}
if (!page) { console.log('❌ 无前台页'); process.exit(1); }

appendFileSync(LOG, `\n── 旁观开始 ${new Date().toISOString()} ──\n`);
const t0 = Date.now();
let lastKey = '';
while (Date.now() - t0 < DURATION) {
  const s = await page.evaluate(() => {
    const sc = window.__kfmNzTermScroll?.();
    if (!sc) return null;
    return {
      vv: Math.round(window.visualViewport?.height ?? 0),
      rows: sc.rows, cols: sc.cols, ime: sc.ime, st: Math.round(sc.scrollTop),
      ch: sc.clientHeight, atB: sc.isAtBottom,
      focus: (document.activeElement?.className ?? '').slice(0, 12),
    };
  }).catch(() => null);
  if (s) {
    // 全字段展开逐行落（事后可 grep 任意维度），状态变化打标便于速读
    const key = `${s.vv}|${s.rows}|${s.ime}|${s.st}`;
    const tag = key !== lastKey ? ' ◀变' : '';
    lastKey = key;
    appendFileSync(LOG, `${String(Date.now() - t0).padStart(7)}ms vv=${s.vv} rows=${s.rows} cols=${s.cols} ime=${s.ime} st=${s.st} ch=${s.ch} atB=${s.atB} focus=${s.focus}${tag}\n`);
  }
  await sleep(200);
}
appendFileSync(LOG, `── 旁观结束 ──\n`);
await browser.close();
console.log('旁观完毕，日志在 ' + LOG);
