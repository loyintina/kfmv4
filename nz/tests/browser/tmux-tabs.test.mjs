/**
 * tests/browser/tmux-tabs.test.mjs — tmux 标签条 A 档考卷 v4（附窗接线+actUntil
 * 劣化网络韧性版，2026-09-01）。状态机蓝本=docs/tmux-tabs-v2-state-machine.md。
 * 劣化网络纪律：动作可能丢、效果可能延迟——actUntil=幂等动作+状态轮询直到确认
 * （模拟真实用户「没反应再点」）。观测：屏幕真话×钩子全机位。
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
// 钩子就绪：waitForFunction 浏览器内轮询（不受中继抖动影响），30s 预算
await page.waitForFunction(
  () => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject,
  null, { timeout: 30000, polling: 250 },
).catch((e) => console.log('[HOOK-TIMEOUT]', String(e).slice(0, 120)));
await page.evaluate(() => { window.__fnProbe = window.__kfmNzTmuxTabs; }); // 二次挂载侦测基线
await page.waitForTimeout(1200);
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 250)));

const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
const tabs = () => page.evaluate(() => {
  const el = document.querySelector('[data-tmux-tabs]');
  const rt = window.__kfmNzTmuxTabs?.();
  return { kind: el?.getAttribute('data-tmux-tabs') ?? null, rt };
});
const screenText = () => page.evaluate(() => window.__kfmNzTermScreen());

/** actUntil：动作→状态轮询至确认；未达则重做（幂等动作劣化网络重试器） */
const actUntil = async (act, pred, { tries = 3, settle = 6000, poll = 250 } = {}) => {
  for (let t = 0; t <= tries; t++) {
    await act();
    const end = Date.now() + settle;
    while (Date.now() < end) { if (await pred()) return { ok: true, tries: t }; await page.waitForTimeout(poll); }
  }
  return { ok: false };
};

// ① 清残留会话→把手常在（0 窗 HANDLE 变体）
await inject('tmux kill-session -t kfm-exam-browser 2>/dev/null; true\r');
let s1 = null;
for (let i = 0; i < 12; i++) { await page.waitForTimeout(400); s1 = await tabs(); if (s1?.rt?.windows?.length === 0) break; }
check('①清残留→把手常在（0 窗 HANDLE 变体）', s1?.kind === 'HANDLE' && s1?.rt?.windows?.length === 0,
      `kind=${s1?.kind} wins=${s1?.rt?.windows?.length}`);

// ② 建会话→重试腿重连→HANDLE+alpha
await inject('tmux new-session -d -s kfm-exam-browser -n alpha\r');
let s2 = null;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(400); s2 = await tabs(); if ((s2?.rt?.windows?.length ?? 0) > 0) break; }
check('②建会话→重试腿重连→HANDLE+alpha', s2?.kind === 'HANDLE' && (s2?.rt?.windows?.length ?? 0) > 0,
      `kind=${s2?.kind} wins=${JSON.stringify(s2?.rt?.windows?.map((w) => w.name))}`);
await inject('tmux set -w automatic-rename off -t kfm-exam-browser:alpha\r');
// 夹具：tmux 默认 status-left-length=10 会把 [kfm-exam-browser] 截成
// [kfm-exam-（0901 ④假红实锤：attach 本身成功，断言读不到全名），放开
await inject('tmux set -g status-left-length 40\r');
await page.waitForTimeout(400);

// ③ T1 点把手→EXPANDED（attached=false 前置）
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
const s3 = await tabs();
check('③T1 展开→EXPANDED+attached=false', s3.kind === 'EXPANDED' && s3.rt?.attached === false,
      `kind=${s3.kind} attached=${s3.rt?.attached}`);

