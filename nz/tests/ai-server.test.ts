/**
 * tests/ai-server.test.ts — ai-chat A1 阶段二 B 档雏形：server 薄层 HTTP 全链钉
 *
 * 语义基准 = 设计 §2.1（三端点 + 脑选择）/§1.4（错误语义全集）/§4.3（API 调试
 * 落盘）/§八⑥（run 薄层登记表）× probe-error-cases fixture（kfmv4 实录判卷基准）。
 *
 * 考七件事（全真起 server 实例，不 mock）：
 *   ①echo 脑经 HTTP 全链：POST /ai/chat/start provider=echo → GET stream →
 *     SSE 分帧 {index,event} 与 probe-kimi fixture 逐帧互证（假数据的形状 =
 *     真数据的形状），终结帧 __end__；
 *   ②GET /ai/providers 形状：只出 id/name/models（P1：不出 apiKey/baseUrl/
 *     代字/已解 key），默认 = 智谱 + glm-5.3-flash（2026-09-04 拍板⑮，原
 *     §八③ Kimi 默认被改）；
 *   ③run 登记表 attach 补流：中途断开重连 from=cursor 读到缓冲回放+尾随，
 *     断开不死 run（页面切换补流语义）；
 *   ④probe 错误语义实录钉：空 messages → 400（③）；非法 provider → 200 +
 *     runId + SSE error 人话（①）；不存在 runId 挂 stream → __end__ 不 404（④）；
 *   ⑤取消：POST cancel → error「已取消」入流收尾（P5），重复取消 ok:false；
 *   ⑥DirectApiBrain 直连路径（不烧 token：本地假上游回放 upstream fixture）：
 *     请求形状（Authorization/stream/include_usage）+ 九事件与阶段一 translator
 *     产物逐帧互证 + 错误语义（401 方言取 message / 非 200 截 300 字）+
 *     代字缺失人话不裸发；
 *   ⑦API 调试落盘（§4.3）：JSONL start/upstream-status/first-delta/done+usage/
 *     error 字段齐全；**不落 key 不落全文**（grep 断言）。
 *   ⑧RunRegistry 单元钉：封顶缓冲（base 前移）/ done 后 5min 淘汰 /
 *     同会话新 start 取代旧 run。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①落盘 start 记录偷偷写 apiKey → 「不落 key」钉红；
 *   ②登记表 cancel 不推「已取消」error 事件 → 取消钉红（P5）。
 */
import { test, group, assert } from './runner.ts';
import { createServer as createHttpServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNzServer } from '../src/server/index.ts';
import { SseParser } from '../src/server/ai/sse-parser.ts';
import { OpenAiTranslator } from '../src/server/ai/openai-translator.ts';
import { RunRegistry } from '../src/server/ai/brain.ts';
import type { StreamEvent } from '../src/shared/chat-protocol/events.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function listen(server: Server): Promise<number> {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveListen(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

/** probe fixture（kfmv4 服务端九事件流）→ StreamEvent[]（判卷基准） */
function loadProbeEvents(name: string): StreamEvent[] {
  const text = readFileSync(new URL(`./fixtures/ai-chat/${name}`, import.meta.url), 'utf-8');
  const parser = new SseParser();
  parser.feed(text + '\n\n');
  return parser.drainFrames()
    .map((f) => JSON.parse(f) as { event?: StreamEvent })
    .filter((o) => o.event)
    .map((o) => o.event as StreamEvent);
}

/** upstream fixture（原生端点实录）→ 阶段一 parser+translator 产物（互证基准） */
function translateUpstreamFixture(name: string): StreamEvent[] {
  const text = readFileSync(new URL(`./fixtures/ai-chat/${name}`, import.meta.url), 'utf-8');
  const parser = new SseParser();
  parser.feed(text + '\n\n');
  const translator = new OpenAiTranslator();
  const out: StreamEvent[] = [];
  for (const frame of parser.drainFrames()) out.push(...translator.translatePayload(frame));
  out.push(...translator.finish());
  return out;
}

