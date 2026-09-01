/**
 * tests/browser/tmux-tabs.test.mjs — tmux 标签条 A 档考卷 v3（附窗接线完整版，
 * 2026-09-01 用户二次仲裁语义）。状态机蓝本=docs/tmux-tabs-v2-state-machine.md。
 * 模型：终端本体=裸 shell；标签条=tmux 进出与切换器。
 * 观测：屏幕真话（状态行 [kfm-exam-browser] / 窗口名* / ⚡ 提示符）×钩子全机位。
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
// 慢隧道容忍：等插件钩子全就绪（bundle 下载数秒是常态）
for (let i = 0; i < 60; i++) {
  if (await page.evaluate(() => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject)) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1500);
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 250)));

const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
const tabs = () => page.evaluate(() => {
  const el = document.querySelector('[data-tmux-tabs]');
  const rt = window.__kfmNzTmuxTabs?.();
  return { kind: el?.getAttribute('data-tmux-tabs') ?? null, rt };
});
const screen = () => page.evaluate(() => window.__kfmNzTermScreen());
const waitScreen = async (pred, ms) => {
  const end = Date.now() + ms;
  let scr = await screen();
  while (Date.now() < end) { scr = await screen(); if (pred(scr)) return true; await page.waitForTimeout(120); }
  return pred(scr);
};

// ① 清残留→HIDDEN（无会话）→建会话→重试腿重连→HANDLE+alpha
await inject('tmux kill-session -t kfm-exam-browser 2>/dev/null; true\r');
let s1 = null;
for (let i = 0; i < 10; i++) { await page.waitForTimeout(400); s1 = await tabs(); if (s1.rt?.windows?.length === 0 && s1.rt?.state === 'HIDDEN') break; }
check('①清残留→把手常在（0 窗 HANDLE）', s1?.state === 'HANDLE' && s1?.windows?.length === 0,
      `state=${s1?.state} wins=${s1?.windows?.length}`);
await inject('tmux new-session -d -s kfm-exam-browser -n alpha\r');
let s2 = null;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(400); s2 = await tabs(); if ((s2?.rt?.windows?.length ?? 0) > 0) break; }
check('②建会话→重试腿重连→HANDLE+alpha', s2?.kind === 'HANDLE' && (s2?.rt?.windows?.length ?? 0) > 0,
      `kind=${s2?.kind} wins=${JSON.stringify(s2?.rt?.windows?.map((w) => w.name))}`);
await inject('tmux set -w automatic-rename off -t kfm-exam-browser:alpha\r');
await page.waitForTimeout(400);

// ② T1 点把手→EXPANDED（attached=false 前置）
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
const s3 = await tabs();
check('③T1 展开→EXPANDED+attached=false', s3.kind === 'EXPANDED' && s3.rt?.attached === false,
      `kind=${s3.kind} attached=${s3.rt?.attached}`);

// ③ T3b：未附+点聚焦标签（alpha）=attach 进 tmux（状态行出现+alpha*）
const alphaId = s3.rt.windows.find((w) => w.name === 'alpha').id;
const t03 = Date.now();
await page.click(`[data-tmux-id="${alphaId}"]`);
const ok3 = await waitScreen((scr) => scr.includes('[kfm-exam-browser]') && scr.includes('alpha*'), 4000);
const t3bMs = Date.now() - t03;
const s3b = await tabs();
check('③T3b 未附点聚焦标签→attach 进 tmux（状态行+alpha*）',
      ok3 && s3b.rt?.attached === true && t3bMs <= 8000, // 端到端含中继开销；真机纯延迟实测 455ms
      `attach ${t3bMs}ms attached=${s3b.rt?.attached}`);

// ④ T5：＋建 beta（名字钉死）→聚焦新窗+收起回终端视图
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', 'beta');
await page.click('[data-tmux-confirm="1"]');
let s4 = null;
for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); s4 = await tabs(); if (s4.rt?.state === 'HANDLE') break; }
check('④T5 ＋建 beta→聚焦+收起', s4?.rt?.windows?.some((w) => w.name === 'beta') && s4?.rt?.state === 'HANDLE',
      `wins=${JSON.stringify(s4?.rt?.windows?.map((w) => w.name))} state=${s4?.rt?.state}`);

// ⑤ T1 再展开
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
const s5 = await tabs();
check('⑤T1 再展开（beta* 在屏）', s5.kind === 'EXPANDED' && (await screen()).includes('beta*'),
      `kind=${s5.kind}`);

// ⑥ T2：点非聚焦 alpha→切窗（alpha*）≤800ms+停 EXPANDED+attached 保持
const t06 = Date.now();
await page.click(`[data-tmux-id="${alphaId}"]`);
const ok6 = await waitScreen((scr) => scr.includes('alpha*'), 3000);
const t2ms = Date.now() - t06;
const s6 = await tabs();
check('⑥T2 已附点非聚焦→切窗（alpha*）≤800ms+停 EXPANDED',
      ok6 && t2ms <= 800 && s6.kind === 'EXPANDED' && s6.rt?.attached === true,
      `切窗 ${t2ms}ms kind=${s6.kind} attached=${s6.rt?.attached}`);

// ⑦ T3：点聚焦 beta→detach 回终端态（状态行消失+⚡+HANDLE+attached=false）
await page.click(`[data-tmux-id="${betaWinId(s6)}"]`);
const ok7 = await waitScreen((scr) => !scr.includes('[kfm-exam-browser]') && scr.includes('⚡'), 4000);
const s7 = await tabs();
check('⑦T3 点聚焦标签→detach 回终端态', ok7 && s7.rt?.attached === false && s7.rt?.state === 'HANDLE'
      && (await screen()).includes('⚡'),
      `attached=${s7.rt?.attached} kind=${s7.kind}`);
function betaWinId(s) { return s.rt.windows.find((w) => w.name === 'beta').id; }

// ⑧ T2a：脱附态点非聚焦标签→重新 attach+切窗（进出自由）
await page.click(`[data-tmux-id="${betaWinId(s7)}"]`);
const ok8 = await waitScreen((scr) => scr.includes('[kfm-exam-browser]') && scr.includes('beta*'), 4000);
const s8 = await tabs();
check('⑧T2a 脱附态点标签→重新 attach+切窗（beta*）', ok8 && s8.rt?.attached === true,
      `attached=${s8.rt?.attached}`);

// ⑨ T11 拖动：beta 拖过 alpha→推送顺序翻转
const bBox = await page.locator('[data-tmux-win="beta"]').boundingBox();
const aBox = await page.locator('[data-tmux-win="alpha"]').boundingBox();
if (bBox && aBox) {
  await page.mouse.move(bBox.x + 10, bBox.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.move(aBox.x + 10, aBox.y + 10, { steps: 8 });
  await page.mouse.up();
}
let s9 = null;
for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); s9 = await tabs(); if (s9.rt?.windows?.[0]?.name === 'beta') break; }
check('⑨T11 拖动换序→推送顺序翻转（beta 到首位）', s9?.rt?.windows?.[0]?.name === 'beta',
      `order=${JSON.stringify(s9?.rt?.windows?.map((w) => w.name))}`);

// ⑩ ×关窗流：点×→OVERLAY_CLOSE（确认前不杀）→确认→目标窗消失
const gammaBoxBefore = s9.rt.windows.length;
await page.click('[data-tmux-plus="1"]');
await page.fill('[data-tmux-new-name]', 'gamma');
await page.click('[data-tmux-confirm="1"]');
await page.waitForTimeout(800);
const s10a = await tabs();
await page.click('[data-tmux-close="gamma"]');
await page.waitForTimeout(300);
const ovShown = await page.evaluate(() => document.querySelector('[data-tmux-overlay]') !== null);
const gammaAliveBeforeConfirm = (await tabs()).rt.windows.some((w) => w.name === 'gamma');
await page.click('[data-tmux-confirm="1"]');
let s10 = null;
for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); s10 = await tabs(); if (!s10.rt?.windows?.some((w) => w.name === 'gamma')) break; }
check('⑩×关窗流：确认页拦截（禁令钉）+确认后消失', ovShown && gammaAliveBeforeConfirm
      && !s10?.rt?.windows?.some((w) => w.name === 'gamma'),
      `确认页=${ovShown} 确认前窗在=${gammaAliveBeforeConfirm} 确认后 wins=${s10?.rt?.windows?.length}（前 ${gammaBoxBefore}）`);

// ⑪ kernel 注册表 + 自观测环词汇表
const reg = await page.evaluate(() => window.__kfmNzKernel?.list?.() ?? null);
const s11 = await tabs();
const hist = s11.rt?.history ?? [];
const states = hist.map((h) => h.state);
const domNow = await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null);
check('⑪kernel 注册表+自观测环词汇表统一+末拍互证',
      Array.isArray(reg) && reg.includes('tmux-tabs') && states.length > 0
        && states.every((st) => ['HANDLE', 'EXPANDED', 'OVERLAY_NEW', 'OVERLAY_CLOSE'].includes(st))
        && states[states.length - 1] === domNow,
      `reg=${JSON.stringify(reg)} states=${JSON.stringify(states.slice(-5))} dom=${domNow}`);

// 清理
try { await inject('tmux kill-session -t kfm-exam-browser\r'); await page.waitForTimeout(800); } catch { /* 忽略 */ } finally { await browser.close(); }
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
process.exit(fails.length ? 1 : 0);
