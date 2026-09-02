import { launchBrowser } from './launch.mjs';
import { execFileSync } from 'node:child_process';

// probe-t2s — T2s 已附切换失连定位：事件到底有没有到芯片
const tmux = (args) => { try { execFileSync('tmux', args, { timeout: 4000, stdio: 'pipe' }); return true; } catch { return false; } };
for (const s of ['kfm-exam-a', 'kfm-exam-new']) tmux(['kill-session', '-t', s]);
tmux(['set', '-g', 'status-left-length', '40']);
tmux(['new-session', '-d', '-s', 'kfm-exam-a']);
tmux(['new-session', '-d', '-s', 'kfm-exam-new']);

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto('http://127.0.0.1:8023/', { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
await page.waitForFunction(() => !!window.__kfmNzTmuxTabs && !!window.__kfmNzTermInject, null, { timeout: 30000, polling: 250 }).catch(() => {});
await page.waitForTimeout(1500);

// 附到 kfm-exam-a：展开→点 a 标签
await page.click('[data-tmux-tabs="HANDLE"]');
await page.waitForTimeout(300);
await page.click('[data-tmux-id="kfm-exam-a"]');
await page.waitForFunction(() => window.__kfmNzTmuxTabs?.().attachedSession === 'kfm-exam-a', null, { timeout: 8000, polling: 300 }).catch(() => {});
console.log('[pre]', JSON.stringify(await page.evaluate(() => ({ att: window.__kfmNzTmuxTabs?.().attachedSession, kind: document.querySelector('[data-tmux-tabs]')?.getAttribute('data-tmux-tabs'), scr: window.__kfmNzTermScreen().includes('[kfm-exam-a]') }))));

// 仪器：芯片原生 click 计数 + elementFromPoint
await page.evaluate(() => {
  window.__chipClicked = 0;
  const chip = document.querySelector('[data-tmux-id="kfm-exam-new"]');
  chip.addEventListener('click', () => { window.__chipClicked++; });
  const r = chip.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  window.__hit = el ? el.tagName + '|' + (el.getAttribute?.('data-tmux-id') ?? el.className ?? '') : 'none';
});
console.log('[hit]', await page.evaluate(() => window.__hit));

// Playwright click + 200ms×10 采样 attachedRef
await page.click('[data-tmux-id="kfm-exam-new"]');
const samples = [];
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(200);
  samples.push(await page.evaluate(() => ({ att: window.__kfmNzTmuxTabs?.().attachedSession, clicks: window.__chipClicked, scr: (window.__kfmNzTermScreen().match(/\[kfm-exam-[a-z]+\]/) ?? [null])[0] })));
}
console.log('[samples]', JSON.stringify(samples, null, 0));

// 对照：DOM 直呼 click
await page.evaluate(() => document.querySelector('[data-tmux-id="kfm-exam-new"]').click());
await page.waitForTimeout(1200);
console.log('[after direct]', JSON.stringify(await page.evaluate(() => ({ att: window.__kfmNzTmuxTabs?.().attachedSession, clicks: window.__chipClicked, scr: (window.__kfmNzTermScreen().match(/\[kfm-exam-[a-z]+\]/) ?? [null])[0] }))));

for (const s of ['kfm-exam-a', 'kfm-exam-new']) tmux(['kill-session', '-t', s]);
await browser.close();