interface Envelope { index: number; event: StreamEvent }

/** 读 SSE 流到终结；limit 提前 abort（中途断开补流钉用） */
async function readSse(
  port: number,
  runId: string,
  from: number,
  opts: { abortAfter?: number } = {},
): Promise<{ frames: Envelope[]; ended: boolean }> {
  const ctrl = new AbortController();
  const resp = await fetch(`http://127.0.0.1:${port}/ai/chat/${runId}/stream?from=${from}`, { signal: ctrl.signal });
  assert(resp.status === 200, `stream 应 200，实际 ${resp.status}`);
  assert((resp.headers.get('content-type') ?? '').includes('text/event-stream'), 'stream 应是 SSE');
  const parser = new SseParser();
  const reader = (resp.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  const frames: Envelope[] = [];
  let ended = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
      for (const f of parser.drainFrames()) {
        const o = JSON.parse(f) as { type?: string; index?: number; event?: StreamEvent };
        if (o.type === '__end__') { ended = true; continue; }
        frames.push({ index: o.index as number, event: o.event as StreamEvent });
        if (opts.abortAfter && frames.length >= opts.abortAfter) ctrl.abort();
      }
    }
  } catch { /* abort 中途断开是本意 */ }
  return { frames, ended };
}

async function postStart(port: number, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const resp = await fetch(`http://127.0.0.1:${port}/ai/chat/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, json: await resp.json() as Record<string, unknown> };
}

const USER_TEXT = 'hi'; // A2a.5 ③：start 形状 break——{text, sessionId?}，history 归会话文件

/**  env 现场保护：设值 → 跑 → 还原 */
async function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; process.env[k] = vars[k]; }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

group('ai-server（B 档雏形：echo 脑 HTTP 全链）');

test('echo 全链：start → stream 九事件序列与 probe-kimi fixture 逐帧互证', async () => {
  const cfgDir = mkdtempSync(join(tmpdir(), 'nz-ai-sess-'));
  await withEnv({ NZ_AI_ECHO_PACE_MS: '0', NZ_AI_CONFIG_DIR: cfgDir }, async () => {
    const server = createNzServer();
    const port = await listen(server);
    try {
      const { status, json } = await postStart(port, { text: USER_TEXT, provider: 'echo' });
      assert(status === 200, `start 应 200，实际 ${status}`);
      assert(typeof json.runId === 'string' && String(json.runId).startsWith('run_'), '应立即返 runId');
      assert(json.fromIndex === 0 && json.done === false, 'start 应答形状 {runId,fromIndex:0,done:false}');
      assert(typeof json.sessionId === 'string' && String(json.sessionId).startsWith('s-'),
        `A2a.5：应自动建壳并回 sessionId，实际 ${JSON.stringify(json.sessionId)}`);
      await sleep(350); // 防抖窗（200ms）过后会话文件应在场
      const sessFile = join(cfgDir, 'sessions', `${String(json.sessionId)}.json`);
      assert(existsSync(sessFile), `会话文件应落盘（自动建壳+用户消息），${sessFile}`);
      // 显式 sessionId 透传：继续往同一会话发，文件消息数应增长（history 归文件）
      const { json: j2 } = await postStart(port, { text: '第二条', sessionId: json.sessionId, provider: 'echo' });
      assert(j2.sessionId === json.sessionId, '显式 sessionId 应透传');
      await sleep(350);
      const sess = JSON.parse(readFileSync(sessFile, 'utf-8')) as { messages: unknown[]; providerId?: string; tokenCount?: number; fullTokenCount?: number };
      // 两轮对话=4 条消息（2 user + 2 AI，归约器产物落盘；每轮 user+AI 各一）
      assert(sess.messages.length === 4, `同会话第二条应追加（两轮共 4 条），实际 ${sess.messages.length}`);
      assert((sess.messages[3] as { role?: string }).role === 'ai', '末条应为 AI 回复');
      assert(sess.providerId === 'echo', 'provider 应盖进会话绑定');
      assert((sess.tokenCount ?? 0) > 0 && (sess.fullTokenCount ?? 0) > 0, '三数字应随 flush 落盘');
      const { frames, ended } = await readSse(port, String(json.runId), 0);
      assert(ended, '应有 __end__ 终结帧');
      const expected = loadProbeEvents('probe-kimi-k3-256k-20260830.sse');
      assert(frames.length === expected.length, `事件数应与 fixture 一致（${frames.length} vs ${expected.length}）`);
      frames.forEach((f, i) => {
        assert(f.index === i, `信封 index 应连续（第 ${i} 帧实际 index=${f.index}）`);
        assert(JSON.stringify(f.event) === JSON.stringify(expected[i]), `第 ${i} 帧事件应与 fixture 逐帧一致`);
      });
      assert(frames[0].event.type === 'message_start', '首帧 message_start');
      assert(frames[frames.length - 1].event.type === 'done', '末帧 done');
    } finally {
      server.close();
    }
  });
});

test('/ai/providers：只出 id/name/models + 默认 智谱 glm-5.3-flash（拍板⑮），无 key 无代字', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nz-ai-prov-'));
  writeFileSync(join(dir, 'providers.json'), JSON.stringify([
    { id: 'Kimi', name: 'Kimi', baseUrl: 'https://api.kimi.com/coding/v1', apiKey: '${NZ_TEST_VISIBLE_KEY}', models: ['k3-256k'] },
  ]));
  writeFileSync(join(dir, '.env'), 'NZ_TEST_VISIBLE_KEY=sk-visible-secret-abc123\n');
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const server = createNzServer();
    const port = await listen(server);
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/ai/providers`);
      assert(resp.status === 200, '/ai/providers 应 200');
      const raw = await resp.text();
      const json = JSON.parse(raw) as { providers: Array<Record<string, unknown>>; default: { provider: string; model: string } };
      assert(Array.isArray(json.providers) && json.providers.length >= 1, 'providers 应非空');
      for (const p of json.providers) {
        const keys = Object.keys(p).sort();
        assert(JSON.stringify(keys) === JSON.stringify(['id', 'models', 'name']),
          `picker 项只出 id/name/models，实际 ${keys.join(',')}`);
      }
      assert(json.providers.some((p) => p.id === 'echo'), '应含 echo 条目（断网开发/B 档腿）');
      assert(json.default.provider === '智谱' && json.default.model === 'glm-5.3-flash',
        `默认 = 智谱 + glm-5.3-flash（2026-09-04 拍板⑮），实际 ${JSON.stringify(json.default)}`);
      assert(!raw.includes('apiKey') && !raw.includes('baseUrl'), '不得出 apiKey/baseUrl 字段');
      assert(!raw.includes('sk-visible-secret-abc123') && !raw.includes('${'), '不得出已解 key 或代字（P1）');
    } finally {
      server.close();
    }
  });
});

