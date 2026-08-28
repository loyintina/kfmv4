// 真机 CDP 直连助手（真机眼基建，经 8026 反隧道）
// 纪律：①禁按下标猜目标——按 target id 前缀精确操作 ②禁 /json/new 开新页
//      ③必须 localhost 连 relay（8026 只听 IPv6 ::1，127.0.0.1 会挂死）
// 目标：live=description 含 "attached":true（用户活会话，勿导航勿 reload）
//      spare=empty/never_attached（空页，导航它什么都不杀，测完回 about:blank）
// 用法: node scripts/cdp-device.mjs eval "1+1"                  # live 上 evaluate
//       node scripts/cdp-device.mjs shot /tmp/out.png           # live 截图（App 需前台，后台不产帧必超时）
//       node scripts/cdp-device.mjs evshot "expr" /tmp/o.png [holdMs]
//       node scripts/cdp-device.mjs navshot <id前缀> <url> <png> [holdMs]  # spare 导航+截图+回 blank
//       node scripts/cdp-device.mjs cshot <id前缀> <png> [url]  # 画布重画眼（后台可用），带 url 先导航拍完回 blank
const mode = process.argv[2];

const list = await (await fetch('http://localhost:8026/json/list')).json();
// 目标选择：navshot/cshot 用 id 前缀指定（spare=empty/never_attached），
// 其余默认 live（attached）
let live;
if (mode === 'navshot' || mode === 'cshot') {
  live = list.find(t => t.id.startsWith(process.argv[3]));
  if (!live) { console.error('no target with id prefix', process.argv[3]); process.exit(1); }
} else {
  live = list.find(t => t.description.includes('"attached":true'));
  if (!live) { console.error('no attached live target'); process.exit(1); }
}
const ws = new WebSocket(live.webSocketDebuggerUrl);
let idc = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++idc;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
const opened = new Promise(r => { ws.onopen = r; });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
};
await opened;

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result ? r.result.value : undefined;
}
async function shot(path) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('fs');
  writeFileSync(path, Buffer.from(r.data, 'base64'));
}

if (mode === 'eval') {
  console.log(JSON.stringify(await evaluate(process.argv[3])));
} else if (mode === 'shot') {
  await shot(process.argv[3]);
  console.log('shot ->', process.argv[3]);
} else if (mode === 'evshot') {
  console.log('eval ->', JSON.stringify(await evaluate(process.argv[3])));
  await new Promise(r => setTimeout(r, +(process.argv[5] || 800)));
  await shot(process.argv[4]);
  console.log('shot ->', process.argv[4]);
} else if (mode === 'navshot') {
  // navshot <id前缀> <url> <png路径> [holdMs]：导航→等加载+hold→截图→回 about:blank
  const url = process.argv[4], png = process.argv[5], hold = +(process.argv[6] || 1500);
  await send('Page.enable');
  const loaded = new Promise(r => {
    const h = (ev) => { const m = JSON.parse(ev.data); if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', h); r(); } };
    ws.addEventListener('message', h);
    setTimeout(r, 8000);
  });
  await send('Page.navigate', { url });
  await loaded;
  await new Promise(r => setTimeout(r, hold));
  await shot(png);
  console.log('shot ->', png);
  await send('Page.navigate', { url: 'about:blank' });
} else if (mode === 'cshot') {
  // cshot <id前缀> <png路径> [url]：画布重画眼（后台可用，不依赖合成器产帧）。
  // 目标页需已加载含 __kfmNzCanvasShot 的 bundle；带 url 则先导航、拍完回 blank。
  const png = process.argv[4], url = process.argv[5];
  if (url) {
    // 目标已在连接里（live=按 id 选的 spare），导航→等加载
    await send('Page.enable');
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 5000));
  }
  const u = await evaluate(`window.__kfmNzCanvasShot ? window.__kfmNzCanvasShot() : ''`);
  if (typeof u !== 'string' || !u.startsWith('data:image/png;base64,')) {
    console.error('canvasShot fail:', typeof u === 'string' ? u.slice(0, 80) : u);
    process.exit(1);
  }
  const { writeFileSync } = await import('fs');
  writeFileSync(png, Buffer.from(u.split(',')[1], 'base64'));
  console.log('cshot ->', png);
  if (url) await send('Page.navigate', { url: 'about:blank' });
}
ws.close();
// ws.close 不保证进程即退（socket  draining），显式退出防悬挂
process.exit(0);
