/**
 * tests/browser/float-grid-mismatch-repro.mjs — 浮窗挤画回归考卷
 * （2026-09-12 用户报「kimi 输出时浮窗被状态等待条反复往上刷」）。
 *
 * 案情与根因（修复前 A/B 定罪卷宗，考卷 v1-v3）：
 *   e17c8e5b 把浮窗管道按主格网拉起（73 列），但浮窗渲染卡仍按自身容
 *   器量列（~54 列），提交信息声称的「挤画」无实现 → 格网错位。全宽
 *   状态行在窄核里逐帧折行=重绘定位全错，屏面剧烈搅动（churn 211 行次
 *   /6s vs 对齐对照 11 行次/6s，A/B 分离定罪）。
 *
 * 修复合同（v4 起断言的终态）：
 *   ① bind 收编：浮窗卡格网恒=拉起时管道格网（73×46），与容器测量无关
 *   ② 挤画生效：paintScale<1（壳 scaleX 压进浮窗宽度）
 *   ③ 刷屏消失：同一满宽横幅+spinner 负载下搅动 ≤18 行次/6s（只动
 *     spinner 行）；修复前错位页同负载=211
 *   ④ 双列覆盖：73×46（真机格网）与 54×46（窄容器格网）两页都过
 *
 * 观测手段：Playwright 驱动真 bundle 隔离实例（NZ_FS_ROOTS 隔离，真
 * tmux 夹具），读 __kfmNzTermScroll() 的 cols/rows/paintScale + 屏文本
 * 搅动度；截屏存 lab/device-agent/build/float-squeeze-A.png。
 * 跑法：先 npm run build，再 node tests/browser/float-grid-mismatch-repro.mjs
 */
