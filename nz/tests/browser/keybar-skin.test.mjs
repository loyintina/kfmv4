/**
 * tests/browser/keybar-skin.test.mjs — keybar 迁皮专项钉（清单
 * docs/keybar-v3-state-machine.md §六 ㉒㉓㉔；21 行为钉在
 * keybar-click.test.mjs 原样保留，本卷不重复）。
 *
 * ㉒ P5 零硬编码：皮源文件（term/KeybarApp.tsx + term/keybar.ts）grep 无
 *     十六进制色值、无 style.cssText；DOM computed 色=tokens 解析值
 *     （栏/键面 transparent=0903 拍板透明化；键字=--kfm-key-ink；
 *     armed=--kfm-key-on-bg 色块浮现）。
 * ㉓ §三可观测钩子：__kfmNzKeybar() 报 mods/repeat/history；点 CTRL→
 *     mods.ctrl=true→落字（诱饵 textarea 键盘输入触发 take）→全 false；
 *     history ring 有 toggle→take 拍序。repeat 词汇=清单枚举。
 * ㉔ 视觉白名单：迁前基线（tests/assets/keybar-baseline.json/.png，
 *     keybar-baseline-capture.mjs 迁皮前对旧皮捕获）vs 迁后同区域：
 *     豁免背景色（透明化=0903 拍板项）；键位几何（14 键 grid 7×2 位置
 *     尺寸）、键序、字号逐格比对。字色=token 解析值断言（诚实注记：旧皮
 *     字面量 → --kfm-key-ink=--kfm-ink-2 档的收编漂移是清单 §五行 3 的
 *     意图内变更，不与基线字色做相等断言）。
 *     **降级声明**：像素级 diff 在 headless 太飘（--use-gl=disabled 软光栅
 *     +字体光栅差异，同码两跑都未必逐像素同），故降级为几何+computed-style
 *     断言；迁前/迁后 PNG 双存（baseline/after）供人审兜底。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './launch.mjs';
import { summarize } from './clickability.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const NZ = join(HERE, '..', '..');
const SKIN_FILES = ['src/client/term/KeybarApp.tsx', 'src/client/term/keybar.ts'];
const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';

const results = [];
const push = (name, ok, detail = '') => results.push({ name, ok, detail });

// ── ㉒a 皮源文件静态断言（P5：零十六进制色值/零 style.cssText） ──
const HEX = /#[0-9a-fA-F]{3,8}/;
for (const rel of SKIN_FILES) {
  const src = readFileSync(join(NZ, rel), 'utf8');
  // 注释里的叙事性色值引用（如头注引清单原文）不算硬编码——只扫代码行
  const codeLines = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
  const hexHit = codeLines.find((l) => HEX.test(l));
  push(`㉒ ${rel} 无十六进制色值`, !hexHit, hexHit ? `命中: ${hexHit.trim()}` : 'clean');
  push(`㉒ ${rel} 无 style.cssText`, !src.includes('style.cssText'), '');
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.kfm-term-keybar', { timeout: 15000 });
await page.waitForTimeout(3000);

// ── ㉒b DOM computed 色 = tokens 解析值 ──
const colors = await page.evaluate(() => {
  const bar = document.querySelector('.kfm-term-keybar');
  const esc = [...bar.querySelectorAll(':scope > div')].find((d) => d.textContent === 'ESC');
  const ctrl = [...bar.querySelectorAll(':scope > div')].find((d) => d.textContent === 'CTRL');
  return {
    barBg: getComputedStyle(bar).backgroundColor,
    keyBg: getComputedStyle(esc).backgroundColor,
    keyInk: getComputedStyle(esc).color,
    keyFont: getComputedStyle(esc).fontFamily,
    ctrlBgBefore: getComputedStyle(ctrl).backgroundColor,
  };
});
push('㉒ 栏底 computed background=transparent（0903 透明化）',
  colors.barBg === 'rgba(0, 0, 0, 0)' || colors.barBg === 'transparent', colors.barBg);
push('㉒ 键面 computed background=transparent（0903 透明化）',
  colors.keyBg === 'rgba(0, 0, 0, 0)' || colors.keyBg === 'transparent', colors.keyBg);
push('㉒ 键字色=--kfm-key-ink 解析值 rgb(165,168,173)',
  colors.keyInk === 'rgb(165, 168, 173)', colors.keyInk);
push('㉒ 键字体走 --kfm-font-mono（ui-monospace 打头）',
  /ui-monospace/.test(colors.keyFont), colors.keyFont);

// armed：点 CTRL → 色块浮现 rgb(61,90,153)
await page.locator('.kfm-term-keybar div', { hasText: /^CTRL$/ }).first().click({ force: true });
await page.waitForTimeout(150);
const ctrlBgArmed = await page.evaluate(() => {
  const ctrl = [...document.querySelectorAll('.kfm-term-keybar > div')].find((d) => d.textContent === 'CTRL');
  return getComputedStyle(ctrl).backgroundColor;
});
push('㉒ armed CTRL 背景=--kfm-key-on-bg rgb(61,90,153)（黑底色块浮现）',
  ctrlBgArmed === 'rgb(61, 90, 153)', `${colors.ctrlBgBefore} → ${ctrlBgArmed}`);

// ── ㉓ 可观测钩子（清单 §三） ──
const hook0 = await page.evaluate(() => (window.__kfmNzKeybar ? window.__kfmNzKeybar() : null));
push('㉓ __kfmNzKeybar() 存在且报 mods/repeat/history 三件套',
  !!hook0 && !!hook0.mods && !!hook0.repeat && Array.isArray(hook0.history),
  hook0 ? JSON.stringify(hook0.mods) : 'missing');
const repeatVocab = hook0 && ['up', 'down', 'left', 'right']
  .every((k) => ['IDLE', 'HELD', 'REPEATING'].includes(hook0.repeat[k]));
push('㉓ repeat 四机词汇=清单枚举 IDLE/HELD/REPEATING（初态全 IDLE）',
  repeatVocab && hook0.repeat.up === 'IDLE' && hook0.repeat.down === 'IDLE'
  && hook0.repeat.left === 'IDLE' && hook0.repeat.right === 'IDLE',
  hook0 ? JSON.stringify(hook0.repeat) : 'missing');
// CTRL 已 armed（㉒b 末点过）→ mods.ctrl=true；落字 → take → 全 false
const ctrlArmed = await page.evaluate(() => window.__kfmNzKeybar().mods.ctrl === true);
await page.evaluate(() => document.querySelector('textarea.kfm-term-kb')?.focus());
await page.keyboard.type('q', { delay: 10 });
await page.waitForTimeout(300);
const afterTake = await page.evaluate(() => window.__kfmNzKeybar());
push('㉓ K1/K3：点 CTRL→mods.ctrl=true→落字→三机全 false（一次性粘滞 P1）',
  ctrlArmed && afterTake.mods.ctrl === false && afterTake.mods.alt === false && afterTake.mods.shift === false,
  `armed=${ctrlArmed} after=${JSON.stringify(afterTake.mods)}`);
const kinds = afterTake.history.map((h) => h.kind);
const ti = kinds.lastIndexOf('toggle');
const ki = kinds.lastIndexOf('take');
push('㉓ history ring 有 toggle→take 拍序（K1→K3 转换序列）',
  ti !== -1 && ki !== -1 && ti < ki,
  `kinds=${kinds.slice(-6).join(',')}`);

// ── ㉔ 视觉白名单（迁前基线 vs 迁后；豁免背景透明化=拍板项） ──
const baseline = JSON.parse(readFileSync(join(HERE, '..', 'assets', 'keybar-baseline.json'), 'utf8'));
const now = await page.evaluate(() => {
  const bar = document.querySelector('.kfm-term-keybar');
  const r = bar.getBoundingClientRect();
  return {
    bar: { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
    keys: [...bar.querySelectorAll(':scope > div')].map((d) => {
      const dr = d.getBoundingClientRect();
      const cs = getComputedStyle(d);
      return {
        label: d.textContent,
        x: +dr.x.toFixed(2), y: +dr.y.toFixed(2), w: +dr.width.toFixed(2), h: +dr.height.toFixed(2),
        fontSize: cs.fontSize, color: cs.color,
      };
    }),
  };
});
await page.locator('.kfm-term-keybar').screenshot({ path: join(HERE, '..', 'assets', 'keybar-after.png') });
const near = (a, b) => Math.abs(a - b) <= 1; // 1px 容差（同 viewport 同链应全等）
push('㉔ 栏几何一致（位置+尺寸 vs 基线）',
  near(now.bar.x, baseline.bar.x) && near(now.bar.y, baseline.bar.y)
  && near(now.bar.w, baseline.bar.w) && near(now.bar.h, baseline.bar.h),
  `baseline=${JSON.stringify(baseline.bar)} now=${JSON.stringify(now.bar)}`);
push('㉔ 14 键键序一致（KEYS 逐格对齐）',
  now.keys.length === 14 && now.keys.every((k, i) => k.label === baseline.keys[i].label),
  now.keys.map((k) => k.label).join(','));
const geomBad = now.keys.findIndex((k, i) => {
  const b = baseline.keys[i];
  return !(near(k.x, b.x) && near(k.y, b.y) && near(k.w, b.w) && near(k.h, b.h));
});
push('㉔ 14 键几何一致（grid 7×2 位置尺寸逐格 vs 基线）', geomBad === -1,
  geomBad === -1 ? 'all within 1px' : `键${geomBad} ${now.keys[geomBad]?.label}: now=${JSON.stringify(now.keys[geomBad])} base=${JSON.stringify(baseline.keys[geomBad])}`);
const fontBad = now.keys.findIndex((k, i) => k.fontSize !== baseline.keys[i].fontSize);
push('㉔ 字号一致（逐格 vs 基线）', fontBad === -1,
  fontBad === -1 ? now.keys[0].fontSize : `键${fontBad}: ${now.keys[fontBad]?.fontSize} ≠ ${baseline.keys[fontBad]?.fontSize}`);
// 字色=token 解析值（收编漂移=意图内，见文件头注记；不与基线字色断言相等）
push('㉔ 字色=--kfm-key-ink 解析值（token 收编档，逐格）',
  now.keys.every((k) => k.color === 'rgb(165, 168, 173)'),
  now.keys[0].color);

await browser.close();
const { allOk } = summarize(results);
process.exit(allOk ? 0 : 1);
