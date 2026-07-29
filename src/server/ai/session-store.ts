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
import { join } from 'path';
import { KFM_DATA_DIR } from '../path-utils.js';
import { applyEvent, type ReduceContext } from '../../shared/chat-protocol/reducer.js';
import type { StreamEvent } from '../../shared/chat-protocol/events.js';
import type { ChatMessage } from '../../shared/chat-protocol/messages.js';

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

/** 从磁盘加载 session 的 meta + messages（hydrate） */
function _loadFromDisk(sessionId: string): SessionState {
  const filePath = join(SESSIONS_DIR, `${sessionId}.json`);
  let meta: Record<string, unknown> = { id: sessionId, title: sessionId, createdAt: new Date().toISOString() };
  const messages: ChatMessage[] = [];

  if (existsSync(filePath)) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      meta = raw;
      if (Array.isArray(raw.messages)) {
        for (const m of raw.messages) {
          messages.push({ role: m.role === 'user' ? 'user' : 'ai', content: Array.isArray(m.content) ? m.content : [] });
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

/** 计算 messageCount / tokenCount（与旧 saveSessionFile 口径一致） */
function _computeStats(messages: ChatMessage[]): { messageCount: number; tokenCount: number } {
  let mc = 0, tc = 0;
  for (const msg of messages) {
    if (!msg || !Array.isArray(msg.content)) continue;
    for (const b of msg.content) {
      if (!b) continue;
      if (b.type === 'text') {
        tc += ((typeof b.text === 'string' ? b.text.length : 0) + (typeof b.reasoning === 'string' ? b.reasoning.length : 0));
        if (typeof b.text === 'string' && b.text.trim()) { mc++; break; }
      } else if (b.type === 'tool') {
        if (b.input) tc += JSON.stringify(b.input).length;
        const rc = b.result?.content;
        if (Array.isArray(rc)) for (const c of rc) { if (c?.text) tc += String(c.text).length; }
      }
    }
  }
  return { messageCount: mc, tokenCount: Math.round(tc / 3) };
}

/** 异步落盘（非阻塞） */
function _writeToDisk(sessionId: string, s: SessionState): void {
  const { messageCount, tokenCount } = _computeStats(s.ctx.messages);
  const out = {
    ...s.meta,
    messages: s.ctx.messages,
    messageCount,
    tokenCount,
    updatedAt: new Date().toISOString(),
  };
  _ensureDir();
  const filePath = join(SESSIONS_DIR, `${sessionId}.json`);
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
  const { messageCount, tokenCount } = _computeStats(s.ctx.messages);
  const out = {
    ...s.meta,
    messages: s.ctx.messages,
    messageCount,
    tokenCount,
    updatedAt: new Date().toISOString(),
  };
  _ensureDir();
  writeFileSync(join(SESSIONS_DIR, `${sessionId}.json`), JSON.stringify(out, null, 2), 'utf-8');
  s.dirty = false;
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
    msgs.push({ role: 'user', content: [{ type: 'text', text }] });
  }
  s.ctx.msgIdx = -1;
  if (model) s.meta.modelId = model;
  if (provider) s.meta.providerId = provider;
  _scheduleFlush(sessionId, s);
}
