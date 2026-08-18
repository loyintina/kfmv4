/**
 * session-store.ts — 会话日志唯一写者（v8 宪法第三条：服务端可死，真相在磁盘）
 *
 * 职责：
 * - 持有每个 session 的 Message[]（从磁盘 hydrate）
 * - 接收 StreamEvent，用 shared reducer 更新内存态
 * - 防抖 200ms 落盘（同步 writeFileSync——见 _writeToDisk 注释：异步写与同步写不互斥曾致文件交错）
 * - tool_result / done / abort 时强制 flush（生死线）
 * - 计算顶层 messageCount / tokenCount（sessions/list 只读顶层）
 *
 * 不做：渲染、发事件、管 run。
 */

import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync, renameSync } from 'fs';
import { join, resolve, sep } from 'path';
import { KFM_DATA_DIR, isValidSessionId } from '../path-utils.js';
import { applyEvent, type ReduceContext } from '../../shared/chat-protocol/reducer.js';
import type { StreamEvent } from '../../shared/chat-protocol/events.js';
import type { ChatMessage } from '../../shared/chat-protocol/messages.js';
import { toOpenAiMessages } from '../../shared/chat-protocol/to-openai-messages.js';

const SESSIONS_DIR = join(KFM_DATA_DIR, 'sessions');
const SCRIPT_SESSIONS_DIR = join(SESSIONS_DIR, 'script');
const FLUSH_DEBOUNCE_MS = 200;

/**
 * script 类会话分流注册表（2026-08-06 泄漏根治：服务端分流修法①，
 * 根因报告 experiments/paradigm/results/results-session-leak-rootcause.md）。
 * 此前服务端只有根目录一条写路径，sessions/script/ 全靠客户端事后搬运，
 * 搬运失败（重试换 id/超时/重启掐 run）即泄漏进面板区。
 * 现在 /ai/chat/start 收 sessionClass:'script' 时先调 markSessionScript 登记，
 * 该会话的落盘/hydrate 直接走 sessions/script/——从构造上不进面板区。
 */
const _scriptSessions = new Set<string>();

interface SessionState {
  ctx: ReduceContext;
  meta: Record<string, unknown>;
  flushTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
}

const _sessions = new Map<string, SessionState>();

function _ensureDir(): void {
  mkdirSync(SESSIONS_DIR, { recursive: true });
  mkdirSync(SCRIPT_SESSIONS_DIR, { recursive: true });
}

/**
 * 登记 script 类会话（/ai/chat/start 收 sessionClass:'script' 时调用，
 * 必须先于任何 appendUserMessage/appendEvent——hydrate 路径随之切换）。
 * legacy 迁移：根目录已有同名文件而 script/ 没有（分流部署前开跑的会话），
 * 搬到 script/ 并失效内存缓存——否则 hydrate 落空、新旧历史裂成两份。
 */
export function markSessionScript(sessionId: string): void {
  if (!isValidSessionId(sessionId)) return;
  if (_scriptSessions.has(sessionId)) return;
  const rootPath = _sessionFilePath(sessionId);   // 登记前 = 根目录路径
  _scriptSessions.add(sessionId);
  const scriptPath = _sessionFilePath(sessionId); // 登记后 = script/ 路径
  try {
    if (rootPath && scriptPath && existsSync(rootPath) && !existsSync(scriptPath)) {
      mkdirSync(SCRIPT_SESSIONS_DIR, { recursive: true });
      renameSync(rootPath, scriptPath);
    }
  } catch { /* 迁移失败不致命——下轮 flush 会在 script/ 重建 */ }
  invalidateSession(sessionId);
}

/**
 * 构造会话文件路径（BAR-SEC-14 纵深防御）：格式白名单 + join 后 containment 复查。
 * 非法 sessionId 返回 null——调用方必须 fail-closed（不读写磁盘）。
 * script 登记会话落 sessions/script/（面板 /sessions/list 只读根目录，天然隔离）。
 */
