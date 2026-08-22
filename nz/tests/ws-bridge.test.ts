/**
 * tests/ws-bridge.test.ts — 终端 WS 桥 A 档考题（8.8.2③b）
 *
 * 全真 socket：ephemeral 端口起真 HTTP+WS 服务，ws 客户端直连，
 * 走 open→input→output→list→attach 重连→close 全链。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①output 帧不带会话 id → 「回帧带 id」钉红；
 *   ②socket 断开时把会话杀掉 → 「断线会话不死，attach 续命」钉红。
 */
import { Context } from 'cordis';
import WebSocket from 'ws';
import { test, group, assert } from './runner.ts';
import { mountTermConnection } from '../src/server/term-connection.ts';
import { mountWsBridge } from '../src/server/ws-bridge.ts';
import { createNzServer } from '../src/server/index.ts';
import type { AddressInfo } from 'node:net';

interface Ctx { ctx: Context; url: string; closeServer(): Promise<void> }

async function newEnv(): Promise<Ctx> {
  const ctx = new Context();
  mountTermConnection(ctx, { shell: '/bin/sh' });
  const server = createNzServer();
  mountWsBridge(ctx, server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    ctx,
    url: `ws://127.0.0.1:${port}/ws/term`,
    closeServer: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/** 一个连好、带消息泵的小客户端 */
async function client(url: string) {
  const ws = new WebSocket(url);
  const inbox: Record<string, unknown>[] = [];
  const waiters: Array<(m: Record<string, unknown>) => boolean> = [];
  ws.on('message', (raw: Buffer) => {
    const m = JSON.parse(raw.toString()) as Record<string, unknown>;
    const i = waiters.findIndex((w) => w(m));
    if (i >= 0) waiters.splice(i, 1);
    else inbox.push(m);
  });
  await new Promise<void>((r, j) => { ws.on('open', r); ws.on('error', j); });
  return {
    send: (m: Record<string, unknown>) => ws.send(JSON.stringify(m)),
    /** 等一条满足条件的帧（先查存货再等新的，3s 超时） */
    wait(pred: (m: Record<string, unknown>) => boolean, what: string): Promise<Record<string, unknown>> {
      const hit = inbox.find(pred);
      if (hit) return Promise.resolve(hit);
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`等不到帧：${what}`)), 3000);
        waiters.push((m) => {
          if (!pred(m)) return false;
          clearTimeout(t);
          resolve(m);
          return true;
        });
      });
    },
    /** 收集 output 数据流 */
    async collect(id: string, needle: string, what: string): Promise<string> {
      let buf = '';
      const t0 = Date.now();
      while (!buf.includes(needle)) {
        const m = await this.wait(
          (f) => f.t === 'output' && f.id === id && !buf.includes(needle),
          what,
        );
        buf += String(m.data);
        if (Date.now() - t0 > 3000) throw new Error(`收集超时：${what}（已收 ${buf.slice(0, 40)}）`);
      }
      return buf;
    },
    close: () => ws.close(),
  };
}

group('ws-bridge（终端 WS 桥）');

test('open→input→output 全链：帧↔方法翻译正确，回帧带会话 id', async () => {
  const env = await newEnv();
  const c = await client(env.url);
  c.send({ t: 'open', command: 'cat', cols: 80, rows: 24 });
  const opened = await c.wait((m) => m.t === 'opened', 'opened 帧');
  const id = String(opened.id);
  c.send({ t: 'input', id, data: '桥接回显\n' });
  const got = await c.collect(id, '桥接回显', 'cat 经桥回显');
  assert(got.includes('桥接回显'), '输出帧应带回显');
  c.send({ t: 'list' });
  const lst = await c.wait((m) => m.t === 'list', 'list 帧');
  assert((lst.ids as string[]).includes(id), 'list 应含活会话');
  c.send({ t: 'close', id });
  await c.wait((m) => m.t === 'exit' && m.id === id, 'close 后 exit 帧');
  c.close();
  await env.closeServer();
});

test('断线会话不死：socket 断开只退订，重连 attach + tail 补断档', async () => {
  const env = await newEnv();
  const c1 = await client(env.url);
  c1.send({ t: 'open', command: 'cat' });
  const opened = await c1.wait((m) => m.t === 'opened', 'opened 帧');
  const id = String(opened.id);
  c1.send({ t: 'input', id, data: '断线前\n' });
  await c1.collect(id, '断线前', '断线前回显');
  c1.close();
  await new Promise((r) => setTimeout(r, 100)); // 等服务端感知 close
  assert(env.ctx.termConn.list().includes(id), 'socket 断开后会话应仍活着');
  // 断档期输出
  env.ctx.termConn.attach(id)!.sendInput('断档期\n');
  await new Promise((r) => setTimeout(r, 100));
  // 新 socket attach 重连
  const c2 = await client(env.url);
  c2.send({ t: 'attach', id });
  const att = await c2.wait((m) => m.t === 'attached' && m.id === id, 'attached 帧');
  const tail = String(att.tail);
  assert(tail.includes('断线前') && tail.includes('断档期'), 'tail 应补断档期输出');
  c2.send({ t: 'input', id, data: '重连后\n' });
  await c2.collect(id, '重连后', '重连后续收');
  c2.send({ t: 'close', id });
  await c2.wait((m) => m.t === 'exit' && m.id === id, '终态 exit');
  c2.close();
  await env.closeServer();
});