// ④ T3b：未附+点聚焦 alpha→attach 进 tmux（状态行出现+alpha*）
// 守卫式重试：芯片点选对聚焦芯片=attach/detach 拨动（仲裁语义），非幂等——
// 只在 attached=false 时点；已附但屏幕未确认=纯等（attach 渲染中），超时单列。
const alphaId = s3.rt.windows.find((w) => w.name === 'alpha').id;
const t04 = Date.now();
let sawAttachedNoScreen = false;
const ok4 = await actUntil(
  async () => {
    const rt = await page.evaluate(() => window.__kfmNzTmuxTabs?.() ?? null);
    if (rt?.attached) { sawAttachedNoScreen = true; return; } // 已附未确认：不点（点了=detach）
    try {
      await page.click(`[data-tmux-id="${alphaId}"]`, { timeout: 5000 });
    } catch (e) {
      const dump = await page.evaluate(() => JSON.stringify({
        kind: document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null,
        roots: document.querySelectorAll('[data-tmux-tabs-root]').length,
        domIds: [...document.querySelectorAll('[data-tmux-id]')].map((el) => el.getAttribute('data-tmux-id')),
        fnChanged: window.__fnProbe !== window.__kfmNzTmuxTabs,
        rt: window.__kfmNzTmuxTabs?.(),
        ringTail: (window.__kfmNzTmuxTabsSnap?.ring ?? []).slice(-8),
        scrHead: window.__kfmNzTermScreen?.().slice(0, 120),
      }));
      console.log('[CLICK-ERR-DUMP]', dump.slice(0, 1400));
    }
  },
  async () => { const scr = await screenText(); return scr.includes('[kfm-exam-browser]') && scr.includes('alpha*'); },
  { tries: 3, settle: 5000, poll: 250 },
);
const ms4 = Date.now() - t04;
const s4 = await tabs();
check('④T3b 未附点聚焦标签→attach 进 tmux（状态行+alpha*）',
      ok4.ok && s4.rt?.attached === true && ms4 <= 8000,
      `attach ${ms4}ms tries=${ok4.tries} attached=${s4.rt?.attached} attNoScr=${sawAttachedNoScreen}`);

// ⑤ T5：＋建 beta（名字钉死）→聚焦+收起（④ 后已 EXPANDED，条件展开防呆）
const kindPre5 = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
if (kindPre5 === 'HANDLE') { await page.click('[data-tmux-tabs="HANDLE"]'); await page.waitForTimeout(300); }
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', 'beta');
await page.click('[data-tmux-confirm="1"]');
let s5 = null;
for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); s5 = await tabs(); if (s5.rt?.windows?.some((w) => w.name === 'beta')) break; }
check('⑤T5 ＋建 beta→聚焦+收起', s5?.rt?.windows?.some((w) => w.name === 'beta') && s5?.rt?.state === 'HANDLE',
      `wins=${JSON.stringify(s5?.rt?.windows?.map((w) => w.name))} state=${s5?.rt?.state}`);

// ⑥ T1 再展开
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
const s6 = await tabs();
check('⑥T1 再展开（beta 在列）', s6.kind === 'EXPANDED' && s6.rt?.windows?.some((w) => w.name === 'beta'),
      `kind=${s6.kind} wins=${JSON.stringify(s6?.rt?.windows?.map((w) => w.name))}`);

// ⑦ T2：点非聚焦 alpha→切窗（alpha*）≤800ms+停 EXPANDED+attached 保持
const t07 = Date.now();
await page.click(`[data-tmux-id="${alphaId}"]`);
let s7 = null, ok7 = false, ms7 = -1;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(100);
  s7 = await tabs();
  const scr = await screenText();
  if (scr.includes('alpha*')) { ok7 = true; ms7 = Date.now() - t07; break; }
}
check('⑦T2 已附点非聚焦→切窗（alpha*）≤800ms+停 EXPANDED',
      ok7 && ms7 <= 800 && s7.kind === 'EXPANDED' && s7.rt?.attached === true,
      `切窗 ${ms7}ms kind=${s7.kind} attached=${s7.rt?.attached}`);

