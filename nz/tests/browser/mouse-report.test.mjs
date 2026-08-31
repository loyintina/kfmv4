/**
 * tests/browser/mouse-report.test.mjs — SGR 1006 鼠标上报 A 档标准
 * （term-contract 挂单转正；用户核心诉求：tmux attach 后滚轮/触摸可滚动）
 *
 * 场景=真 PTY + 真 tmux（独立 scrtest 会话，不碰 dsh）：
 *  ① attach 后滚轮上 → 服务端 pane_in_mode=1 且 scroll_position>0（进 copy-mode 翻历史）
 *  ② 滚轮下 → 回底（pane_in_mode=0）
 *  ③ WS 帧字节断言：含 \x1b[<64; / \x1b[<65;，坐标 1 基（不允许 0）
 *  ④ detach 回行模式 → 滚轮零鼠标帧、本地滚动照旧
 *  ⑤ ALT 无鼠标（?1049h 无 ?1000h）→ 滚轮零鼠标帧
 *  ⑥ 触摸拖拽合成（手机无滚轮）→ 发出 64/65 帧
 * 钩子契约：__kfmNzTermScroll().mouseMode（核模式位图）、__kfmNzTermInject
 */
import { launchBrowser } from './launch.mjs';
import { execSync } from 'node:child_process';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok?'✅':'❌'} ${name}${detail?' — '+detail:''}`); };
const tmux = (args) => execSync(`tmux ${args}`, { encoding: 'utf8' }).trim();

// ── 备 tmux 场景：独立会话 scrtest + 200 行历史 + mouse on（会话级，不碰全局）──
try { tmux('kill-session -t scrtest 2>/dev/null'); } catch {}
tmux('new-session -d -s scrtest -x 120 -y 40');
tmux('set-option -t scrtest mouse on');
tmux("send-keys -t scrtest 'seq 1 200' Enter");
await new Promise(r => setTimeout(r, 800));

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
// WS 发送帧采集（字节精确性判卷）：劫持 send，解 JSON 收 input 帧的 data
await page.addInitScript(() => {
  window.__inputFrames = [];
  const orig = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const j = JSON.parse(data);
      if (j && j.t === 'input') window.__inputFrames.push(j.data);
    } catch {}
    return orig.call(this, data);
  };
});
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);

const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject(x), t);
const frames = () => page.evaluate(() => { const f = window.__inputFrames.slice(); window.__inputFrames.length = 0; return f; });
const mouseMode = () => page.evaluate(() => window.__kfmNzTermScroll?.()?.mouseMode ?? null);
const wheelOver = async (deltaY, times = 1) => {
  // 锚滚动容器（scrollEl 恒在视口内）而非 .nz-term——行模式历史多时
  // termEl 是含全部历史的长条，几何中心会飞出视口，滚轮打空（修卷）
  const box = await page.evaluate(() => {
    const r = window.__kfmNzTermScroll().getContainer().getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < times; i++) { await page.mouse.wheel(0, deltaY); await page.waitForTimeout(60); }
};
const paneState = () => {
  try {
    const s = tmux("display-message -p -t scrtest '#{pane_in_mode} #{scroll_position}'");
    const [mode, pos] = s.split(' ');
    return { inMode: mode === '1', pos: Number(pos) || 0 };
  } catch { return { inMode: null, pos: null }; }
};
const pollPane = async (pred, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const s = paneState(); if (pred(s)) return s; await new Promise(r => setTimeout(r, 150)); }
  return paneState();
};

// ── attach scrtest ──
await inject('tmux attach -t scrtest\r');
await page.waitForTimeout(1500);
const mm = await mouseMode();
check('⓪ attach 后核鼠标模式置位（bit0=1）', mm !== null && (mm & 1) === 1, `mouseMode=${mm}`);

// ① 滚轮上 → copy-mode + scroll_position>0
await frames(); // 清零（attach 握手帧不判）
await wheelOver(-240, 5);
const up = await pollPane(s => s.inMode && s.pos > 0);
check('①滚轮上→tmux 进 copy-mode 且 scroll_position>0', up.inMode === true && up.pos > 0,
  `pane_in_mode=${up.inMode} scroll_position=${up.pos}`);

// ③ WS 帧字节断言（滚轮上段采集）
const upFrames = await frames();
const sgrUp = upFrames.filter(d => d.includes('\x1b[<64;'));
const oneBased = sgrUp.length > 0 && sgrUp.every(d => {
  const m = d.match(/\x1b\[<64;(\d+);(\d+)M/);
  return m && Number(m[1]) >= 1 && Number(m[2]) >= 1;
});
check('③a 滚轮上发出 SGR \\x1b[<64; 帧且坐标 1 基', sgrUp.length > 0 && oneBased,
  `64帧=${sgrUp.length} 样例=${JSON.stringify(sgrUp[0] ?? null)}`);

// ② 滚轮下 → 回底
await wheelOver(240, 10);
const down = await pollPane(s => !s.inMode);
check('②滚轮下→回底（pane_in_mode=0）', down.inMode === false, `pane_in_mode=${down.inMode}`);
const downFrames = await frames();
const sgrDown = downFrames.filter(d => d.includes('\x1b[<65;'));
check('③b 滚轮下发出 SGR \\x1b[<65; 帧', sgrDown.length > 0, `65帧=${sgrDown.length} 样例=${JSON.stringify(sgrDown[0] ?? null)}`);

// ⑥ 触摸拖拽合成（在 ALT+鼠标态做）：触控=拖内容惯例——下滑=拉历史=64，上滑=回新=65
await frames();
await page.evaluate(() => {
  const el = window.__kfmNzTermScroll().getContainer();
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const mk = (type, y) => new PointerEvent(type, { pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true });
  el.dispatchEvent(mk('pointerdown', r.top + 100));
  for (let y = 100; y <= 300; y += 25) el.dispatchEvent(mk('pointermove', r.top + y)); // 下滑 200px
  el.dispatchEvent(mk('pointerup', r.top + 300));
});
await page.waitForTimeout(300);
const touchFrames = await frames();
const t64 = touchFrames.filter(d => d.includes('\x1b[<64;'));
check('⑥a 触摸下滑拖拽→合成 64 帧（拖历史下来）', t64.length > 0, `64帧=${t64.length}`);
await page.evaluate(() => {
  const el = window.__kfmNzTermScroll().getContainer();
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const mk = (type, y) => new PointerEvent(type, { pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true });
  el.dispatchEvent(mk('pointerdown', r.top + 300));
  for (let y = 300; y >= 100; y -= 25) el.dispatchEvent(mk('pointermove', r.top + y)); // 上滑 200px
  el.dispatchEvent(mk('pointerup', r.top + 100));
});
await page.waitForTimeout(300);
const touchFrames2 = await frames();
const t65 = touchFrames2.filter(d => d.includes('\x1b[<65;'));
check('⑥b 触摸上滑拖拽→合成 65 帧（拖回新内容）', t65.length > 0, `65帧=${t65.length}`);
// ④ detach 回行模式 → 滚轮零鼠标帧 + 本地滚动照旧。
// detach 走服务端命令（两次真红教训：打字 detach 依赖 copy-mode 状态——
// 在 copy-mode 里被键位吞、不在则清场 q 污染命令行拼出 qtmux，都不确定）
try { tmux('detach-client -s scrtest'); } catch {}
await page.waitForTimeout(1200);
await inject('seq 1 100\r');
await page.waitForTimeout(1200);
await frames();
const scroll0 = await page.evaluate(() => { const s = window.__kfmNzTermScroll(); return { st: s.scrollTop, mm: s.mouseMode }; });
await wheelOver(-240, 3);
await page.waitForTimeout(300);
const lineFrames = await frames();
const lineMouse = lineFrames.filter(d => d.includes('\x1b[<6'));
const scroll1 = await page.evaluate(() => window.__kfmNzTermScroll().scrollTop);
check('④行模式滚轮→零鼠标帧+本地滚动照旧', lineMouse.length === 0 && scroll1 < scroll0.st,
  `鼠标帧=${lineMouse.length} scrollTop ${scroll0.st}→${scroll1} mouseMode=${scroll0.mm}`);

// ⑤ ALT 无鼠标 → 滚轮零鼠标帧
await page.evaluate(() => { const c = window.__kfmNzTermScroll().getContainer(); if (c) c.scrollTop = c.scrollHeight; });
await inject("printf '\\x1b[?1049h'; sleep 4\r");
await page.waitForTimeout(800);
await frames();
await wheelOver(-240, 3);
await page.waitForTimeout(300);
const altFrames = await frames();
const altMouse = altFrames.filter(d => d.includes('\x1b[<'));
check('⑤ALT 无鼠标（?1049h）→滚轮零鼠标帧', altMouse.length === 0, `鼠标帧=${altMouse.length}`);
await page.waitForTimeout(3500); // 等 sleep 4 退 ALT
await inject('\r');

await browser.close();
try { tmux('kill-session -t scrtest 2>/dev/null'); } catch {}
const allOk = results.every(r => r.ok);
console.log(`\n=== mouse-report A 档：${results.filter(r => r.ok).length}/${results.length} 通过 ===`);
process.exit(allOk ? 0 : 1);
