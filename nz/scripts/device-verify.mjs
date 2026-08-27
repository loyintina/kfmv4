/**
 * scripts/device-verify.mjs — 真机四单并验（实验台自验收，评审角色调整
 * 后 nz 自验+通报免检：kfmv4-review-role-shift-notice）
 *
 * 四单（均来自 8.x→nz 终端收口遗留的「待真机」账）：
 *   ①runaway：TUI 空闲 rows 不增/scrollTop=0/overflow=0/mCellH≈壳 cellH
 *   ②TUI 底栏：ALT 态键栏可见钉视口底、滚动区高=卡身−KEYBAR_H(84)
 *   ③字体：powerline U+E0B0/⚡ 渲染、中文 2cell 宽（截图为像素证据）
 *   ④中文行：中英混排 ink 顶对齐（真机字体 canvas 量 asc 差 ==
 *     cjkDrop 补偿，残余≤1px；截图肉眼复核）
 *
 * 链路：playwright connectOverCDP 127.0.0.1:8026 → cdp-relay → 手机
 * WebView（NZ-Agent）。页面切 ?debug 开遥测（落 /tmp/nz-ime-events.log，
 * 本脚本按字节偏移只读本轮新增行）。证据截图落
 * docs/active/nine-zero/assets/device-verify-*.png。
 *
 * 跑法：node scripts/device-verify.mjs   （nz 目录下；手机 NZ-Agent 开着）
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CDP = process.env.NZ_CDP_URL || 'http://127.0.0.1:8026';
const TERM = 'http://127.0.0.1:8023/?debug';
const IME_LOG = '/tmp/nz-ime-events.log';
const SHOTS = new URL('../../docs/active/nine-zero/assets/', import.meta.url).pathname;

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(SHOTS, { recursive: true });

// ── attach ──────────────────────────────────────────────────────────────
const browser = await chromium.connectOverCDP(CDP);
const pages = browser.contexts().flatMap((c) => c.pages());
const page = pages.find((p) => p.url().includes('8023'));
if (!page) {
  console.log('❌ 枚举不到 8023 页（手机 NZ-Agent 没开？）');
  process.exit(1);
}
console.log(`attach 成功：${page.url()}`);

// 切 ?debug 开遥测（实验台专用；不动用户 Via 那边任何东西）
const logBefore = (() => { try { return readFileSync(IME_LOG, 'utf8').length; } catch { return 0; } })();
await page.goto(TERM, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 });
await page.waitForFunction(() => typeof window.__kfmNzTermInject === 'function', { timeout: 15000 });
await sleep(3000); // 字体就绪门 + 终端首屏

const inject = (s) => page.evaluate((t) => window.__kfmNzTermInject(t), s);
const scroll = () => page.evaluate(() => {
  const { getContainer, ...rest } = window.__kfmNzTermScroll();
  return rest;
});
const newTelemetry = () => {
  try {
    return readFileSync(IME_LOG, 'utf8').slice(logBefore).trim().split('\n')
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
};
const shot = (name) => page.screenshot({ path: SHOTS + name });

// ── ③④ 字体 + 中文行（行模式） ─────────────────────────────────────────
// 混排样张：powerline 箭头 + ⚡ + 中英混排（ranger 实症同款词）
await inject("printf 'A\\xee\\x82\\xb0A ⚡ hermes-蔚然 ts工具 知乎-VibeCoding\\n'\r");
await sleep(1500);
await shot('device-verify-font-cjk.png');

const fontFacts = await page.evaluate(async () => {
  await document.fonts.ready;
  const scroll0 = window.__kfmNzTermScroll();
  // 真机字体栈 canvas 量：A 与 中 的 actualBoundingBoxAscent 差 = 应有 cjkDrop
  const cs = getComputedStyle(document.querySelector('.nz-term'));
  const c = document.createElement('canvas').getContext('2d');
  c.font = `${cs.fontSize} ${cs.fontFamily}`;
  const ascA = c.measureText('A').actualBoundingBoxAscent;
  const ascC = c.measureText('中').actualBoundingBoxAscent;
  // 渲染面：含「中」的 span 宽度应=2×cellW（2cell 清晰），其 top 补偿=asc 差
  const spans = [...document.querySelectorAll('.nz-term span')]
    .filter((s) => s.textContent === '中');
  const first = spans[0];
  return {
    fontFamily: cs.fontFamily, fontSize: cs.fontSize,
    ascA, ascC, ascDiff: +(ascC - ascA).toFixed(2),
    cjkSpanCount: spans.length,
    cjkSpanW: first ? first.getBoundingClientRect().width : null,
    cjkSpanTop: first ? getComputedStyle(first).top : null,
    cjkParentH: first ? first.parentElement.getBoundingClientRect().height : null,
  };
});
// cellW 从遥测读（DOM 拿不准）
const tel0 = newTelemetry();
const lastGeom = [...tel0].reverse().find((r) => r.cellW != null);
const cellW = lastGeom?.cellW ?? null;
const cellH = lastGeom?.cellH ?? null;
check('③a 字体栈生效', /NaMain/.test(fontFacts.fontFamily), fontFacts.fontFamily);
check('③b 中文 2cell 宽', fontFacts.cjkSpanW != null && cellW != null
  && Math.abs(fontFacts.cjkSpanW - 2 * cellW) < 0.6,
  `spanW=${fontFacts.cjkSpanW} 2×cellW=${cellW ? (2 * cellW).toFixed(2) : '?'}`);
check('④ cjkDrop==真机字体 asc 差（残余≤1px）',
  fontFacts.cjkSpanTop != null
  && Math.abs(parseFloat(fontFacts.cjkSpanTop) - fontFacts.ascDiff) <= 1,
  `spanTop=${fontFacts.cjkSpanTop} ascDiff=${fontFacts.ascDiff}（ascA=${fontFacts.ascA} ascC=${fontFacts.ascC}）`);
check('③c 中文行不撑高行盒', fontFacts.cjkParentH != null && cellH != null
  && Math.abs(fontFacts.cjkParentH - cellH) < 0.6,
  `parentH=${fontFacts.cjkParentH} cellH=${cellH}`);

// ── ①② runaway + TUI 底栏（ALT 模式，htop） ────────────────────────────
await inject('htop\r');
await sleep(3000); // alt-enter + 首渲染落定

const tui0 = await page.evaluate(() => {
  const kb = document.querySelector('.kfm-term-keybar');
  const kbRect = kb?.getBoundingClientRect();
  const card = document.querySelector('.nz-term')?.closest('[class]')?.parentElement;
  const s = window.__kfmNzTermScroll();
  return {
    kbDisplay: kb ? getComputedStyle(kb).display : 'missing',
    kbBottom: kbRect?.bottom ?? null,
    innerH: window.innerHeight,
    vvH: window.visualViewport?.height ?? null,
    scrollClientH: s.clientHeight, rows: s.rows, cols: s.cols,
    scrollTop: s.scrollTop,
  };
});
// 卡身底=固定定位铺满可视区：bottom≈innerH（无键盘态 vv≈innerH）
check('②a TUI 态键栏可见（不藏）', tui0.kbDisplay !== 'none' && tui0.kbDisplay !== 'missing',
  `display=${tui0.kbDisplay} kbBottom=${tui0.kbBottom?.toFixed?.(1)} innerH=${tui0.innerH}`);
check('②b TUI 窗口=视口−KEYBAR_H(84)', tui0.vvH != null
  && Math.abs(tui0.scrollClientH - (tui0.vvH - 84)) <= 2,
  `scrollClientH=${tui0.scrollClientH} vvH=${tui0.vvH} vvH−84=${tui0.vvH - 84}`);
check('②c ALT 态 scrollTop=0（禁滚）', tui0.scrollTop === 0, `scrollTop=${tui0.scrollTop}`);

// runaway：空闲 8s 采 4 帧，rows/scrollTop 不得增长
const frames = [];
for (let i = 0; i < 4; i++) {
  await sleep(2000);
  frames.push(await scroll());
}
const rowsSeq = frames.map((f) => f.rows).join('→');
const stSeq = frames.map((f) => f.scrollTop).join('→');
check('①a 空闲 rows 不增', frames.every((f) => f.rows === frames[0].rows), `rows ${rowsSeq}`);
check('①b 空闲 scrollTop 恒 0', frames.every((f) => f.scrollTop === 0), `scrollTop ${stSeq}`);

await shot('device-verify-tui-htop.png');

// 遥测判读：alt-enter 之后 overflowBeyondVisible 恒 0、mCellH≈壳 cellH
const tel1 = newTelemetry();
const altIdx = tel1.findIndex((r) => r.type === 'alt-enter');
const afterAlt = altIdx >= 0 ? tel1.slice(altIdx) : tel1.filter((r) => r.type === 'resized');
const overflows = afterAlt.filter((r) => r.overflowBeyondVisible != null)
  .map((r) => `${r.type}:${r.overflowBeyondVisible}`);
check('①c 遥测 overflow 恒 0', overflows.length > 0 && overflows.every((o) => o.endsWith(':0')),
  overflows.join(' ') || '（无几何遥测行）');
const mCells = afterAlt.filter((r) => r.mCellH != null).map((r) => r.mCellH);
check('①d mCellH 单源≈壳 cellH', mCells.length > 0 && cellH != null
  && mCells.every((m) => Math.abs(m - cellH) < 0.5),
  `mCellH=${mCells.join(',')} cellH=${cellH}`);

await inject('q'); // 退 htop
await sleep(1200);
await shot('device-verify-after-quit.png');

// ── 汇总 ────────────────────────────────────────────────────────────────
const bad = results.filter((r) => !r.ok);
console.log(`\n${bad.length === 0 ? '✅ 四单全绿' : `❌ ${bad.length} 项红`}（${results.length} 断言）`);
writeFileSync('/tmp/nz-device-verify-last.json', JSON.stringify({
  ts: new Date().toISOString(), fontFacts, tui0, frames, results,
}, null, 2));
await browser.close();
process.exit(bad.length === 0 ? 0 : 1);
