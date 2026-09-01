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

// ========== 附窗接线四钉（T2a/T2/T3/T3b，2026-09-01 用户二次仲裁）==========
// 终端本体=裸 shell；标签条点选语义以 attached（终端是否 attach 在会话上）为条件：
//   未附+点任意标签 → 注入 attach+select（整页切窗）
//   已附+点非聚焦   → select 切窗（停 EXPANDED）
//   已附+点聚焦     → 注入 Ctrl-B d detach → 回终端态
// 观测：屏幕真话（__kfmNzTermScreen：状态行/TABMARK 标记）×钩子（attached）互证

// 预埋：两窗各自屏幕标记（send-keys 经页面 shell 的 tmux CLI，服务器侧执行）
const sh2 = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
await sh2(`tmux send-keys -t kfm-exam-browser:alpha 'echo TABMARK-ALPHA && sleep 300' Enter\r`);
await sh2(`tmux new-window -t kfm-exam-browser -n beta\r`);
await sh2(`tmux send-keys -t kfm-exam-browser:beta 'echo TABMARK-BETA && sleep 300' Enter\r`);
await sh2(`tmux set -w automatic-rename off -t kfm-exam-browser:alpha\r`);
await sh2(`tmux set -w automatic-rename off -t kfm-exam-browser:beta\r`);
await page.waitForTimeout(800);

// 展开（T1）：此刻应 EXPANDED 且 attached=false（未附）
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
const sA = await tabs();
check('⑭T2a前置：EXPANDED 且 attached=false（词汇表+附窗字段）',
      sA.kind === 'EXPANDED' && sA.rt?.attached === false,
      `kind=${sA.kind} attached=${sA.rt?.attached}`);

// P-C：未附+点聚焦标签（alpha）→ attach+显示该窗（屏幕真话）
const t0pc = Date.now();
await page.click('[data-tmux-id="' + sA.rt.windows.find((w) => w.name === 'alpha').id + '"]');
let pc = null, pcMs = -1;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(150);
  pc = await tabs();
  const scr = await page.evaluate(() => window.__kfmNzTermScreen());
  if (scr.includes('TABMARK-ALPHA') && scr.includes('kfm-exam-browser')) { pcMs = Date.now() - t0pc; break; }
}
const pcFinal = await tabs();
check('P-C 未附点聚焦标签→attach（屏幕真话：状态行+标记）',
      pc !== null && pcMs > 0 && pcFinal.rt?.attached === true && pcFinal.rt?.state === 'EXPANDED',
      `attach+切窗 ${pcMs}ms attached=${pcFinal.rt?.attached}`);

// T2/P-A：已附+点非聚焦 beta→select 切窗（屏幕真话 ≤800ms）
const betaId = pcFinal.rt.windows.find((w) => w.name === 'beta').id;
const t0pa = Date.now();
await page.click(`[data-tmux-id="${betaId}"]`);
let pa = null, paMs = -1;
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(100);
  pa = await tabs();
  const scr = await page.evaluate(() => window.__kfmNzTermScreen());
  if (scr.includes('TABMARK-BETA')) { paMs = Date.now() - t0pa; break; }
}
const paFinal = await tabs();
check('P-A 已附点非聚焦→切窗（屏幕 TABMARK-BETA）+停 EXPANDED+时序≤800ms',
      pa !== null && paMs > 0 && paMs <= 800 && paFinal.rt?.attached === true && paFinal.kind === 'EXPANDED',
      `切窗 ${paMs}ms kind=${paFinal.kind} attached=${paFinal.rt?.attached}`);

// P-B：已附+点聚焦 beta→detach 回终端态（状态行消失+HANDLE+attached=false）
const focusedNow = paFinal.rt.windows.find((w) => w.active);
const t0pb = Date.now();
await page.click(`[data-tmux-id="${focusedNow.id}"]`);
let pb = null, pbMs = -1;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(150);
  pb = await tabs();
  const scr = await page.evaluate(() => window.__kfmNzTermScreen());
  if (!scr.includes('kfm-exam-browser') && pb.rt?.attached === false) { pbMs = Date.now() - t0pb; break; }
}
const pbScreen = await page.evaluate(() => window.__kfmNzTermScreen());
check('P-B 已附点聚焦标签→detach 回终端态（状态行消失+HANDLE）',
      pb !== null && pbMs > 0 && pbMs <= 1500 && pb.rt?.attached === false && pb.kind === 'HANDLE'
        && !pbScreen.includes('kfm-exam-browser'),
      `detach ${pbMs}ms attached=${pb.rt?.attached} kind=${pb.kind}`);

// P-C2：脱附态再点非聚焦标签→重新 attach（T2a 门：进出自由）
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
const t0pc2 = Date.now();
await page.click(`[data-tmux-id="${betaId}"]`);
let pc2 = null, pc2Ms = -1;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(150);
  pc2 = await tabs();
  const scr = await page.evaluate(() => window.__kfmNzTermScreen());
  if (scr.includes('TABMARK-BETA') && scr.includes('kfm-exam-browser')) { pc2Ms = Date.now() - t0pc2; break; }
}
const pc2Final = await tabs();
check('P-C2 脱附态点标签→重新 attach（进出自由）',
      pc2 !== null && pc2Ms > 0 && pc2Final.rt?.attached === true && pc2Final.rt?.state === 'EXPANDED',
      `re-attach ${pc2Ms}ms attached=${pc2Final.rt?.attached}`);

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
