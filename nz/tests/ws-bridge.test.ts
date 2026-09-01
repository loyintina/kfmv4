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
import { execSync } from 'node:child_process';
import WebSocket from 'ws';
import { test, group, assert } from './runner.ts';
import { mountTermConnection } from '../src/server/term-connection.ts';
import { mountTmuxConnection } from '../src/server/tmux-connection.ts';
import { mountWsBridge } from '../src/server/ws-bridge.ts';
import { createNzServer } from '../src/server/index.ts';
import type { AddressInfo } from 'node:net';

interface Ctx { ctx: Context; url: string; closeServer(): Promise<void> }

async function newEnv(): Promise<Ctx> {
  const ctx = new Context();
  mountTermConnection(ctx, { shell: '/bin/sh' });
  mountTmuxConnection(ctx);
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

// ========== tmux 控制通道开门（宪法 §6 Step 2，2026-09-01）==========
// 帧：C→S {t:'tmux-open',session} / {t:'tmux-select',session,id} / {t:'tmux-close',session}
//     S→C {t:'tmux-state',session,windows} / {t:'tmux-exit',session}

const TS = 'kfm-ws-exam';
const sh = (cmd: string): string => execSync(cmd, { encoding: 'utf8' }).trim();

group('ws-bridge tmux 帧（控制通道开门）');

test('tmux-open 真会话→tmux-state 帧（窗口列表）+ tmux-select 切换生效', async () => {
  try { sh(`tmux kill-session -t ${TS}`); } catch { /* 不存在即可 */ }
  sh(`tmux new-session -d -s ${TS} -x 100 -y 26 -n w1`);
  sh(`tmux new-window -t ${TS} -n w2`);
  const env = await newEnv();
  const c = await client(env.url);
  try {
    c.send({ t: 'tmux-open', session: TS });
    const st = await c.wait((m) => m.t === 'tmux-state' && Array.isArray(m.windows) && (m.windows as unknown[]).length === 2, 'tmux-state 两窗');
    const wins = st.windows as Array<{ id: string; name: string; active: boolean }>;
    assert(wins.some((w) => w.name === 'w1') && wins.some((w) => w.name === 'w2'), '窗口名应 w1/w2');
    const target = wins.find((w) => w.name === 'w2')!;
    c.send({ t: 'tmux-select', session: TS, id: target.id });
    // 权威验证：问 tmux 本尊当前窗（控制通道之外的第三方法庭）
    let activeId = '';
    for (let i = 0; i < 30; i++) {
      activeId = sh(`tmux display-message -t ${TS} -p '#{window_id}'`);
      if (activeId === target.id) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(activeId === target.id, `select 应切到 ${target.id}，实际 ${activeId}`);
  } finally {
    c.close();
    sh(`tmux kill-session -t ${TS} 2>/dev/null || true`);
    await env.closeServer();
  }
});

test('tmux-open 不存在会话→tmux-exit 帧（客户端据此隐藏标签条）', async () => {
  const env = await newEnv();
  const c = await client(env.url);
  try {
    c.send({ t: 'tmux-open', session: 'kfm-no-such-session' });
    const ex = await c.wait((m) => m.t === 'tmux-exit', 'tmux-exit 帧');
    assert(ex.t === 'tmux-exit', '应收到 tmux-exit');
  } finally {
    c.close();
    await env.closeServer();
  }
});

test('tmux-cmd 透传：new-window→推送新窗+automatic-rename off 生效', async () => {
  try { sh(`tmux kill-session -t ${TS}`); } catch { /* 不存在即可 */ }
  sh(`tmux new-session -d -s ${TS} -x 100 -y 26 -n w1`);
  const env = await newEnv();
  const c = await client(env.url);
  try {
    c.send({ t: 'tmux-open', session: TS });
    await c.wait((m) => m.t === 'tmux-state', '首帧 state');
    c.send({ t: 'tmux-cmd', session: TS, cmd: 'new-window -n cmdwin' });
    const st = await c.wait((m) => m.t === 'tmux-state' && (m.windows as Array<{ name: string }>).some((w) => w.name === 'cmdwin'), 'cmdwin 推送');
    const cmdwin = (st.windows as Array<{ id: string; name: string }>).find((w) => w.name === 'cmdwin')!;
    c.send({ t: 'tmux-cmd', session: TS, cmd: `set -w automatic-rename off -t ${cmdwin.id}` });
    await new Promise((r) => setTimeout(r, 300));
    const names = sh(`tmux list-windows -t ${TS} -F '#{window_name}'`).split('\n');
    assert(names.includes('cmdwin'), `cmdwin 应在列，实际 ${JSON.stringify(names)}`);
  } finally {
    c.close();
    sh(`tmux kill-session -t ${TS} 2>/dev/null || true`);
    await env.closeServer();
  }
});

test('socket 断开→控制客户端收尸（不占 tmux 客户端位）', async () => {
  try { sh(`tmux kill-session -t ${TS}`); } catch { /* 不存在即可 */ }
  sh(`tmux new-session -d -s ${TS} -x 100 -y 26 -n w1`);
  const env = await newEnv();
  const c = await client(env.url);
  c.send({ t: 'tmux-open', session: TS });
  await c.wait((m) => m.t === 'tmux-state', '首帧 state');
  c.close();
  let clientsGone = false;
  for (let i = 0; i < 30; i++) {
    // list-clients 无客户端时退出码 0 且输出空串（不触发 || echo none）——
    // 空串=收尸成功，别只认 'none'（0901 考卷自身判定 bug，桥是好的）
    const out = sh(`tmux list-clients -t ${TS} 2>/dev/null || echo none`);
    if (out.trim() === 'none' || out.trim() === '') { clientsGone = true; break; }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(clientsGone, 'socket 断开后控制客户端应被收尸');
  sh(`tmux kill-session -t ${TS} 2>/dev/null || true`);
  await env.closeServer();
});
