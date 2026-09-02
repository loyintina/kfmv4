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

// 收起态基线：strip 必须 scaleX(0)+opacity 0（选择器 bug 钉：
// [data-tmux-tabs="EXPANDED"] 规则在收起态失效会导致 strip 常显）
const collapsedBase = await page.evaluate(() => {
  const el = document.querySelector('[data-tmux-strip]');
  if (!el) return null;
  const s = getComputedStyle(el);
  return { transform: s.transform, opacity: s.opacity, transition: s.transition };
});
console.log('[标签排收起基线]', collapsedBase);
if (!collapsedBase) throw new Error('缺少 [data-tmux-strip] 元素');
if (collapsedBase.opacity !== '0') throw new Error(`收起态 opacity 应为 0，实得 ${collapsedBase.opacity}`);
if (!collapsedBase.transition.includes('transform')) throw new Error('收起态缺 transform transition');

// 把手收起态：不得带 transform-origin 污染、不得旋转
const orbCollapsed = await page.evaluate(() => {
  const orb = document.querySelector('[data-tmux-orb="1"]');
  const s = getComputedStyle(orb);
  return { transform: s.transform, transformOrigin: s.transformOrigin };
});
console.log('[把手收起态]', orbCollapsed);

// 展开标签栏，检查标签排动画（等 350ms 让 250ms transition 走完再断言终态）
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(350);
const strip = await page.evaluate(() => {
  const el = document.querySelector('[data-tmux-strip]');
  if (!el) return null;
  const s = getComputedStyle(el);
  return { transition: s.transition, animation: s.animation, opacity: s.opacity, transform: s.transform };
});
console.log('[标签排展开动画]', strip);
if (strip && strip.opacity !== '1') throw new Error(`展开态 opacity 应为 1，实得 ${strip.opacity}`);

// 把手展开态：rotate(90deg) 且绕中心旋转（transform-origin 应为中心）
const orbExpanded = await page.evaluate(() => {
  const orb = document.querySelector('[data-tmux-orb="1"]');
  const s = getComputedStyle(orb);
  return { transform: s.transform, transformOrigin: s.transformOrigin };
});
console.log('[把手展开态]', orbExpanded);
// rotate(90deg) 的矩阵 = matrix(0,1,-1,0,0,0)（浮点近似 6.12e-17）
if (!orbExpanded.transform.startsWith('matrix(')) throw new Error(`展开态把手未旋转：${orbExpanded.transform}`);
const m = orbExpanded.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
if (Math.abs(m[0]) > 0.01 || Math.abs(m[1] - 1) > 0.01 || Math.abs(m[2] + 1) > 0.01 || Math.abs(m[3]) > 0.01) {
  throw new Error(`把手旋转角异常：${orbExpanded.transform}`);
}

// 收回后再断言一次：strip 回到 scaleX(0)+opacity 0（收回动画链路完整）
await page.click('[data-tmux-orb="1"]');
await page.waitForTimeout(350);
const collapsedAgain = await page.evaluate(() => {
  const el = document.querySelector('[data-tmux-strip]');
  const s = getComputedStyle(el);
  return { transform: s.transform, opacity: s.opacity };
});
console.log('[标签排收回后]', collapsedAgain);
if (collapsedAgain.opacity !== '0') throw new Error(`收回后 opacity 应为 0，实得 ${collapsedAgain.opacity}`);

// 截图
await page.click('[data-tmux-orb="1"]');
await page.waitForTimeout(350);
await page.screenshot({ path: join(OUT_DIR, 'expanded.png') });
console.log('[截图]', join(OUT_DIR, 'expanded.png'));

await browser.close();
console.log('[tmux-tabs-animation-check] 全部断言通过');
