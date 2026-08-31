/**
 * tests/bridge-heartbeat.test.ts — WS 心跳看门狗 A 档考题（2026-08-31
 * 僵尸页实锤后立项：WS 会「悄悄死」无 close 事件，inject 零回显、
 * 热更 fetch 全挂、页面还以为活着）
 *
 * 三枚钉：
 *   ①协议钉：服务端收 {t:'ping'} 必回 {t:'pong'}（raw 客户端直发）；
 *   ②活链不冤报：真服务端+TermWsBridge 短心跳，数拍内 onSilentDead
 *     零触发、链路照常可用；
 *   ③死链必报且只报一次：哑服务端（收了不回）+TermWsBridge 短心跳，
 *     onSilentDead 在 ~3 拍内触发且 2s 内只触发一次（防风暴）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①服务端 ping case 删了 → 钉①红；
 *   ②心跳 _awaitingPong 不置位（发完就忘）→ 钉③红。
 */
import { Context } from 'cordis';
import WebSocket, { WebSocketServer } from 'ws';
import { test, group, assert } from './runner.ts';
import { mountTermConnection } from '../src/server/term-connection.ts';
import { mountWsBridge } from '../src/server/ws-bridge.ts';
import { createNzServer } from '../src/server/index.ts';
import { TermWsBridge } from '../src/client/term/bridge.ts';
import type { AddressInfo } from 'node:net';

group('bridge-heartbeat（WS 心跳看门狗）');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

test('①协议钉：ping 必回 pong', async () => {
  const ctx = new Context();
  mountTermConnection(ctx, { shell: '/bin/sh' });
  const server = createNzServer();
  mountWsBridge(ctx, server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/term`);
  await new Promise<void>((r, j) => { ws.on('open', r); ws.on('error', j); });
  const pong = new Promise<Record<string, unknown>>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('3s 没等到 pong')), 3000);
    ws.on('message', (raw: Buffer) => {
      const m = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (m.t === 'pong') { clearTimeout(t); resolve(m); }
    });
  });
  ws.send(JSON.stringify({ t: 'ping' }));
  await pong;
  ws.close();
  await new Promise<void>((r) => server.close(() => r()));
});

test('②活链不冤报：真服务端短心跳数拍零触发', async () => {
  const ctx = new Context();
  mountTermConnection(ctx, { shell: '/bin/sh' });
  const server = createNzServer();
  mountWsBridge(ctx, server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  let silent = 0;
  const bridge = new TermWsBridge(`ws://127.0.0.1:${port}/ws/term`, {
    onOutput() {}, onExit() {},
    onSilentDead: () => { silent++; },
  }, 150);
  bridge.connect();
  await sleep(700); // ≈4.5 拍
  assert(silent === 0, `活链不得报假死（报了 ${silent} 次）`);
  // 链路照常可用：open 拿得到会话
  const id = await bridge.open({ command: 'cat' });
  assert(typeof id === 'string' && id.length > 0, '活链 open 照常');
  bridge.stop();
  await new Promise<void>((r) => server.close(() => r()));
});

test('③死链必报且只报一次：哑服务端 ~3 拍内触发', async () => {
  // 哑服务端：收下所有帧，一概不回（= 链路假死形态）
  const dumb = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>((r) => dumb.on('listening', r));
  dumb.on('connection', (ws) => ws.on('message', () => { /* 沉默 */ }));
  const { port } = dumb.address() as AddressInfo;
  let silent = 0;
  const bridge = new TermWsBridge(`ws://127.0.0.1:${port}/ws/term`, {
    onOutput() {}, onExit() {},
    onSilentDead: () => { silent++; },
  }, 150);
  bridge.connect();
  const t0 = Date.now();
  while (silent === 0 && Date.now() - t0 < 3000) await sleep(30);
  assert(silent > 0, '哑服务端 3s 内必须报假死');
  await sleep(1500); // 继续观察：不得重复报（防风暴）
  assert(silent === 1, `假死只许报一次（报了 ${silent} 次）`);
  bridge.stop();
  await new Promise<void>((r) => dumb.close(() => r()));
});
