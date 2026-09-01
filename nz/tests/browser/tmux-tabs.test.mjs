/**
 * tests/browser/tmux-tabs.test.mjs — tmux 标签条 A 档考题（宪法 §6 Step 2
 * client 侧，2026-09-01）。全真链路：真服务器 + 真 tmux + 真 WS。
 *
 * 考试会话 kfm-exam-browser 由**页面自身 PTY 注入**创建（P0 钩子的
 * 战斗应用）——考卷进程在手机上，tmux 在服务器上，注入即远程建会话。
 *
 * 钉五件：
 *   ①无会话→标签条隐藏（tmux-exit→hidden 语义）
 *   ②注入建会话→3s 重试腿重开通道→把手出现+展开见 alpha 标签
 *   ③注入 new-window→推送刷新 beta 标签出现
 *   ④点 alpha 标签→select 帧发出（lastSelected）+推送回 active 位翻转
 *   ⑤kernel 注册表在案（tmux-tabs 挂宪法 §1 契约）
 *
 * 跑法：手机 proot，KFM_NZ_URL=http://127.0.0.1:8023/。
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

// ① 无会话→隐藏：先清上一轮残留（崩卷可能留下考试会话）——经页面
// PTY 杀掉，等 tmux-exit 推送→hidden（顺带钉 exit→隐藏语义）
await inject('tmux kill-session -t kfm-exam-browser 2>/dev/null; true\r');
let s1 = null;
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(500);
  s1 = await tabs();
  if (s1.kind === 'hidden') break;
}
check('①无会话→标签条隐藏（hidden 语义）', s1.kind === 'hidden' && s1.rt?.visible === false,
      `kind=${s1.kind} visible=${s1.rt?.visible}`);

// ② 注入建会话→重试腿重开→把手/标签出现
await inject('tmux new-session -d -s kfm-exam-browser -n alpha\r');
let s2 = null;
for (let i = 0; i < 24; i++) { // 最多 12s（3s 重试腿 + 推送）
  await page.waitForTimeout(500);
  s2 = await tabs();
  if (s2.kind === 'handle' || s2.kind === 'bar') break;
}
check('②注入建会话→重试腿重开通道→标签条出现', s2?.kind === 'handle' || s2?.kind === 'bar',
      `kind=${s2?.kind} wins=${JSON.stringify(s2?.rt?.windows?.map((w) => w.name))}`);

// ③ 展开标签排（点把手）
if (s2?.kind === 'handle') {
  await page.click('[data-tmux-tabs="handle"]');
  await page.waitForTimeout(300);
}
const s3 = await tabs();
check('③点把手→展开标签排（alpha 标签在列）', s3.kind === 'bar' && s3.rt?.windows?.some((w) => w.name === 'alpha'),
      `kind=${s3.kind} wins=${JSON.stringify(s3.rt?.windows?.map((w) => w.name))}`);

// ④ 注入 new-window→推送 beta 标签
await inject('tmux new-window -t kfm-exam-browser -n beta\r');
let s4 = null;
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(500);
  s4 = await tabs();
  if (s4.rt?.windows?.some((w) => w.name === 'beta')) break;
}
check('④注入 new-window→推送刷新 beta 标签', s4?.rt?.windows?.some((w) => w.name === 'beta'),
      `wins=${JSON.stringify(s4?.rt?.windows?.map((w) => w.name))}`);

// ⑤ 点 alpha 标签→select 发出+active 位翻转（推送回证）
const alphaId = s4.rt.windows.find((w) => w.name === 'alpha').id;
const chip = page.locator(`[data-tmux-id="${alphaId}"]`);
await chip.click();
let s5 = null;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400);
  s5 = await tabs();
  const a = s5.rt?.windows?.find((w) => w.id === alphaId);
  if (a?.active === true) break;
}
check('⑤点 alpha 标签→select 发出+active 位翻转（推送回证）',
      s5.rt?.lastSelected === alphaId && s5.rt?.windows?.find((w) => w.id === alphaId)?.active === true,
      `lastSelected=${s5.rt?.lastSelected} target=${alphaId}`);

// ⑥ kernel 注册表在案
const reg = await page.evaluate(() => window.__kfmNzKernel?.list?.() ?? null);
check('⑥kernel 注册表在案（tmux-tabs 挂宪法契约）', Array.isArray(reg) && reg.includes('tmux-tabs'),
      `list=${JSON.stringify(reg)}`);

// 清理考试会话（经页面 PTY，考卷进程不需要 tmux CLI）——崩卷也不残留
try {
  await inject('tmux kill-session -t kfm-exam-browser\r');
  await page.waitForTimeout(800);
} finally {
  await browser.close();
}
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
process.exit(fails.length ? 1 : 0);
