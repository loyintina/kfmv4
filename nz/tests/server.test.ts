/**
 * tests/server.test.ts — nz 服务端最小出生 A 档考题（8.8.1a）
 *
 * 考四件：静态服务能取到页 / 越界 fail-closed / 404 / 服务端总线活了。
 * 全用临时端口真起真访，不 mock。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①resolveStatic 不做越界判定（直接 join 返回）→ 「../ 逃逸 403」钉红；
 *   ②serverCtx 不注册 hello 见证 → 「服务端总线活了」钉红。
 */
import { test, group, assert } from './runner.ts';
import { createNzServer, resolveStatic, serverCtx, serverBootLog } from '../src/server/index.ts';
import type { Server } from 'node:http';

function listen(server: Server): Promise<number> {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveListen(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

group('server（服务端最小出生）');

test('静态服务：/ 与 /bundle.js 可取，content-type 正确', async () => {
  const server = createNzServer();
  const port = await listen(server);
  try {
    const html = await fetch(`http://127.0.0.1:${port}/`);
    assert(html.status === 200, '/ 应 200');
    assert((html.headers.get('content-type') ?? '').includes('text/html'), '/ 应是 text/html');
    assert((await html.text()).includes('kfm-nz'), '/ 应是 nz 骨架页');
    const js = await fetch(`http://127.0.0.1:${port}/bundle.js`);
    assert(js.status === 200 && (js.headers.get('content-type') ?? '').includes('javascript'), 'bundle.js 应 200 + js 类型');
    const info = await fetch(`http://127.0.0.1:${port}/build-info.json`);
    assert(info.status === 200, 'build-info.json 应 200');
  } finally {
    server.close();
  }
});

test('越界 fail-closed：../ 逃逸 → 403，不存在 → 404', async () => {
  // resolveStatic 纯函数直判（等号左边的路径必须死在 public/ 外）
  assert(resolveStatic('/../../etc/passwd') === null, '绝对逃逸应 null');
  assert(resolveStatic('/%2e%2e/%2e%2e/etc/passwd') === null, 'URL 编码逃逸应 null');
  const server = createNzServer();
  const port = await listen(server);
  try {
    const escaped = await fetch(`http://127.0.0.1:${port}/%2e%2e/%2e%2e/etc/passwd`);
    assert(escaped.status === 403 || escaped.status === 404, `逃逸应被挡（403/404），实际 ${escaped.status}`);
    const missing = await fetch(`http://127.0.0.1:${port}/no-such-file.xyz`);
    assert(missing.status === 404, '不存在应 404');
  } finally {
    server.close();
  }
});

test('服务端 cordis 根总线：hello 见证在案，注册/清理链可复验', async () => {
  assert(serverBootLog.some((l) => l.includes('服务端总线活了')), 'bootLog 应有服务端 hello 见证');
  let cleaned = false;
  const probe = serverCtx.plugin((ctx) => {
    ctx.provide('serverProbe', 1);
    ctx.effect(() => () => { cleaned = true; });
  });
  await probe;
  let consumed: unknown = null;
  serverCtx.inject(['serverProbe'], (ctx) => {
    consumed = (ctx as unknown as Record<string, unknown>).serverProbe; // escape-ok: 临时探针键不走声明合并
  });
  await flush0();
  assert(consumed === 1, 'inject 应消费到探针服务');
  await probe.dispose();
  assert(cleaned, 'dispose 后 effect 清理应执行');
});

const flush0 = () => new Promise((r) => setTimeout(r, 0));

// ========== 编码协商（2026-09-01 bundle 增重插曲：慢隧道首载超考卷预算，
// 修法=构建期预压缩 .gz/.br + 静态服务按 Accept-Encoding 伺服）==========
// 用 node:http 原始请求拿未解码字节——fetch(undici) 会透明解压，量不到线上级体积。

import { get as httpGet } from 'node:http';
import { readFileSync } from 'node:fs';

interface RawResp { status?: number; headers: Record<string, string | string[] | undefined>; bytes: number }
function rawGet(port: number, path: string, headers: Record<string, string>): Promise<RawResp> {
  return new Promise((res, rej) => {
    const req = httpGet({ host: '127.0.0.1', port, path, headers }, (r) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => res({ status: r.statusCode, headers: r.headers, bytes: Buffer.concat(chunks).length }));
    });
    req.on('error', rej);
  });
}

group('server 编码协商（预压缩兄弟文件伺服）');

test('无 Accept-Encoding → 原文，无 content-encoding', async () => {
  const server = createNzServer();
  const port = await listen(server);
  try {
    const r = await rawGet(port, '/bundle.js', {});
    assert(r.status === 200, '应 200');
    assert(!r.headers['content-encoding'], '无协商不得发 content-encoding');
    const raw = readFileSync(new URL('../public/bundle.js', import.meta.url));
    assert(r.bytes === raw.length, `应与原文等字节（${r.bytes} vs ${raw.length}）`);
  } finally {
    server.close();
  }
});

test('Accept-Encoding: gzip → Content-Encoding: gzip + Vary + 体积≤原文 40%', async () => {
  const server = createNzServer();
  const port = await listen(server);
  try {
    const r = await rawGet(port, '/bundle.js', { 'accept-encoding': 'gzip' });
    assert(r.status === 200, '应 200');
    assert(r.headers['content-encoding'] === 'gzip', `应 content-encoding: gzip，实际 ${r.headers['content-encoding']}`);
    const vary = String(r.headers.vary ?? '').toLowerCase();
    assert(vary.includes('accept-encoding'), 'Vary 应含 accept-encoding');
    const raw = readFileSync(new URL('../public/bundle.js', import.meta.url)).length;
    assert(r.bytes <= raw * 0.4, `压缩体 ${r.bytes} 应≤原文 ${raw} 的 40%`);
  } finally {
    server.close();
  }
});

test('Accept-Encoding: gzip, br → br 优先（体积再小一档）', async () => {
  const server = createNzServer();
  const port = await listen(server);
  try {
    const br = await rawGet(port, '/bundle.js', { 'accept-encoding': 'gzip, br' });
    assert(br.headers['content-encoding'] === 'br', `br 在前应发 br，实际 ${br.headers['content-encoding']}`);
    const gz = await rawGet(port, '/bundle.js', { 'accept-encoding': 'gzip' });
    assert(br.bytes <= gz.bytes, `br (${br.bytes}) 应≤gzip (${gz.bytes})`);
  } finally {
    server.close();
  }
});
