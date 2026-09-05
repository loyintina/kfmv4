/**
 * session-store.ts — 会话日志唯一写者（A2a.5 §2.1；v8 session-store.ts 337 行
 * 照语义重落，适配点见 §八⑨ 逐条登记）。v8 宪法第三条：服务端可死，真相在磁盘。
 *
 * 职责（设计 §2.1 字段族写者矩阵的「消息族」行）：
 * - 持有每个 session 的 messages（磁盘 hydrate，白名单：role 归一 user/ai +
 *   content 数组 + ts 存活，其余字段不活过 hydrate——_jsonBuf 等 reducer
 *   中间态不落盘存活）
 * - 接收 StreamEvent，用 shared reducer 原地归约（applyEvent）
 * - 防抖 200ms 落盘（同步 writeFileSync——BAR-SESSION-FLUSH-01 尸检教训：
 *   异步 fd 线程池滞后把旧快照头覆盖在新快照上；事件循环单线程下同步写
 *   天然串行，从构造上根除交错）
 * - done / error / finish 生死线强制 flush（v8 的 tool_result 强制点在 nz
 *   阶段①无对应事件，语义等价=收尾必同步，§八⑨登记）
 * - messageCount / tokenCount（窗口）/ fullTokenCount 三数字唯一生产者
 *   （§1.2：stats 无第二把尺）
 *
 * 不做：渲染、发事件、管 run（录音泵在 route 层挂）、压缩执行（阶段②）。
 * 与池层关系：同文件双视角（§1.3）——池 API 壳投影恒空 messages；
 * checkMessagesRule 禁写闸保留（写消息的路只有本 store，P13）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { applyEvent, type ReduceContext } from '../../shared/chat-protocol/reducer.ts';
import type { StreamEvent } from '../../shared/chat-protocol/events.ts';
import type { ChatMessage } from '../../shared/chat-protocol/messages.ts';
import { toOpenAiMessages } from '../../shared/chat-protocol/to-openai-messages.ts';
import { poolDir, sessionsDir, atomicWriteJson } from '../pool/store.ts';

const FLUSH_DEBOUNCE_MS = 200;

/** 文件名裸名闸（与池层 isBareName 同语义：可中文，禁路径分隔符与 . / ..） */
function isBareName(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && !v.includes('/') && !v.includes('\\') && v !== '.' && v !== '..';
}

interface SessionCompact {
  cutIndex: number;        // 覆盖到第几条消息（不含）——messages[0..cutIndex) 由摘要代表
  summary: string;
  model: string;
  createdAt: string;
}

export interface LastUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  ts: string;
}

interface SessionState {
  ctx: ReduceContext;
  meta: Record<string, unknown>;
  /** 发送窗口的 system 段字符数（route 层 start 时经 recordSystemChars 注入，
   *  窗口数字 = 投影 + system 段，§1.2 口径「含 system+摘要段」） */
  systemChars: number;
  flushTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
}

const _sessions = new Map<string, SessionState>();

function _dir(): string {
  return sessionsDir(poolDir());
}

/** 构造会话文件路径（BAR-SEC-14 纵深防御照搬）：裸名白名单 + join 后 containment 复查。
 *  非法 sessionId 返回 null——调用方必须 fail-closed（不读写磁盘）。 */
function _sessionFilePath(sessionId: string): string | null {
  if (!isBareName(sessionId)) return null;
  const filePath = join(_dir(), `${sessionId}.json`);
  const resolved = resolve(filePath);
  if (!resolved.startsWith(_dir() + sep)) return null; // 逃逸复查（双重保险）
  return filePath;
}

function _loadFromDisk(sessionId: string): SessionState {
  const filePath = _sessionFilePath(sessionId);
  if (!filePath) {
    console.error('[session-store] 拒绝非法 sessionId 读取:', sessionId);
    return { ctx: { messages: [], msgIdx: -1 }, meta: { id: sessionId }, systemChars: 0, flushTimer: null, dirty: false };
  }
  let meta: Record<string, unknown> = { id: sessionId, title: '新会话', createdAt: new Date().toISOString() };
  const messages: ChatMessage[] = [];
  if (existsSync(filePath)) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      meta = raw;
      if (Array.isArray(raw.messages)) {
        for (const m of raw.messages as ChatMessage[]) {
          // hydrate 白名单（v8 照搬）：role 归一 + content 数组 + ts 存活。
          // A2a.5 真机加固（2026-09-05）：真实会话文件里存在 null/坏 content 块
          // （茉莉的测试 实录），渲染期 `'text' in null` 崩 React 树=「AI 气泡
          // 消失」病灶——坏块在唯一写者的入口洗掉，不活过 hydrate。
          const content = Array.isArray(m?.content)
            ? (m.content as ChatMessage['content']).filter((b) => !!b && typeof b === 'object' && typeof (b as { type?: unknown }).type === 'string')
            : [];
          messages.push({
            role: m?.role === 'user' ? 'user' : 'ai',
            content,
            ...(typeof m?.ts === 'string' ? { ts: m.ts } : {}),
          });
        }
      }
    } catch { /* corrupted file → start fresh（v8 同款降级） */ }
  }
  return { ctx: { messages, msgIdx: -1 }, meta, systemChars: 0, flushTimer: null, dirty: false };
}

