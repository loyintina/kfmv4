/**
 * tests/browser/tmux-tabs.test.mjs — tmux 标签条 A 档考卷（宪法 §6 Step 2
 * client 侧，2026-09-01；v2 词汇表统一+时序钉）。全真链路：真服务器+
 * 真 tmux+真 WS。状态机清单蓝本=docs/tmux-tabs-v2-state-machine.md。
 *
 * 钉：①T12/T13 无会话隐藏+重试腿 ②T1 把手 ③展开 ④E4 推送刷新
 * ⑤T2 select+P4 停 EXPANDED+时序钉（≤800ms）⑥契约注册
 * ⑦自观测环（词汇表统一：HIDDEN/HANDLE/EXPANDED）
 */
import { launchBrowser } from './launch.mjs';

const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const URL = `${BASE}?tmuxSession=kfm-exam-browser`;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 250)));
await page.waitForTimeout(1500);

const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
const tabs = () => page.evaluate(() => {
  const el = document.querySelector('[data-tmux-tabs]');
  const rt = window.__kfmNzTmuxTabs?.();
  return { kind: el?.getAttribute('data-tmux-tabs') ?? null, rt };
});

// ① 无会话→HIDDEN：先清上一轮残留（经页面 PTY 杀），等 tmux-exit 推送
await inject('tmux kill-session -t kfm-exam-browser 2>/dev/null; true\r');
let s1 = null;
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(500);
  s1 = await tabs();
  if (s1.kind === 'HIDDEN') break;
}
check('①无会话→HIDDEN（隐藏语义）', s1.kind === 'HIDDEN' && s1.rt?.state === 'HIDDEN',
      `kind=${s1.kind} state=${s1.rt?.state}`);

// ② T13 注入建会话→重试腿重开→HANDLE 出现
await inject('tmux new-session -d -s kfm-exam-browser -n alpha\r');
let s2 = null;
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(500);
  s2 = await tabs();
  if (s2.kind === 'HANDLE' || s2.kind === 'EXPANDED') break;
}
check('②T13 重试腿重开通道→HANDLE', s2?.kind === 'HANDLE',
      `kind=${s2?.kind} wins=${JSON.stringify(s2?.rt?.windows?.map((w) => w.name))}`);

// ③ T1 点把手→EXPANDED
if (s2?.kind === 'HANDLE') {
  await page.click('[data-tmux-tabs="HANDLE"]');
  await page.waitForTimeout(300);
}
const s3 = await tabs();
check('③T1 点把手→EXPANDED（alpha 在列）', s3.kind === 'EXPANDED' && s3.rt?.windows?.some((w) => w.name === 'alpha'),
      `kind=${s3.kind} wins=${JSON.stringify(s3.rt?.windows?.map((w) => w.name))}`);

// ④ E4 注入 new-window→推送刷新 beta
await inject('tmux new-window -t kfm-exam-browser -n beta\r');
let s4 = null;
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(500);
  s4 = await tabs();
  if (s4.rt?.windows?.some((w) => w.name === 'beta')) break;
}
check('④E4 推送刷新→beta 标签', s4?.rt?.windows?.some((w) => w.name === 'beta'),
      `wins=${JSON.stringify(s4?.rt?.windows?.map((w) => w.name))}`);

// ⑤ T2 点非聚焦 alpha→select+active 翻转+停 EXPANDED（P4）+时序钉≤800ms
const alphaId = s4.rt.windows.find((w) => w.name === 'alpha').id;
let elapsed = -1;
await page.evaluate(() => { window.__t0 = Date.now(); });
const chip = page.locator(`[data-tmux-id="${alphaId}"]`);
await chip.click();
let s5 = null;
for (let i = 0; i < 40; i++) { // 100ms 步进，最长 4s
  await page.waitForTimeout(100);
  s5 = await tabs();
  const a = s5.rt?.windows?.find((w) => w.id === alphaId);
  if (a?.active === true) { elapsed = await page.evaluate(() => Date.now() - window.__t0); break; }
}
check('⑤T2 非聚焦点选→select+active 翻转+停 EXPANDED+时序≤800ms',
      s5.rt?.lastSelected === alphaId && s5.rt?.windows?.find((w) => w.id === alphaId)?.active === true
        && s5.kind === 'EXPANDED' && elapsed >= 0 && elapsed <= 800,
      `last=${s5.rt?.lastSelected} kind=${s5.kind} elapsed=${elapsed}ms`);

