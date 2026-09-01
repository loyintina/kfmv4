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
