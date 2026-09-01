import { launchBrowser } from './launch.mjs';

// probe-push — tmux-state 推送延迟测量：UI 连开 3 窗，测 cmd→rt.windows 出现延迟
const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const URL = `${BASE}?tmuxSession=kfm-exam-browser`;
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 250)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject, null, { timeout: 30000, polling: 250 }).catch(() => {});
await page.waitForTimeout(1000);

const rt = () => page.evaluate(() => { const r = window.__kfmNzTmuxTabs?.() ?? {}; return { wins: r.windows?.map((w) => `${w.name}${w.active ? '*' : ''}`) }; });
console.log('[baseline]', JSON.stringify(await rt()));

// 先收拢到干净基线：杀掉历史窗，只留 alpha
const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
await inject('tmux kill-window -t kfm-exam-browser:gamma 2>/dev/null; true\r');
await page.waitForTimeout(1500);
console.log('[after clean]', JSON.stringify(await rt()));

// 展开（新页面=HANDLE 收起态）
console.log('[pre-expand]', JSON.stringify(await rt()), await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs')));
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(600);
console.log('[post-expand]', JSON.stringify(await rt()), await page.evaluate(() => document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs')));

for (const name of ['delta', 'epsilon', 'zeta']) {
  const t0 = Date.now();
  await page.click('[data-tmux-plus="1"]');
  await page.fill('[data-tmux-new-name]', name);
  await page.click('[data-tmux-confirm="1"]');
  let arrived = -1;
  for (let i = 0; i < 60; i++) { // 至多 12s
    await page.waitForTimeout(200);
    const w = await rt();
    if (w.wins?.some((x) => x.startsWith(name))) { arrived = Date.now() - t0; break; }
  }
  console.log(`[${name}] arrive=${arrived}ms wins=${JSON.stringify((await rt()).wins)}`);
}
await browser.close();
