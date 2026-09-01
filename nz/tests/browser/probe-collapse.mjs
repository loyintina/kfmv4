import { launchBrowser } from './launch.mjs';

// probe-collapse — 钉死「③ 展开后 ~1s 内塌回 HANDLE」：
// 采样 fn 引用是否被换（二次挂载）、root/orb/chip 数量、ring 完整尾部时间线。
const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const URL = `${BASE}?tmuxSession=kfm-exam-browser`;
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 250)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[CONSOLE-ERR]', m.text().slice(0, 200)); });
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject, null, { timeout: 30000, polling: 250 }).catch(() => {});
await page.waitForTimeout(1000);

const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
const snap = () => page.evaluate(() => {
  const rt = window.__kfmNzTmuxTabs?.() ?? {};
  return {
    kind: document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs') ?? null,
    rootCount: document.querySelectorAll('[data-tmux-tabs-root]').length,
    orbCount: document.querySelectorAll('[data-tmux-orb]').length,
    chipCount: document.querySelectorAll('[data-tmux-id]').length,
    fnChanged: window.__fnRef !== window.__kfmNzTmuxTabs,
    expanded: rt.expanded, attached: rt.attached, lastSel: rt.lastSelected,
    wins: rt.windows?.length,
  };
});

await page.evaluate(() => { window.__fnRef = window.__kfmNzTmuxTabs; });
await inject('tmux kill-session -t kfm-exam-browser 2>/dev/null; true\r');
await page.waitForTimeout(800);
await inject('tmux new-session -d -s kfm-exam-browser -n alpha\r');
let wins = 0;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(400); wins = (await snap()).wins ?? 0; if (wins > 0) break; }
console.log('[setup] wins=', wins);

const t0 = Date.now();
await page.click('[data-tmux-tabs="HANDLE"]');
for (let t = 0; t < 12; t++) {
  await page.waitForTimeout(150 + t * 150);
  const s = await snap();
  console.log(`[+${Date.now() - t0}ms] kind=${s.kind} roots=${s.rootCount} orb=${s.orbCount} chips=${s.chipCount} fnChanged=${s.fnChanged} exp=${s.expanded} att=${s.attached} lastSel=${s.lastSel}`);
  if (s.kind !== 'EXPANDED' || s.fnChanged || s.rootCount > 1) {
    const ring = await page.evaluate(() => window.__kfmNzTmuxTabsSnap?.ring ?? []);
    console.log('[RING-TAIL]', JSON.stringify(ring.slice(-12)));
    break;
  }
}
await browser.close();
