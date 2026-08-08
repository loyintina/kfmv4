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
import { join } from 'path';
import { setupAiRoutes } from '../src/server/ai/routes.js';
import type { StartRunFn } from '../src/server/ai/routes.js';
import { executeTool } from '../src/server/ai/tools/index.js';
import { KFM_DATA_DIR } from '../src/server/path-utils.js';
import { sliceMessages, capMessagesPayload } from '../src/server/routes/files.js';

group('ai/routes — /ai/chat/start 参数校验');

// ---- 测试夹具 ----

type Handler = (req: any, res: any) => void;

/** 把 setupAiRoutes 注册的路由收集到 Map，按 "METHOD PATH" 检索 handler。
 *  express 签名是 (path, ...middleware, handler)，取最后一个为业务 handler。*/
function collectRoutes(startRunFn?: StartRunFn) {
  const routes = new Map<string, Handler>();
  const fakeRouter = {
    post: (path: string, ...handlers: Handler[]) => routes.set(`POST ${path}`, handlers[handlers.length - 1]),
    get:  (path: string, ...handlers: Handler[]) => routes.set(`GET ${path}`, handlers[handlers.length - 1]),
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

// 会话权限档案：script 类会话未显式传 tools 时服务端默认只读白名单 read/grep/glob
// （实验臂污染事故后立规——曾 write 污染 repo/sed 改源码/rm 删会话）；
// panel（缺省）保持全量（undefined）；显式 tools 原样透传。
regression('BAR-SESSION-PROFILE-01', 'pending-commit', 'script 会话缺省 tools 收到只读白名单，显式透传，panel 全量', () => {
  const seen: Array<{ tools: unknown }> = [];
  const fakeStart: StartRunFn = (...args: unknown[]) => {
    seen.push({ tools: args[7] }); // startRun 第 8 参 = tools 白名单
    return { id: 'run_profile', done: false } as any;
  };
  const routes = collectRoutes(fakeStart);
  const start = routes.get('POST /ai/chat/start')!;
  const base = { sessionId: 'sess-prof', messages: [{ role: 'user', content: 'hi' }] };
  const call = (body: Record<string, unknown>) => { const res = makeRes(); start({ body }, res); assert(res._r.statusCode === 200, `应 200，得 ${res._r.statusCode}`); };

  call({ ...base, sessionClass: 'script' });
  assert(JSON.stringify(seen[0]!.tools) === JSON.stringify(['read', 'grep', 'glob']),
    `script 缺省应只读白名单，得 ${JSON.stringify(seen[0]!.tools)}`);

  call({ ...base, sessionClass: 'script', tools: ['read'] });
  assert(JSON.stringify(seen[1]!.tools) === JSON.stringify(['read']),
    `显式 tools 应原样透传，得 ${JSON.stringify(seen[1]!.tools)}`);

  call({ ...base });
  assert(seen[2]!.tools === undefined, `panel 缺省应全量（undefined），得 ${JSON.stringify(seen[2]!.tools)}`);
});

// 写监狱（2026-08-06 e13 沙箱逃逸事故：V3 写穿 fixture 模板、27B 写进真仓库
// docs/——提示词约定不防呆，write/edit 路径在 executeTool 扼点强制沙箱 containment）。
// 路由层纪律：仅 script 会话可设、必须落 sessions/script/ 内，其余忽略。
regression('BAR-SANDBOX-JAIL-01', 'pending-commit', 'sandboxRoot 仅 script+script/ 内路径才透传为写监狱根', () => {
  const seen: Array<{ jail: unknown }> = [];
  const fakeStart: StartRunFn = (...args: unknown[]) => {
    seen.push({ jail: args[11] }); // startRun 第 12 参 = sandboxRoot
    return { id: 'run_jail', done: false } as any;
  };
  const routes = collectRoutes(fakeStart);
  const start = routes.get('POST /ai/chat/start')!;
  const base = { sessionId: 'sess-jail', messages: [{ role: 'user', content: 'hi' }] };
  const call = (body: Record<string, unknown>) => { const res = makeRes(); start({ body }, res); assert(res._r.statusCode === 200, `应 200，得 ${res._r.statusCode}`); };
  const scriptDir = join(KFM_DATA_DIR, 'sessions', 'script');

  call({ ...base, sessionClass: 'script', sandboxRoot: join(scriptDir, 'sandbox-x1') });
  assert(typeof seen[0]!.jail === 'string' && (seen[0]!.jail as string).endsWith('sandbox-x1'),
    `script 会话合法 sandboxRoot 应透传，得 ${JSON.stringify(seen[0]!.jail)}`);

  call({ ...base, sandboxRoot: join(scriptDir, 'sandbox-x2') });
  assert(seen[1]!.jail === undefined, `panel 会话 sandboxRoot 应忽略，得 ${JSON.stringify(seen[1]!.jail)}`);

  call({ ...base, sessionClass: 'script', sandboxRoot: '/etc' });
  assert(seen[2]!.jail === undefined, `越出 sessions/script/ 的 sandboxRoot 应忽略，得 ${JSON.stringify(seen[2]!.jail)}`);

  call({ ...base, sessionClass: 'script' });
  assert(seen[3]!.jail === undefined, `不传 sandboxRoot 应不限制（undefined），得 ${JSON.stringify(seen[3]!.jail)}`);
});

// 写监狱扼点：executeTool 在 sandboxRoot 下拒绝沙箱外 write/edit（fail-closed：
// ctx.cwd 与 process.cwd() 双解析任一越界即拒），沙箱内放行，未设根不限制。
regression('BAR-SANDBOX-JAIL-02', 'pending-commit', 'executeTool 沙箱外 write/edit 拒绝、沙箱内放行', async () => {
  const jail = join(KFM_DATA_DIR, 'sessions', 'script', 'sandbox-jailtest');
  const ctx = { cwd: '/root/kfmv4', wsServer: {} as never, sandboxRoot: jail };
  const outside = await executeTool('write', { path: 'docs/evil.md', content: 'x' }, ctx);
  assert(outside.isError === true, '相对路径逃逸应拒绝');
  assert(String(outside.content[0]!.text).includes('沙箱限制'), '拒绝文案应指回沙箱');
  const outsideAbs = await executeTool('edit', { path: '/root/kfmv4/src/x.ts', old: 'a', new: 'b' }, ctx);
  assert(outsideAbs.isError === true, '绝对路径逃逸应拒绝');
  const inside = await executeTool('write', { path: join(jail, 'ok.md'), content: 'x' }, ctx);
  assert(inside.isError !== true, `沙箱内写入应放行，得 ${JSON.stringify(inside.content[0])}`);
  const noJail = await executeTool('write', { path: '/tmp/nojail-ok.md', content: 'x' },
    { cwd: '/root/kfmv4', wsServer: {} as never });
  assert(noJail.isError !== true, '未设 sandboxRoot 不应限制');
});

// 读监狱（2026-08-08 docprobe 试点 v2 污染事故：被试 agent 顺仓内设计文档里的
// 绝对路径直读私有区答案——只读白名单限工具类型不限路径，考场边界在 executeTool
// 扼点强制）。路由层纪律：仅 script 会话可设；与写监狱不同，读监狱只收窄访问面
// （不引入新权限），不限制必须落在哪个目录。
regression('BAR-READ-JAIL-01', 'pending-commit', 'readRoot 仅 script 会话透传为读监狱根，panel 忽略，缺省不限制', () => {
  const seen: Array<{ jail: unknown }> = [];
  const fakeStart: StartRunFn = (...args: unknown[]) => {
    seen.push({ jail: args[12] }); // startRun 第 13 参 = readRoot
    return { id: 'run_rjail', done: false } as any;
  };
  const routes = collectRoutes(fakeStart);
  const start = routes.get('POST /ai/chat/start')!;
  const base = { sessionId: 'sess-rjail', messages: [{ role: 'user', content: 'hi' }] };
  const call = (body: Record<string, unknown>) => { const res = makeRes(); start({ body }, res); assert(res._r.statusCode === 200, `应 200，得 ${res._r.statusCode}`); };

  call({ ...base, sessionClass: 'script', readRoot: '/root/kfmv4' });
  assert(seen[0]!.jail === '/root/kfmv4',
    `script 会话 readRoot 应透传，得 ${JSON.stringify(seen[0]!.jail)}`);

  call({ ...base, readRoot: '/root/kfmv4' });
  assert(seen[1]!.jail === undefined, `panel 会话 readRoot 应忽略，得 ${JSON.stringify(seen[1]!.jail)}`);

  call({ ...base, sessionClass: 'script' });
  assert(seen[2]!.jail === undefined, `不传 readRoot 应不限制（undefined），得 ${JSON.stringify(seen[2]!.jail)}`);
});

// 读监狱扼点：executeTool 在 readRoot 下拒绝监狱外 read/grep/glob（fail-closed：
// ctx.cwd 与 process.cwd() 双解析任一越界即拒），监狱内放行，未设根不限制。
regression('BAR-READ-JAIL-02', 'pending-commit', 'executeTool 监狱外 read/grep 拒绝、监狱内放行', async () => {
  const ctx = { cwd: '/root/kfmv4', wsServer: {} as never, readRoot: '/root/kfmv4' };
  const outsideRel = await executeTool('read', { path: '../.kfmv4/experiments/docprobe/truth/shoushi.md' }, ctx);
  assert(outsideRel.isError === true, 'read 相对路径逃逸应拒绝');
  assert(String(outsideRel.content[0]!.text).includes('沙箱限制'), '拒绝文案应指明读限制');
  const outsideAbs = await executeTool('read', { path: '/etc/hostname' }, ctx);
  assert(outsideAbs.isError === true, 'read 绝对路径逃逸应拒绝');
  const grepOutside = await executeTool('grep', { pattern: 'x', path: '/root/.kfmv4' }, ctx);
  assert(grepOutside.isError === true, 'grep 监狱外 path 应拒绝');
  const inside = await executeTool('read', { path: 'package.json' }, ctx);
  assert(inside.isError !== true, `监狱内读取应放行，得 ${JSON.stringify(inside.content[0])}`);
  const noJail = await executeTool('read', { path: 'package.json' },
    { cwd: '/root/kfmv4', wsServer: {} as never });
  assert(noJail.isError !== true, '未设 readRoot 不应限制');
});

// ---- 其他路由 ----

regression('BAR-ORIGIN-GUARD-01', '4d3b251', '/ai/chat/start 挂 verifyLocalOrigin 中间件（drive-by 防护）', () => {
  // express 签名 (path, ...middleware, handler)：挂 guard 后 handlers 数 ≥ 2，
  // 且首个中间件拒绝跨源 Origin。
  const seen = new Map<string, Handler[]>();
  const countingRouter = {
    post: (path: string, ...handlers: Handler[]) => seen.set(`POST ${path}`, handlers),
    get: (path: string, ...handlers: Handler[]) => seen.set(`GET ${path}`, handlers),
  } as any;
  setupAiRoutes(countingRouter, {} as any);
  const handlers = seen.get('POST /ai/chat/start')!;
  assert(handlers.length >= 2, '应有 verifyLocalOrigin 中间件 + 业务 handler');
  const guard = handlers[0];
  const res = makeRes();
  guard({ headers: { origin: 'https://evil.com', host: '127.0.0.1:8021' } }, res, () => {
    throw new Error('跨源请求不应通过 guard');
  });
  assert(res._r.statusCode === 403, `跨源应 403，得 ${res._r.statusCode}`);
});

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
function runOriginGuard(origin?: string, host?: string) {
  let passed = false;
  const r = { statusCode: 0, body: null as unknown };
  const headers: Record<string, string> = {};
  if (origin !== undefined) headers.origin = origin;
  if (host !== undefined) headers.host = host;
  const req = { headers };
  const res = { status(n: number) { r.statusCode = n; return { json(b: unknown) { r.body = b; } }; } };
  verifyLocalOrigin(req, res, () => { passed = true; });
  return { passed, status: r.statusCode };
}

regression('BAR-SEC-09', 'path-utils', '跨源 Origin（host 不匹配）写 → 403 拒绝', () => {
  const { passed, status } = runOriginGuard('https://evil.example.com', 'myapp.local:8021');
  assert(!passed, '跨源 Origin 不应通过');
  assert(status === 403, `应 403，得 ${status}`);
});

regression('BAR-SEC-10', 'path-utils', '本地回环 Origin → 放行', () => {
  for (const o of ['http://localhost:8021', 'http://127.0.0.1:8021', 'http://[::1]:8021']) {
    const { passed } = runOriginGuard(o, 'localhost:8021');
    assert(passed, `本地 Origin ${o} 应放行`);
  }
});

regression('BAR-SEC-11', 'path-utils', '无 Origin（脚本/curl）→ 放行', () => {
  const { passed } = runOriginGuard(undefined, 'localhost:8021');
  assert(passed, '无 Origin 的非浏览器客户端应放行');
});

regression('BAR-SEC-12', 'path-utils', '畸形 Origin → 拒绝（不放行）', () => {
  const { passed, status } = runOriginGuard('not a url', 'localhost:8021');
  assert(!passed, '无法解析的 Origin 不应放行');
  assert(status === 403, `应 403，得 ${status}`);
});

// 关键回归：同源但非 loopback 访问（局域网 IP / 反向代理域名）必须放行。
// 旧实现只认 loopback，导致手机/代理访问时 WS 与写删接口全被 403（ws:off，1006 无限重连）。
regression('BAR-SEC-13', 'path-utils', '同源非 loopback（局域网/代理）→ 放行', () => {
  // 局域网 IP 访问：Origin host == Host 头
  assert(runOriginGuard('http://192.168.1.50:8021', '192.168.1.50:8021').passed, '局域网 IP 同源应放行');
  // 反向代理域名访问
  assert(runOriginGuard('https://kfm.example.com', 'kfm.example.com').passed, '代理域名同源应放行');
  // 端口差异（代理改写端口）仍视为同源（hostname 匹配）
  assert(runOriginGuard('https://kfm.example.com', 'kfm.example.com:8021').passed, '同 host 不同端口应放行');
  // 但 host 不匹配的外部站点仍拒绝
  assert(!runOriginGuard('https://evil.com', 'kfm.example.com').passed, '不同 host 的外部站点应拒绝');
});

// ==========================================================================
// BAR-ORB-SEG-01: 会话消息分段切片 sliceMessages 边界契约
//
// 分段传输核心逻辑：面板追底用 tail（先拿末尾数条秒显示），会话卡预览用
// head（先拿开头数条），后台再补齐另一段拼成完整会话。切片边界算错会导致
// 漏消息 / 重复消息 / head+tail 拼接顺序错乱或丢中间段。
// 关键不变量：head(0,k) ++ tail(0, total-k) 必须精确等于完整数组。
// ==========================================================================

group('files/sessions — 消息分段切片（BAR-ORB-SEG-01）');

const seq10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

regression('BAR-ORB-SEG-01a', 'files.ts', 'tail 基本：offset=0 取最后 limit 条', () => {
  assert.deepStrictEqual(
    sliceMessages(seq10, 'tail', 0, 3),
    [8, 9, 10],
    'tail offset=0 limit=3 应取末尾 3 条 [8,9,10]',
  );
});

regression('BAR-ORB-SEG-01b', 'files.ts', 'head 基本：offset=0 取最前 limit 条', () => {
  assert.deepStrictEqual(
    sliceMessages(seq10, 'head', 0, 3),
    [1, 2, 3],
    'head offset=0 limit=3 应取开头 3 条 [1,2,3]',
  );
});

regression('BAR-ORB-SEG-01c', 'files.ts', 'tail offset：末尾往前跳过 offset 条后的 limit 条', () => {
  assert.deepStrictEqual(
    sliceMessages(seq10, 'tail', 3, 3),
    [5, 6, 7],
    'tail offset=3 limit=3 应跳过末尾 3 条后取 3 条 [5,6,7]',
  );
});

regression('BAR-ORB-SEG-01d', 'files.ts', 'head offset：开头往后跳过 offset 条后的 limit 条', () => {
  assert.deepStrictEqual(
    sliceMessages(seq10, 'head', 3, 3),
    [4, 5, 6],
    'head offset=3 limit=3 应跳过开头 3 条后取 3 条 [4,5,6]',
  );
});

regression('BAR-ORB-SEG-01e', 'files.ts', 'limit 超过剩余：不越界不报错', () => {
  assert.deepStrictEqual(
    sliceMessages([1, 2, 3, 4, 5], 'tail', 0, 100),
    [1, 2, 3, 4, 5],
    'tail limit=100 超总数应返回全部，不越界',
  );
  assert.deepStrictEqual(
    sliceMessages([1, 2, 3, 4, 5], 'head', 0, 100),
    [1, 2, 3, 4, 5],
    'head limit=100 超总数应返回全部，不越界',
  );
});

regression('BAR-ORB-SEG-01f', 'files.ts', 'limit<=0 视为取全部', () => {
  assert.deepStrictEqual(
    sliceMessages([1, 2, 3], 'head', 0, 0),
    [1, 2, 3],
    'head limit=0 应取全部 [1,2,3]',
  );
  assert.deepStrictEqual(
    sliceMessages([1, 2, 3], 'tail', 0, 0),
    [1, 2, 3],
    'tail limit=0 应取全部 [1,2,3]',
  );
});

regression('BAR-ORB-SEG-01g', 'files.ts', '空数组：返回空数组不报错', () => {
  assert.deepStrictEqual(
    sliceMessages([] as number[], 'tail', 0, 5),
    [],
    'tail 空数组应返回 []',
  );
  assert.deepStrictEqual(
    sliceMessages([] as number[], 'head', 0, 5),
    [],
    'head 空数组应返回 []',
  );
});

// BAR-MSG-PAYLOAD-01（2026-08-05，e9b-t0p4m0r7 实案）：失控实验臂单条消息超 300KB，
// 面板刷新恢复会话时 limit=12 尾部切片返回 1MB+ → 移动端 JSON.parse+渲染把主线程打满，
// 页面 1-2 秒后完全冻死。契约：/sessions/messages 响应经 capMessagesPayload 封顶——
// 条数语义不变，超限 text 块截断并标注，总预算 400KB / 单条 100KB。
regression('BAR-MSG-PAYLOAD-01', 'pending-commit', 'capMessagesPayload 载荷封顶：巨条截断+标注，总量预算，小消息不动', () => {
  const giant = 'x'.repeat(300_000);
  const msgs = [
    { role: 'user', content: [{ type: 'text', text: '小问题' }] },
    { role: 'ai', content: [{ type: 'text', text: giant }, { type: 'tool', name: 'read' }] },
    { role: 'ai', content: [{ type: 'text', text: '正常回复' }] },
  ];
  const out = capMessagesPayload(msgs) as any[];
  // 条数不变
  assert(out.length === 3, '条数语义不变');
  // 巨条被截断到单条上限并带标注
  const t1 = out[1]!.content[0]!.text as string;
  assert(t1.length < 101_000, `巨条应截到 100KB 级，实得 ${t1.length}`);
  assert(t1.includes('[已截断：原消息 300000 字符'), '截断标注缺失');
  // 非 text 块原样
  assert(out[1]!.content[1]!.type === 'tool', '非 text 块不应被动');
  // 小消息原样（引用相等 = 未重建）
  assert(out[0] === msgs[0] && out[2] === msgs[2], '小消息应保持原样');
  // 总预算：连续巨条时后面的预算被压缩
  const two = capMessagesPayload([
    { role: 'ai', content: [{ type: 'text', text: giant }] },
    { role: 'ai', content: [{ type: 'text', text: giant }] },
  ]) as any[];
  const sum = two.reduce((s, m) => s + (m.content[0].text as string).length, 0);
  assert(sum < 410_000, `总量应封顶 400KB 级，实得 ${sum}`);
});

// 最关键：head(0,k) ++ tail(0, total-k) 必须严格等于完整数组（无重叠、无缺口）。
// 这是面板/卡片先拿一段、后台补齐另一段后拼成完整会话的正确性保证。
regression('BAR-ORB-SEG-01h', 'files.ts', '拼接不变量：head(0,k) ++ tail(0,total-k) === 完整数组', () => {
  const total = seq10.length;
  for (const k of [8, 1]) {
    const head = sliceMessages(seq10, 'head', 0, k);
    const tail = sliceMessages(seq10, 'tail', 0, total - k);
    assert.deepStrictEqual(
      [...head, ...tail],
      seq10,
      `k=${k}：head(0,${k}) 拼 tail(0,${total - k}) 应精确等于原数组，无重叠无缺口`,
    );
  }
});

regression('BAR-ORB-SEG-01i', 'files.ts', 'offset 越界：钳位后返回空数组不抛异常', () => {
  assert.deepStrictEqual(
    sliceMessages([1, 2, 3], 'tail', 10, 2),
    [],
    'tail offset=10 超总数应钳位为空 []，不返回负 slice、不抛异常',
  );
});