test('A2a 阶段三 仲裁⑥：默认改读激活总账——/ai/providers default 与直连脑默认随账走，缺项回落出厂 智谱 glm-5.3-flash（拍板⑮）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nz-ai-ledger-def-'));
  writeFileSync(join(dir, 'providers.json'), JSON.stringify([
    { id: 'Kimi', name: 'Kimi', baseUrl: 'https://api.kimi.com/coding/v1', apiKey: '', models: ['k3-256k'] },
  ]));
  writeFileSync(join(dir, '.env'), 'KIMI_API_KEY=sk-ledger-default-exam\n');
  await withEnv({ NZ_AI_CONFIG_DIR: dir }, async () => {
    const server = createNzServer();
    const port = await listen(server);
    try {
      const get_default = async () => {
        const r = await fetch(`http://127.0.0.1:${port}/ai/providers`);
        return (await r.json()) as { default: { provider: string; model: string } };
      };
      // ① 总账缺文件 → 纯出厂回落（拍板⑮出厂初值，语义等价迁移）
      let d = await get_default();
      assert(d.default.provider === '智谱' && d.default.model === 'glm-5.3-flash',
        `空账应回落出厂 智谱/glm-5.3-flash，实际 ${JSON.stringify(d.default)}`);
      // ② 总账在场 → 默认随账走（/pool/active 是唯一门，考卷直写文件=夹具播种）
      writeFileSync(join(dir, 'active.json'), JSON.stringify({ providerId: 'Kimi', modelId: 'k3-256k', roleFile: '', sessionId: '' }));
      await sleep(20); // mtime 缓存按 mtimeMs 失效，隔一拍防同毫秒撞缓存
      d = await get_default();
      assert(d.default.provider === 'Kimi' && d.default.model === 'k3-256k',
        `总账在场 default 应随账（Kimi/k3-256k），实际 ${JSON.stringify(d.default)}`);
      // ③ 直连脑默认 = 总账条目（离线证据：不显式带 provider/model 发起 →
      //    总账条目不在 providers.json → error 人话点名总账条目，不点出厂智谱）
      writeFileSync(join(dir, 'active.json'), JSON.stringify({ providerId: 'exam-ledger-prov', modelId: 'exam-ledger-model', roleFile: '', sessionId: '' }));
      await sleep(20);
      const { json } = await postStart(port, { text: USER_TEXT });
      const sse = await readSse(port, String(json.runId), 0);
      const err = sse.frames.map((f) => f.event).find((e) => e.type === 'error');
      assert(!!err && String(err.content ?? '').includes('exam-ledger-prov'),
        `直连脑默认应来自总账（error 点名 exam-ledger-prov），实际 ${String(err?.content ?? '').slice(0, 80)}`);
      assert(!String(err?.content ?? '').includes('智谱'), '不得回落出厂智谱（总账在场即随账）');
      // ④ 部分缺项逐字段回落：modelId 空 → model 回落出厂、provider 仍随账
      writeFileSync(join(dir, 'active.json'), JSON.stringify({ providerId: 'Kimi', modelId: '', roleFile: '', sessionId: '' }));
      await sleep(20);
      d = await get_default();
      assert(d.default.provider === 'Kimi' && d.default.model === 'glm-5.3-flash',
        `modelId 缺项应逐字段回落（Kimi/glm-5.3-flash），实际 ${JSON.stringify(d.default)}`);
    } finally {
      server.close();
    }
  });
});

