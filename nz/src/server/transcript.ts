/**
 * src/server/transcript.ts — 会话记录回看器服务端（A 线正式版 2026-09-13）
 *
 * v0（lab/device-agent/build/gen-transcript.mjs）验证过的解析语义升级为
 * 常驻服务：wire.jsonl 增量 tail（字节位记账+残行 carry）→ 结构化时间线，
 * 两个只读端点供回看页轮询：
 *   GET /api/transcript/sessions                   → kimi 会话名册
 *   GET /api/transcript/messages?key&since|tail=N  → 增量/尾部取消息
 *
 * 解析语义（v0 考证，2809 条时间线实证）：
 *   用户   = context.append_message(role=user) 的 text 部件（工具结果回填
 *            无文本部件=天然滤除）
 *   助手轮 = context.append_loop_event 的 content.part(part.type=text) 按
 *            turnId 聚合（新旧进程世代通吃）+ tool.call 挂芯片
 * 增量语义：turnId 变更或用户消息到即切换当前轮（tool.result 夹缝不切断
 *   同轮——result 不是 content.part 也不是 tool.call）；排序按事件时间。
 *   同轮续写=同 seq 消息内容增长并重发，客户端按 seq 替换。
 *
 * 安全：key 形如 `<wdDir>/<sessionDir>`，两段都过 ^[A-Za-z0-9_-]+$ 闸，
 *   resolve 后必须落在会话根内（越界 fail-closed）；只读 GET，无副作用。
 */
