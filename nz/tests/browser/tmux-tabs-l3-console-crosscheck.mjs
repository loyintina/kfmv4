/**
 * tests/browser/tmux-tabs-l3-console-crosscheck.mjs
 * tmux-tabs v2.2 的 L3 控制台钩子验证（独立于 DOM 选择器和服务端真值）。
 * 只使用 window.__kfmNzTerm* 公共钩子，模拟用户在 DevTools 控制台或
 * CDP Runtime.evaluate 里手动复核清屏行为的方式。
 */
import { launchBrowser } from './launch.mjs';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForFunction(() =>
  !!window.__kfmNzTermInject && !!window.__kfmNzTermClear && !!window.__kfmNzTermScreen,
  null, { timeout: 30000 },
);

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

// 先产生一点屏幕内容
await page.evaluate(() => window.__kfmNzTermInject?.('echo l3-clear-probe\r'));
await page.waitForTimeout(800);

// L3：在控制台层直接调用钩子完成清屏+^L 重绘 prompt，不依赖 UI 选择器
const r = await page.evaluate(async () => {
  const inject = (s) => window.__kfmNzTermInject?.(s);
  const screen = () => window.__kfmNzTermScreen?.() ?? '';
  const clear = () => window.__kfmNzTermClear?.();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const before = screen();
  const beforeHas = before.includes('l3-clear-probe');
  clear();
  inject('\u000c'); // ^L：readline 清屏并重绘当前行/prompt
  await wait(400);
  const after = screen();
  const afterHas = after.includes('l3-clear-probe');

  return { beforeHas, afterHas, afterLength: after.length, after };
});

check('L3a 清屏前屏幕含探测文本', r.beforeHas, `beforeHas=${r.beforeHas}`);
check('L3b 调用 __kfmNzTermClear()+^L 后屏幕不再含探测文本',
      !r.afterHas, `afterHas=${r.afterHas} len=${r.afterLength}`);
check('L3c 清屏重绘后屏幕有提示符（非空屏）',
      r.afterLength > 0 && r.after.includes('⚡'), `after=${r.after.slice(0, 80)}`);

await browser.close();

const fails = results.filter((x) => !x.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
if (fails.length > 0) process.exit(1);
