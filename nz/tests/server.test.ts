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
