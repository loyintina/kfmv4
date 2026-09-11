const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const list = async () => (await fetch('http://localhost:8026/json/list')).json();
const conn = async (t) => {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let idc = 0; const pend = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
  return { send: (method, params = {}) => new Promise((resolve, reject) => { const id = ++idc; pend.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }) };
};
const evalOn = async (c, expr) => (await c.send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
const geom = async () => {
  const f = (await list()).find(x => x.url.includes('float=1'));
  const d = JSON.parse(f.description);
  return `${d.screenX},${d.screenY} ${d.width}x${d.height}`;
};
const tt = (await list()).find(x => x.url.includes('_tApk'));
const term = await conn(tt);
const flDesc = (await list()).find(x => x.url.includes('float=1'));
const fl = await conn(flDesc);
const vw = await evalOn(fl, 'innerWidth');
const hasBridge = await evalOn(fl, 'typeof NzNative!==\"undefined\" && typeof NzNative.floatCollapse');
const out = {};
const barX = 26 + (vw - 26) / 2, barY = 12;
const touch = async (type, pts) => fl.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const tapBar = async () => { await touch('touchStart', [{ x: barX, y: barY }]); await sleep(90); await touch('touchEnd', []); };
out.bridge = hasBridge;
// ① 点按=折叠
await tapBar(); await sleep(800);
out.tap1 = { st: await evalOn(term, 'NzNative.browserState()'), geo: await geom() };
// ② 再点=展开
await tapBar(); await sleep(800);
out.tap2 = { st: await evalOn(term, 'NzNative.browserState()'), geo: await geom() };
// ③ 顶条拖拽（-180,-120 再拖回）
await touch('touchStart', [{ x: barX, y: barY }]);
for (let i = 0; i < 6; i++) { await touch('touchMove', [{ x: barX - 30 * (i + 1), y: barY - 20 * (i + 1) }]); await sleep(60); }
await touch('touchEnd', []); await sleep(600);
out.drag = { geo: await geom() };
await touch('touchStart', [{ x: barX - 180, y: barY - 120 }]);
for (let i = 0; i < 6; i++) { await touch('touchMove', [{ x: barX - 180 + 30 * (i + 1), y: barY - 120 + 20 * (i + 1) }]); await sleep(60); }
await touch('touchEnd', []); await sleep(600);
out.dragBack = { geo: await geom() };
// ④ 长按=隐身
await touch('touchStart', [{ x: barX, y: barY }]);
await sleep(600);
out.holdDuring = await evalOn(term, 'NzNative.browserState()');
await touch('touchEnd', []); await sleep(400);
out.holdAfter = await evalOn(term, 'NzNative.browserState()');
console.log(JSON.stringify(out, null, 1));
process.exit(0);