// ⑥ kernel 注册表在案
const reg = await page.evaluate(() => window.__kfmNzKernel?.list?.() ?? null);
check('⑥kernel 注册表在案（tmux-tabs 挂宪法契约）', Array.isArray(reg) && reg.includes('tmux-tabs'),
      `list=${JSON.stringify(reg)}`);

// ⑦ 自观测环（修正三：词汇表统一）——迁移序列忠实+末拍与实时 DOM 互证
const s7 = await tabs();
const hist = s7.rt?.history ?? [];
const states = hist.map((h) => h.state);
const domNow = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
const sawEXP = states.includes('EXPANDED');
const sawHDL = states.includes('HANDLE');
const vocabOk = states.every((s) => ['HIDDEN', 'HANDLE', 'EXPANDED'].includes(s));
const lastMatchesDom = hist.length > 0 && hist[hist.length - 1].state === domNow;
check('⑦自观测环：词汇表统一+迁移序列忠实+末拍互证',
      sawEXP && sawHDL && vocabOk && lastMatchesDom,
      `states=${JSON.stringify(states.slice(-6))} last=${states.at(-1)} domNow=${domNow}`);

// ⑧ T4/T5 ＋建窗毛玻璃页：EXPANDED 态点＋→OVERLAY_NEW→输名 gamma→确认
await page.click('[data-tmux-plus="1"]');
const ovNew = await page.evaluate(() => document.querySelector('[data-tmux-overlay]')?.getAttribute('data-tmux-overlay') ?? null);
const st7 = await tabs();
check('⑧T4 点＋→OVERLAY_NEW 毛玻璃页', ovNew === '1' && st7.rt?.state === 'OVERLAY_NEW',
      `overlay=${ovNew} state=${st7.rt?.state}`);
await page.fill('[data-tmux-new-name]', 'gamma');
await page.click('[data-tmux-confirm="1"]');
let s8 = null;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400);
  s8 = await tabs();
  if (s8.rt?.windows?.some((w) => w.name === 'gamma') && s8.rt.state === 'HANDLE') break;
}
check('⑧T5 确认→gamma 新窗聚焦+收起回把手', s8?.rt?.windows?.some((w) => w.name === 'gamma') && s8?.rt?.state === 'HANDLE',
      `wins=${JSON.stringify(s8?.rt?.windows?.map((w) => w.name))} state=${s8?.rt?.state}`);

// ⑨ T6 空名确认→新窗（名字跟随程序，不钉死）
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
await page.click('[data-tmux-plus="1"]');
await page.click('[data-tmux-confirm="1"]');
let s9 = null;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400);
  s9 = await tabs();
  if (s9.rt?.windows?.length === 4) break;
}
check('⑨T6 空名确认→新窗（4 窗）', s9?.rt?.windows?.length === 4,
      `wins=${s9?.rt?.windows?.length} names=${JSON.stringify(s9?.rt?.windows?.map((w) => w.name))}`);

// ⑩ T7 取消：展开→点＋→点罩层空白→原状零副作用
const beforeCancel = s9.rt.windows.length;
await page.click('[data-tmux-tabs="HANDLE"]'); // ⑨ 终点是 HANDLE，先展开
await page.waitForTimeout(300);
await page.click('[data-tmux-plus="1"]');
const ovShown = await page.evaluate(() => document.querySelector('[data-tmux-overlay]') !== null);
await page.mouse.click(20, 300); // 罩层空白处
await page.waitForTimeout(300);
const s10 = await tabs();
check('⑩T7 毛玻璃取消→原状零副作用', ovShown && s10.rt?.state !== 'OVERLAY_NEW'
      && s10.rt?.overlay === null && s10.rt?.windows?.length === beforeCancel,
      `shown=${ovShown} state=${s10.rt?.state} wins=${s10.rt?.windows?.length}（前 ${beforeCancel}）`);