test('attach 补流：中途断开重连 from=cursor 读到缓冲回放+尾随，断开不死 run', async () => {
  await withEnv({ NZ_AI_ECHO_PACE_MS: '10' }, async () => {
    const server = createNzServer();
    const port = await listen(server);
    try {
      const { json } = await postStart(port, { text: USER_TEXT, provider: 'echo' });
      const runId = String(json.runId);
      const first = await readSse(port, runId, 0, { abortAfter: 5 });
      assert(first.frames.length === 5, `应先收 5 帧再断，实际 ${first.frames.length}`);
      await sleep(250); // 断开期间 run 继续生产（10ms/帧 ×44 ≈ 440ms 全程）
      const second = await readSse(port, runId, 5);
      assert(second.ended, '补流应收到 __end__');
      const expected = loadProbeEvents('probe-kimi-k3-256k-20260830.sse');
      assert(second.frames.length === expected.length - 5,
        `补流应从 cursor 续到尾（${second.frames.length} vs ${expected.length - 5}）`);
      second.frames.forEach((f, i) => {
        assert(f.index === i + 5, `补流 index 应从 5 连续（第 ${i} 帧实际 ${f.index}）`);
        assert(JSON.stringify(f.event) === JSON.stringify(expected[i + 5]), `补流第 ${i} 帧应与 fixture 一致`);
      });
    } finally {
      server.close();
    }
  });
});