import { createReadStream, existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export interface TranscriptMessage {
  seq: number;
  kind: 'user' | 'asst';
  time: number;
  text: string;
  tools: string[];
}

const SINGLE_READ_CAP = 8 * 1024 * 1024; // 单拍读取封顶，内循环追平

/** 单会话增量解析账本：offset 记账 + 残行 carry + 结构化消息数组 */
export class TranscriptDoc {
  readonly key: string;
  readonly wirePath: string;
  private offset = 0;
  private carry = '';
  private msgs: TranscriptMessage[] = [];
  private turnById = new Map<string, TranscriptMessage>();
  private activeTurnId: string | null = null;
  private seq = 0;
  /** 新增/更新待取队列（poll 消费后清空；续写重发整条=客户端按 seq 替换） */
  private pending: TranscriptMessage[] = [];

  constructor(key: string, wirePath: string) {
    this.key = key;
    this.wirePath = wirePath;
  }

  get size(): number {
    return this.msgs.length;
  }

  get cursor(): number {
    return this.seq;
  }

  /** 尾部 N 条 + 当前游标（首屏用，避免全量传输） */
  tail(n: number): { messages: TranscriptMessage[]; cursor: number; total: number } {
    return { messages: this.msgs.slice(-n), cursor: this.seq, total: this.msgs.length };
  }

  /** since 之后的新消息（增量轮询）；同 seq 重复出现=续写，按 seq 替换 */
  since(sinceSeq: number): { messages: TranscriptMessage[]; cursor: number; total: number } {
    return { messages: this.msgs.filter((m) => m.seq > sinceSeq), cursor: this.seq, total: this.msgs.length };
  }

  private emit(m: TranscriptMessage): void {
    this.pending.push(m);
  }

  private handleUser(time: number, text: string): void {
    this.activeTurnId = null; // 用户消息切轮
    const m: TranscriptMessage = { seq: ++this.seq, kind: 'user', time, text, tools: [] };
    this.msgs.push(m);
    this.emit(m);
  }

  private turnBuffer(turnId: string, time: number): TranscriptMessage {
    let t = this.turnById.get(turnId);
    if (!t) {
      t = { seq: ++this.seq, kind: 'asst', time, text: '', tools: [] };
      this.turnById.set(turnId, t);
      this.msgs.push(t);
      this.emit(t);
    }
    return t;
  }

  private handleLoopEvent(ev: Record<string, unknown>, time: number): void {
    const part = ev.part as { type?: string; text?: string } | undefined;
    const isText = ev.type === 'content.part' && part?.type === 'text' && !!part.text;
    const isTool = ev.type === 'tool.call';
    if (!isText && !isTool) return;
    const turnId = String(ev.turnId ?? ev.stepUuid ?? 'x');
    if (turnId !== this.activeTurnId) this.activeTurnId = turnId;
    const turn = this.turnBuffer(turnId, time);
    if (isText) {
      turn.text += (part as { text: string }).text;
    } else {
      const nm = ev as { call?: { name?: string }; name?: string; tool?: string };
      const name = nm.call?.name || nm.name || nm.tool || 'tool';
      if (name && !turn.tools.includes(name)) turn.tools.push(name);
    }
    this.emit(turn); // 增量重发整条（首见=新增，再见=续写）
  }

  /** 追平 wire 新增字节（单拍 ≤8MB，内循环到账平），返回新增/更新消息 */
  async poll(): Promise<TranscriptMessage[]> {
    for (;;) {
      const st = await stat(this.wirePath).catch(() => null);
      if (!st) break;
      if (st.size < this.offset) { this.offset = 0; this.carry = ''; } // 文件被截断/替换：重读
      if (st.size <= this.offset) break;
      const start = this.offset;
      const buf = await new Promise<Buffer>((resolveRead, rejectRead) => {
        const chunks: Buffer[] = [];
        const stream = createReadStream(this.wirePath, { start, end: Math.min(st.size, start + SINGLE_READ_CAP) - 1 });
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => resolveRead(Buffer.concat(chunks)));
        stream.on('error', rejectRead);
      });
      const text = this.carry + buf.toString('utf8');
      const lines = text.split('\n');
      this.carry = lines.pop() ?? ''; // 末段可能是残行，留在内存（字节已消费）
      this.offset = start + buf.length; // carry 字节随读随记进内存，绝不重读（重读=残行拼双份）
      for (const line of lines) {
        if (!line.trim()) continue;
        let rec: Record<string, unknown>;
        try {
          rec = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        const time = Number(rec.time ?? 0);
        if (rec.type === 'context.append_message') {
          const msg = rec.message as { role?: string; content?: Array<{ type?: string; text?: string }> } | undefined;
          if (!msg || msg.role !== 'user') continue;
          const texts: string[] = [];
          for (const p of msg.content ?? []) if (p.type === 'text' && p.text && p.text.trim()) texts.push(p.text);
          if (!texts.length) continue; // 工具结果回填等无文本部件滤除
          this.handleUser(time, texts.join('\n'));
        } else if (rec.type === 'context.append_loop_event') {
          this.handleLoopEvent((rec.event ?? {}) as Record<string, unknown>, time);
        }
      }
      if (buf.length < SINGLE_READ_CAP) break; // 已追平
    }
    const out = this.pending;
    this.pending = [];
    return out;
  }
}

const KEY_RE = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;
const MAX_DOCS = 4; // LRU 封顶：大会话账本 ~MB 级，防多 key 常驻堆高

/** 会话回看服务：按需建 doc，LRU 封顶防内存坑 */
export class TranscriptService {
  private docs = new Map<string, TranscriptDoc>();
  private lastPoll = new Map<string, number>();
  readonly root: string;

  constructor(root?: string) {
    this.root = resolve(root ?? join(homedir(), '.kimi-code', 'sessions'));
  }

  resolveKey(key: string): string | null {
    if (!KEY_RE.test(key)) return null;
    const abs = resolve(this.root, key, 'agents', 'main', 'wire.jsonl');
    if (!abs.startsWith(this.root + sep)) return null;
    if (!existsSync(abs)) return null;
    return abs;
  }

  doc(key: string): TranscriptDoc | null {
    const wirePath = this.resolveKey(key);
    if (!wirePath) return null;
    let d = this.docs.get(key);
    if (!d) {
      d = new TranscriptDoc(key, wirePath);
      this.docs.set(key, d);
      if (this.docs.size > MAX_DOCS) {
        let oldestKey = '';
        let oldest = Infinity;
        for (const [k, t] of this.lastPoll) if (t < oldest) { oldest = t; oldestKey = k; }
        if (oldestKey) { this.docs.delete(oldestKey); this.lastPoll.delete(oldestKey); }
      }
    }
    this.lastPoll.set(key, Date.now());
    return d;
  }

  /** 会话名册：key/mtime/size，新者在前，封顶 50 */
  async sessions(): Promise<Array<{ key: string; mtime: number; size: number }>> {
    const out: Array<{ key: string; mtime: number; size: number }> = [];
    let wds: string[] = [];
    try {
      wds = await readdir(this.root);
    } catch {
      return out;
    }
    for (const wd of wds) {
      if (!/^[A-Za-z0-9_-]+$/.test(wd)) continue;
      let sess: string[] = [];
      try {
        sess = await readdir(join(this.root, wd));
      } catch {
        continue;
      }
      for (const s of sess) {
        if (!s.startsWith('session_') || !/^[A-Za-z0-9_-]+$/.test(s)) continue;
        const wire = join(this.root, wd, s, 'agents', 'main', 'wire.jsonl');
        try {
          const st = await stat(wire);
          out.push({ key: `${wd}/${s}`, mtime: st.mtimeMs, size: st.size });
        } catch { /* 无 main wire 的会话跳过 */ }
      }
    }
    out.sort((a, b) => b.mtime - a.mtime);
    return out.slice(0, 50);
  }
}

const json = (res: import('node:http').ServerResponse, code: number, body: unknown): void => {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const toInt = (v: string | null, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : dflt;
};

/** HTTP 端点（index.ts 分支链挂载）：返回 true=请求已处理 */
export function mountTranscriptRoutes(svc = new TranscriptService()): (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => boolean {
  return (req, res): boolean => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method !== 'GET') return false;
    if (url.pathname === '/api/transcript/sessions') {
      void svc.sessions().then(
        (sessions) => json(res, 200, { sessions }),
        () => json(res, 500, { sessions: [] }),
      );
      return true;
    }
    if (url.pathname === '/api/transcript/messages') {
      const key = url.searchParams.get('key') ?? '';
      const doc = svc.doc(key);
      if (!doc) {
        json(res, 404, { error: '会话不存在或 key 非法' });
        return true;
      }
      void doc.poll().then(() => {
        const since = url.searchParams.get('since');
        const r = since !== null
          ? doc.since(toInt(since, 0))
          : doc.tail(Math.min(Math.max(toInt(url.searchParams.get('tail'), 300), 1), 2000));
        if (r.messages.length > 2000) r.messages = r.messages.slice(-2000); // 单响应巨包闸
        json(res, 200, { key, ...r });
      }).catch(() => json(res, 500, { error: '读取失败' }));
      return true;
    }
    return false;
  };
}
