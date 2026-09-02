/**
 * tests/browser/tmux-tabs-repro-device.mjs
 * 真机/接近真机路径：通过 CDP attach 到 nz WebView，直接注入 Ctrl-B d
 * 触发 leaveTmux（与点击已聚焦标签同一段代码），逐帧截图 + 读钩子，
 * 复现「命令历史被清空 + 闪烁」问题。
 */
import { WebSocket } from 'ws';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CDP_LIST = process.env.KFM_NZ_CDP_LIST || 'http://localhost:8026/json/list';
const OUT_DIR = process.env.KFM_NZ_REPRO_DIR || '/tmp/nz-tmux-tabs-repro-device';
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const listRes = await fetch(CDP_LIST).then((r) => r.json()).catch(() => []);
const target = listRes.find((t) => t.type === 'page' && t.url?.includes('_tApk'))
  || listRes.find((t) => t.type === 'page' && !t.url?.includes('empty'));
if (!target) { console.error('没有可用的 CDP 页面'); process.exit(1); }
console.log('[CDP 目标]', target.id, target.url);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const reqId = ++id;
  pending.set(reqId, { resolve, reject });
  ws.send(JSON.stringify({ id: reqId, method, params }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(String(data));
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(msg.error);
    else p.resolve(msg.result);
  }
});
await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });

await send('Runtime.enable');
await send('Page.enable');

const evaluate = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => r.result.value);
const screenshot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(r.data, 'base64');
  const p = join(OUT_DIR, `${name}.png`);
  writeFileSync(p, buf);
  return p;
};

// 1. 读取初始状态
const rInit = await evaluate('window.__kfmNzTmuxTabs()');
console.log('[初始状态]', { state: rInit.state, attached: rInit.attachedSession, expanded: rInit.expanded });

// 2. 如果还没 attach，先 attach 到 amp（稳定存在的会话）
let attachedName = rInit.attachedSession;
if (!attachedName) {
  // 直接注入 attach 命令
  await evaluate(`window.__kfmNzTermInject('tmux attach -t amp\\r')`);
  for (let i = 0; i < 30; i++) {
    const r = await evaluate('window.__kfmNzTmuxTabs()');
    if (r.attachedSession) { attachedName = r.attachedSession; break; }
    await sleep(200);
  }
}
console.log('[attach] attached=', attachedName);

// 3. 在 shell 里产生一些命令历史（如果当前是终端态）
const rCheck = await evaluate('window.__kfmNzTmuxTabs()');
if (rCheck.attachedSession === null) {
  await evaluate(`window.__kfmNzTermInject('echo hist-before-1\\r')`);
  await sleep(400);
  await evaluate(`window.__kfmNzTermInject('echo hist-before-2\\r')`);
  await sleep(400);
}
const beforeHistory = await evaluate('window.__kfmNzTermScreen()');
console.log('[前置历史] 含 hist-before-1/2:', beforeHistory.includes('hist-before-1') && beforeHistory.includes('hist-before-2'));

// 4. detach 前截图
const frames = [];
frames.push({ t: 'pre-detach', p: await screenshot('01-pre-detach') });

// 5. 注入 Ctrl-B d 触发 leaveTmux（与点聚焦标签同一段代码）
await evaluate(`window.__kfmNzTermInject('\\u0002d')`);

// 6. 逐帧截图 1400ms（覆盖 500ms+300ms 清屏窗口）
for (let i = 0; i < 15; i++) {
  await sleep(100);
  frames.push({ t: `post-${i * 100}ms`, p: await screenshot(`02-post-${String(i).padStart(2, '0')}0ms`) });
}

// 7. 读取 detach 后状态
const afterState = await evaluate('window.__kfmNzTmuxTabs()');
const afterScreen = await evaluate('window.__kfmNzTermScreen()');
console.log('[detach 后状态]', { state: afterState.state, attached: afterState.attachedSession, expanded: afterState.expanded });
console.log('[detach 后屏幕]', afterScreen.slice(0, 200));

// 上滑到顶检查 scrollback
await send('Runtime.evaluate', {
  expression: `const scroller = document.querySelector('.nz-term-scroll') || document.querySelector('.nz-term')?.parentElement; if (scroller) scroller.scrollTop = 0;`,
});
await sleep(300);
const topScreen = await evaluate('window.__kfmNzTermScreen()');
console.log('[scrollback 顶层]', topScreen.slice(0, 200));

const bugCurrentLost = !afterScreen.includes('hist-before-1') && !afterScreen.includes('hist-before-2');
const bugScrollbackLost = !topScreen.includes('hist-before-1') && !topScreen.includes('hist-before-2');
console.log('[BUG 当前屏历史丢失]', bugCurrentLost);
console.log('[BUG scrollback 历史丢失]', bugScrollbackLost);
console.log('[帧序列]', frames.map((f) => f.t).join(', '));
console.log('[截图落盘]', OUT_DIR);

ws.close();