// ⑪ T3 点聚焦标签→收起回把手（无 select：lastSelected 不变）
const lastBefore = s10.rt.lastSelected;
const activeId = s10.rt.activeId ?? s10.rt.windows.find((w) => w.active)?.id;
const activeChip = page.locator(`[data-tmux-id="${activeId}"]`);
await activeChip.click();
await page.waitForTimeout(400);
const s11 = await tabs();
check('⑪T3 点聚焦标签→收起回把手（无 select）', s11.kind === 'HANDLE' && s11.rt?.lastSelected === lastBefore,
      `kind=${s11.kind} last=${s11.rt?.lastSelected}（前 ${lastBefore}）`);

// ⑫ T8/T9 ×关窗：确认页（禁令钉：×不直接杀）→确认→标签消失
await page.click('[data-tmux-tabs="HANDLE"]'); // ⑪ 终点 HANDLE，先展开
await page.waitForTimeout(300);
console.log('[DUMP-12]', await page.evaluate(() => JSON.stringify({ n: document.querySelectorAll('[data-tmux-close]').length, ids: [...document.querySelectorAll('[data-tmux-id]')].map((e) => e.getAttribute('data-tmux-id')), wins: window.__kfmNzTmuxTabs().windows })));
const gammaWin = s10.rt.windows.find((w) => w.name === 'gamma');
const gammaChipClose = page.locator(`[data-tmux-close="${gammaWin.name}"]`).first();
await gammaChipClose.click();
await page.waitForTimeout(300);
const s12a = await tabs();
const gammaStillThere = s12a.rt?.windows?.some((w) => w.id === gammaWin.id);
const ovClose = await page.evaluate(() => document.querySelector('[data-tmux-overlay]') !== null);
await page.click('[data-tmux-confirm="1"]');
let s12 = null;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400);
  s12 = await tabs();
  if (!s12.rt?.windows?.some((w) => w.id === gammaWin.id)) break;
}
check('⑫T8/T9 ×→确认页（禁令钉：确认前不杀）→确认→目标窗消失（按 id）',
      gammaStillThere && ovClose && !s12.rt?.windows?.some((w) => w.id === gammaWin.id),
      `确认前窗在=${gammaStillThere} 确认页=${ovClose} 确认后 wins=${JSON.stringify(s12?.rt?.windows?.map((w) => w.name))}`);

// ⑬ T11 拖动换序：mouse 拖 beta 到 alpha 位→推送顺序翻转（⑫ 终点已 EXPANDED）
const betaBox = await page.locator('[data-tmux-win="beta"]').boundingBox();
const alphaBox = await page.locator('[data-tmux-win="alpha"]').boundingBox();
if (betaBox && alphaBox) {
  await page.mouse.move(betaBox.x + 10, betaBox.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(400); // 起拖阈值 300ms
  await page.mouse.move(alphaBox.x + 10, alphaBox.y + 10, { steps: 8 });
  await page.mouse.up();
}
let s13 = null;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400);
  s13 = await tabs();
  if (s13.rt?.windows?.[0]?.name === 'beta') break;
}
check('⑬T11 拖动换序→推送顺序翻转（beta 到首位）',
      s13?.rt?.windows?.[0]?.name === 'beta',
      `order=${JSON.stringify(s13?.rt?.windows?.map((w) => w.name))}`);

// 清理考试会话（经页面 PTY）——崩卷也不残留
try {
  await inject('tmux kill-session -t kfm-exam-browser\r');
  await page.waitForTimeout(800);
} finally {
  await browser.close();
}
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
process.exit(fails.length ? 1 : 0);
