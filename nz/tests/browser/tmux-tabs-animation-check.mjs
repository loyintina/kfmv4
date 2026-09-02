/**
 * tests/browser/tmux-tabs-animation-check.mjs
 * 验证 tmux-tabs 动画 tokens 和 CSS 动画是否正确加载。
 */
import { launchBrowser } from './launch.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_ANIM_DIR || '/tmp/nz-tmux-tabs-animation';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs, null, { timeout: 30000 });

// 检查 tokens.css 是否加载
const hasTokens = await page.evaluate(() => {
  return !!document.querySelector('link[href*="tokens.css"]');
});
console.log('[tokens.css 已加载]', hasTokens);

// 检查动画关键帧是否存在
const hasKeyframes = await page.evaluate(() => {
  const sheets = Array.from(document.styleSheets);
  for (const sheet of sheets) {
    try {
      const rules = Array.from(sheet.cssRules || []);
      for (const rule of rules) {
        if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name?.includes('kfm-tmux')) return true;
      }
    } catch { /* cross-origin */ }
  }
  return false;
});
console.log('[kfm-tmux keyframes 已加载]', hasKeyframes);

// 检查把手 transition
const orbTransition = await page.evaluate(() => {
  const orb = document.querySelector('[data-tmux-orb="1"]') || document.querySelector('[data-tmux-tabs="HANDLE"]');
  if (!orb) return null;
  const s = getComputedStyle(orb);
  return { transition: s.transition, animation: s.animation };
});
console.log('[把手样式]', orbTransition);

// 展开标签栏，检查标签排动画
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(100);
const strip = await page.evaluate(() => {
  const el = document.querySelector('[data-tmux-tabs="EXPANDED"]');
  if (!el) return null;
  const s = getComputedStyle(el);
  return { animation: s.animation, opacity: s.opacity };
});
console.log('[标签排展开动画]', strip);

// 截图
await page.screenshot({ path: join(OUT_DIR, 'expanded.png') });
console.log('[截图]', join(OUT_DIR, 'expanded.png'));

await browser.close();
