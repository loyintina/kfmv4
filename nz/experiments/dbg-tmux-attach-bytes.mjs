/**
 * experiments/dbg-tmux-attach-bytes.mjs — 洪峰字节时间线测量
 * （2026-08-30 用户追问：omp/opencode/dsh 全都疯狂滚动；提案「直接把
 * 最尾部信息替换贴上」——先量清瓶颈在源还是在我们）
 *
 * 方法：addInitScript 劫持 WebSocket 构造（统计每个连接的 message 数/
 * 字节数/时间戳），reload 前台页（nz 有续命 attach，reload 不掉会话），
 * 注入 tmux attach -t dsh，100ms 采样字节曲线+屏幕收敛状态。
 * 判读：
 *   - 字节 1-2s 内到齐、屏幕 10s+ 还在变 = 我们渲染慢 → 节流渲染有效；
 *   - 字节本身 10s+ 才滴完 = 源（kimi/tmux 服务端）慢 → 节流只能改观感。
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const CDP = process.env.NZ_CDP_URL || 'http://127.0.0.1:8026';
const tmux = (a) => { try { return execSync(`tmux ${a}`, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.connectOverCDP(CDP);
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

await page.addInitScript(() => {
  window.__wsStats = { msgs: 0, bytes: 0, lastAt: 0, startedAt: Date.now(), log: [] };
  const OrigWS = window.WebSocket;
  window.WebSocket = class extends OrigWS {
    constructor(...a) {
      super(...a);
      this.addEventListener('message', (ev) => {
        const n = typeof ev.data === 'string' ? ev.data.length : (ev.data?.byteLength ?? 0);
        const s = window.__wsStats;
        s.msgs++; s.bytes += n; s.lastAt = Date.now();
        if (s.log.length < 4000) s.log.push([Date.now() - s.startedAt, n]);
      });
    }
  };
});
await page.reload({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 });
await page.waitForFunction(() => typeof window.__kfmNzTermInject === 'function', { timeout: 15000 });
await sleep(3000);

const clientsBefore = tmux('list-clients -t dsh -F "#{client_tty}"');
console.log('dsh pane:', tmux("display-message -p -t dsh '#{pane_width}x#{pane_height} 历史=#{history_size}'"));

// 重置统计起点（去掉 reload 握手的噪声）
await page.evaluate(() => { window.__wsStats.msgs = 0; window.__wsStats.bytes = 0; window.__wsStats.log = []; window.__wsStats.t0 = Date.now(); });
console.log('>>> 注入 tmux attach -t dsh');
await page.evaluate(() => window.__kfmNzTermInject('tmux attach -t dsh\r'));

const t0 = Date.now();
const samples = [];
while (Date.now() - t0 < 20000) {
  const s = await page.evaluate(() => {
    const st = window.__wsStats;
    const txt = window.__kfmNzTermScreen();
    return { msgs: st.msgs, bytes: st.bytes, lastAgo: Date.now() - st.lastAt, len: txt.length,
      tail: txt.split('\n').filter(l => l.trim()).slice(-2).map(l => l.trim().slice(0, 30)).join(' | ') };
  }).catch(() => null);
  if (s) samples.push({ t: Date.now() - t0, ...s });
  await sleep(150);
}

// 收敛后静置 3s 再读一次终态
await sleep(3000);
const fin = await page.evaluate(() => ({ msgs: window.__wsStats.msgs, bytes: window.__wsStats.bytes }));
await browser.close();

// 清场：detach 自己
const clientsAfter = tmux('list-clients -t dsh -F "#{client_tty}"');
const before = new Set(clientsBefore.split('\n').map(l => l.trim()).filter(Boolean));
for (const tty of clientsAfter.split('\n').map(l => l.trim()).filter(t => t && !before.has(t))) {
  tmux(`detach-client -t ${tty}`);
}

console.log('\n=== 字节时间线（150ms/帧，20s 窗）===');
for (const s of samples) {
  console.log(`${String(s.t).padStart(6)}ms  msgs=${String(s.msgs).padStart(5)}  bytes=${String(s.bytes).padStart(8)}  静默=${String(s.lastAgo).padStart(5)}ms  screen=${s.len}  | ${s.tail}`);
}
console.log(`\n终态：msgs=${fin.msgs} bytes=${fin.bytes}（${(fin.bytes / 1024).toFixed(0)}KB）`);
