// ==========================================================================
// tests/server-routes.test.ts — ai/routes.ts 参数校验回归钉子
//
// 测试 /ai/chat/start 的参数校验逻辑，无需启动 Express 服务器：
// 把路由注册成一个假 router，直接调用注册的 handler，传入最小化 req/res mock。
// 完全离线，无网络、无文件 I/O。
//
// 规格来源：docs/design/AI_CHAT_RUNTIME.md §4.6-4.7（空 sessionId 处理）。
// ==========================================================================

import assert from 'assert';
import { group, regression, test } from './runner.js';
import { setupAiRoutes } from '../src/server/ai/routes.js';
import type { StartRunFn } from '../src/server/ai/routes.js';

group('ai/routes — /ai/chat/start 参数校验');

// ---- 测试夹具 ----

type Handler = (req: any, res: any) => void;

/** 把 setupAiRoutes 注册的路由收集到 Map，按 "METHOD PATH" 检索 handler。*/
function collectRoutes(startRunFn?: StartRunFn) {
  const routes = new Map<string, Handler>();
  const fakeRouter = {
    post: (path: string, handler: Handler) => routes.set(`POST ${path}`, handler),
    get:  (path: string, handler: Handler) => routes.set(`GET ${path}`, handler),
  } as any;
  const fakeWs = {} as any;
  setupAiRoutes(fakeRouter, fakeWs, startRunFn);
  return routes;
}

/** 最小化 res mock：记录 status / json 调用。 */
function makeRes() {
  const r: { statusCode: number; body: unknown; ended: boolean } = { statusCode: 200, body: null, ended: false };
  return {
    _r: r,
    status(n: number) { r.statusCode = n; return this; },
    json(b: unknown) { r.body = b; r.ended = true; return this; },
    setHeader() { return this; },
    flushHeaders() {},
    write() {},
    end() { r.ended = true; },
    on() {},
  };
}

// ==========================================================================
// BAR-102 (f46a551): 空 sessionId → 400（删会话后再发送不应 500/崩溃）
// ==========================================================================

regression('BAR-102a', 'f46a551', '缺少 sessionId → 400', () => {
  const routes = collectRoutes();
  const start = routes.get('POST /ai/chat/start')!;
  const res = makeRes();
  start({ body: { messages: [{ role: 'user', content: 'x' }], model: 'm', provider: 'p' } }, res);
  assert(res._r.statusCode === 400, `期望 400，得 ${res._r.statusCode}`);
  assert(typeof (res._r.body as any)?.error === 'string', '响应体应含 error 字段');
});

regression('BAR-102b', 'f46a551', '空字符串 sessionId → 400', () => {
  const routes = collectRoutes();
  const start = routes.get('POST /ai/chat/start')!;
  const res = makeRes();
  start({ body: { sessionId: '', messages: [{ role: 'user', content: 'x' }] } }, res);
  assert(res._r.statusCode === 400, `空串 sessionId 也应返回 400，得 ${res._r.statusCode}`);
});

regression('BAR-102c', 'f46a551', '缺少 messages → 400', () => {
  const routes = collectRoutes();
  const start = routes.get('POST /ai/chat/start')!;
  const res = makeRes();
  start({ body: { sessionId: 'sess-1' } }, res);
  assert(res._r.statusCode === 400, `期望 400，得 ${res._r.statusCode}`);
});

regression('BAR-102d', 'f46a551', '空数组 messages → 400', () => {
  const routes = collectRoutes();
  const start = routes.get('POST /ai/chat/start')!;
  const res = makeRes();
  start({ body: { sessionId: 'sess-1', messages: [] } }, res);
  assert(res._r.statusCode === 400, `空数组 messages 也应拒绝，得 ${res._r.statusCode}`);
});

regression('BAR-102e', 'f46a551', 'messages 不是数组 → 400', () => {
  const routes = collectRoutes();
  const start = routes.get('POST /ai/chat/start')!;
  const res = makeRes();
  start({ body: { sessionId: 'sess-1', messages: 'not-an-array' } }, res);
  assert(res._r.statusCode === 400, `非数组 messages 应拒绝，得 ${res._r.statusCode}`);
});

