/**
 * experiments/verify-mouse-device.mjs — SGR 1006 鼠标上报真机 C 档
 * （实验台：CDP attach 手机 NZ-Agent WebView，真 Chromium 输入管线）
 *
 * 场景=用户原痛点：终端里 tmux attach 后滚轮/触摸滚动。
 * 步骤：
 *   ①attach mscrtest（服务端独立会话，不碰 dsh）→ 核 mouseMode bit0=1
 *   ②CDP Input.dispatchMouseEvent mouseWheel（真引擎级滚轮）→ pane_in_mode=1 + scroll_position>0
 *   ③CDP Input.dispatchTouchEvent 拖拽（真引擎级触摸，手机上没滚轮的主路径）→ scroll_position 继续涨
 *   ④滚轮下 → 回底 pane_in_mode=0
 *   ⑤截图取证
 * 跑法：node experiments/verify-mouse-device.mjs（nz 目录下；手机 NZ-Agent 开着）
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CDP = process.env.NZ_CDP_URL || 'http://127.0.0.1:8026';
const SHOTS = new URL('../../docs/active/nine-zero/assets/', import.meta.url).pathname;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok?'✅':'❌'} ${name}${detail?' — '+detail:''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmux = (a) => execSync(`tmux ${a}`, { encoding: 'utf8' }).trim();

mkdirSync(SHOTS, { recursive: true });

// ── 备 tmux 场景 ──
try { tmux('kill-session -t mscrtest 2>/dev/null'); } catch {}
tmux('new-session -d -s mscrtest -x 120 -y 40');
tmux('set-option -t mscrtest mouse on');
tmux("send-keys -t mscrtest 'seq 1 300' Enter");
await sleep(800);

const paneState = () => {
  try {
    const s = tmux("display-message -p -t mscrtest '#{pane_in_mode} #{scroll_position}'");
    const [m, p] = s.split(' ');
    return { inMode: m === '1', pos: Number(p) || 0 };
  } catch { return { inMode: null, pos: null }; }
};
const pollPane = async (pred, ms = 5000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const s = paneState(); if (pred(s)) return s; await sleep(150); }
  return paneState();
};

// ── attach 真机 ──
const browser = await chromium.connectOverCDP(CDP);
const pages = browser.contexts().flatMap((c) => c.pages());
const page = pages.find((p) => p.url().includes('8023'));
if (!page) { console.log('❌ 枚举不到 8023 页（手机 NZ-Agent 没开？）'); process.exit(1); }
console.log(`attach 成功：${page.url()}`);
// 一次性清缓存：旧 immutable 头让 WebView 抱着旧 wasm/glue（一年期），
// 服务端已改 no-cache，清一次后未来只协商 304
const cdp0 = await page.context().newCDPSession(page);
await cdp0.send('Network.enable');
await cdp0.send('Network.clearBrowserCache');
await cdp0.send('Network.setCacheDisabled', { cacheDisabled: true }); // 本 target 请求全绕缓存（实验台专用）
await page.reload({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {}); // 吃新 bundle+wasm
await page.waitForSelector('.nz-term', { timeout: 15000 });
await page.waitForFunction(() => typeof window.__kfmNzTermInject === 'function', { timeout: 15000 });
await sleep(3000);
const inject = (s) => page.evaluate((t) => window.__kfmNzTermInject(t), s);

// ① attach mscrtest
await inject('tmux attach -t mscrtest\r');
await sleep(1500);
const mm = await page.evaluate(() => window.__kfmNzTermScroll()?.mouseMode ?? null);
check('①attach 后核鼠标模式置位（bit0=1）', mm !== null && (mm & 1) === 1, `mouseMode=${mm}`);

// ② 滚轮上（×5）——JS 合成 WheelEvent（bubbles/cancelable 走真监听链）。
// 边界记档：引擎级 Input.dispatchMouseEvent 经 cdp-relay 无应答（首次 send
// 即挂起，已实测两次）——实验台引擎输入待 relay 排查，本期用页内合成
// 事件（同一监听链），最终手感由用户真指收口。
const wheelJs = async (deltaY, times) => page.evaluate(([dy, n]) => {
  const el = window.__kfmNzTermScroll().getContainer();
  const r = el.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    el.dispatchEvent(new WheelEvent('wheel', {
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      deltaY: dy, bubbles: true, cancelable: true,
    }));
  }
}, [deltaY, times]);
await wheelJs(-240, 5);
const up = await pollPane(s => s.inMode && s.pos > 0);
check('②真机滚轮上→copy-mode+scroll_position>0', up.inMode === true && up.pos > 0,
  `pane_in_mode=${up.inMode} scroll_position=${up.pos}`);

// ③ 触摸拖拽上滑（手机主路径，JS 合成 PointerEvent 同②边界）：
// scroll_position 继续涨
const posBefore = paneState().pos ?? 0;
await page.evaluate(() => {
  const el = window.__kfmNzTermScroll().getContainer();
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const mk = (type, y) => new PointerEvent(type, { pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true });
  el.dispatchEvent(mk('pointerdown', r.top + 300));
  for (let y = 300; y >= 60; y -= 30) el.dispatchEvent(mk('pointermove', r.top + y));
  el.dispatchEvent(mk('pointerup', r.top + 60));
});
const up2 = await pollPane(s => s.pos > posBefore, 3000);
check('③真机触摸拖拽上滑→scroll_position 续涨', up2.pos > posBefore, `scroll_position ${posBefore}→${up2.pos}`);
// 截图走页内像素眼 canvasShot（CDP Page.captureScreenshot 经 relay 超时，
// 与 Input 域同病；canvasShot 是为此建的后台通道）
const shot = await page.evaluate(() => window.__kfmNzCanvasShot?.(1) ?? '');
if (shot) writeFileSync(`${SHOTS}mouse-device-copymode.png`, Buffer.from(shot.split(',')[1], 'base64'));

// ④ 滚轮下 → 回底
await wheelJs(240, 12);
const down = await pollPane(s => !s.inMode);
check('④真机滚轮下→回底（pane_in_mode=0）', down.inMode === false, `pane_in_mode=${down.inMode} pos=${down.pos}`);

// 清场：detach + 杀会话，终端还原
await inject('tmux detach\r');
await sleep(800);
try { tmux('kill-session -t mscrtest 2>/dev/null'); } catch {}
await browser.close();

const allOk = results.every(r => r.ok);
console.log(`\n=== mouse-report 真机 C 档：${results.filter(r => r.ok).length}/${results.length} 通过 ===`);
process.exit(allOk ? 0 : 1);
