// experiments/dbg-tmux-scroll.mjs — 用户报案复现（2026-08-30）：
// 「tmux attach 进有长历史的窗口，上下滚动没有效果」。
// 嫌疑双堵：①tmux=alt screen→nz 终端 ALT 三路禁滚（ranger runaway 对策）
//           ②滚轮→SGR 1006 鼠标报告未实现（term-contract 挂单）
//           → tmux 收不到滚轮=进不了 copy-mode，终端自身回滚又被禁。
// 复现：独立 scrtest 会话（不碰 dsh），灌 200 行历史，attach 后滚轮，
// 判：容器 scrollTop / tmux pane_in_mode 双双动不动。
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const sh = (c) => execSync(c).toString().trim();

sh('tmux kill-session -t scrtest 2>/dev/null || true');
sh('tmux new-session -d -s scrtest -x 200 -y 50');
sh("tmux send-keys -t scrtest 'seq 1 200' Enter");
await new Promise((r) => setTimeout(r, 800));
const before = {
  hist: sh("tmux display -p -t scrtest '#{history_size}'"),
  mode: sh("tmux display -p -t scrtest '#{pane_in_mode}'"),
};
console.log('前置：history_size=' + before.hist + ' pane_in_mode=' + before.mode);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2500);

// 注入 attach（P0 钩子，走现有输入管线）
await page.evaluate(() => window.__kfmNzTermInject('tmux attach -t scrtest\r'));
await page.waitForTimeout(1500);
const screen = await page.evaluate(() => window.__kfmNzTermScreen());
console.log('attach 后屏幕末行：' + JSON.stringify(screen.split('\n').filter((l) => l.trim()).slice(-3)));

const s0 = await page.evaluate(() => window.__kfmNzTermScroll?.() ?? null);
console.log('滚动容器：', JSON.stringify(s0));

// 滚轮三连（向上=看历史）
await page.mouse.move(450, 300);
for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(120); }
await page.waitForTimeout(600);

const s1 = await page.evaluate(() => window.__kfmNzTermScroll?.() ?? null);
const after = {
  mode: sh("tmux display -p -t scrtest '#{pane_in_mode}'"),
  top: sh("tmux display -p -t scrtest '#{scroll_position}'"),
};
console.log('滚轮后容器：', JSON.stringify(s1));
console.log('滚轮后 tmux：pane_in_mode=' + after.mode + ' scroll_position=' + after.top);

const containerMoved = s0 && s1 && s1.scrollTop !== s0.scrollTop;
const tmuxMoved = after.mode !== '0' || (after.top !== '' && after.top !== '0');
console.log('\n判定：');
console.log((containerMoved ? '✅' : '❌') + ' 终端容器可滚（ALT 禁滚=' + !containerMoved + '）');
console.log((tmuxMoved ? '✅' : '❌') + ' tmux 收到滚轮进 copy-mode（鼠标报告=' + tmuxMoved + '）');
console.log(!containerMoved && !tmuxMoved ? '🔴 复现成立：双堵——用户怎么滚都没反应' : '🟢 未复现');

await page.evaluate(() => window.__kfmNzTermInject('exit\r')).catch(() => {});
await browser.close();
sh('tmux kill-session -t scrtest 2>/dev/null || true');
process.exit(0);
