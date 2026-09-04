/**
 * A1 阶段四 orb 挪位存证：headless 展开 tmux 标签排 + AI orb 同框截图，
 * 并数值断言 orb 位于屏幕右边缘垂直居中（右中）。
 * 观测手段：Playwright 像素截图 + boundingBox 数值（nz/AGENTS.md L1+截图腿）。
 */
import { launchBrowser } from './launch.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const OUT_DIR = process.env.KFM_NZ_SHOT_DIR || join(process.cwd(), 'tests', 'assets');
mkdirSync(OUT_DIR, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs && !!window.__kfmNzAiChat, null, { timeout: 30000 });

// 展开 tmux 标签排（真点击把手，与冲突场景同形态）
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(500);

const bar = await page.evaluate(() => {
  const el = document.querySelector('[data-tmux-tabs="EXPANDED"]');
  return el ? el.getBoundingClientRect().toJSON() : null;
});
const orb = await page.evaluate(() => {
  const el = document.querySelector('[data-kfm-aichat-orb]');
  return el ? el.getBoundingClientRect().toJSON() : null;
});
console.log('tmux-bar rect:', JSON.stringify(bar));
console.log('ai-orb rect:', JSON.stringify(orb));

const VW = 900, VH = 620;
const checks = [];
const ck = (name, ok, detail) => { checks.push(ok); console.log(`${ok ? '✅' : '❌'} ${name} — ${detail}`); };
ck('orb 存在且标签排已展开', !!orb && !!bar, `orb=${!!orb} bar=${!!bar}`);
if (orb) {
  const cy = orb.top + orb.height / 2;
  ck('orb 右边缘贴屏右（right=12px）', Math.abs(VW - orb.right - 12) < 2, `vw-right-orb.right=${(VW - orb.right).toFixed(1)}`);
  ck('orb 垂直居中（top:50% translateY(-50%)）', Math.abs(cy - VH / 2) < 2, `cy=${cy.toFixed(1)} vh/2=${VH / 2}`);
  ck('orb 不在顶部标签排伸出区（top > 12+32）', orb.top > 44, `orb.top=${orb.top.toFixed(1)}`);
}
if (orb && bar) {
  const overlap = !(orb.right < bar.left || orb.left > bar.right || orb.bottom < bar.top || orb.top > bar.bottom);
  ck('orb 与标签排展开态零重叠', !overlap,
    `orb[${orb.left.toFixed(0)},${orb.top.toFixed(0)}..${orb.right.toFixed(0)},${orb.bottom.toFixed(0)}] bar[${bar.left.toFixed(0)},${bar.top.toFixed(0)}..${bar.right.toFixed(0)},${bar.bottom.toFixed(0)}]`);
}

const p1 = join(OUT_DIR, 'ai-chat-orb-right-center.png');
await page.screenshot({ path: p1, fullPage: false });
console.log('shot:', p1);

// 再拍一张 AI 页打开态（orb 仍可见于右中，不遮头部收起钮）
await page.click('[data-kfm-aichat-orb]');
await page.waitForTimeout(400);
const page2 = await page.evaluate(() => window.__kfmNzAiChat()?.page);
const p2 = join(OUT_DIR, 'ai-chat-orb-right-center-aipage.png');
await page.screenshot({ path: p2, fullPage: false });
console.log('shot:', p2, 'page=', page2);

await browser.close();
const bad = checks.filter((x) => !x).length;
console.log(bad === 0 ? '=== orb 右中存证：全绿 ===' : `=== ${bad} 项红 ===`);
process.exit(bad === 0 ? 0 : 1);
