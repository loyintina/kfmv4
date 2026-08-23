/**
 * tests/browser/keybar-click.test.mjs — 「仿 Termux 按键栏可点击性」浏览器 E2E 标准
 *
 * 8.8.3b 评审发现的布局 bug（2026-08-23）：keybar 按钮绑定 onPress 正确（dispatch
 * 能触发），但真实点击落在终端内容/容器上（elementFromPoint 命中 root@... 而非按钮）
 * → 按钮收不到点击 → 既没 send 又走默认 tap（召唤/关闭软键盘）。本测试用 3 条断言
 * 把它钉死，作为 A 档标准：任何改动让 keybar 不可点（重叠/不响应/粘滞失效）都红。
 *
 * 用法：node tests/browser/keybar-click.test.mjs   （需 dev 服务在 8023 + playwright）
 * 依赖：playwright（chromium），URL 默认 http://127.0.0.1:8023/
 */
import { chromium } from 'playwright';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(()=>{});
await page.waitForSelector('.kfm-term-keybar', { timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(3000);

// ① 命中测试：每个按钮中心 elementFromPoint 必须命中该按钮自身
const overlap = await page.evaluate(() => {
  const bad = [];
  for (const btn of document.querySelectorAll('.kfm-term-keybar div')) {
    const r = btn.getBoundingClientRect();
    if (r.width < 5) continue;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const isBtn = top === btn || btn.contains(top);
    if (!isBtn) bad.push({ label: btn.textContent, hitTag: top?.tagName, hitTxt: (top?.textContent||'').slice(0, 20) });
  }
  return bad;
});
check('命中测试：所有 keybar 按钮可被 elementFromPoint 命中（无重叠）',
  overlap.length === 0,
  overlap.length ? JSON.stringify(overlap) : '全部命中自身');

// ② 点击即 send：点 ENTER → 终端应收到 \r（shell 出新提示符）
const grid = () => page.evaluate(() => (document.querySelector('.nz-term')?.textContent||'') );
const before = await grid();
await page.evaluate(() => document.querySelector('textarea.kfm-term-kb')?.focus());
await page.keyboard.type('echo T', { delay: 10 });   // 放一段未回车文本
await page.waitForTimeout(400);
const mid = await grid();
// 点 keybar ENTER → \r 执行 → 应出现 "T" 输出 + 新 prompt
const enterBtn = page.locator('.kfm-term-keybar div', { hasText: /^ENTER$/ }).first();
await enterBtn.click({ force: true }).catch(()=>{});
await page.waitForTimeout(700);
const after = await grid();
const sent = after !== mid; // 内容变化 = \r 已送（echo T 被执行）
check('点击 ENTER 发送 \\r（终端内容响应）', sent, `before.len=${before.length} mid.len=${mid.length} after.len=${after.length}`);

// ③ 粘滞可点：点 CTRL 灯亮（syncMods）
const bg = (l) => page.evaluate((x)=>{const e=[...document.querySelectorAll('.kfm-term-keybar div')].find(d=>d.textContent===x);return e?getComputedStyle(e).backgroundColor:null;}, l);
const bgBefore = await bg('CTRL');
const ctrlBtn = page.locator('.kfm-term-keybar div', { hasText: /^CTRL$/ }).first();
await ctrlBtn.click({ force: true }).catch(()=>{});
await page.waitForTimeout(200);
const bgAfter = await bg('CTRL');
check('点击 CTRL 粘滞灯亮（syncMods 生效）', bgBefore !== bgAfter, `${bgBefore} → ${bgAfter}`);

await browser.close();

const allOk = results.every(r => r.ok);
console.log(`\n=== keybar 可点击性：${results.filter(r=>r.ok).length}/${results.length} 通过 ===`);
process.exit(allOk ? 0 : 1);
