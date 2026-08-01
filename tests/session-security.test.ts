// ==========================================================================
// tests/session-security.test.ts — 会话 id 路径穿越回归钉子（BAR-SEC-14）
//
// bug：/ai/chat/start 只查 sessionId truthy（routes.ts:31），session-store 把
// sessionId 直接拼进 `join(SESSIONS_DIR, `${sessionId}.json`)`（读写删三点无格式
// 校验）——`../` 可逃逸 sessions/ 目录，服务端权限内任意 JSON 读写。
// 2026-07-31 冷启动实验 gpt-5.6-sol 臂发现，源码复核实锤。
//
// 契约：sessionId 格式白名单 `^[\p{L}\p{N}_-]{1,128}$/u`（Unicode 字母数字含中文——
// 生产会话 id 即中文标题，初版 ASCII 白名单 2026-08-01 误杀全部中文会话）+ UTF-8
// 字节 ≤ 200，全入口统一校验（/ai/chat/start、/sessions/messages、session-store
// 落盘点）+ join 后 containment 复查。
//
// revert 验证：去掉入口校验后「start 拒绝」三条全红；去掉落盘守卫后
// 「join 单点化」源码断言红。
// ==========================================================================

import assert from 'assert';
import { readFileSync } from 'fs';
import { group, regression, test } from './runner.js';
import { setupAiRoutes } from '../src/server/ai/routes.js';
import { isValidSessionId } from '../src/server/path-utils.js';
import type { Router } from 'express';
import type { WsServer } from '../src/server/ws-server.js';
import type { StartRunFn } from '../src/server/ai/routes.js';

group('BAR-SEC-14 — sessionId 路径穿越防护');

// ========== 1. 校验器边界（单元） ==========

test('合法 sessionId 通过：Unicode 字母数字（含中文标题）/-/_，1..128 位', () => {
  // 生产会话 id 就是中文标题（todo工具测试/新会话3/蔚然的一次整理——v8.3.3 误杀事故）
  for (const id of ['a', 'abc123', 'sess-01_x', 'A1_b-C2', '中文', 'todo工具测试', '新会话3', '蔚然的一次整理', 'x'.repeat(128)]) {
    assert(isValidSessionId(id), `应通过: ${JSON.stringify(id)}`);
  }
});

test('非法 sessionId 拒绝：路径逃逸/分隔符/空白/超长/非字符串/超字节', () => {
  const bad: unknown[] = ['..', '../x', 'a/b', 'a\\b', 'a b', '', '.hidden', 'a.b', 'x'.repeat(129), '中'.repeat(67), 42, null, undefined];
  for (const id of bad) {
    assert(!isValidSessionId(id), `应拒绝: ${JSON.stringify(id)}`);
  }
});

// ========== 2. /ai/chat/start 入口（行为） ==========

type ResLike = {
  status(n: number): { json(b: unknown): unknown };
  json(b: unknown): unknown;
};
type ReqLike = { body: Record<string, unknown> };

/** 最小化 res mock：记录 status / body（start 端点只用 status().json()） */
function makeRes(): { state: { statusCode: number; body: unknown }; res: ResLike } {
  const state = { statusCode: 200, body: undefined as unknown };
  const res: ResLike = {
    status(n: number) {
      state.statusCode = n;
      return { json: (b: unknown) => { state.body = b; } };
    },
    json(b: unknown) { state.body = b; return undefined; },
  };
  return { state, res };
}

/** 把 setupAiRoutes 注册的路由收集到 Map，按 "METHOD PATH" 检索 handler（express 签名取最后一个为业务 handler） */
function collectRoutes(startRunFn?: StartRunFn): Map<string, (req: ReqLike, res: ResLike) => void> {
  const routes = new Map<string, (req: ReqLike, res: ResLike) => void>();
  const fakeRouter = {
    post: (path: string, ...handlers: Array<(req: ReqLike, res: ResLike) => void>) =>
      routes.set(`POST ${path}`, handlers[handlers.length - 1]),
    get: (path: string, ...handlers: Array<(req: ReqLike, res: ResLike) => void>) =>
      routes.set(`GET ${path}`, handlers[handlers.length - 1]),
  } as unknown as Router; // escape-ok: 测试夹具只实现 post/get 注册，express Router 其余成员未实现
  const fakeWs = {} as unknown as WsServer; // escape-ok: 测试夹具——startRun 注入 mock，wsServer 不被使用
  setupAiRoutes(fakeRouter, fakeWs, startRunFn);
  return routes;
}

// 注意：测试 body 的 user 消息 content 用空串——userText 缺省回退取最后 user 文本，
// 空串不触发 appendUserMessage（不碰真实磁盘），start 端点行为不受影响。
const BODY = (sessionId: string): Record<string, unknown> => ({
  sessionId,
  messages: [{ role: 'user', content: '' }],
});

regression('BAR-SEC-14', 'sessionid-traversal', 'start 拒绝路径穿越 sessionId → 400 且不启动 run', () => {
  let called = false;
  const routes = collectRoutes(((sessionId: string, _messages: unknown) => {
    called = true;
    return { id: `run_${sessionId}`, fromIndex: 0, done: true };
  }) as unknown as StartRunFn); // escape-ok: 测试 mock——只实现 startRun 用到的字段
  const start = routes.get('POST /ai/chat/start')!;
  for (const evil of ['../escape', '..', 'a/../../etc/passwd', '..%2Fescape', 'a\\b', 'x'.repeat(129)]) {
    const { state, res } = makeRes();
    start({ body: BODY(evil) }, res);
    assert(state.statusCode === 400, `期望 400，得 ${state.statusCode}（sessionId=${JSON.stringify(evil)}）`);
  }
  assert(!called, '非法 sessionId 不应启动 run');
});

regression('BAR-SEC-14', 'sessionid-valid', '合法 sessionId 正常放行', () => {
  let passed: string | null = null;
  const routes = collectRoutes(((sessionId: string) => {
    passed = sessionId;
    return { id: 'run_x', fromIndex: 0, done: true };
  }) as unknown as StartRunFn); // escape-ok: 测试 mock——只实现 startRun 用到的字段
  const start = routes.get('POST /ai/chat/start')!;
  const { state, res } = makeRes();
  start({ body: BODY('sess-01_x') }, res);
  assert(state.statusCode === 200, `期望 200，得 ${state.statusCode}`);
  assert(passed === 'sess-01_x', `合法 sessionId 应传给 startRun，得 ${String(passed)}`);
});

// ========== 3. 落盘点守卫（源码断言） ==========

regression('BAR-SEC-14', 'sessionid-joins', 'session-store 所有 join(SESSIONS_DIR 收敛到 _sessionFilePath 单点', () => {
  const src = readFileSync(new URL('../src/server/ai/session-store.ts', import.meta.url), 'utf-8');
  const rawJoins = (src.match(/join\(SESSIONS_DIR/g) || []).length;
  assert(rawJoins === 1, `join(SESSIONS_DIR 应只在 _sessionFilePath 出现 1 次，实际 ${rawJoins} 次`);
  assert(src.includes('function _sessionFilePath'), '缺少 _sessionFilePath 单点守卫函数');
  assert(src.includes('isValidSessionId'), '_sessionFilePath 未使用 isValidSessionId 白名单');
  assert(src.includes('startsWith(SESSIONS_DIR + sep)'), '缺少 join 后 containment 复查');
});
