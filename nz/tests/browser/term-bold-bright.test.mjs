/**
 * tests/browser/term-bold-bright.test.mjs — bold-is-bright 渲染钉
 * （2026-09-03 用户拍板，两线首次定义 bold 语义，term-contract 已登记）
 *
 * 病灶：NaMain/NaCJK 都只有 400 单字重，Chromium 合成加粗把像素 CJK
 * 糊成 2px 毛边、中文难认。根治=bold 不画粗、改映射亮色（ECMA-48
 * 惯例），并容器级 font-synthesis:none 双保险。
 *
 * 钉三件事（走真 PTY：printf 出 SGR，核→壳全链）：
 *   ① \x1b[1;31m → span computed color=亮红 #FF5555（NA ANSI_16[9] 同源）、
 *      computed fontWeight=400/normal（不画粗）
 *   ② \x1b[1m（默认 fg）→ 亮白 #FFFFFF
 *   ③ \x1b[1;94m（已是 bright）→ 亮蓝 #60A5FA 不变（不二次提亮）
 *   ④ 容器 .nz-term computed fontSynthesis='none'（任何漏网 bold 不被合成）
 *
 * 跑法：服务器在 127.0.0.1:8023（build 后即新包），
 * node tests/browser/term-bold-bright.test.mjs。
 */
import { launchBrowser } from './launch.mjs';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

// 标记串全大写独特拼写，避免与屏上既有文本撞车；printf 单引号内 \x1b
// 由 shell printf 解释（mouse-report 卷同款注入路）。
await page.evaluate(() => window.__kfmNzTermInject(
  "printf '\\x1b[1;31mBOLDREDMK\\x1b[0m \\x1b[1mBOLDFGMK\\x1b[0m \\x1b[1;94mBOLDBLUMK\\x1b[0m\\n'\r"));
await page.waitForTimeout(1500);

const probe = await page.evaluate(() => {
  const out = {};
  for (const mk of ['BOLDREDMK', 'BOLDFGMK', 'BOLDBLUMK']) {
    const spans = [...document.querySelectorAll('.nz-term span')]
      .filter((s) => s.textContent === mk);
    const el = spans[spans.length - 1]; // 最新一条（屏上可能有历史残留）
    if (!el) { out[mk] = null; continue; }
    const cs = getComputedStyle(el);
    out[mk] = { color: cs.color, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle };
  }
  const term = document.querySelector('.nz-term');
  out.container = term ? { fontSynthesis: getComputedStyle(term).fontSynthesis } : null;
  return out;
});

check('① bold+红（1;31）→ 亮红 #FF5555 且不画粗',
  !!probe.BOLDREDMK && probe.BOLDREDMK.color === 'rgb(255, 85, 85)'
  && (probe.BOLDREDMK.fontWeight === '400' || probe.BOLDREDMK.fontWeight === 'normal'),
  JSON.stringify(probe.BOLDREDMK));

check('② bold+默认 fg（1m）→ 亮白 #FFFFFF 且不画粗',
  !!probe.BOLDFGMK && probe.BOLDFGMK.color === 'rgb(255, 255, 255)'
  && (probe.BOLDFGMK.fontWeight === '400' || probe.BOLDFGMK.fontWeight === 'normal'),
  JSON.stringify(probe.BOLDFGMK));

check('③ bold+亮蓝（1;94，已是 bright）→ #60A5FA 不二次提亮',
  !!probe.BOLDBLUMK && probe.BOLDBLUMK.color === 'rgb(96, 165, 250)'
  && (probe.BOLDBLUMK.fontWeight === '400' || probe.BOLDBLUMK.fontWeight === 'normal'),
  JSON.stringify(probe.BOLDBLUMK));

check('④ 容器 font-synthesis:none（合成加粗全局禁）',
  !!probe.container && probe.container.fontSynthesis === 'none',
  JSON.stringify(probe.container));

await browser.close();
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
process.exit(fails.length ? 1 : 0);