// ⑧ T11 拖动：beta 拖过 alpha→推送顺序翻转（actUntil 整段重试）
// 拖前塌回自愈（前一次拖动的松手点击穿透可能切窗/收起，用户语义下
// 重试=再点把手展开再拖）；detail 携 dbg 逐环读数。
const dragOnce = async () => {
  const kind = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
  if (kind === 'HANDLE') { await page.click('[data-tmux-tabs="HANDLE"]'); await page.waitForTimeout(300); }
  const bBox = await page.locator('[data-tmux-win="beta"]').boundingBox();
  const aBox = await page.locator('[data-tmux-win="alpha"]').boundingBox();
  if (!bBox || !aBox) { console.log('[DRAG-NOBOX]', JSON.stringify({ kind, bBox, aBox })); return; }
  await page.mouse.move(bBox.x + 10, bBox.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.move(aBox.x + 10, aBox.y + 10, { steps: 8 });
  await page.mouse.up();
};
const d8 = await actUntil(
  async () => { await dragOnce(); },
  async () => { const r = (await tabs())?.rt; return r?.windows?.[0]?.name === 'beta'; },
  { tries: 3, settle: 4000, poll: 300 },
);
const s8 = await tabs();
const dbg8 = await page.evaluate(() => window.__kfmNzTmuxTabsDbgGet?.() ?? null);
check('⑧T11 拖动换序→推送顺序翻转（beta 到首位）', d8.ok && s8?.rt?.windows?.[0]?.name === 'beta',
      `order=${JSON.stringify(s8?.rt?.windows?.map((w) => w.name))} tries=${d8.tries} dbg=${JSON.stringify(dbg8)} kind=${s8.kind} att=${s8.rt?.attached}`);

// ⑨ ×关窗流：点×→OVERLAY_CLOSE（确认前不杀）→确认→目标窗消失
// （防呆同⑤：前步塌回 HANDLE 则先展开——拖动收尾穿透的自愈冗余）
const kindPre9 = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
if (kindPre9 === 'HANDLE') { await page.click('[data-tmux-tabs="HANDLE"]'); await page.waitForTimeout(300); }
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', 'gamma');
await page.click('[data-tmux-confirm="1"]');
let s9a = null;
for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); s9a = await tabs(); if (s9a.rt?.windows?.some((w) => w.name === 'gamma')) break; }
// confirm 建窗后组件收起回 HANDLE（T5/T6 语义）——重展开才有 × 可点
const kindPre9b = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
if (kindPre9b === 'HANDLE') { await page.click('[data-tmux-tabs="HANDLE"]'); await page.waitForTimeout(300); }
await page.click('[data-tmux-close="gamma"]');
await page.waitForTimeout(300);
const ovShown = await page.evaluate(() => document.querySelector('[data-tmux-overlay]') !== null);
const gammaAliveBefore = (await tabs()).rt.windows.some((w) => w.name === 'gamma');
await page.click('[data-tmux-confirm="1"]');
let s9 = null;
for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); s9 = await tabs(); if (!s9.rt?.windows?.some((w) => w.name === 'gamma')) break; }
check('⑨×关窗流：确认页拦截（禁令钉）+确认后消失', ovShown && gammaAliveBefore
      && !s9?.rt?.windows?.some((w) => w.name === 'gamma'),
      `确认页=${ovShown} 确认前窗在=${gammaAliveBefore} 确认后 wins=${s9?.rt?.windows?.length}`);

// ⑩ kernel 注册表 + 自观测环词汇表
const reg = await page.evaluate(() => window.__kfmNzKernel?.list?.() ?? null);
const s10 = await tabs();
const hist = s10.rt?.history ?? [];
const states = hist.map((h) => h.state);
const domNow = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
check('⑩kernel 注册表+自观测环词汇表统一+末拍互证',
      Array.isArray(reg) && reg.includes('tmux-tabs') && states.length > 0
        && states.every((st) => ['HANDLE', 'EXPANDED', 'OVERLAY_NEW', 'OVERLAY_CLOSE'].includes(st))
        && states[states.length - 1] === domNow,
      `reg=${JSON.stringify(reg)} states=${JSON.stringify(states.slice(-5))} dom=${domNow}`);

// 清理
try { await inject('tmux kill-session -t kfm-exam-browser\r'); await page.waitForTimeout(800); } catch { /* 忽略 */ } finally { await browser.close(); }
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
process.exit(fails.length ? 1 : 0);
