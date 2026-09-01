import { launchBrowser } from './launch.mjs';

// probe-attach — 实证 T3b attach 后屏幕真实内容：
// 点芯片→轮询屏幕→注 echo ATTACH-RC=$? 判命令是否真跑、退出码多少。
const BASE = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const URL = `${BASE}?tmuxSession=kfm-exam-browser`;
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 250)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject, null, { timeout: 30000, polling: 250 }).catch(() => {});
await page.waitForTimeout(1000);

const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
const screen = () => page.evaluate(() => window.__kfmNzTermScreen());
const rt = () => page.evaluate(() => { const r = window.__kfmNzTmuxTabs?.() ?? {}; return { attached: r.attached, expanded: r.expanded, wins: r.windows?.length }; });

await inject('tmux kill-session -t kfm-exam-browser 2>/dev/null; true\r');
await page.waitForTimeout(700);
await inject('tmux new-session -d -s kfm-exam-browser -n alpha\r');
let wins = 0;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(400); wins = (await rt()).wins ?? 0; if (wins > 0) break; }
console.log('[setup] wins=', wins);
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(400);
const chipId = await page.evaluate(() => document.querySelector('[data-tmux-id]')?.getAttribute('data-tmux-id'));
console.log('[chip]', chipId);
await page.click(`[data-tmux-id="${chipId}"]`);
for (const ms of [600, 1500, 3000, 5000]) {
  await page.waitForTimeout(ms === 600 ? 600 : ms - (ms === 1500 ? 600 : ms === 3000 ? 1500 : 3000));
  const s = await screen();
  const r = await rt();
  console.log(`[t=${ms}] attached=${r.attached} expanded=${r.expanded} screenHasStatus=${s.includes('[kfm-exam-browser]')} screenHead=${JSON.stringify(s.slice(0, 80))} screenTail=${JSON.stringify(s.slice(-120))}`);
}
// attach 命令退出码：若已进 tmux，此 echo 落在 tmux 窗内；若失败，落回裸 shell
await inject('echo ATTACH-RC=$? TMUXVAR=$TMUX\r');
await page.waitForTimeout(1200);
const s2 = await screen();
console.log('[after echo] hasRC=', s2.includes('ATTACH-RC='), JSON.stringify(s2.split('\n').filter((l) => l.includes('ATTACH-RC') || l.includes('nested') || l.includes('error')).slice(0, 3)));
console.log('[FULL-SCREEN]\n' + s2.split('\n').map((l) => '|' + l).join('\n'));
await browser.close();
