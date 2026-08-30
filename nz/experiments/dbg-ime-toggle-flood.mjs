/**
 * experiments/dbg-ime-toggle-flood.mjs — 复现「召唤/关闭输入法也疯狂滚动」
 * （2026-08-30 用户报告：attach 后先追尾部、~1s 后疯狂滚动 3-5s；
 * 召唤/关闭输入法同样触发，快速连点更长）
 * 假说：键盘弹收 → vv 高度变 → rows 重测 → PTY/tmux resize → SIGWINCH
 * → kimi 整史重绘洪峰。每次 toggle 一次洪峰，连点=洪峰叠加。
 *
 * 方法：实验台 attach 前台页（带 WS 字节统计）→ attach dsh 收敛后：
 *   A: kb.focus()（=召唤输入法同路）采 8s
 *   B: kb.blur()  采 8s
 *   C: 快速连 toggle ×3 采 12s
 * 采样：vv 高度/rows/scrollTop/字节量/屏长（150ms）。
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
  window.__wsStats = { msgs: 0, bytes: 0, lastAt: 0 };
  const OrigWS = window.WebSocket;
  window.WebSocket = class extends OrigWS {
    constructor(...a) {
      super(...a);
      this.addEventListener('message', (ev) => {
        const n = typeof ev.data === 'string' ? ev.data.length : (ev.data?.byteLength ?? 0);
        const s = window.__wsStats; s.msgs++; s.bytes += n; s.lastAt = Date.now();
      });
    }
  };
});
await page.reload({ waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 });
await page.waitForFunction(() => typeof window.__kfmNzTermInject === 'function', { timeout: 15000 });
await sleep(3000);

const clientsBefore = tmux('list-clients -t dsh -F "#{client_tty}"');
await page.evaluate(() => { window.__wsStats.msgs = 0; window.__wsStats.bytes = 0; });
await page.evaluate(() => window.__kfmNzTermInject('tmux attach -t dsh\r'));
await sleep(5000); // 收敛

const sample = () => page.evaluate(() => {
  const sc = window.__kfmNzTermScroll();
  return {
    vv: Math.round(window.visualViewport?.height ?? 0),
    rows: sc.rows, st: sc.scrollTop, sh: sc.scrollHeight,
    bytes: window.__wsStats.bytes, len: window.__kfmNzTermScreen().length,
    focus: (document.activeElement?.className ?? '').slice(0, 20),
  };
}).catch(() => null);

const runPhase = async (name, ms, kick) => {
  const b0 = (await sample())?.bytes ?? 0;
  console.log(`\n── ${name} ──`);
  if (kick) await kick();
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await sample();
    if (s) console.log(`${String(Date.now() - t0).padStart(6)}ms vv=${s.vv} rows=${s.rows} st=${s.st} bytes+${s.bytes - b0} len=${s.len} focus=${s.focus}`);
    await sleep(150);
  }
};

// tap 真触摸=用户手指同款（弹键盘）；ime(false)=收键盘
const tapCenter = () => page.evaluate(() => {
  const c = window.__kfmNzTermScroll().getContainer();
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio;
  window.NzNative?.tap((r.left + r.width / 2) * dpr, (r.top + r.height / 2) * dpr);
});
const hideIme = () => page.evaluate(() => {
  window.NzNative?.ime(false);
  document.querySelector('textarea.kfm-term-kb')?.blur();
});

await runPhase('A 召唤输入法（tap 真触摸）', 8000, tapCenter);
await runPhase('B 关闭输入法（ime(false)+blur）', 8000, hideIme);
await runPhase('C 快速连 toggle ×3', 12000, async () => {
  for (let i = 0; i < 3; i++) {
    await tapCenter();
    await sleep(400);
    await hideIme();
    await sleep(400);
  }
});

await browser.close();
const after = tmux('list-clients -t dsh -F "#{client_tty}"');
const bf = new Set(clientsBefore.split('\n').map((x) => x.trim()).filter(Boolean));
for (const tty of after.split('\n').map((x) => x.trim()).filter((x) => x && !bf.has(x))) tmux(`detach-client -t ${tty}`);
console.log('\n清场完毕');
