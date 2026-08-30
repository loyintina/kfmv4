import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const tmux = (a) => execSync(`tmux ${a}`, { encoding: 'utf8' }).trim();
try { tmux('kill-session -t scrtest 2>/dev/null'); } catch {}
tmux('new-session -d -s scrtest -x 120 -y 40');
tmux('set-option -t scrtest mouse on');
tmux("send-keys -t scrtest 'seq 1 200' Enter");
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto('http://127.0.0.1:8023/', { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);
const inject = (t) => page.evaluate((x) => window.__kfmNzTermInject(x), t);
const mm = () => page.evaluate(() => window.__kfmNzTermScroll()?.mouseMode);
const screen = () => page.evaluate(() => window.__kfmNzTermScreen());
await inject('tmux attach -t scrtest\r');
await page.waitForTimeout(1500);
console.log('attached mm=', await mm());
await inject('tmux detach\r');
await page.waitForTimeout(1500);
console.log('after detach mm=', await mm());
console.log('screen tail:', JSON.stringify((await screen()).split('\n').slice(-4)));
console.log('pane clients:', tmux("list-clients -t scrtest 2>/dev/null || echo none"));
await browser.close();
try { tmux('kill-session -t scrtest 2>/dev/null'); } catch {}