import { spawn, execSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from './launch.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

// ---------- 隔离实例（browser-organ 同款骨架） ----------
const FIX = await mkdtemp(join(tmpdir(), 'nz-fspam-'));
let PORT = 8189;
const freePort = async (p) => await fetch(`http://127.0.0.1:${p}/healthz`).then(() => false).catch(() => true);
while (!(await freePort(PORT))) PORT++;
const srv = spawn(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['src/server/index.ts'], {
  cwd: process.cwd(), detached: true,
  env: { ...process.env, TMUX: '', NZ_PORT: String(PORT), NZ_NO_BELL_HOOK: '1', NZ_FS_ROOTS: FIX, NZ_AI_CONFIG_DIR: join(FIX, '.ai'), NZ_GATE_DIR: join(FIX, '.gate') },
  stdio: ['ignore', 'ignore', 'ignore'],
});
const tmux = (a) => { try { execSync(`tmux ${a}`, { stdio: 'ignore' }); return true; } catch { return false; } };
tmux('kill-session -t nzspamA 2>/dev/null'); tmux('kill-session -t nzspamB 2>/dev/null');
let up = false;
for (let t = 0; t < 30000; t += 300) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`, { cache: 'no-store' }); if (r.ok) { up = true; break; } } catch { /* 未起 */ }
  await sleep(300);
}
check('⓪隔离实例起（healthz）', up, `port=${PORT}`);
const BASE = `http://127.0.0.1:${PORT}`;

const browser = await launchBrowser();

/** 开一页浮窗专态，等出生附着（tmux 管道真换绑）完成 */
async function openFloat(grid, sess) {
  const ctx = await browser.newContext({ viewport: { width: 300, height: 700 } });
  const page = await ctx.newPage();
  await page.addInitScript((g) => localStorage.setItem('kfmMainGrid', JSON.stringify(g)), grid);
  await page.goto(`${BASE}/?float=1&fs=${sess}&nosplash`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  await page.waitForFunction(() => typeof (window).__kfmNzTermScroll === 'function', null, { timeout: 20000, polling: 250 }).catch(() => {});
  // 出生附着门闩：必须等 tmux 管道真换绑（attached===sess）——sessionId
  // 在出生 zsh 管道时就不为空，等它=提前放行（v2 假阴性教训）
  await page.waitForFunction(
    (s) => (window).__kfmBrowserFloat && (window).__kfmBrowserFloat().attached === s,
    sess, { timeout: 20000, polling: 250 },
  ).catch(() => {});
  const st = await page.evaluate(() => {
    const s = (window).__kfmNzTermScroll();
    return { cols: s.cols, rows: s.rows, paintScale: s.paintScale };
  });
  return { ctx, page, ...st };
}

/** 往会话塞「40 行满宽横幅 + 满宽状态行重绘负载」（@~8Hz，模拟 kimi
 *  整屏内容+状态条）。外层 sh 单引号直投：$ 不转义、\r\033[K 原样进
 *  pane 由 printf 解释。 */
function startLoad(sess) {
  tmux(`send-keys -t ${sess} 'C=$(tput cols); for j in $(seq 40); do printf "%*s\\n" $((C-3)) "BANNER-$j"; done; i=0; while true; do i=$((i+1)); printf "\\r\\033[K%*s" $((C-3)) "DELIB-$i"; sleep 0.12; done' Enter`);
}

/** 采样 6s：搅动度（相邻两拍不同行数）。ALT 屏下 histLen 恒 0 是设计内
 *  （v3 教训：tmux 客户端帧带 ?1049h，histLen/scrollHeight 全盲）——唯一
 *  有效刷屏指纹=屏内容搅动速率：pane 服务端每拍只动 1 行，卡片搅动越大
 *  =错位重排越凶。 */
async function sample(page, sess) {
  const shots = [];
  for (let i = 0; i < 12; i++) {
    shots.push(await page.evaluate(() => (window).__kfmNzTermScreen()));
    await sleep(500);
  }
  let churn = 0;
  for (let k = 1; k < shots.length; k++) {
    const a = shots[k - 1].split('\n'), b = shots[k].split('\n');
    for (let r = 0; r < Math.max(a.length, b.length); r++) if ((a[r] ?? '') !== (b[r] ?? '')) churn++;
  }
  // L2 互证：服务器侧 pane 真容（负载是否真进了会话）
  let pane = '';
  try { pane = execSync(`tmux capture-pane -p -t ${sess} 2>/dev/null | tail -3`).toString().replace(/\s+$/, ''); } catch { pane = '(capture 失败)'; }
  console.log(`[pane-server] ${sess} 尾 3 行：${JSON.stringify(pane.slice(-160))}`);
  return { churn, screen: shots[shots.length - 1] };
}

// ---------- A：真机格网（73×46），300px 窄容器 → 必收编+必挤画 ----------
console.log('\n===== A：主格网 73×46（修复合同①②③） =====');
const A = await openFloat({ c: 73, r: 46 }, 'nzspamA');
check('A① 格网收编（卡=管道 73×46，与容器测量无关）', A.cols === 73 && A.rows === 46, `cols=${A.cols} rows=${A.rows}`);
// ② v5 字号拟合案：壳自然宽必须 ≤ 容器（字号被反解到放得下为止），
// 字号必须 <10（拟合真发生了）；transform 挤画降级为残余微调（≈1）
const fit = await A.page.evaluate(() => {
  const el = document.querySelector('.nz-term');
  const pw = el.parentElement.clientWidth;
  return { w: Math.round(el.getBoundingClientRect().width), pw, fs: +getComputedStyle(el).fontSize.replace('px', ''), ps: (window).__kfmNzTermScroll().paintScale };
});
check('A② 字号拟合（视觉宽≤容器+6、字号<10）', fit.w <= fit.pw + 6 && fit.fs < 10, `w=${fit.w} pw=${fit.pw} fs=${fit.fs} paintScale=${fit.ps}`);
startLoad('nzspamA');
await sleep(1200);
const ra = await sample(A.page, 'nzspamA');
console.log(`[A] 搅动度=${ra.churn} 行次/6s`);
check('A③ 刷屏消失（搅动 ≤18 行次/6s；修复前错位页=211）', ra.churn <= 18, `churn=${ra.churn}`);
await A.page.screenshot({ path: 'lab/device-agent/build/float-squeeze-A.png' }).catch(() => {});

// ---------- B：窄格网（54×46），同窗宽 → 收编后同样静止 ----------
console.log('\n===== B：主格网 54×46（修复合同④双列覆盖） =====');
const B = await openFloat({ c: 54, r: 46 }, 'nzspamB');
check('B① 格网收编（卡=管道 54×46）', B.cols === 54 && B.rows === 46, `cols=${B.cols} rows=${B.rows}`);
startLoad('nzspamB');
await sleep(1200);
const rb = await sample(B.page, 'nzspamB');
console.log(`[B] 搅动度=${rb.churn} 行次/6s`);
check('B② 同样静止（搅动 ≤18 行次/6s）', rb.churn <= 18, `churn=${rb.churn}`);

// ---------- ⑤ ratchet 反向钉（2026-09-12 竖直变形案第二案） ----------
// v1 棘轮：按当前字号解比值 + min(...,1) 封顶 = 字号只能缩不能涨——
// 瞬态小容器踩到钳底后永世不得翻身（真机「文字超格挤在一起」根因）。
// 钉：容器由小变大后字号必须能涨回去（对称拟合）。
const fsSmall = await A.page.evaluate(() => +getComputedStyle(document.querySelector('.nz-term')).fontSize.replace('px', ''));
await A.page.setViewportSize({ width: 500, height: 900 });
await sleep(2500); // RO→scheduleResize(150ms 防抖)→fitFloatFont
const fitBig = await A.page.evaluate(() => {
  const el = document.querySelector('.nz-term');
  return { fs: +getComputedStyle(el).fontSize.replace('px', ''), w: Math.round(el.getBoundingClientRect().width), pw: el.parentElement.clientWidth };
});
check('⑤ ratchet 反向（容器变大字号必须涨回，且仍贴合容器）', fitBig.fs > fsSmall + 0.5 && fitBig.w <= fitBig.pw + 6, `fs ${fsSmall}→${fitBig.fs}, w=${fitBig.w} pw=${fitBig.pw}`);

// ---------- 裁决 ----------
console.log('\n===== 裁决 =====');
const pass = results.every(Boolean);
console.log(pass ? '[裁决] 挤画合同成立：格网收编+挤画生效+刷屏消失' : '[裁决] 合同有红项——看上方数据');

// ---------- 清场 ----------
await A.ctx.close(); await B.ctx.close();
await browser.close().catch(() => {});
tmux('kill-session -t nzspamA 2>/dev/null'); tmux('kill-session -t nzspamB 2>/dev/null');
try { process.kill(-srv.pid, 'SIGKILL'); } catch { /* 已死即达意 */ }
process.exit(pass ? 0 : 1);
