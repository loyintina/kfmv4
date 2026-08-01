/**
 * session-store.ts — 会话日志唯一写者（v8 宪法第三条：服务端可死，真相在磁盘）
 *
 * 职责：
 * - 持有每个 session 的 Message[]（从磁盘 hydrate）
 * - 接收 StreamEvent，用 shared reducer 更新内存态
 * - 防抖 200ms 异步落盘（writeFile，非 sync）
 * - tool_result / done / abort 时强制 flush（生死线）
 * - 计算顶层 messageCount / tokenCount（sessions/list 只读顶层）
 *
 * 不做：渲染、发事件、管 run。
 */

import { mkdirSync, existsSync, readFileSync, readdirSync, writeFile, writeFileSync } from 'fs';
import { join, resolve, sep } from 'path';
import { KFM_DATA_DIR, isValidSessionId } from '../path-utils.js';
import { applyEvent, type ReduceContext } from '../../shared/chat-protocol/reducer.js';
import type { StreamEvent } from '../../shared/chat-protocol/events.js';
import type { ChatMessage } from '../../shared/chat-protocol/messages.js';
import { toOpenAiMessages } from '../../shared/chat-protocol/to-openai-messages.js';

const SESSIONS_DIR = join(KFM_DATA_DIR, 'sessions');
const FLUSH_DEBOUNCE_MS = 200;

interface SessionState {
  ctx: ReduceContext;
  meta: Record<string, unknown>;
  flushTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
}

const _sessions = new Map<string, SessionState>();

function _ensureDir(): void {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * 构造会话文件路径（BAR-SEC-14 纵深防御）：格式白名单 + join 后 containment 复查。
 * 非法 sessionId 返回 null——调用方必须 fail-closed（不读写磁盘）。
 */
function _sessionFilePath(sessionId: string): string | null {
  if (!isValidSessionId(sessionId)) return null;
  const filePath = join(SESSIONS_DIR, `${sessionId}.json`);
  const resolved = resolve(filePath);
  if (!resolved.startsWith(SESSIONS_DIR + sep)) return null; // 逃逸复查（双重保险）
  return filePath;
}

function _loadFromDisk(sessionId: string): SessionState {
  const filePath = _sessionFilePath(sessionId);
  if (!filePath) {
    console.error('[session-store] 拒绝非法 sessionId 读取:', sessionId);
    return { ctx: { messages: [], msgIdx: -1 }, meta: { id: sessionId }, flushTimer: null, dirty: false };
  }
  let meta: Record<string, unknown> = { id: sessionId, title: sessionId, createdAt: new Date().toISOString() };
  const messages: ChatMessage[] = [];

  if (existsSync(filePath)) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      meta = raw;
      if (Array.isArray(raw.messages)) {
        for (const m of raw.messages) {
          messages.push({
            role: m.role === 'user' ? 'user' : 'ai',
            content: Array.isArray(m.content) ? m.content : [],
            ...(typeof m.ts === 'string' ? { ts: m.ts } : {}), // 时间戳随 hydrate 存活
          });
        }
      }
    } catch { /* corrupted file → start fresh */ }
  }

  const ctx: ReduceContext = { messages, msgIdx: -1 };
  return { ctx, meta, flushTimer: null, dirty: false };
}

function _get(sessionId: string): SessionState {
  let s = _sessions.get(sessionId);
  if (!s) {
    s = _loadFromDisk(sessionId);
    _sessions.set(sessionId, s);
  }
  return s;
}

/**
 * 计算 messageCount / tokenCount / fullTokenCount。
 * tokenCount 口径（v8.3.x 起）：**压缩投影后的载荷字符数 / 3**——这是实际发给 API
 * 的量级，对齐「上下文窗口还剩多少」的用户直觉。
 * fullTokenCount：全量会话字符 / 3（旧口径，含 reasoning 与全部工具 I/O）——
 * 会话卡并列显示「压缩/全量」，让压缩收益与窗口占用同时可见。
 * isTodoDismissed 是客户端 localStorage 信号，服务端缺省（投影标注 ±30 字符，可忽略）。
 */