test('probe 错误语义实录：空 messages → 400；非法 provider → 200+SSE error 人话；不存在 runId → __end__', async () => {
  const server = createNzServer();
  const port = await listen(server);
  try {
    // probe ③（A2a.5 形状）：空 text / 缺 text → 400 {error}
    const empty = await postStart(port, { text: '' });
    assert(empty.status === 400 && typeof empty.json.error === 'string', '空 text 应 400 {error}');
    const missing = await postStart(port, { provider: 'echo' });
    assert(missing.status === 400, '缺 text 应 400');
    // probe ①：非法 provider → 200 立即 runId + SSE error 事件人话（不 500 不抛）
    const bad = await postStart(port, { text: USER_TEXT, provider: '不存在的provider' });
    assert(bad.status === 200 && typeof bad.json.runId === 'string', '配置错误应 200 立即返 runId');
    const { frames, ended } = await readSse(port, String(bad.json.runId), 0);
    assert(ended && frames.length === 1 && frames[0].event.type === 'error', '应只有一个 error 事件后终结');
    assert(String(frames[0].event.content).includes('Provider「不存在的provider」不存在（id/name 均未匹配）'),
      `error 人话应对拍 probe 实录，实际 ${frames[0].event.content}`);
    // probe ④：不存在 runId 挂 stream → 不 404，直接 __end__
    const ghost = await readSse(port, 'run_nonexistent', 0);
    assert(ghost.ended && ghost.frames.length === 0, '不存在 runId 应直接 __end__ 不 404');
  } finally {
    server.close();
  }
});

test('text 形状闸（A2a.5 ③：messages 全量上行退役）→ 400，同进程后续请求照常（C 档打崩 server 实锤回归）', async () => {
  const server = createNzServer();
  const port = await listen(server);
  try {
    // 旧形状 {messages:[…]} 退役：一律 400（P13——history 归会话文件，
    // client 上行全量=第二真相源）
    const legacy = await postStart(port, { messages: [{ role: 'user', content: [{ type: 'text', text: 'x' }] }] });
    assert(legacy.status === 400, `旧 messages 形状应 400（text 必填），实际 ${legacy.status}`);
    const ws = await postStart(port, { text: '   ' });
    assert(ws.status === 400, '纯空白 text 应 400');
    // 同进程后续请求照常 = 没崩的机器证明
    const alive = await postStart(port, { text: USER_TEXT, provider: 'echo' });
    assert(alive.status === 200 && typeof alive.json.runId === 'string', '形状闸后 server 应活着');
  } finally {
    server.close();
  }
});

test('取消：POST cancel → error「已取消」入流收尾（P5），重复取消 ok:false', async () => {
  await withEnv({ NZ_AI_ECHO_PACE_MS: '30' }, async () => {
    const server = createNzServer();
    const port = await listen(server);
    try {
      const { json } = await postStart(port, { text: USER_TEXT, provider: 'echo' });
      const runId = String(json.runId);
      const streamPromise = readSse(port, runId, 0);
      await sleep(80); // 已流出 2~3 帧
      const cancel1 = await fetch(`http://127.0.0.1:${port}/ai/chat/${runId}/cancel`, { method: 'POST' });
      assert(cancel1.status === 200, 'cancel 应 200');
      assert((await cancel1.json() as { ok: boolean }).ok === true, '首次取消 ok:true');
      const { frames, ended } = await streamPromise;
      assert(ended, '取消后流应 __end__ 收尾');
      const last = frames[frames.length - 1].event;
      assert(last.type === 'error' && last.content === '已取消',
        `末帧应为 error「已取消」（P5 不许静默断流），实际 ${JSON.stringify(last)}`);
      assert(!frames.some((f) => f.event.type === 'done'), '取消的 run 不得有 done 事件');
      const cancel2 = await fetch(`http://127.0.0.1:${port}/ai/chat/${runId}/cancel`, { method: 'POST' });
      assert((await cancel2.json() as { ok: boolean }).ok === false, '重复取消 ok:false');
    } finally {
      server.close();
    }
  });
});

group('ai-server（DirectApiBrain 直连路径：本地假上游，不烧 token）');

const FAKE_KEY = 'sk-fake-secret-987654';
const DISTINCTIVE_USER_TEXT = 'NZXYZZY 用户全文秘密 7f3a9c 不得落盘';

