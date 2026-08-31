// experiments/dbg-keybar-ime-summon.mjs — keybar 点击召唤 IME 真机复现探针
// （2026-08-31 用户报告：点两排快捷键任意键都弹出输入法；源码防线
// keybar.ts click stopPropagation 在位、keybar-click A 档 19/19 绿——
// 矛盾，需真机实证）
// 方法：CDP Input.dispatchTouchEvent（渲染管线内的可信触摸=真用户手势）
// 点 ESC 键（无害字节），前后采样 activeElement/vv.height——vv 缩=IME 被召唤。
// 纪律：live target（用户活会话），勿导航勿 reload；触摸落点是 keybar 按钮。
const list = await (await fetch('http://localhost:8026/json/list')).json();
const live = list.find(t => t.description.includes('"attached":true'));
if (!live) { console.error('no attached live target'); process.exit(1); }
const ws = new WebSocket(live.webSocketDebuggerUrl);
let idc = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++idc; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  }
};
await new Promise(r => { ws.onopen = r; });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval ex: ' + (r.exceptionDetails.exception?.description || '?').split('\n')[0]);
  return r.result?.value;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const state = () => evaluate(`JSON.stringify({
  focus: document.activeElement?.className || document.activeElement?.tagName,
  vv: Math.round(visualViewport?.height ?? 0),
  innerH: window.innerHeight,
})`).then(JSON.parse);

// ESC 按钮中心（无害：发一个 ESC 字节）
const pt = await evaluate(`(() => { const b=[...document.querySelectorAll('.kfm-term-keybar > div')].find(b=>b.textContent==='ESC'); if(!b) return null; const r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}; })()`);
if (!pt) { console.error('ESC button not found'); process.exit(1); }

console.log('BEFORE', JSON.stringify(await state()), 'tap@', JSON.stringify(pt));
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] });
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
for (const wait of [300, 700, 1200, 2000]) {
  await sleep(wait === 300 ? 300 : wait - [300, 700, 1200][[300, 700, 1200, 2000].indexOf(wait) - 1]);
  console.log(`AFTER+${wait}ms`, JSON.stringify(await state()));
}
// 若 IME 真被召唤（vv 缩），点终端空白让它回去之前先如实报告——不自动收拾，
// 由下一轮真手指或用户自行收键盘（不替用户做前景决定）。
ws.close();
