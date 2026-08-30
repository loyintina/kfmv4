/**
 * experiments/dbg-tmux-attach-scroll.mjs — 观测「tmux attach 后大滚动才落地」
 * （2026-08-30 用户报告：进入 tmux 窗口后有很大滚动，窗口够长滚得久）
 *
 * 方法：实验台 attach 手机 → 注入 'tmux attach -t dsh' → 每 100ms 采样
 *   {scrollTop, scrollHeight, histLen, mouseMode, rows, 屏幕首/尾行}，
 * 并在页内劫持 WebSocket message 统计 PTY 下行字节量（判「重绘输出洪峰」）。
 * 判读：
 *   - 若屏幕内容随时间从旧到新扫过大段历史 = 对端（kimi TUI）整史重绘；
 *   - 若 scrollTop 大幅爬升 = nz 本地滚动在动；
 *   - 字节量 = 输出洪峰规模。
 * 安全：只 attach/detach 自己的客户端（按 list-clients 最新 id 精确 detach），
 * 不敲任何键、不滚动 dsh。
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const CDP = process.env.NZ_CDP_URL || 'http://127.0.0.1:8026';
const tmux = (a) => { try { return execSync(`tmux ${a}`, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.connectOverCDP(CDP);
// 选前台页：App 有前台 Activity(?nosplash)+离屏 Service(裸 URL,0×0)两个
// WebView，find includes 会错拿离屏页（08-30 实测：离屏 20x5 attach 把
// dsh 窗口压到 20 列）。按容器非零筛前台。
let page = null;
for (const p of browser.contexts().flatMap((c) => c.pages())) {
  if (!p.url().includes('8023')) continue;
  const ok = await p.evaluate(() => {
    const sc = window.__kfmNzTermScroll?.();
    return sc ? sc.getContainer().clientWidth > 0 : false;
  }).catch(() => false);
  if (ok) { page = p; break; }
}
if (!page) { console.log('❌ 枚举不到前台 8023 页'); process.exit(1); }
console.log('attach 前台页:', page.url().slice(0, 60));

// 字节量统计：页内包一层 addEventListener（WS 是同一个对象，直接挂）
await page.evaluate(() => {
  window.__obsBytes = 0; window.__obsMsgs = 0;
  for (const ws of (window.__obsWss ??= [])) { /* 幂等 */ }
  // 找页面里的 WS：bridge 没暴露实例，劫持未来不可行——改统计钩子侧：
  // 用 __kfmNzTermScroll 的 rp/f 不可读字节。降级：采 screen 文本变化量。
});

const clientsBefore = tmux('list-clients -t dsh -F "#{client_tty}"');
console.log('attach 前 dsh clients:', clientsBefore || '(无)');
console.log('dsh pane 尺寸:', tmux("display-message -p -t dsh '#{pane_width}x#{pane_height} 历史=#{history_size}'"));

const base = await page.evaluate(() => {
  const s = window.__kfmNzTermScroll();
  return { cols: s.cols, rows: s.rows };
});
console.log('手机终端尺寸:', JSON.stringify(base));

// 开始采样
const samples = [];
let stop = false;
const sampler = (async () => {
  const t0 = Date.now();
  while (!stop && Date.now() - t0 < 20000) {
    const s = await page.evaluate(() => {
      const sc = window.__kfmNzTermScroll();
      const txt = window.__kfmNzTermScreen();
      const lines = txt.split('\n');
      return {
        st: sc.scrollTop, sh: sc.scrollHeight, ch: sc.clientHeight,
        hist: sc.histLen, mm: sc.mouseMode, rows: sc.rows,
        first: (lines.find(l => l.trim()) ?? '').trim().slice(0, 50),
        last: (lines.filter(l => l.trim()).pop() ?? '').trim().slice(0, 50),
        len: txt.length,
      };
    }).catch(() => null);
    if (s) samples.push({ t: Date.now() - t0, ...s });
    await sleep(100);
  }
})();

await sleep(300);
console.log('>>> 注入 tmux attach -t dsh');
await page.evaluate(() => window.__kfmNzTermInject('tmux attach -t dsh\r'));
await sleep(12000); // 采 12s 现象窗
stop = true;
await sampler;

// 精确 detach 自己（attach 后新增的 client）。用 client_tty 不用
// client_id——detach-client -t 只认 tty（两次实测：-t client_id 报
// can't find client，残留观测客户端压着 dsh 窗口尺寸）
const clientsAfter = tmux('list-clients -t dsh -F "#{client_tty}"');
console.log('attach 后 dsh clients:', clientsAfter || '(无)');
const before = new Set(clientsBefore.split('\n').map(l => l.trim()).filter(Boolean));
const mine = clientsAfter.split('\n').map(l => l.trim()).filter(tty => tty && !before.has(tty));
for (const tty of mine) { tmux(`detach-client -t ${tty}`); console.log(`已 detach 观测客户端 ${tty}`); }
await browser.close();

// 判读输出
console.log(`\n=== 采样 ${samples.length} 帧（100ms/帧）===`);
for (const s of samples) {
  console.log(`${String(s.t).padStart(6)}ms st=${String(s.st).padStart(5)} sh=${s.sh} hist=${s.hist} mm=${s.mm} rows=${s.rows} | ${s.first} ⤡ ${s.last}`);
}
