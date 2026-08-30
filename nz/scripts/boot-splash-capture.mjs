// scripts/boot-splash-capture.mjs — 冷启动盲窗像素取证（2026-08-30）。
// 背景：壳层 decorView 自绘抓不到硬件加速 WebView 内容（自证图全黑，
// Android 已知限制），改走 CDP：splash WebView 本身是独立 target，
// 冷启动窗内（splash-first-picture ~0.2s → splash-dismissed ~3.9s）
// attach 它直接 captureScreenshot=真合成器像素。
//
// 流程：ssh nz_exit 杀旧进程 → am start 冷启动 → 8026 轮询出 splash
// target → attach 连拍（App 前台，合成器产帧）→ 帧落 assets/。
// 跑法：node scripts/boot-splash-capture.mjs   （nz 目录下）
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

const SHOTS = new URL('../../docs/active/nine-zero/assets/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const SSH = ['-p', '8022', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', 'localhost'];
const ACT = 'dev.kfm.nz.agent/.MainActivity';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// relay 死在 App 里：App 一死 8026 黑洞（connect 挂起不拒绝），
// fetch 必须带超时，否则死等轮询环整体卡死（2026-08-30 实踩）
const list = async () =>
  (await fetch('http://localhost:8026/json/list', { signal: AbortSignal.timeout(3000) })).json();

// ── 1. 杀旧进程（自毁钩子；必须 FLAG_ACTIVITY_CLEAR_TOP -f 0x04000000——
//    裸 am start 的 extras 被 filterEquals 吸收=纯带回前台，CLEAR_TOP
//    销毁重建才送达。2026-08-30 实踩）；确认 8023 term target 消失=旧
//    进程死透，否则 am start 只是「带回前台」不是冷启动 ──────────────
console.log('nz-exit 杀旧进程…');
await run('ssh', [...SSH, `am start -f 0x04000000 -n ${ACT} --ez nz_exit true`]).catch(() => {});
let dead = false;
for (let i = 0; i < 30 && !dead; i++) {
  await sleep(300);
  const ts = await list().catch(() => []);
  dead = !ts.some((t) => (t.url || '').includes('_tApk='));
}
if (!dead) console.log('⚠️ 9s 内旧进程没死（旧 APK 无 onNewIntent 钩？），照旧起');
else console.log('旧进程已死');

// ── 2. 冷启动 + 轮询 splash target ─────────────────────────────────────
console.log('am start 冷启动…');
const t0 = Date.now();
const launch = run('ssh', [...SSH, `am start -n ${ACT}`]).catch(() => {});
let splash = null;
for (let i = 0; i < 80 && !splash; i++) { // 100ms × 80 = 8s 上限
  const ts = await list().catch(() => []);
  splash = ts.find((t) => (t.url || '').includes('android_asset/splash'));
  if (!splash) await sleep(100);
}
await launch;
if (!splash) {
  console.log('❌ 8s 内没等到 splash target（App 没起来？安装版本旧？）');
  process.exit(1);
}
console.log(`splash target 出现 @${Date.now() - t0}ms：${splash.url}`);

// ── 3. attach 连拍，直到 target 消失（splash WebView 被摘除）────────────
const ws = new WebSocket(splash.webSocketDebuggerUrl);
let idc = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++idc;
  pending.set(id, { resolve, reject });
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
// target 销毁=ws 断，挂着的请求必须全部拒掉——否则 promise 永挂，
// 进程以 unsettled await 退出 13（2026-08-30 实踩：f1 截图撞上
// splash WebView 摘除瞬间）
ws.onclose = () => {
  for (const { reject } of pending.values()) reject(new Error('ws closed（target 已摘除）'));
  pending.clear();
};
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
await send('Page.enable');

const frames = [];
for (let i = 0; i < 10; i++) {
  try {
    // 截图与 target 摘除抢跑：5s 超时=认输收场，不算失败
    const r = await Promise.race([
      send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }),
      sleep(5000).then(() => Promise.reject(new Error('shot 5s 超时'))),
    ]);
    const p = `${SHOTS}boot-splash-f${i}.jpg`;
    writeFileSync(p, Buffer.from(r.data, 'base64'));
    frames.push({ i, at: Date.now() - t0, path: p, bytes: r.data.length });
    console.log(`f${i} @${Date.now() - t0}ms -> ${p}`);
  } catch (e) {
    console.log(`f${i} 拍失败（target 走了？）：${String(e).slice(0, 60)}`);
    break;
  }
  // target 还在不在（splash WebView dismiss 后 destroy）
  const ts = await list().catch(() => []);
  if (!ts.some((t) => t.id === splash.id)) { console.log('splash target 已摘除'); break; }
  await sleep(400);
}
ws.close();
console.log(`共 ${frames.length} 帧`);
writeFileSync('/tmp/nz-boot-splash-capture.json', JSON.stringify({ frames }, null, 2));
process.exit(frames.length ? 0 : 1);