/** 假上游：断言请求形状，回放 upstream-kimi fixture */
function startFakeUpstream(handler: (req: { authorization: string; body: Record<string, unknown> }) => { status: number; body: string }): Promise<{ server: Server; port: number; seen: Array<{ authorization: string; body: Record<string, unknown> }> }> {
  const seen: Array<{ authorization: string; body: Record<string, unknown> }> = [];
  const server = createHttpServer((req, res) => {
    assert(req.method === 'POST' && req.url === '/chat/completions', `假上游只接 POST /chat/completions，实际 ${req.method} ${req.url}`);
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const rec = { authorization: String(req.headers.authorization ?? ''), body: JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown> };
      seen.push(rec);
      const out = handler(rec);
      res.writeHead(out.status, { 'content-type': out.status === 200 ? 'text/event-stream' : 'application/json' });
      res.end(out.body);
    });
  });
  return listen(server).then((port) => ({ server, port, seen }));
}

function fakeConfigDir(baseUrl: string, apiKey = '${NZ_TEST_FAKE_KEY}'): string {
  const dir = mkdtempSync(join(tmpdir(), 'nz-ai-fake-'));
  writeFileSync(join(dir, 'providers.json'), JSON.stringify([
    { id: 'Fake', name: 'Fake', baseUrl, apiKey, models: ['fake-model'] },
  ]));
  writeFileSync(join(dir, '.env'), `NZ_TEST_FAKE_KEY=${FAKE_KEY}\n`);
  return dir;
}

test('直连全链：请求形状 + 九事件与阶段一 translator 产物互证 + 落盘字段齐全无 key 无全文', async () => {
  const fixtureText = readFileSync(new URL('./fixtures/ai-chat/upstream-kimi-k2.7-highspeed-20260830.sse', import.meta.url), 'utf-8');
  const upstream = await startFakeUpstream(() => ({ status: 200, body: fixtureText }));
  const dir = fakeConfigDir(`http://127.0.0.1:${upstream.port}`);
  const log = join(mkdtempSync(join(tmpdir(), 'nz-ai-log-')), 'chat.log');
  await withEnv({ NZ_AI_CONFIG_DIR: dir, NZ_AI_CHAT_LOG: log, NZ_AI_ECHO_PACE_MS: '0' }, async () => {
    const server = createNzServer();
    const port = await listen(server);
    try {
      const { status, json } = await postStart(port, {
        text: DISTINCTIVE_USER_TEXT, provider: 'Fake', model: 'fake-model',
      });
      assert(status === 200, 'start 应 200');
      const { frames, ended } = await readSse(port, String(json.runId), 0);
      assert(ended, '应 __end__ 终结');
      // 上游请求形状（§2.1：model/messages/stream/stream_options.include_usage）
      assert(upstream.seen.length === 1, '假上游应收 1 次请求');
      const seen = upstream.seen[0];
      assert(seen.authorization === `Bearer ${FAKE_KEY}`, '代字应在使用点展开为 Bearer key');
      assert(seen.body.model === 'fake-model' && seen.body.stream === true, 'model/stream 形状');
      assert((seen.body.stream_options as { include_usage?: boolean })?.include_usage === true, 'include_usage 必带');
      const msgs = seen.body.messages as Array<{ role: string; content: string }>;
      // A2a.5 §三：出厂基线 system 应在载荷首位（无角色=ts 前缀声明）
      assert(msgs.length === 2 && msgs[0].role === 'system'
        && msgs[0].content.includes('[ts MM-DD HH:MM:SS]'),
        `出厂基线 system 应在载荷首位，实际 ${JSON.stringify(msgs.map((m) => m.role))}`);
      assert(msgs[1].role === 'user' && msgs[1].content.includes(DISTINCTIVE_USER_TEXT),
        '用户消息应完整上行（假上游侧可见全文）');
      // 九事件与阶段一 translator 产物逐帧互证
      const expected = translateUpstreamFixture('upstream-kimi-k2.7-highspeed-20260830.sse');
      assert(frames.length === expected.length, `事件数应与 translator 产物一致（${frames.length} vs ${expected.length}）`);
      frames.forEach((f, i) => {
        assert(f.index === i, `信封 index 连续（${i}）`);
        assert(JSON.stringify(f.event) === JSON.stringify(expected[i]), `第 ${i} 帧与 translator 产物一致`);
      });
      // echo run 也落一条 start（每个 run 逐拍落）
      const echoStart = await postStart(port, { text: USER_TEXT, provider: 'echo' });
      await readSse(port, String(echoStart.json.runId), 0);
      // 落盘钉（§4.3）：等异步 appendFile 落盘
      await sleep(150);
      const raw = readFileSync(log, 'utf-8');
      const lines = raw.trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
      const runId = String(json.runId);
      const ofRun = (kind: string) => lines.find((l) => l.runId === runId && l.kind === kind);
      const start = ofRun('start');
      assert(!!start && start.provider === 'Fake' && start.model === 'fake-model'
        && start.msgCount === 2 && typeof start.bodyBytes === 'number' && (start.bodyBytes as number) > 0,
        `start 记录字段齐全，实际 ${JSON.stringify(start)}`);
      const st = ofRun('upstream-status');
      assert(!!st && st.status === 200 && typeof st.ttfbMs === 'number', `upstream-status 应含 status+ttfbMs，实际 ${JSON.stringify(st)}`);
      const fd = ofRun('first-delta');
      assert(!!fd && typeof fd.atMs === 'number', `first-delta 应含 atMs，实际 ${JSON.stringify(fd)}`);
      const done = ofRun('done');
      assert(!!done && typeof done.deltas === 'number' && (done.deltas as number) > 0
        && typeof done.chars === 'number' && (done.chars as number) > 0
        && typeof done.ms === 'number'
        && typeof (done.usage as { promptTokens?: number })?.promptTokens === 'number',
        `done 应含 deltas/chars/usage/ms，实际 ${JSON.stringify(done)}`);
      assert(lines.some((l) => l.kind === 'start' && l.provider === 'echo'), 'echo run 也应有 start 记录');
      // P1/§4.3：不落 key、不落完整消息正文（grep 断言）
      assert(!raw.includes(FAKE_KEY), '日志不得出现 apiKey（变异抽检靶子①）');
      assert(!raw.includes(DISTINCTIVE_USER_TEXT), '日志不得出现用户消息全文');
      assert(!raw.includes('Bearer'), '日志不得出现 Authorization 形态');
    } finally {
      server.close();
    }
  });
  upstream.server.close();
});