function _get(sessionId: string): SessionState {
  let s = _sessions.get(sessionId);
  if (!s) {
    s = _loadFromDisk(sessionId);
    _sessions.set(sessionId, s);
  }
  return s;
}

function _compactsOf(s: SessionState): SessionCompact[] {
  return Array.isArray(s.meta.compacts) ? (s.meta.compacts as SessionCompact[]) : [];
}

/** 三数字唯一生产者（§1.2/§4.4）：全量=全部消息字符/3；窗口=投影字符+system 段
 *  字符（compacts 末条 cutIndex 起跳，阶段①无 compacts=全量投影）/3；
 *  messageCount=有正文 text 块的消息数。 */
export function _computeStats(
  messages: ChatMessage[],
  compacts?: SessionCompact[],
  systemChars = 0,
): { messageCount: number; tokenCount: number; fullTokenCount: number } {
  let mc = 0;
  let fc = 0;
  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.content)) continue;
    let counted = false;
    for (const b of msg.content) {
      if (!b) continue;
      if (b.type === 'text') {
        fc += (typeof b.text === 'string' ? b.text.length : 0) + (typeof b.reasoning === 'string' ? b.reasoning.length : 0);
        if (!counted && typeof b.text === 'string' && b.text.trim()) { mc++; counted = true; }
      } else if (b.type === 'tool') {
        if (b.input) fc += JSON.stringify(b.input).length;
        const rc = b.result?.content;
        if (Array.isArray(rc)) for (const c of rc) { if (c?.text) fc += String(c.text).length; }
      }
    }
  }
  const lastCompact = compacts && compacts.length > 0 ? compacts[compacts.length - 1] : null;
  // nz 投影返回纯数组（v8 返回 {apiMessages} 对象——照搬解构是自摆乌龙）
  const apiMessages = toOpenAiMessages(messages, lastCompact ? { compactCutIndex: lastCompact.cutIndex } : undefined);
  // 窗口 = 实际发送投影（content+tool_calls+reasoning_content）+ system 段，/3
  const tc = apiMessages.reduce((sum, m) =>
    sum + (m.content?.length || 0)
      + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0)
      + (typeof (m as { reasoning_content?: unknown }).reasoning_content === 'string'
        ? ((m as { reasoning_content?: string }).reasoning_content as string).length : 0), systemChars);
  return {
    messageCount: mc,
    tokenCount: Math.round(tc / 3),
    fullTokenCount: Math.round(fc / 3),
  };
}

function _writeToDisk(sessionId: string, s: SessionState): void {
  s.dirty = false;
  const { messageCount, tokenCount, fullTokenCount } = _computeStats(s.ctx.messages, _compactsOf(s), s.systemChars);
  const out = {
    ...s.meta,
    messages: s.ctx.messages,
    messageCount,
    tokenCount,
    fullTokenCount,
    updatedAt: new Date().toISOString(),
  };
  const filePath = _sessionFilePath(sessionId);
  if (!filePath) {
    console.error('[session-store] 拒绝非法 sessionId 落盘:', sessionId);
    return;
  }
  try {
    mkdirSync(_dir(), { recursive: true });
    // 同步写（v8 BAR-SESSION-FLUSH-01 尸检教训，§2.3）：防抖合并频率，单次 sync 写毫秒级
    writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf-8');
  } catch (err) {
    console.error('[session-store] write failed:', sessionId, err instanceof Error ? err.message : err);
    s.dirty = true; // 写失败保脏，下个事件/防抖窗重试（v8 同款）
  }
}

function _scheduleFlush(sessionId: string, s: SessionState): void {
  s.dirty = true;
  if (s.flushTimer) return;
  s.flushTimer = setTimeout(() => {
    s.flushTimer = null;
    if (s.dirty) _writeToDisk(sessionId, s);
  }, FLUSH_DEBOUNCE_MS);
}

