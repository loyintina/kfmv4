/**
 * route.ts — 统一池数据层路由族（设计清单 §2.1；照 ai-chat route.ts 先例
 * 挂进 src/server/index.ts 静态服务分支之前，raw node:http 无 express）
 *
 *   GET  /pool/list                  → 池描述表投影 [{pool,title,readonly,count}]
 *   GET  /pool/:pool                 → 条目数组（provider 出代字形态永不出明文——P4；
 *                                      带 refs 的池附 dangling 断引用标注，降级不崩）
 *   POST /pool/:pool/create          body{entry} → {entry}（schema 坏即 400 人话；
 *                                      provider 走 fuse-on-save；重复 id → 409）
 *   POST /pool/:pool/:id/update      body{entry} → {entry}（merge 保留未知字段；
 *                                      编辑目标≠激活项，禁动总账——P2）
 *   POST /pool/:pool/:id/delete      → 200{ok} | 409{error,reliedBy}（relied 守卫
 *                                      唯一执行点=此处——P3；激活中视同 relied）
 *   GET  /pool/:pool/:id/reliers     → {reliers:[{pool,id,field}]}（"被谁用着"）
 *   GET  /pool/active                → 激活总账 {providerId,modelId,roleFile,sessionId}
 *   POST /pool/active                body 部分更新（如{providerId,modelId}）→ 新总账
 *                                      （激活唯一路径；未知字段/非字符串 → 400 不写盘）
 *
 * 错误语义沿用 A1 表精神：配置错误 → 人话 JSON 不 500 不裸栈；
 * 写失败（权限/坏 JSON）→ 500{error} + /tmp 日志完整体。
 *
 * pool/changed 的 WS 推送是阶段二的活（清单 §1.6），v0 写盘即事实、
 * client 刷新校准——本层只在落盘成功后落 /tmp/nz-pool.log 观测拍。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  POOLS, getPool, loadEntry, scanReliers, annotateDangling,
  type PoolDescriptor, type PoolEntry,
} from './pools.ts';
import {
  poolDir, readActive, writeActive, poolLog, ACTIVE_FIELDS,
  type ActiveLedger,
} from './store.ts';

const BODY_CAP = 1024 * 1024; // 单请求 1MB 封顶（与 ai route 同款）

const ACTIVE_FIELD_SET = new Set<string>(ACTIVE_FIELDS);

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

/** 读请求体里的 entry（对象），非合法 JSON / 非对象 → 抛 400 人话 */
async function readEntry(req: IncomingMessage): Promise<Record<string, unknown>> {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  } catch {
    throw new RouteError(400, '请求体不是合法 JSON');
  }
  const entry = body?.entry;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new RouteError(400, '请求体缺 entry（对象）');
  }
  return entry as Record<string, unknown>;
}

class RouteError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** messages 恒空禁写（仲裁①/P5）：任何池的写请求携带非空 messages 即 400 */
function checkMessagesRule(entry: Record<string, unknown>): string | null {
  if (!('messages' in entry)) return null;
  if (!Array.isArray(entry.messages) || entry.messages.length > 0) {
    return 'session.messages 恒空禁写（仲裁①：v0 壳管理，消息落盘留 A3/session-store lineage）';
  }
  return null;
}