test('错误语义：双路 401 方言取 message / 非 200 截 300 字 / 代字缺失人话不裸发', async () => {
  // 智谱方言 401：{error:{code:"401",message}}（code 是字符串）——统一取 message
  const zhipu401 = JSON.stringify({ error: { code: '401', message: '令牌已过期或验证不正确' } });
  const upstream = await startFakeUpstream(({ body }) => {
    if (body.model === 'm-401') return { status: 401, body: zhipu401 };
    return { status: 500, body: 'X'.repeat(1000) }; // 巨型非 JSON 错误体
  });
  const dir = fakeConfigDir(`http://127.0.0.1:${upstream.port}`);
  const log = join(mkdtempSync(join(tmpdir(), 'nz-ai-log-')), 'chat.log');
  await withEnv({ NZ_AI_CONFIG_DIR: dir, NZ_AI_CHAT_LOG: log }, async () => {
    const server = createNzServer();
    const port = await listen(server);
    try {
      // 401 方言 → error 事件取 message
      const r401 = await postStart(port, { text: USER_TEXT, provider: 'Fake', model: 'm-401' });
      const f401 = await readSse(port, String(r401.json.runId), 0);
      const e401 = f401.frames[f401.frames.length - 1].event;
      assert(e401.type === 'error' && e401.content === 'API 请求失败: 401 — 令牌已过期或验证不正确',
        `401 方言应取 error.message，实际 ${e401.content}`);
      // 500 巨型错误体 → error 事件截 300 字（P4）
      const r500 = await postStart(port, { text: USER_TEXT, provider: 'Fake', model: 'm-500' });
      const f500 = await readSse(port, String(r500.json.runId), 0);
      const e500 = f500.frames[f500.frames.length - 1].event;
      assert(e500.type === 'error' && String(e500.content).startsWith('API 请求失败: 500 — '),
        `500 应透传错误体，实际 ${e500.content}`);
      assert([...String(e500.content)].length <= 'API 请求失败: 500 — '.length + 300,
        `error 事件错误体应截 300 字（P4），实际 ${[...String(e500.content)].length} 字`);
      await sleep(150);
      const raw = readFileSync(log, 'utf-8');
      const lines = raw.trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
      const errRecs = lines.filter((l) => l.kind === 'error');
      assert(errRecs.length >= 2, '两次失败 run 都应落 error 记录');
      for (const r of errRecs) {
        assert([...String(r.message)].length <= 320, `落盘 error message 也应截断，实际 ${[...String(r.message)].length} 字`);
      }
      assert(!raw.includes(FAKE_KEY), '错误路径日志也不得出 key');
    } finally {
      server.close();
    }
  });
  upstream.server.close();

  // 代字缺失 → error 人话点名变量，绝不裸发 ${VAR}
  const missingDir = fakeConfigDir('http://127.0.0.1:1', '${NZ_TEST_DEFINITELY_MISSING_VAR}');
  await withEnv({ NZ_AI_CONFIG_DIR: missingDir }, async () => {
    delete process.env.NZ_TEST_DEFINITELY_MISSING_VAR;
    const server = createNzServer();
    const port = await listen(server);
    try {
      const r = await postStart(port, { text: USER_TEXT, provider: 'Fake', model: 'fake-model' });
      assert(r.status === 200, '配置错误应 200 立即返 runId');
      const { frames } = await readSse(port, String(r.json.runId), 0);
      const ev = frames[frames.length - 1].event;
      assert(ev.type === 'error' && String(ev.content).includes('NZ_TEST_DEFINITELY_MISSING_VAR'),
        `代字缺失应点名变量名，实际 ${ev.content}`);
      assert(!String(ev.content).includes('${'), '绝不裸发 ${VAR} 代字（fuse 断在 server）');
    } finally {
      server.close();
    }
  });
});

