import { launchBrowser } from './launch.mjs';
const b = await launchBrowser();
const page = await b.newPage({ viewport: { width: 900, height: 620 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 200)));
await page.goto(process.env.KFM_NZ_URL + '?tmuxSession=kfm-exam-browser', { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 20000 }).catch(() => {});
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject, null, { timeout: 30000, polling: 250 }).catch(() => {});
await page.waitForTimeout(1000);
const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject?.(x), t);
const tabs = () => page.evaluate(() => { const rt = window.__kfmNzTmuxTabs?.(); return rt ? { state: rt.state, attached: rt.attached, wins: rt.windows.map((w) => w.name), order0: rt.windows[0]?.name } : null; });
await inject('tmux kill-session -t kfm-exam-browser 2>/dev/null; true\r');
await inject('tmux new-session -d -s kfm-exam-browser -n alpha\r');
let s2 = null;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(400); s2 = await tabs(); if ((s2?.rt?.windows?.length ?? 0) > 0) break; }
console.log('[wins]', JSON.stringify(s2?.rt?.windows));
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(400);
const alphaId = (await tabs()).rt.windows.find((w) => w.name === 'alpha').id;
const probe = await page.evaluate((id) => {
  const chip = document.querySelector(`[data-tmux-id="${id}"]`);
  if (!chip) return { err: 'chip not found' };
  const r = chip.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const top = document.elementFromPoint(cx, cy);
  return { cx, cy, topDesc: top ? top.tagName + '|' + String(top.getAttribute('data-tmux-id') || '') : 'none', isChip: top === chip };
}, alphaId);
console.log('[probe]', JSON.stringify(probe));
let clicked = false;
await page.evaluate((id) => {
  const chip = document.querySelector(`[data-tmux-id="${id}"]`);
  chip.addEventListener('click', () => { window.__domClick = true; });
}, alphaId);
await page.mouse.click(probe.cx, probe.cy);
await page.waitForTimeout(600);
const res = await page.evaluate((id) => {
  const scr = window.__kfmNzTermScreen();
  const rt = window.__kfmNzTmuxTabs();
  return { domClick: !!window.__domClick, attached: rt.attached, statusLine: scr.includes('[kfm-exam-browser]'), alphaStar: scr.includes('alpha*') };
}, alphaId);
console.log('[after click]', JSON.stringify(res));
await b.close();
