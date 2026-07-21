/**
 * run-manager.ts — AI 对话后台挂机管理器
 *
 * 让 LLM 生成像 tmux 会话一样持久化：生成任务在服务端后台跑到完成，
 * 与客户端连接解耦。客户端断开（刷新/切后台）后生成继续；重连时从缓冲区
 * 补齐已错过的事件并续读实时尾部。
 *
 * ## 模型
 *   一个 sessionId 最多一个活跃 run（再次 start 会复用/等待现有 run）。
 *   Run 持有全部 StreamEvent 缓冲 + 订阅者集合。生成器每产出一个事件：
 *     1. push 进 events[]（重连补齐用）
 *     2. 广播给当前所有订阅者（实时）
 *   done/error 后标记完成，延迟 EVICT_MS 清理缓冲区。
 *
 * ## 生命周期
 *   服务端进程重启 → 运行态全部丢失（等价 tmux kill-server，可接受）。
 *   done/error 后 EVICT_MS 内可重连补齐；超时清理释放内存。
 */

import { streamChat, type ChatMessage, type StreamEvent } from './chat.js';
import type { WsServer } from '../ws-server.js';

type Subscriber = (event: StreamEvent) => void;

interface Run {
  id: string;
  sessionId: string;
  events: StreamEvent[];
  done: boolean;
  error: string | null;
  subscribers: Set<Subscriber>;
  abort: AbortController;
  evictTimer?: ReturnType<typeof setTimeout>;
  startedAt: number;
}

const EVICT_MS = 5 * 60 * 1000; // done 后保留 5 分钟供重连补齐

const _runs = new Map<string, Run>();      // runId → Run
const _bySession = new Map<string, string>(); // sessionId → 活跃 runId

function _newRunId(): string {
  return 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** 当前 session 是否有活跃（未完成）的 run */
export function getActiveRun(sessionId: string): Run | null {
  const rid = _bySession.get(sessionId);
  if (!rid) return null;
  const run = _runs.get(rid);
  if (!run) return null;
  return run;
}

export function getRun(runId: string): Run | null {
  return _runs.get(runId) || null;
}

/**
 * 启动一个后台生成任务。若该 session 已有未完成 run，直接返回它（幂等）。
 * 生成在后台跑，不依赖任何客户端连接。
 */
export function startRun(
  sessionId: string,
  messages: ChatMessage[],
  model: string,
  provider: string,
  wsServer: WsServer,
): Run {
  // 已有活跃 run（未完成）→ 复用，避免重复生成
  const existing = getActiveRun(sessionId);
  if (existing && !existing.done) return existing;

  const run: Run = {
    id: _newRunId(),
    sessionId,
    events: [],
    done: false,
    error: null,
    subscribers: new Set(),
    abort: new AbortController(),
    startedAt: Date.now(),
  };
  _runs.set(run.id, run);
  _bySession.set(sessionId, run.id);

  // 后台驱动生成器：与请求连接解耦
  (async () => {
    try {
      for await (const event of streamChat(messages, model, provider, wsServer, run.abort.signal)) {
        run.events.push(event);
        for (const sub of run.subscribers) {
          try { sub(event); } catch { /* 订阅者写失败不影响生成 */ }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      run.error = msg;
      const errEvent: StreamEvent = { type: 'error', content: msg };
      run.events.push(errEvent);
      for (const sub of run.subscribers) { try { sub(errEvent); } catch { /* ignore */ } }
    } finally {
      run.done = true;
      _scheduleEvict(run);
    }
  })();

  return run;
}

/**
 * 订阅一个 run：先补齐 fromIndex 起已缓冲的事件，再实时接收后续事件。
 * 返回退订函数。若 run 已完成，补齐后立即调用 onDone。
 */
export function attachRun(
  runId: string,
  fromIndex: number,
  onEvent: (event: StreamEvent, index: number) => void,
  onDone: () => void,
): () => void {
  const run = _runs.get(runId);
  if (!run) { onDone(); return () => {}; }

  // 1) 补齐已缓冲的事件（重连场景）
  for (let i = Math.max(0, fromIndex); i < run.events.length; i++) {
    onEvent(run.events[i], i);
  }

  // 2) 已完成 → 无需实时订阅
  if (run.done) { onDone(); return () => {}; }

  // 3) 实时订阅后续事件
  let idx = run.events.length;
  const sub: Subscriber = (event) => {
    onEvent(event, idx++);
    if (run.done) onDone();
  };
  run.subscribers.add(sub);
  return () => { run.subscribers.delete(sub); };
}

function _scheduleEvict(run: Run): void {
  if (run.evictTimer) clearTimeout(run.evictTimer);
  run.evictTimer = setTimeout(() => {
    _runs.delete(run.id);
    if (_bySession.get(run.sessionId) === run.id) _bySession.delete(run.sessionId);
  }, EVICT_MS);
}

/** 取消一个 run（用户主动停止）。 */
export function cancelRun(runId: string): boolean {
  const run = _runs.get(runId);
  if (!run) return false;
  run.abort.abort();
  return true;
}