// 正常请求：mock startRunFn 避免后台生成，只验证 200 路径
test('合法请求 → 200 + runId', () => {
  const fakeStart: StartRunFn = () => ({ id: 'run_test123', done: false } as any);
  const routes = collectRoutes(fakeStart);
  const start = routes.get('POST /ai/chat/start')!;
  const res = makeRes();
  start({ body: { sessionId: 'sess-ok', messages: [{ role: 'user', content: 'hi' }] } }, res);
  assert(res._r.statusCode === 200, `合法请求应 200，得 ${res._r.statusCode}`);
  assert((res._r.body as any)?.runId === 'run_test123', '响应体应含 runId');
}, { tag: 'integration' });

// ---- 其他路由 ----

group('ai/routes — 其他端点');

test('GET /ai/chat/active 无 sessionId → { runId: null }', () => {
  const routes = collectRoutes();
  const active = routes.get('GET /ai/chat/active')!;
  const res = makeRes();
  active({ query: {} }, res);
  assert((res._r.body as any)?.runId === null);
}, { tag: 'integration' });

test('POST /ai/chat/:runId/cancel 不存在的 runId → { ok: false }', () => {
  const routes = collectRoutes();
  const cancel = routes.get('POST /ai/chat/:runId/cancel')!;
  const res = makeRes();
  cancel({ params: { runId: 'run_ghost' } }, res);
  assert((res._r.body as any)?.ok === false);
}, { tag: 'integration' });

test('GET /ai/chat/:runId/status 不存在 → { exists: false }', () => {
  const routes = collectRoutes();
  const status = routes.get('GET /ai/chat/:runId/status')!;
  const res = makeRes();
  status({ params: { runId: 'run_ghost' } }, res);
  assert((res._r.body as any)?.exists === false);
}, { tag: 'integration' });

// ==========================================================================
// 写删接口 drive-by 防护：verifyLocalOrigin 中间件（2026-07-21 审计第三档）
//
// 变更类 /files/* 接口挂了 verifyLocalOrigin：外部网站的跨源写删被 403，
// 本地页面与无 Origin 的脚本放行。浏览器强制带真实 Origin 且 JS 不可伪造。
// ==========================================================================

import { verifyLocalOrigin } from '../src/server/path-utils.js';

group('path-utils — verifyLocalOrigin 跨源写守卫');

/** 调 verifyLocalOrigin，返回 { passed, status }：passed=next 是否被调用 */
function runOriginGuard(origin?: string) {
  let passed = false;
  const r = { statusCode: 0, body: null as unknown };
  const req = { headers: origin === undefined ? {} : { origin } };
  const res = { status(n: number) { r.statusCode = n; return { json(b: unknown) { r.body = b; } }; } };
  verifyLocalOrigin(req, res, () => { passed = true; });
  return { passed, status: r.statusCode };
}

regression('BAR-SEC-09', 'path-utils', '外部 Origin 写 → 403 拒绝', () => {
  const { passed, status } = runOriginGuard('https://evil.example.com');
  assert(!passed, '外部 Origin 不应通过');
  assert(status === 403, `应 403，得 ${status}`);
});

regression('BAR-SEC-10', 'path-utils', '本地回环 Origin → 放行', () => {
  for (const o of ['http://localhost:8021', 'http://127.0.0.1:8021', 'http://[::1]:8021']) {
    const { passed } = runOriginGuard(o);
    assert(passed, `本地 Origin ${o} 应放行`);
  }
});

regression('BAR-SEC-11', 'path-utils', '无 Origin（脚本/curl）→ 放行', () => {
  const { passed } = runOriginGuard(undefined);
  assert(passed, '无 Origin 的非浏览器客户端应放行');
});

regression('BAR-SEC-12', 'path-utils', '畸形 Origin → 拒绝（不放行）', () => {
  const { passed, status } = runOriginGuard('not a url');
  assert(!passed, '无法解析的 Origin 不应放行');
  assert(status === 403, `应 403，得 ${status}`);
});
