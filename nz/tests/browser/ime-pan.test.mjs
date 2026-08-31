/**
 * tests/browser/ime-pan.test.mjs — IME pan 不 resize（格网解耦）A 档标准
 * （2026-08-30 用户拍板；dbg-ime-toggle-flood 真机定罪：键盘弹/收各触发
 * 一次 kimi 整史重绘洪峰 +423/+308KB，快速连点叠加 +713KB）
 *
 * 修法契约：键盘占位期间行列格网**不动**（tmux/TUI 零感知=零洪峰），
 * 可视区变矮用视窗平移补——ALT(TUI) 程序化滚到底让输入行露在键盘上方；
 * 行模式不抢滚动位。收键盘行列若未变=零重测零洪峰。
 *
 * 入态三闸+闩锁（几何上键盘与窗口缩/旧考卷 vv mock 信号同款，靠语义区分）：
 *   ①召唤键盘意图 2s 内（click 主武装+focus 兜原生）②宽不变
 *   ③跌幅>20% 且>150px。innerH 不当闸：APK adjustResize 下真键盘连布局
 *   视口一起缩（2026-08-30 真手指实锤，innerH 闸曾致永不入态）。闩锁
 *   30s、打字续闩，误闩自愈。
 *   旁证：bottom-anchor ④b-d（vv-only mock、无聚焦序曲、十余秒后）保持
 *   绿=武装闸判别力成立，本卷不重复造钉。
 *
 * 钩子契约：
 *   window.__kfmNzTermMockIme(open, kbPx=271) → boolean（ime 扳机是否命中；
 *     open 时自带聚焦序曲，走与真键盘完全相同的几何链路）
 *   window.__kfmNzTermScroll() → { ..., ime, rows, cols, scrollTop,
 *     scrollHeight, clientHeight, getContainer }
 *   window.__kfmNzTermInject(str) / __kfmNzTermScreen()（P0 契约复用）
 *
 * 跑法：起 8023 dev + node tests/browser/ime-pan.test.mjs（playwright + chromium）。
 */
import { launchBrowser } from './launch.mjs';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3500); // 字体重量落地 + 空闲巡查立好 vv 基线

const scroll = () => page.evaluate(() => window.__kfmNzTermScroll?.() ?? null);
const mockIme = (open, px) => page.evaluate(([o, p]) => window.__kfmNzTermMockIme?.(o, p), [open, px]);
const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);

const hookOk = await page.evaluate(() => typeof window.__kfmNzTermMockIme === 'function');
check('钩子存在（__kfmNzTermMockIme + scroll.ime 字段）', hookOk && (await scroll())?.ime === false,
      `hook=${hookOk} ime=${(await scroll())?.ime}`);

// ① 入态闸判别（无武装序曲的缩窗≠键盘）：不点不聚焦直接真缩窗口——
// 无召唤意图，绝不能进 IME 态，行列必须跟随（bottom-anchor ④语义不回退）
await page.evaluate(() => document.activeElement?.blur());
const base = await scroll();
await page.setViewportSize({ width: 900, height: 400 });
await page.waitForTimeout(1000); // 防抖150+RO+空闲巡查500 落地
const shrunkWin = await scroll();
check('①无武装真缩窗→不进 IME 态、行列跟随', !!(base && shrunkWin)
      && shrunkWin.ime === false && shrunkWin.rows < base.rows,
      `rows ${base?.rows}→${shrunkWin?.rows} ime=${shrunkWin?.ime}`);

// ①c 武装+innerH 同缩的缩窗=入态（APK adjustResize 语义钉，2026-08-30
// 真手指实锤：WebView 下真键盘连布局视口一起缩，innerH 闸会把真键盘
// 误判成桌面拖窗永不入态——判别全押武装序曲）：先还原窗（无武装、
// 行列回基线），再点终端（召唤意图武装）再缩窗——行列必须钉住不动；
// 还原窗=退闩重测回基线
await page.setViewportSize({ width: 900, height: 620 });
await page.waitForTimeout(1000);
const restored0 = await scroll();
await page.evaluate(() => document.querySelector('textarea.kfm-term-kb')?.focus());
await page.setViewportSize({ width: 900, height: 400 });
await page.waitForTimeout(1000);
const armedShrink = await scroll();
check('①c武装后缩窗（innerH 同缩）→入态钉行列（APK 语义）', !!(armedShrink && restored0)
      && restored0.rows === base.rows            // 前置：还原窗行列已回基线
      && armedShrink.ime === true && armedShrink.rows === base.rows,
      `restored=${restored0?.rows} ime=${armedShrink?.ime} rows=${armedShrink?.rows}（基线${base?.rows}）`);