function _computeStats(messages: ChatMessage[]): { messageCount: number; tokenCount: number; fullTokenCount: number } {
  let mc = 0, fc = 0;
  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.content)) continue;
    let counted = false;
    for (const b of msg.content) {
      if (!b) continue;
      if (b.type === 'text') {
        fc += ((typeof b.text === 'string' ? b.text.length : 0) + (typeof b.reasoning === 'string' ? b.reasoning.length : 0));
        if (!counted && typeof b.text === 'string' && b.text.trim()) { mc++; counted = true; }
      } else if (b.type === 'tool') {
        if (b.input) fc += JSON.stringify(b.input).length;
        const rc = b.result?.content;
        if (Array.isArray(rc)) for (const c of rc) { if (c?.text) fc += String(c.text).length; }
      }
    }
  }
  const { apiMessages } = toOpenAiMessages(messages, { compact: true });
  const tc = apiMessages.reduce((s, m) =>
    s + (m.content?.length || 0) + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0), 0);
  return { messageCount: mc, tokenCount: Math.round(tc / 3), fullTokenCount: Math.round(fc / 3) };
}

/** 异步落盘（非阻塞） */
function _writeToDisk(sessionId: string, s: SessionState): void {
  const { messageCount, tokenCount, fullTokenCount } = _computeStats(s.ctx.messages);
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
    s.dirty = false;
    return;
  }
  _ensureDir();
  writeFile(filePath, JSON.stringify(out, null, 2), 'utf-8', (err) => {
    if (err) console.error('[session-store] write failed:', sessionId, err.message);
  });
  s.dirty = false;
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

/**
 * 追加一个事件到 session 的消息日志。
 * reduce 更新内存态 + 调度防抖落盘。
 */
export function appendEvent(sessionId: string, event: StreamEvent): void {
  const s = _get(sessionId);
  applyEvent(s.ctx, event);
  _scheduleFlush(sessionId, s);
}

/**
 * 强制同步落盘（生死线：tool_result / done / abort 时调用）。
 * 注意：底层仍是 async writeFile，但保证在下一个事件前完成调度。
 * 进程即将死亡前（kfm-restart）需要 writeFileSync 保证——由调用方决定。
 */
export function flush(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  if (s.flushTimer) { clearTimeout(s.flushTimer); s.flushTimer = null; }
  if (s.dirty) _writeToDisk(sessionId, s);
}

/**
 * 同步落盘（进程即将死亡前的最后保障）。
 * 用于 kfm-restart 的 abort.finally 路径。
 */
export function flushSync(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s || !s.dirty) return;
  if (s.flushTimer) { clearTimeout(s.flushTimer); s.flushTimer = null; }
  const { messageCount, tokenCount, fullTokenCount } = _computeStats(s.ctx.messages);
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
    console.error('[session-store] 拒绝非法 sessionId 同步落盘:', sessionId);
    s.dirty = false;
    return;
  }
  _ensureDir();
  writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf-8');
  s.dirty = false;
}

/**
 * 使 session 的内存缓存失效（会话文件被删除/移动/重命名时必须调用）。
 * 串档 bug（2026-08-01 冷启动实验实测）：删除会话只删磁盘文件，_sessions
 * 缓存不失效——同名新会话 appendUserMessage 接续旧 ctx，旧消息被全量发给
 * API（turn1 载荷 5.7× 膨胀：~114KB/49,512 tokens vs 干净基线 ~20KB/9,042），
 * flush 后两段历史合并落盘，刷新面板旧消息「复活」。
 * 注意：不 flush 脏数据——文件已被删，flush 会把删掉的会话重新写出来。
 */
export function invalidateSession(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  if (s.flushTimer) { clearTimeout(s.flushTimer); s.flushTimer = null; }
  _sessions.delete(sessionId);
}

/**
 * 追加用户消息（/ai/chat/start 时调用）。
 * 幂等：若末尾已是相同文本的 user 消息则跳过（客户端 pre-run saveMessages 已落盘）。
 */
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