// ========== 公开 API ==========

/** 追加事件：reduce 原地更新内存态 + 调度防抖落盘（录音泵逐事件喂）。 */
export function appendEvent(sessionId: string, event: StreamEvent): void {
  const s = _get(sessionId);
  applyEvent(s.ctx, event);
  _scheduleFlush(sessionId, s);
}

/** 生死线强制落盘（done / error / registry finish 三点调用）：清防抖计时器后
 *  立即同步写——writeFileSync 天然保证在下一个事件前完成落盘。 */
export function flush(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  if (s.flushTimer) { clearTimeout(s.flushTimer); s.flushTimer = null; }
  if (s.dirty) _writeToDisk(sessionId, s);
}

/** 会话文件被删除/移动时必须调用（串档 bug 根治点，v8 BAR 同款）：
 *  清内存缓存；**不 flush 脏数据**——文件已被删，flush 会把删掉的会话重新写出来。 */
export function invalidateSession(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  if (s.flushTimer) { clearTimeout(s.flushTimer); s.flushTimer = null; }
  _sessions.delete(sessionId);
}

/** 追加用户消息（/ai/chat/start 时调用）。幂等：末尾已是相同文本 user → 跳过
 *  （v8 语义照搬）。provider/model 盖进会话绑定（§1.1 首条盖章数据源）。 */
export function appendUserMessage(sessionId: string, text: string, model?: string, provider?: string): void {
  const s = _get(sessionId);
  const msgs = s.ctx.messages;
  const last = msgs[msgs.length - 1];
  const lastText = last?.role === 'user' && last.content.length > 0 && last.content[0]?.type === 'text'
    ? (last.content[0] as { text?: string }).text : null;
  if (lastText !== text) {
    msgs.push({ role: 'user', content: [{ type: 'text', text }], ts: new Date().toISOString() });
  }
  s.ctx.msgIdx = -1;
  if (model) s.meta.modelId = model;
  if (provider) s.meta.providerId = provider;
  _scheduleFlush(sessionId, s);
}

/** 读全量消息（发送投影 + 水合共用——真相源唯一出口）。返回内存数组的浅拷贝引用
 *  语义与 v8 一致：调用方只读。 */
export function readMessages(sessionId: string): ChatMessage[] {
  return _get(sessionId).ctx.messages;
}

export function readMeta(sessionId: string): Record<string, unknown> {
  return _get(sessionId).meta;
}

export function readStats(sessionId: string): { messageCount: number; tokenCount: number; fullTokenCount: number } {
  const s = _get(sessionId);
  return _computeStats(s.ctx.messages, _compactsOf(s), s.systemChars);
}

/** route 层 start 时注入发送窗口的 system 段字符数（窗口口径「含 system」，§1.2）。 */
export function recordSystemChars(sessionId: string, n: number): void {
  const s = _get(sessionId);
  s.systemChars = typeof n === 'number' && n >= 0 ? n : 0;
  _scheduleFlush(sessionId, s);
}

/** 自动建壳（§2.2 步骤 1）：id=s-<时间戳36进制>-<4位随机>，与标题解耦（§八④）。
 *  落盘空壳文件；**不写总账**（sessionId 写点由 route 层按 §1.4 表执行）。 */
export function ensureSession(): { id: string; title: string } {
  const id = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const title = '新会话';
  const now = new Date().toISOString();
  atomicWriteJson(join(_dir(), `${id}.json`), {
    id, title, manuallyNamed: false, createdAt: now, updatedAt: now,
    messages: [], messageCount: 0, tokenCount: 0, fullTokenCount: 0,
  });
  invalidateSession(id); // 磁盘已有壳，内存缓存清空走 hydrate（单一起点）
  return { id, title };
}

// ========== 〔②〕压缩与实测（接口位，阶段①不接线） ==========

/** 固化摘要追加（阶段② runCompact 调用）。追加制：数组只增不改（v8 宪法第四条）。 */
export function appendCompact(sessionId: string, c: SessionCompact): void {
  const s = _get(sessionId);
  const arr = _compactsOf(s);
  arr.push(c);
  s.meta.compacts = arr;
  _scheduleFlush(sessionId, s);
}

export function recordLastUsage(sessionId: string, u: LastUsage): void {
  const s = _get(sessionId);
  s.meta.lastUsage = u;
  _scheduleFlush(sessionId, s);
}