function _sessionFilePath(sessionId: string): string | null {
  if (!isValidSessionId(sessionId)) return null;
  const dir = _scriptSessions.has(sessionId) ? SCRIPT_SESSIONS_DIR : SESSIONS_DIR;
  const filePath = join(dir, `${sessionId}.json`);
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
// 导出供测试（tokenCount 口径 = 真实 API 载荷含 reasoning；BAR-REASONING-L2-01 配套）
export function _computeStats(
  messages: ChatMessage[],
  compacts?: SessionCompact[],
): { messageCount: number; tokenCount: number; windowTokenCount: number; fullTokenCount: number } {
  let mc = 0, fc = 0, wc = 0;
  const lastCompact = compacts && compacts.length > 0 ? compacts[compacts.length - 1] : null;
  // b（windowTokenCount）口径：从摘要边界到最新消息的「窗口全量」token——
  // 与 c（fullTokenCount）同口径（text+reasoning+工具 I/O 全量），但只累加 cutIndex 之后的消息。
  // 三数字语义：c-b = 摘要覆盖掉的量；b-a = 工具压缩+思考摘除省下的量。
  const cutIndex = lastCompact ? lastCompact.cutIndex : -1;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || !Array.isArray(msg.content)) continue;
    const inWindow = i >= cutIndex; // cutIndex=-1（无 compact）时全部在窗口内，但 wc 仅在 lastCompact 存在时有意义
    let counted = false;
    for (const b of msg.content) {
      if (!b) continue;
      if (b.type === 'text') {
        const add = ((typeof b.text === 'string' ? b.text.length : 0) + (typeof b.reasoning === 'string' ? b.reasoning.length : 0));
        fc += add; if (inWindow) wc += add;
        if (!counted && typeof b.text === 'string' && b.text.trim()) { mc++; counted = true; }
      } else if (b.type === 'tool') {
        let add = 0;
        if (b.input) add += JSON.stringify(b.input).length;
        const rc = b.result?.content;
        if (Array.isArray(rc)) for (const c of rc) { if (c?.text) add += String(c.text).length; }
        fc += add; if (inWindow) wc += add;
      }
    }
  }
  // L4 会话压缩（/compact）：把最后一条摘要的 cutIndex 传给投影，让 tokenCount
  // 反映真实 API 载荷（摘要代表的历史不再进载荷）。
  const { apiMessages } = toOpenAiMessages(messages, {
    compact: true,
    ...(lastCompact ? { compactCutIndex: lastCompact.cutIndex } : {}),
  });
  // tc = 压缩投影后的真实 API 载荷字符数：content + tool_calls + reasoning_content。
  // reasoning_content 必须算（用户判断「发给 API 有没有超窗口」的真实参考——近期
  // 豁免区内 reasoning 真实上行）；L2 剥离远期 reasoning 后本数字相应变小，
  // 剥离收益在界面显形（BAR-REASONING-L2-01 配套）。
  const tc = apiMessages.reduce((s, m) =>
    s + (m.content?.length || 0) + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0)
      + (typeof (m as { reasoning_content?: unknown }).reasoning_content === 'string'
        ? ((m as { reasoning_content?: string }).reasoning_content as string).length : 0), 0);
  // windowTokenCount = 窗口全量 token（a/b/c 三数字的 b）：摘要边界之后消息的未压缩全量
  // （与 c 同口径、只算 cutIndex 之后）。无 compact 时 0 → 界面退化为双数字。
  const windowTokenCount = lastCompact ? Math.round(wc / 3) : 0;
  return {
    messageCount: mc,
    tokenCount: Math.round(tc / 3),          // a：摘要后实际发给 API 的压缩载荷
    windowTokenCount,                        // b：摘要窗口内全量 token（未压缩）
    fullTokenCount: Math.round(fc / 3),      // c：会话全量真相源
  };
}

