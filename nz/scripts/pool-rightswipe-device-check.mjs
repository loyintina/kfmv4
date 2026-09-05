/**
 * pool-rightswipe-device-check.mjs — 真机右滑返回修复复确（8026 CDP，L3）
 *
 * 2026-09-05 用户报告：池页开着右滑回不去（左滑开池正常）。根因=池页列表区
 * touch-action 实际生效 auto，真触摸横拖被浏览器原生接管 → pointercancel →
 * 手势核以小位移判 null；修法=tokens.css 池页根+列表区显式 pan-y。
 * 本脚本在真机上以 Input.dispatchTouchEvent 真触摸序列复确：
 *   ①真机左滑开池（对照腿）→ ②真触摸右滑关池（病灶腿，修复前必不响）
 *   → ③修复后再右滑一次应已关（②成功即跳过）。
 * 纪律：attached live 目标精确选（cdp-device.mjs 同款），禁 /json/new，
 * 不导航；结束时池页必回 POOL_CLOSED（原态复原）。
 * 截图存证：tests/assets/config-pool-device-rightswipe-{before,after}.png
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const list = await (await fetch('http://localhost:8026/json/list')).json();
// 目标选择：优先「可见」的 nz 页（后台页 Input.dispatchTouchEvent 必挂——
// 2026-09-05 实测 hidden 页 touch 派发永久 pending）；都不可见再退 attached 首个
const nzPages = list.filter((t) => t.type === 'page' && (t.url || '').includes('8023'));
const visOf = async (t) => {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let idc = 0; const p = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && p.has(m.id)) { const x = p.get(m.id); p.delete(m.id); m.error ? x.reject(new Error(m.error.message)) : x.resolve(m.result); } });
  await new Promise((r) => ws.addEventListener('open', r));
  const v = await new Promise((res, rej) => { const id = ++idc; p.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: 'document.visibilityState', returnByValue: true } })); });
  try { ws.close(); } catch {}
  return v.result?.value ?? 'unknown';
};
let live = null;
for (const t of nzPages) {
  const v = await visOf(t).catch(() => 'err');
  console.log('[target]', t.id.slice(0, 8), t.url.slice(0, 50), 'visibility=' + v);
  if (v === 'visible') { live = t; break; }
}
if (!live) live = nzPages.find((t) => t.description.includes('"attached":true'));
if (!live) { console.error('❌ 无 attached 的 nz live 目标'); process.exit(2); }
console.log('[cdp] attach', live.id.slice(0, 8), live.url.slice(0, 60));
const ws = new WebSocket(live.webSocketDebuggerUrl);
let idc = 0;
const pending = new Map();
ws.addEventListener('error', (e) => console.log('[ws-error]', String(e.message ?? e).slice(0, 100)));
ws.addEventListener('close', () => console.log('[ws-close]'));
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++idc; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evalJson = async (expr) => {
  const r = await Promise.race([
    send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }),
    sleep(15000).then(() => { throw new Error('eval timeout: ' + expr.slice(0, 60)); }),
  ]);
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? '?').split('\n')[0]);
  return r.result?.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (r?.data) { const p = join(process.cwd(), 'tests', 'assets', name); writeFileSync(p, Buffer.from(r.data, 'base64')); console.log('shot:', p); }
  else console.log('[shot] 截图失败（App 可能在后台，跳过——CDP 读数仍有效）');
};
const touch = async (type, points) => {
  try { return await send('Input.dispatchTouchEvent', { type, touchPoints: points }); }
  catch (e) { console.log(`[touch-${type}-err]`, String(e.message ?? e).slice(0, 120)); return null; }
};
const swipe = async (x0, y0, x1, y1, steps = 16) => {
  await touch('touchStart', [{ x: x0, y: y0, id: 1 }]);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [{ x: Math.round(x0 + ((x1 - x0) * i) / steps), y: Math.round(y0 + ((y1 - y0) * i) / steps), id: 1 }]);
    await sleep(14);
  }
  await touch('touchEnd', []);
  await sleep(500);
};
const poolState = () => evalJson(`(() => { const r = window.__kfmNzPool && window.__kfmNzPool(); return r ? r.page + '/' + (r.pool ?? '-') + '/' + r.pageState : 'no-hook'; })()`);

// bundle 版本核对（热更腿没跟上时提醒一次 reload——与热更链同款唯一一次）
const bundleInfo = await evalJson(`fetch('/build-info.json', { cache: 'no-store' }).then(r => r.json()).then(i => i.builtAt ?? '')`).catch(() => '?');
console.log('[check] server bundle builtAt =', bundleInfo);
await sleep(12000); // 等热更轮询腿（10s 拍）万一有新包先自刷

const geom = await evalJson(`({ w: window.innerWidth, h: window.innerHeight, hook: !!window.__kfmNzPool })`);
if (!geom.hook) { console.error('❌ 页面无 __kfmNzPool（bundle 未热更到位？手动刷新后重跑）'); process.exit(2); }
console.log('[geom]', JSON.stringify(geom), 'pool =', await poolState());

// 事件带（真触摸 pointer 流取证：修复前 cancels≥1，修复后 0）
await evalJson(`(() => {
  window.__tl = [];
  for (const ty of ['pointerdown','pointermove','pointerup','pointercancel'])
    document.addEventListener(ty, (e) => { const t = e.touches?.[0] ?? e; window.__tl.push({ ty, pt: e.pointerType, x: Math.round(t.clientX ?? 0), y: Math.round(t.clientY ?? 0) }); }, { capture: true, passive: true });
  return true;
})()`);

const w = geom.w, h = geom.h;
const midY = Math.round(h * 0.42);
let st0 = await poolState();
const shot0 = join(process.cwd(), 'tests', 'assets', 'config-pool-device-rightswipe-before.png');

if (!st0.startsWith('POOL_OPEN')) {
  console.log('== ① 真机左滑开池（对照腿） ==');
  await swipe(Math.round(w * 0.72), midY, Math.round(w * 0.72) - 200, midY).catch((e) => console.log('[swipe-err]', String(e).slice(0, 120)));
  st0 = await poolState();
  console.log('① 左滑后 pool =', st0);
  await evalJson('window.__tl.length = 0');
}

if (st0.startsWith('POOL_OPEN')) {
  console.log('== ② 真触摸右滑关池（病灶腿） ==');
  await shot('config-pool-device-rightswipe-before.png');
  await swipe(Math.round(w * 0.3), midY, Math.round(w * 0.3) + 220, midY);
  const st1 = await poolState();
  console.log('② 右滑后 pool =', st1, st1.startsWith('POOL_CLOSED') ? '（修复生效）' : '（仍未修复！）');
  const tape = await evalJson(`(() => { const t = window.__tl; window.__tl = []; return { n: t.length, moves: t.filter(e => e.ty === 'pointermove').length, cancels: t.filter(e => e.ty === 'pointercancel').length, ups: t.filter(e => e.ty === 'pointerup').length }; })()`);
  console.log('[tape-②]', JSON.stringify(tape));
  await shot('config-pool-device-rightswipe-after.png');
  console.log('== 终态 pool =', await poolState(), '==');
  if (!st1.startsWith('POOL_CLOSED')) process.exit(1);
} else {
  console.log('❌ 左滑开池都没成（bundle 未热更/页面异常）pool =', st0);
  await shot(shot0.split('/').pop());
  process.exit(1);
}
ws.close();
process.exit(0);