group('ai-server（RunRegistry 单元：封顶/淘汰/取代）');

test('登记表：封顶缓冲 base 前移；done 后 5min 淘汰；同会话新 start 取代旧 run', async () => {
  let fakeNow = 1_000_000;
  const registry = new RunRegistry(() => fakeNow);
  // 同会话新 start 取代旧 run（P2 兜底）
  const a = registry.open({ provider: 'echo', model: 'echo' });
  registry.push(a, { type: 'message_start' });
  const b = registry.open({ provider: 'echo', model: 'echo' });
  assert(a.done, '新 start 应取代（终结）活跃旧 run');
  assert(a.events[a.events.length - 1].type === 'error' && a.events[a.events.length - 1].content === '已取消',
    '被取代的旧 run 应有「已取消」入流收尾');
  assert(a.abort.signal.aborted, '被取代的旧 run AbortController 应触发');
  assert(!b.done, '新 run 应活跃');
  // 封顶缓冲：1 万条封顶，base 前移，attach 从老 cursor 补到的是 base 之后
  for (let i = 0; i < 10_050; i++) registry.push(b, { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'x' });
  registry.finish(b);
  assert(b.base === 50, `封顶 1 万条 base 应前移（实际 base=${b.base}）`);
  const gen = registry.attach(b.id, 0);
  if (!gen) throw new Error('attach 存在 run 应非 null');
  const first = await gen.next();
  assert(!first.done && first.value.index === 50, `attach 老 cursor 应从 base 回放，实际 ${first.done ? 'done' : first.value.index}`);
  // done 后 5min 淘汰
  fakeNow += 6 * 60_000;
  registry.open({ provider: 'echo', model: 'echo' }); // 触发清扫
  assert(registry.attach(b.id, 0) === null, 'done 超 5min 应淘汰（attach → null → __end__）');
});