await page.setViewportSize({ width: 900, height: 620 });
await page.waitForTimeout(1000);
const restored = await scroll();
const R0 = restored?.rows, C0 = restored?.clientHeight;
check('①b 窗口还原→退闩、行列回基线', !!(restored && R0) && restored.ime === false && restored.rows === base.rows,
      `rows ${armedShrink?.rows}→${R0}（基线${base?.rows}） ime=${restored?.ime} clientH=${C0}`);

// ② 模拟键盘弹起：扳机命中 + 卡身缩（占位生效）+ 行列格网不动（核心判据）
const imeHit = await mockIme(true); // 默认 kbPx=271（真机实测键盘占位）
await page.waitForTimeout(1200);    // 防抖150+空闲巡查500 各跑过至少一轮
const imeOpen = await scroll();
check('②mock 弹键盘→扳机命中+卡身缩 271px+行列不动', imeHit === true && !!imeOpen && base
      && imeOpen.ime === true
      && imeOpen.rows === R0 && imeOpen.cols === restored.cols
      && Math.abs(imeOpen.clientHeight - (C0 - 271)) <= 6,
      `hit=${imeHit} ime=${imeOpen?.ime} rows=${imeOpen?.rows}（基线${R0}） clientH=${imeOpen?.clientHeight}（期望${C0 - 271}）`);

// ③ 键盘开着打字（行模式）：落字回底纪律不破、输出可见、行列仍不动
await inject('echo IME_ALIVE\r');
await page.waitForTimeout(800);
const afterType = await scroll();
const screenHas = await page.evaluate(() => window.__kfmNzTermScreen?.().includes('IME_ALIVE'));
check('③键盘开着打字→输出可见+在底+行列不动', !!(afterType && screenHas)
      && afterType.isAtBottom === true && afterType.rows === R0,
      `screen=${screenHas} atBottom=${afterType?.isAtBottom} rows=${afterType?.rows}`);

// ④ 键盘开着进 ALT（htop）：视窗平移——scrollTop 滚到底让 TUI 底行
// 露在键盘上方；ALT 进入本身也不许触发重测（格网不动）
await inject('htop\r');
await page.waitForTimeout(2500); // ALT 进入 + TUI 首帧稳定
const altIme = await scroll();
const altPanOk = altIme && altIme.scrollTop > 100
  && Math.abs(altIme.scrollTop + altIme.clientHeight - altIme.scrollHeight) <= 5;
check('④键盘开着进 ALT→平移到底（TUI 底行露键盘上方）+行列不动', !!(altIme)
      && altIme.rows === R0 && altPanOk === true,
      `st=${altIme?.scrollTop} sh=${altIme?.scrollHeight} ch=${altIme?.clientHeight} rows=${altIme?.rows}`);

// ⑤ 收键盘（ALT 中）：高度涨回=退 IME 态；行列从②到⑤全程=R0=
// 零重测=零洪峰（弹/收都不再有 kimi 整史重绘的触发源）
const imeOff = await mockIme(false);
await page.waitForTimeout(1200);
const altClosed = await scroll();
check('⑤收键盘→退 IME 态+行列仍全程不动（零洪峰判据）', imeOff === false && !!(altClosed)
      && altClosed.ime === false && altClosed.rows === R0
      && altClosed.scrollTop <= 5,
      `off=${imeOff} ime=${altClosed?.ime} rows=${altClosed?.rows} st=${altClosed?.scrollTop}`);

// ⑥ 退出 TUI 回行模式：行列依旧=基线（整轮弹收/ALT 翻转零重测收尾）
await inject('q');
await page.waitForTimeout(1200);
const fin = await scroll();
check('⑥退出 TUI→行列=基线（整轮零重测闭环）', !!(fin) && fin.rows === R0 && fin.ime === false,
      `rows=${fin?.rows}（基线${R0}） ime=${fin?.ime}`);

await browser.close();
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
process.exit(fails.length ? 1 : 0);
