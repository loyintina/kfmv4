import { launchBrowser } from './launch.mjs';

// probe-drag — T11 拖动断链定位：dbg 计数器逐环读数 + 服务器真实窗序互证
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
const rt = () => page.evaluate(() => { const r = window.__kfmNzTmuxTabs?.() ?? {}; return { wins: r.windows?.map((w) => w.name), attached: r.attached, expanded: r.expanded }; });
const dbg = () => page.evaluate(() => window.__kfmNzTmuxTabsDbgGet?.() ?? null);

await inject('tmux kill-session -t kfm-exam-browser 2>/dev/null; true\r');
await page.waitForTimeout(700);
await inject('tmux new-session -d -s kfm-exam-browser -n alpha\r');
await inject('tmux new-window -d -t kfm-exam-browser -n beta\r');
await inject('tmux set -w automatic-rename off -t kfm-exam-browser:alpha\r');
await inject('tmux set -w automatic-rename off -t kfm-exam-browser:beta\r');
let wins = [];
for (let i = 0; i < 30; i++) { await page.waitForTimeout(400); wins = (await rt()).wins ?? []; if (wins.length >= 2) break; }
console.log('[setup] wins=', JSON.stringify(wins));

await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(400);
console.log('[dbg0]', JSON.stringify(await dbg()));

const bBox = await page.locator('[data-tmux-win="beta"]').boundingBox();
const aBox = await page.locator('[data-tmux-win="alpha"]').boundingBox();
console.log('[boxes]', JSON.stringify({ beta: bBox, alpha: aBox }));
await page.mouse.move(bBox.x + 10, bBox.y + 10);
await page.mouse.down();
await page.waitForTimeout(400);
await page.mouse.move(aBox.x + 10, aBox.y + 10, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(1500);
console.log('[dbg1]', JSON.stringify(await dbg()));
console.log('[rt]', JSON.stringify(await rt()));
await browser.close();