/** 落盘（同步 writeFileSync）。曾用 async writeFile + writing/pendingWrite 锁串行化，
 *  但锁只挡得住同层调用——flushSync 的 writeFileSync 不与在途异步写互斥（BAR-SESSION-FLUSH-01
 *  2026-08-05 复发实锤，e9c-t0p0m0r3.json 尸检：异步 fd 线程池滞后，把旧快照头覆盖在新快照上
 *  → 完整旧档 + 新档尾巴交错）。事件循环单线程下同步写天然串行，从构造上根除此类交错；
 *  防抖 200ms 已合并写入频率，单次 sync 写毫秒级，面板无感。 */
function _writeToDisk(sessionId: string, s: SessionState): void {
  s.dirty = false;
  const compacts = Array.isArray(s.meta.compacts) ? (s.meta.compacts as SessionCompact[]) : undefined;
  const { messageCount, tokenCount, windowTokenCount, fullTokenCount } = _computeStats(s.ctx.messages, compacts);
  const out = {
    ...s.meta,
    messages: s.ctx.messages,
    messageCount,
    tokenCount,
    windowTokenCount,
    fullTokenCount,
    updatedAt: new Date().toISOString(),
  };
  const filePath = _sessionFilePath(sessionId);
  if (!filePath) {
    console.error('[session-store] 拒绝非法 sessionId 落盘:', sessionId);
    return;
  }
  _ensureDir();
  try {
    writeFileSync(filePath, JSON.stringify(out, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[session-store] write failed:', sessionId, err?.message);
    s.dirty = true; // 写失败保脏，下个事件/防抖窗重试
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
 * 强制落盘（生死线：tool_result / done / abort 时调用）。
 * 清防抖计时器后立即同步写——writeFileSync 天然保证在下一个事件前完成落盘。
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
 * 2026-08-05 起与 flush 同体：_writeToDisk 已全面同步化（见 BAR-SESSION-FLUSH-01 复发根治）。
 */
export function flushSync(sessionId: string): void {
  flush(sessionId);
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

// ========== 会话压缩（L4 /compact，2026-08-16 立项） ==========
// 真相源追加式：compacts 数组只增不改——每次 /compact 追加一条固化摘要，
// 投影层按最后一条构造 [system+摘要] + [cutIndex 后消息]。宪法第四条：
// messages 全量永不删，摘要只是投影构造方式的参数。
export interface SessionCompact {
  cutIndex: number;        // 覆盖到第几条消息（不含）——messages[0..cutIndex) 由摘要代表
  summary: string;         // 固化摘要（结构化模板产出，一次生成永不重算）
  model: string;           // 生成摘要的模型（deepseek-v4-flash）
  createdAt: string;
}

export function appendCompact(sessionId: string, c: SessionCompact): void {
  const s = _get(sessionId);
  const arr = Array.isArray(s.meta.compacts) ? (s.meta.compacts as SessionCompact[]) : [];
  arr.push(c);
  s.meta.compacts = arr;
  _scheduleFlush(sessionId, s);
}

/** 上一轮 API 实测 usage（2026-08-18 精确尺改造：存 API 自己数的数，不再估算） */
export interface LastUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  ts: string;
}

export function recordLastUsage(sessionId: string, u: LastUsage): void {
  const s = _get(sessionId);
  s.meta.lastUsage = u;
  _scheduleFlush(sessionId, s);
}

export function getLastUsage(sessionId: string): LastUsage | undefined {
  const s = _get(sessionId);
  const u = s.meta.lastUsage as LastUsage | undefined;
  return u && typeof u.promptTokens === 'number' ? u : undefined;
}

export function getCompacts(sessionId: string): SessionCompact[] {
  const s = _get(sessionId);
  return Array.isArray(s.meta.compacts) ? (s.meta.compacts as SessionCompact[]) : [];
}
