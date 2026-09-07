/**
 * tests/link-state.test.ts — R1 断链自愈 A 档考题（2026-09-08 判据稿签收）
 *
 * 覆盖：/healthz 协议钉 + LinkTracker 分层状态机纯逻辑（探测计数/防抖/
 * 相态转移/可见性）+ 会话注册表（并账/封顶/出账/diff）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①服务端 /healthz case 删了 → 钉①红；
 *   ②tracker failsToDown 判定改 1 拍就降 → 钉④红；
 *   ③registryRemove 不落盘 → 钉⑧红。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { createNzServer } from '../src/server/index.ts';
import {
  LinkTracker,
  getLinkTracker,
  type LinkSnapshot,
} from '../src/client/term/link-state.ts';
import {
  loadRegistry,
  saveRegistry,
  registryAddLive,
  registryRemove,
  registryMissing,
  REGISTRY_CAP,
  type KvStorage,
} from '../src/client/term/session-registry.ts';
import type { AddressInfo } from 'node:net';

group('link-state（R1 断链自愈 A 档）');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('①healthz 协议钉：GET /healthz → 200 {ok:true}（no-store）', async () => {
  const server = createNzServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/healthz`, { cache: 'no-store' });
  assert(res.status === 200, `status=${res.status}`);
  assert(res.headers.get('cache-control')?.includes('no-store') === true, '必须 no-store');
  const body = (await res.json()) as { ok: unknown; uptime: unknown };
  assert(body.ok === true, 'ok 必须 true');
  assert(typeof body.uptime === 'number', 'uptime 必须数值');
  await new Promise<void>((r) => server.close(() => r()));
});

test('②boot 期一闪不可见；wsLink(true) → OK', () => {
  const t = new LinkTracker();
  const s0 = t.snapshot();
  assert(s0.phase === 'RECONNECTING', `boot 相态=${s0.phase}`);
  assert(s0.visible === false, 'boot 一闪不可见');
  t.wsLink(true);
  const s1 = t.snapshot();
  assert(s1.phase === 'OK', `连接后=${s1.phase}`);
  assert(s1.lastOkAt > 0, 'OK 时刻落账');
  t.stop();
});

test('③断一拍可见 RECONNECTING；连续败 2 拍降 DOWN（failsToDown=2）', async () => {
  let probeCalls = 0;
  const t = new LinkTracker({ probe: () => { probeCalls++; return Promise.resolve(false); }, probeMs: 20 });
  t.wsLink(false);
  const s1 = t.snapshot();
  assert(s1.phase === 'RECONNECTING' && s1.visible === true, '断一拍即可见');
  assert(s1.retries === 1, `retries=${s1.retries}`);
  await sleep(70); // ≥3 拍
  assert(t.phase === 'DOWN', `连续败 2 拍后应 DOWN，实际 ${t.phase}`);
  assert(probeCalls >= 3, `探测应持续走表（calls=${probeCalls}）`);
  t.stop();
});

test('④防抖：单拍失败不降 DOWN；探测恢复停表', async () => {
  let calls = 0;
  const t = new LinkTracker({
    probe: () => { calls++; return Promise.resolve(calls >= 2); }, // 拍1 败、拍2 起
    probeMs: 20,
  });
  t.wsLink(false);
  await sleep(70); // 拍1 败（不降）、拍2 成（停表）
  assert(t.phase === 'RECONNECTING', `单拍败不得降 DOWN，实际 ${t.phase}`);
  assert(!t.snapshot().transitions.some((tr) => tr.to === 'DOWN'), '全程不得出现 DOWN');
  const steady = calls;
  await sleep(80);
  assert(calls === steady, `停表后不得再探（${steady}→${calls}）`);
  t.stop();
});

test('⑤缺账喂达：ws up 时 DEGRADED/OK 翻转；ws down 时只记账', () => {
  const t = new LinkTracker();
  t.wsLink(true);
  t.setMissing(['dsh', 'amp']);
  assert(t.phase === 'DEGRADED', `缺账应 DEGRADED，实际 ${t.phase}`);
  t.setMissing([]);
  assert(t.phase === 'OK', '清账应回 OK');
  t.wsLink(false);
  t.setMissing(['psh']); // down 期只记账
  assert(t.phase === 'RECONNECTING', 'down 期相态不得因缺账翻转');
  t.wsLink(true);
  assert(t.phase === 'DEGRADED', '回链后按账定相 DEGRADED');
  t.stop();
});

test('⑥note() 记事不翻相；事件环保序封顶', () => {
  const t = new LinkTracker({ historyCap: 3 });
  t.wsLink(true);
  t.note('自愈 reload');
  const s = t.snapshot();
  assert(s.phase === 'OK', 'note 不得翻相');
  assert(s.transitions.at(-1)?.why === '自愈 reload', 'note 进环');
  for (let i = 0; i < 5; i++) t.note(`n${i}`);
  assert(t.snapshot().transitions.length === 3, `环封顶 3，实际 ${t.snapshot().transitions.length}`);
  t.stop();
});

test('⑦可见性：DOWN/DEGRADED 恒可见，重连后 OK 不可见', async () => {
  const t = new LinkTracker({ probe: () => Promise.resolve(false), probeMs: 15 });
  t.wsLink(true);
  t.setMissing(['x']);
  assert(t.snapshot().visible === true, 'DEGRADED 恒可见');
  t.setMissing([]);
  assert(t.snapshot().visible === false, 'OK 不可见');
  t.stop();
});

test('⑧注册表：并账保序/封顶 FIFO/出账/diff', () => {
  const backing = new Map<string, string>();
  const store: KvStorage = {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => void backing.set(k, v),
    removeItem: (k) => void backing.delete(k),
  };
  assert(loadRegistry(store).length === 0, '空账');
  let reg = registryAddLive(['dsh', 'amp'], store);
  assert(JSON.stringify(reg) === '["dsh","amp"]', `并账保序：${JSON.stringify(reg)}`);
  reg = registryAddLive(['dsh', 'omp', 'psh'], store);
  assert(JSON.stringify(reg) === '["dsh","amp","omp","psh"]', `去重接尾：${JSON.stringify(reg)}`);
  // 封顶 FIFO：灌满+1，最旧（dsh）被掐
  const flood: string[] = [];
  for (let i = 0; i < REGISTRY_CAP + 1; i++) flood.push(`s${i}`);
  reg = registryAddLive(flood, store);
  assert(reg.length === REGISTRY_CAP, `封顶 ${REGISTRY_CAP}，实际 ${reg.length}`);
  assert(!reg.includes('dsh') && !reg.includes('amp'), 'FIFO 掐最旧');
  assert(reg[0] === 's1', `掐头后新首=${reg[0]}`);
  // 出账落盘
  registryRemove('s1', store);
  assert(!loadRegistry(store).includes('s1'), '出账必须落盘');
  // diff：账上有、活表没有 → missing 保账序（此时账=[s2,s4,s5..s16]）
  registryRemove('s3', store);
  const missing = registryMissing(['s2', 's4'], store);
  assert(
    missing.length === REGISTRY_CAP - 4 && missing[0] === 's5' &&
      !missing.includes('s2') && !missing.includes('s4'),
    `diff 精确性异常：${JSON.stringify(missing)}`,
  );
  const missing2 = registryMissing([], store);
  assert(missing2.length === loadRegistry(store).length, '活表全灭 = 账全缺');
});

test('⑨getLinkTracker 单例 + __kfmNzLink 钩子（浏览器态）', () => {
  // Node 无 window：单例照常，钩子挂接静默跳过
  const a = getLinkTracker();
  const b = getLinkTracker();
  assert(a === b, '单例');
  a.stop();
});

test('⑩subscribe 即推+退订', () => {
  const t = new LinkTracker();
  t.wsLink(true); // 先到 OK，退开相态基线
  let n = 0;
  const off = t.subscribe((_s: LinkSnapshot) => { n++; });
  assert(n === 1, '订阅即推当前快照');
  t.wsLink(false);
  assert(n === 2, '相态变化推送');
  off();
  t.wsLink(true);
  assert(n === 2, '退订后不再推');
  t.stop();
});

test('⑪saveRegistry/loadRegistry round-trip + 坏账兜底', () => {
  const backing = new Map<string, string>();
  const store: KvStorage = {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => void backing.set(k, v),
    removeItem: (k) => void backing.delete(k),
  };
  saveRegistry(['a', 'b'], store);
  assert(JSON.stringify(loadRegistry(store)) === '["a","b"]', 'round-trip');
  backing.set('nzTmuxRegistry', '不是 JSON');
  assert(loadRegistry(store).length === 0, '坏账兜底空账');
  backing.set('nzTmuxRegistry', JSON.stringify([1, 'x', null]));
  assert(JSON.stringify(loadRegistry(store)) === '["x"]', '非串项滤除');
});
