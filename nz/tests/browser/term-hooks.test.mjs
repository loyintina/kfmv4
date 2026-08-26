/**
 * tests/browser/term-hooks.test.mjs — 终端可编程钩子（Inject/Screen）A 档
 * 标准（2026-08-26 nz-device-agent-p0-review：实验台 device-agent P0
 * 「能动手」前提，用户拍板最高优先）
 *
 * 契约：
 *   window.__kfmNzTermInject(str) — 走现有输入管线（takeMods 粘滞同路
 *     + inputToBottom 落字回底 + bridge.input，\n→\r、\r=回车）；
 *   window.__kfmNzTermScreen() — 当前可视屏纯文本（壳渲染态同源，
 *     塌尾行不计，不含 scrollback 历史）。
 * 可并列扩展：后补 InjectKey/InjectRaw/ScreenGrid/ScreenAt 同款并列加。
 *
 * 跑法：起 8023 dev + node tests/browser/term-hooks.test.mjs（playwright + chromium）。
 */
import { chromium } from 'playwright';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok?'✅':'❌'} ${name}${detail?' — '+detail:''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil:'networkidle', timeout:25000 }).catch(()=>{});
await page.waitForSelector('.nz-term', { timeout:15000 }).catch(()=>{});
await page.waitForTimeout(3000);

// ①两钩子存在（外部可读）
{
  const t = await page.evaluate(() => ({
    inject: typeof window.__kfmNzTermInject,
    screen: typeof window.__kfmNzTermScreen,
    scroll: typeof window.__kfmNzTermScroll, // 旧契约仍在（无命名冲突）
  }));
  check('①钩子存在（Inject/Screen/Scroll 无冲突）',
        t.inject === 'function' && t.screen === 'function' && t.scroll === 'function',
        JSON.stringify(t));
}

// ②Inject 走现有管线：注入 echo 中文测试\r → PTY 执行 → 输出回显上屏
await page.evaluate(() => window.__kfmNzTermInject('echo 中文测试\r'));
await page.waitForTimeout(1500); // 注入→PTTY→回显 RTT
{
  const screen = await page.evaluate(() => window.__kfmNzTermScreen());
  const hits = (screen.match(/中文测试/g) || []).length;
  check('②Inject(echo 中文测试\\r)→shell 回显（命令回显+输出双命中）',
        typeof screen === 'string' && hits >= 2, `命中=${hits}`);
}

// ③Screen=可视屏纯文本：含提示符、行数=壳可见行（塌尾行不计）
{
  const r = await page.evaluate(() => {
    const screen = window.__kfmNzTermScreen();
    // 屏幕行 div 的结构特征=white-space:pre + height:1.25em（historyDiv/
    // 光标层 div 无此标记）——与壳 rowDivs 一一对应
    const visibleRows = [...document.querySelectorAll('.nz-term > div')]
      .filter(d => d.style.whiteSpace === 'pre' && d.style.height === '1.25em'
        && d.style.display !== 'none').length;
    return { screen, lines: screen.split('\n').length, visibleRows,
             hasPrompt: /⚡|root@|\$|#/.test(screen) };
  });
  check('③Screen 含提示符（含首行提示符语义）', r.hasPrompt, r.screen.split('\n')[0]?.slice(0, 30));
  check('③b Screen 行数==壳可见行（同源不建副本）', r.lines === r.visibleRows,
        `lines=${r.lines} visibleRows=${r.visibleRows}`);
}

// ④Inject 不破坏输入纪律：注入后 isAtBottom=true（落字回底走了管线）
{
  const at = await page.evaluate(() => window.__kfmNzTermScroll().isAtBottom);
  check('④注入后回底纪律在位（isAtBottom=true）', at === true, `isAtBottom=${at}`);
}

await browser.close();
const allOk = results.every(r=>r.ok);
console.log(`\n=== term-hooks A 档：${results.filter(r=>r.ok).length}/${results.length} 通过（Inject/Screen 可编程钩子）===`);
process.exit(allOk ? 0 : 1);
