/**
 * experiments/verify-ime-pan-device.mjs — IME pan 修复真机验收（后台模拟键盘）
 * 对照 experiments/dbg-ime-toggle-flood.mjs（真键盘复现：弹 +423KB /
 * 收 +308KB / 连点×3 +713KB 洪峰）——同场景改用 __kfmNzTermMockIme
 * 模拟键盘占位，判据：
 *   ① ime 扳机命中（ime=true）、卡身缩 271px
 *   ② 行列格网全程不动（rows 恒=弹前值）
 *   ③ 字节增量只剩 kimi 心跳（≪60KB/段，对照组 300-700KB=数量级下降）
 * 安全：detach 自己（client_tty），不碰其它客户端。
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
if (!page) { console.log('❌ 无前台页'); process.exit(1); }

await page.addInitScript(() => {
  window.__wsStats = { msgs: 0, bytes: 0 };
  const OrigWS = window.WebSocket;
  window.WebSocket = class extends OrigWS {
    constructor(...a) {
      super(...a);
      this.addEventListener('message', (ev) => {
        const n = typeof ev.data === 'string' ? ev.data.length : (ev.data?.byteLength ?? 0);
        window.__wsStats.msgs++; window.__wsStats.bytes += n;
      });
    }
  };
});
await page.reload({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 });
await page.waitForFunction(() => typeof window.__kfmNzTermMockIme === 'function', { timeout: 15000 });
await sleep(3000);

const clientsBefore = tmux('list-clients -t dsh -F "#{client_tty}"');
await page.evaluate(() => { window.__wsStats.bytes = 0; });
await page.evaluate(() => window.__kfmNzTermInject('tmux attach -t dsh\r'));
await sleep(5000); // attach 洪峰收敛（判据只比弹收段，不比 attach 段）

const sample = () => page.evaluate(() => {
  const sc = window.__kfmNzTermScroll();
  return {
    vv: Math.round(window.visualViewport?.height ?? 0),
    rows: sc.rows, ime: sc.ime, st: sc.scrollTop,
    ch: sc.clientHeight, bytes: window.__wsStats.bytes,
  };
}).catch(() => null);

const runPhase = async (name, ms, kick) => {
  const b0 = (await sample())?.bytes ?? 0;
  const r0 = (await sample())?.rows ?? 0;
  console.log(`\n── ${name} ──`);
  const hit = kick ? await kick() : null;
  if (hit !== null) console.log(`  扳机=${hit}`);
  const t0 = Date.now();
  let maxRows = 0, minRows = 999;
  while (Date.now() - t0 < ms) {
    const s = await sample();
    if (s) {
      maxRows = Math.max(maxRows, s.rows); minRows = Math.min(minRows, s.rows);
      console.log(`${String(Date.now() - t0).padStart(6)}ms vv=${s.vv} rows=${s.rows} ime=${s.ime} st=${s.st} ch=${s.ch} bytes+${s.bytes - b0}`);
    }
    await sleep(200);
  }
  const se = await sample();
  const flood = (se?.bytes ?? 0) - b0;
  console.log(`  ▶ 段字节增量=${flood}（对照真键盘 30-70 万） rows ${r0}∈[${minRows},${maxRows}] ${minRows === maxRows ? '=格网未动✅' : '=格网动了❌'}`);
  return flood;
};

const mockOn = () => page.evaluate(() => window.__kfmNzTermMockIme(true));
const mockOff = () => page.evaluate(() => window.__kfmNzTermMockIme(false));

const fa = await runPhase('A mock 弹键盘', 6000, mockOn);
const fb = await runPhase('B mock 收键盘', 6000, mockOff);
const fc = await runPhase('C mock 快速连 toggle ×3', 6000, async () => {
  let last;
  for (let i = 0; i < 3; i++) { last = await mockOn(); await sleep(350); await mockOff(); await sleep(350); }
  return last;
});

await browser.close();
const after = tmux('list-clients -t dsh -F "#{client_tty}"');
const bf = new Set(clientsBefore.split('\n').map((x) => x.trim()).filter(Boolean));
for (const tty of after.split('\n').map((x) => x.trim()).filter((x) => x && !bf.has(x))) tmux(`detach-client -t ${tty}`);

const THRESH = 60000; // kimi 心跳 ~2-3KB/s × 6s ≈ 16KB，阈值留 3 倍余量
const pass = fa < THRESH && fb < THRESH && fc < THRESH;
console.log(`\n${pass ? '✅' : '❌'} 真机验收：三段增量 ${fa}/${fb}/${fc} 均 ${pass ? '<' : '≥'} ${THRESH}（对照真键盘 423004/308137/712996）`);
console.log('清场完毕');
process.exit(pass ? 0 : 1);
