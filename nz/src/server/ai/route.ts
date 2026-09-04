/**
 * route.ts — ai-chat A1 IO 装配（设计 §2.1）：把 /ai 端点接进
 * src/server/index.ts 的 raw node:http handler（静态服务分支之前；
 * nz 无 express，kfmv4 routes.ts 不可直接搬——§八⑤）。
 *
 *   POST /ai/chat/start            body{messages,model?,provider?}
 *                                  → 200 {runId,fromIndex:0,done:false} 立即返
 *                                  （配置/上游错误一律走 SSE error 事件，不 500——P3）；
 *                                    缺/空 messages → 400 {error}（probe ③）
 *   GET  /ai/chat/:runId/stream?from=N
 *                                  → SSE 分帧 `data: {"index":N,"event":{…}}\n\n`
 *                                  （index = 重连 cursor；无 event: 行），
 *                                    终结帧 `data: {"type":"__end__"}`；
 *                                    不存在/已淘汰 runId → 直接 __end__ 不 404（probe ④）
 *   POST /ai/chat/:runId/cancel    → {ok}；error「已取消」入流收尾（P5）
 *   GET  /ai/providers             → picker 数据源：只出 id/name/models（P1 不出
 *                                    key/baseUrl）+ 默认 智谱 glm-5.3-flash（拍板⑮）
 *
 * 脑选择：provider === 'echo' → EchoBrain（B 档/断网开发走 HTTP 全链，无需
 * 换进程）；NZ_AI_BRAIN=echo → 全局强制 echo（真 key 在场也不直连，排障隔离层）。
 *
 * mountAiChatRoutes() 返回同步判定函数：URL 命中 /ai/ 即接管（异步内部消化），
 * 未命中返回 false 让静态服务继续——index.ts 只加一行挂载。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  RunRegistry, EchoBrain, DirectApiBrain,
  DEFAULT_PROVIDER, DEFAULT_MODEL,
  type BrainEndpoint, type BrainStartRequest,
} from './brain.ts';
import { loadProviders } from './providers.ts';
import type { ChatMessage } from '../../shared/chat-protocol/messages.ts';

const BODY_CAP = 1024 * 1024; // 单请求 1MB 封顶（对话载荷规模）

function sendJson(res: ServerResponse, status: number, obj: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > BODY_CAP) { rejectBody(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', rejectBody);
  });
}

export function mountAiChatRoutes(): (req: IncomingMessage, res: ServerResponse) => boolean {
  // 登记表与两个脑随 server 实例一挂一（考卷起多实例互不串扰）
  const registry = new RunRegistry();
  const echo: BrainEndpoint = new EchoBrain(registry);
  const direct: BrainEndpoint = new DirectApiBrain(registry);
  const pickBrain = (provider?: string): BrainEndpoint =>
    process.env.NZ_AI_BRAIN === 'echo' || provider === 'echo' ? echo : direct;

  const handle = async (req: IncomingMessage, res: ServerResponse, url: string, query: URLSearchParams): Promise<void> => {
    // ---- GET /ai/providers：picker 数据源（§八③；P1 不出 key/baseUrl/代字） ----
    if (req.method === 'GET' && url === '/ai/providers') {
      const providers = loadProviders().map((p) => ({ id: p.id, name: p.name, models: p.models }));
      providers.push({ id: 'echo', name: 'Echo（夹具回放）', models: ['echo', 'echo-error'] });
      sendJson(res, 200, { providers, default: { provider: DEFAULT_PROVIDER, model: DEFAULT_MODEL } });
      return;
    }

    // ---- POST /ai/chat/start ----
    if (req.method === 'POST' && url === '/ai/chat/start') {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      } catch {
        sendJson(res, 400, { error: '请求体不是合法 JSON' });
        return;
      }
      const messages = body.messages as ChatMessage[] | undefined;
      if (!Array.isArray(messages) || messages.length === 0) {
        sendJson(res, 400, { error: '缺少 messages 参数或 messages 为空' });
        return;
      }
      // 消息形状闸（C 档实锤：缺 content 数组的畸形消息曾打崩整个 server
      // 进程）——形状非法 = 参数非法，400，与缺/空 messages 同族
      const malformed = messages.some((m) => !m || typeof m !== 'object'
        || (m.role !== 'user' && m.role !== 'ai')
        || !Array.isArray(m.content));
      if (malformed) {
        sendJson(res, 400, { error: '消息形状非法：每条消息须含 role（user/ai）与 content 数组' });
        return;
      }
      const brain = pickBrain(typeof body.provider === 'string' ? body.provider : undefined);
      const req_: BrainStartRequest = {
        messages,
        model: typeof body.model === 'string' ? body.model : undefined,
        provider: typeof body.provider === 'string' ? body.provider : undefined,
        paceMs: typeof body.paceMs === 'number' ? body.paceMs : undefined,
      };
      const handle_ = brain.start(req_);
      sendJson(res, 200, { runId: handle_.runId, fromIndex: 0, done: false });
      return;
    }

    // ---- /ai/chat/:runId/stream|cancel ----
    const m = /^\/ai\/chat\/([^/]+)\/(stream|cancel)$/.exec(url);
    if (m && m[2] === 'cancel' && req.method === 'POST') {
      sendJson(res, 200, { ok: registry.cancel(decodeURIComponent(m[1])) });
      return;
    }
    if (m && m[2] === 'stream' && req.method === 'GET') {
      const runId = decodeURIComponent(m[1]);
      const from = Number.parseInt(query.get('from') ?? '0', 10) || 0;
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
      });
      const gen = registry.attach(runId, from);
      if (!gen) {
        // probe ④：不存在/已淘汰 runId → 直接 __end__，不 404
        res.end('data: {"type":"__end__"}\n\n');
        return;
      }
      // 页面切走（客户端断开）不杀 run——run 继续缓冲，切回 attach 补流（§八⑥）
      req.on('close', () => { void gen.return(); });
      try {
        for await (const { index, event } of gen) {
          res.write(`data: ${JSON.stringify({ index, event })}\n\n`);
        }
      } catch { /* 客户端中途断开： generator 已 return，落终结帧无意义 */ }
      res.end('data: {"type":"__end__"}\n\n');
      return;
    }

    sendJson(res, 404, { error: `未知 /ai 端点: ${req.method} ${url}` });
  };

  return (req, res) => {
    const raw = req.url ?? '';
    const url = raw.split('?')[0];
    if (!url.startsWith('/ai/')) return false;
    const query = new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '');
    handle(req, res, url, query).catch((err) => {
      // P3：任何装配层意外不得裸 500 到 client——已写头就只能断流，未写头补 500 JSON
      console.error('[nz-ai] route 未捕获异常:', err instanceof Error ? err.message : err);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal' });
      else res.end();
    });
    return true;
  };
}
