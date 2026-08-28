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
//       node scripts/cdp-device.mjs seq <id前缀> <url含{t}> <png前缀> <t1,t2,..>  # 动效帧序列眼
const mode = process.argv[2];

const list = await (await fetch('http://localhost:8026/json/list')).json();
// 目标选择：navshot/cshot/seq 用 id 前缀指定（spare=empty/never_attached），
// 其余默认 live（attached）
let live;
if (mode === 'navshot' || mode === 'cshot' || mode === 'seq') {
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
} else if (mode === 'seq') {
  // seq <id前缀> <url含{t}占位> <png前缀> <t1,t2,...>：动效帧序列眼（后台可用）。
  // 逐 t 导航到 url（{t} 替换为毫秒值，配合页面 ?t= 冻结帧），画布重画出图
  // <png前缀><t>.png，最后回 about:blank。原理：后台 rAF 不跑，合成时间
  // 驱动是正道；块字符按墨迹宽度表 fillRect，几何与真机 DOM 同源。
  // 验证「每帧画什么」（波序/相位/几何）；测不了实时掉帧（那要前台 screencast）。
  const urlTpl = process.argv[4], pngPrefix = process.argv[5];
  const times = (process.argv[6] || '0').split(',').map(Number);
  const eyeExpr = `(function(){
    var s = document.getElementById('nz-splash');
    var pre = s && s.querySelector('pre');
    if (!pre) return 'NO-PRE';
    var pr = pre.getBoundingClientRect();
    var lines = pre.textContent.split('\\n');
    var rows = lines.length, cols = Math.max.apply(null, lines.map(function(l){return l.length}));
    var cw = pr.width / cols, ch = pr.height / rows;
    var grid = [];
    pre.childNodes.forEach(function(n){
      var color = null, text = n.textContent;
      if (n.nodeType !== 3) color = getComputedStyle(n).color;
      for (var i = 0; i < text.length; i++) grid.push({ ch: text[i], color: color });
    });
    var GW = { '\\u2588': 1, '\\u2589': 0.875, '\\u258a': 0.75, '\\u258b': 0.625,
               '\\u258c': 0.5, '\\u258d': 0.375, '\\u258e': 0.25, '\\u258f': 0.125 };
    var scale = 3;
    var c = document.createElement('canvas');
    c.width = Math.round(pr.width * scale); c.height = Math.round(pr.height * scale);
    var g = c.getContext('2d');
    g.fillStyle = '#05070f'; g.fillRect(0, 0, c.width, c.height);
    var k = 0;
    for (var y = 0; y < rows; y++) for (var x = 0; x < lines[y].length; x++) {
      var cell = grid[k++] || { ch: ' ', color: null };
      var w = GW[cell.ch];
      if (!w) continue;
      g.fillStyle = cell.color || '#1a2030';
      g.fillRect(x * cw * scale, y * ch * scale, w * cw * scale, ch * scale);
    }
    return c.toDataURL('image/png');
  })()`;
  await send('Page.enable');
  const { writeFileSync } = await import('fs');
  for (const ms of times) {
    await send('Page.navigate', { url: urlTpl.replace('{t}', String(ms)) });
    await new Promise(r => setTimeout(r, 2500));
    const u = await evaluate(eyeExpr);
    if (typeof u === 'string' && u.startsWith('data:image/png')) {
      const p = `${pngPrefix}${ms}.png`;
      writeFileSync(p, Buffer.from(u.split(',')[1], 'base64'));
      console.log(`t=${ms} -> ${p}`);
    } else console.error(`t=${ms} FAIL:`, String(u).slice(0, 60));
  }
  await send('Page.navigate', { url: 'about:blank' });
}
ws.close();
// ws.close 不保证进程即退（socket  draining），显式退出防悬挂
process.exit(0);