export function mountPoolRoutes(): (req: IncomingMessage, res: ServerResponse) => boolean {
  const dir = (): string => poolDir();

  const listProjection = (): Array<Record<string, unknown>> =>
    Object.values(POOLS).map((d) => ({
      pool: d.pool,
      title: d.title,
      readonly: d.readonly === true,
      count: d.list(dir()).length,
    }));

  const handleCreate = async (req: IncomingMessage, res: ServerResponse, d: PoolDescriptor): Promise<void> => {
    let entry = await readEntry(req);
    const msgErr = checkMessagesRule(entry);
    if (msgErr) { sendJson(res, 400, { error: msgErr }); return; }
    if (d.prepare) entry = d.prepare(entry);
    const bad = d.validate(entry);
    if (bad) { sendJson(res, 400, { error: bad }); return; }
    const id = String(entry.id);
    if (d.saveEntry) {
      if (d.loadRaw!(dir(), id)) {
        sendJson(res, 409, { error: `「${id}」已存在（${d.title} 池一文件一条目，换 id 或先删旧的）` });
        return;
      }
      d.saveEntry(dir(), entry as PoolEntry);
    } else {
      const entries = d.loadAll!(dir());
      if (entries.some((e) => e.id === id)) {
        sendJson(res, 409, { error: `「${id}」已存在（${d.title} 池条目 id 唯一）` });
        return;
      }
      const fused = d.fuseEntry ? d.fuseEntry(dir(), entry as PoolEntry, entries) : (entry as PoolEntry);
      if (fused.apiKey !== entry.apiKey) poolLog({ kind: 'fuse', pool: d.pool, id });
      entries.push(fused);
      d.saveAll!(dir(), entries);
      entry = fused;
    }
    poolLog({ kind: 'create', pool: d.pool, id });
    sendJson(res, 200, { entry });
  };

  const handleUpdate = async (req: IncomingMessage, res: ServerResponse, d: PoolDescriptor, id: string): Promise<void> => {
    const incoming = await readEntry(req);
    const msgErr = checkMessagesRule(incoming);
    if (msgErr) { sendJson(res, 400, { error: msgErr }); return; }
    if ('id' in incoming && incoming.id !== id) {
      sendJson(res, 400, { error: `条目 id 不可改（路径 id=「${id}」，载荷 id=「${String(incoming.id)}」）——改名改 title/name` });
      return;
    }
    if (d.saveEntry) {
      const raw = d.loadRaw!(dir(), id);
      if (!raw) { sendJson(res, 404, { error: `「${id}」不存在于 ${d.title} 池` }); return; }
      // merge 保留未知字段（kfmv4 双端共读：8.x 压缩投影/messages 不毁）；
      // messages 永不来自请求（上方禁写闸），磁盘有才保留（role 池无此字段不沾）
      const merged = { ...raw, ...incoming, id, updatedAt: new Date().toISOString() } as PoolEntry;
      if ('messages' in raw) merged.messages = raw.messages;
      const bad = d.validate(merged);
      if (bad) { sendJson(res, 400, { error: bad }); return; }
      d.saveEntry(dir(), merged);
      poolLog({ kind: 'update', pool: d.pool, id });
      sendJson(res, 200, { entry: merged });
      return;
    }
    const entries = d.loadAll!(dir());
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) { sendJson(res, 404, { error: `「${id}」不存在于 ${d.title} 池` }); return; }
    // 空 apiKey = 未改动（编辑回填只出代字，UI 拿不到明文也发不回明文）
    const patch = { ...incoming };
    if (patch.apiKey === '') delete patch.apiKey;
    const merged = { ...entries[idx], ...patch, id } as PoolEntry;
    const bad = d.validate(merged);
    if (bad) { sendJson(res, 400, { error: bad }); return; }
    const fused = d.fuseEntry ? d.fuseEntry(dir(), merged, entries) : merged;
    if (fused.apiKey !== merged.apiKey) poolLog({ kind: 'fuse', pool: d.pool, id });
    entries[idx] = fused;
    d.saveAll!(dir(), entries);
    poolLog({ kind: 'update', pool: d.pool, id });
    sendJson(res, 200, { entry: fused });
  };

  const handleDelete = (res: ServerResponse, d: PoolDescriptor, id: string): void => {
    const entry = loadEntry(dir(), d, id);
    if (!entry) { sendJson(res, 404, { error: `「${id}」不存在于 ${d.title} 池` }); return; }
    const reliedBy = scanReliers(dir(), d, entry);
    if (reliedBy.length > 0) {
      poolLog({ kind: 'guard-reject', pool: d.pool, id, reliedCount: reliedBy.length });
      sendJson(res, 409, {
        error: `「${id}」被 ${reliedBy.length} 处引用或正激活中——先切走激活/解除引用再删（relied 守卫，P3）`,
        reliedBy,
      });
      return;
    }
    if (d.deleteEntry) {
      d.deleteEntry(dir(), id);
    } else {
      const entries = d.loadAll!(dir()).filter((e) => e.id !== id);
      d.saveAll!(dir(), entries);
    }
    poolLog({ kind: 'delete', pool: d.pool, id });
    sendJson(res, 200, { ok: true });
  };

  const handle = async (req: IncomingMessage, res: ServerResponse, url: string): Promise<void> => {
    // ---- GET /pool/list：池描述表投影（client 注册表存在性互证，§1.5） ----
    if (req.method === 'GET' && url === '/pool/list') {
      sendJson(res, 200, listProjection());
      return;
    }

    // ---- 激活总账（§2.4：nz 侧唯一门，P5） ----
    if (url === '/pool/active') {
      if (req.method === 'GET') {
        sendJson(res, 200, readActive(dir()));
        return;
      }
      if (req.method === 'POST') {
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(await readBody(req)) as Record<string, unknown>;
        } catch {
          sendJson(res, 400, { error: '请求体不是合法 JSON' });
          return;
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          sendJson(res, 400, { error: '请求体应是对象（部分更新，如 {providerId,modelId}）' });
          return;
        }
        for (const [k, v] of Object.entries(body)) {
          if (!ACTIVE_FIELD_SET.has(k)) {
            sendJson(res, 400, { error: `总账没有「${k}」字段（schema 恒四字段 providerId/modelId/roleFile/sessionId，configFile 已砍不迁）` });
            return;
          }
          if (typeof v !== 'string') {
            sendJson(res, 400, { error: `总账字段「${k}」应是字符串（空串=清除槽位）` });
            return;
          }
        }
        const ledger: ActiveLedger = { ...readActive(dir()), ...(body as Partial<ActiveLedger>) };
        writeActive(dir(), ledger);
        poolLog({ kind: 'activated', pool: 'active', fields: Object.keys(body).sort() });
        sendJson(res, 200, ledger);
        return;
      }
    }

    // ---- POST /pool/:pool/create ----
    const mCreate = /^\/pool\/([^/]+)\/create$/.exec(url);
    if (mCreate && req.method === 'POST') {
      const d = getPool(decodeURIComponent(mCreate[1]));
      if (!d) { sendJson(res, 404, { error: `未知池「${decodeURIComponent(mCreate[1])}」（在册：${Object.keys(POOLS).join('/')}）` }); return; }
      if (d.readonly) { sendJson(res, 400, { error: `${d.title} 池是只读聚合视图，禁写（§3.1）` }); return; }
      await handleCreate(req, res, d);
      return;
    }

    // ---- /pool/:pool/:id/update|delete|reliers ----
    const mOp = /^\/pool\/([^/]+)\/([^/]+)\/(update|delete|reliers)$/.exec(url);
    if (mOp) {
      const d = getPool(decodeURIComponent(mOp[1]));
      if (!d) { sendJson(res, 404, { error: `未知池「${decodeURIComponent(mOp[1])}」` }); return; }
      const id = decodeURIComponent(mOp[2]);
      const op = mOp[3];
      if (op === 'reliers' && req.method === 'GET') {
        const entry = loadEntry(dir(), d, id);
        if (!entry) { sendJson(res, 404, { error: `「${id}」不存在于 ${d.title} 池` }); return; }
        sendJson(res, 200, { reliers: scanReliers(dir(), d, entry) });
        return;
      }
      if (d.readonly) { sendJson(res, 400, { error: `${d.title} 池是只读聚合视图，禁写（§3.1）` }); return; }
      if (op === 'update' && req.method === 'POST') { await handleUpdate(req, res, d, id); return; }
      if (op === 'delete' && req.method === 'POST') { handleDelete(res, d, id); return; }
    }

    // ---- GET /pool/:pool：条目集 ----
    const mGet = /^\/pool\/([^/]+)$/.exec(url);
    if (mGet && req.method === 'GET') {
      const d = getPool(decodeURIComponent(mGet[1]));
      if (!d) { sendJson(res, 404, { error: `未知池「${decodeURIComponent(mGet[1])}」（在册：${Object.keys(POOLS).join('/')}）` }); return; }
      sendJson(res, 200, annotateDangling(dir(), d, d.list(dir())));
      return;
    }

    sendJson(res, 404, { error: `未知 /pool 端点: ${req.method} ${url}` });
  };

  return (req, res) => {
    const raw = req.url ?? '';
    const url = raw.split('?')[0];
    if (!url.startsWith('/pool/') && url !== '/pool') return false;
    handle(req, res, url).catch((err) => {
      if (err instanceof RouteError) {
        sendJson(res, err.status, { error: err.message });
        return;
      }
      // 写失败（权限/坏 JSON）→ 500{error} + /tmp 日志完整体（A1 表精神）
      poolLog({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      console.error('[nz-pool] route 未捕获异常:', err instanceof Error ? err.message : err);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal' });
      else res.end();
    });
    return true;
  };
}
