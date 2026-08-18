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
import { appendEvent, flush, flushSync } from './session-store.js';

interface Subscriber {
  onEvent: (event: StreamEvent) => void;
  onDone: () => void;
}

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

/**
 * BAR-BASH-HANG-01：run 级停摆看门狗。
 * 2026-08-01 生产实锤：bash 工具进程替换管道死锁（comm 读 <(sort …)，pi-natives
 * spawn 把管道写端泄漏进 node 进程，EOF 永不到达），executeShell Promise 悬挂
 * 100 分钟——for await 永久阻塞在 next()，run 永不完成，客户端发送按钮永卡"生成中"。
 * 同类故障还有上游静默停摆（TCP 半开，reader.read() 无数据无错误永不返回）。
 * 看门狗：生成器 STALL_MS 内一个事件都不产出 → 判停摆，中止 run 并以 error 收尾——
 * 覆盖一切"悬挂但不抛错"的故障类（工具挂死/上游半开/未来未知挂点）。
 * 取值 > bash 默认超时 300s：合法的长工具调用由工具自身超时先收尾，看门狗只兜真挂死。
 */
const STALL_MS_DEFAULT = 360_000;
let _stallMs = STALL_MS_DEFAULT;
/** 测试钩子：注入短停摆阈值（null 恢复默认）。生产禁止调用。 */
export function _setStallMsForTest(ms: number | null): void { _stallMs = ms ?? STALL_MS_DEFAULT; }

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
 * 启动一个后台生成任务。startRun 只在用户显式发送新消息时调用——
 * 若该 session 已有旧 run（无论是否完成），一律取消并以新消息启动全新 run，
 * 保证新消息不会被丢弃、也不会错误地"接上"旧 run 的上下文。
 * （重连续读走 getActiveRun/attachRun，不经过这里。）
 */
export type StreamFn = (
  messages: ChatMessage[],
  model: string,
  provider: string,
  wsServer: WsServer,
  signal: AbortSignal,
  roleFile?: string,
  allowTools?: string[],
  extraSystem?: string,
  maxTokens?: number,
  params?: Record<string, unknown>,
  sandboxRoot?: string,
  readRoot?: string,
  sessionId?: string,
) => AsyncGenerator<StreamEvent>;


export function startRun(
  sessionId: string,
  messages: ChatMessage[],
  model: string,
  provider: string,
  wsServer: WsServer,
  roleFile?: string,
  streamFn: StreamFn = streamChat,
  tools?: string[],
  extraSystem?: string,
  maxTokens?: number,
  params?: Record<string, unknown>,
  sandboxRoot?: string,
  readRoot?: string,
  sessionIdExplicit?: string, // 显式透传给 streamFn 的会话 ID（kfm-compact 用；缺省回退 sessionId 首参）
): Run {
  // 取消该 session 的旧 run（若仍在跑），新消息取代之
  const prev = getActiveRun(sessionId);
  if (prev) {
    if (!prev.done) prev.abort.abort();
    if (prev.evictTimer) clearTimeout(prev.evictTimer);
    _runs.delete(prev.id);
    _bySession.delete(sessionId);
  }

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

  // 后台驱动生成器：与请求连接解耦。streamFn 默认 streamChat，测试可注入 mock。
  (async () => {
    const it = streamFn(messages, model, provider, wsServer, run.abort.signal, roleFile, tools, extraSystem, maxTokens, params, sandboxRoot, readRoot, sessionIdExplicit ?? sessionId)[Symbol.asyncIterator]();
    try {
      // 停摆看门狗（BAR-BASH-HANG-01）：手动迭代 + 每次 next() 与停摆定时器
      // 竞速。for await 无法表达"next() 永不返回"的超时。
      while (true) {
        let stallTimer: ReturnType<typeof setTimeout> | null = null;
        const nextP = it.next();
        const stallP = new Promise<'__stall__'>(res => {
          stallTimer = setTimeout(() => res('__stall__'), _stallMs);
        });
        const res = await Promise.race([nextP, stallP]);
        if (stallTimer) clearTimeout(stallTimer);
        if (res === '__stall__') {
          nextP.catch(() => {}); // 被抛弃的 next() 之后可能 reject，吞掉防 unhandled
          run.abort.abort(); // 中止信号透传：上游 fetch / 工具原生子进程能杀的杀
          // 不可 await it.return()：生成器卡死在永不 resolve 的 await 时（正是停摆
          // 场景），return() 会排在 pending next() 后面同样永不返回——只能 fire-and-forget。
          try { it.return?.(undefined)?.catch(() => {}); } catch { /* 同步 throw 也不掩盖停摆 */ }
          throw new Error(`生成停滞超过 ${Math.round(_stallMs / 1000)}s 无任何事件，已中止（工具挂死或上游静默停摆）`);
        }
        if (res.done) break;
        const event = res.value;
        run.events.push(event);
        if (sessionId) {
          appendEvent(sessionId, event);
          // v8 性能优化：按事件类型分流落盘策略
          // 高频 delta（text/thinking/input_json）走 200ms 防抖异步写入，合并多次小写入
          // 结构性/终态事件（tool_result/message_stop/done/error）立即同步写入
          // 生死线：tool_result 必须同步（工具执行昂贵，丢失=重执行；冷恢复依赖）
          const isHighFreq = event.type === 'content_block_delta';
          if (!isHighFreq) flushSync(sessionId);
        }
        for (const sub of run.subscribers) {
          try { sub.onEvent(event); } catch { /* 订阅者写失败不影响生成 */ }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      run.error = msg;
      const errEvent: StreamEvent = { type: 'error', content: msg };
      run.events.push(errEvent);
      if (sessionId) appendEvent(sessionId, errEvent);
      for (const sub of run.subscribers) { try { sub.onEvent(errEvent); } catch { /* ignore */ } }
    } finally {
      run.done = true;
      if (sessionId) flush(sessionId);
      // 通知所有实时订阅者流已结束（onEvent 循环里 run.done 尚为 false，
      // 最后一个 done/error 事件派发时不会触发 onDone，必须在此显式收尾）。
      for (const sub of run.subscribers) { try { sub.onDone(); } catch { /* ignore */ } }
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
  const sub: Subscriber = {
    onEvent: (event) => { onEvent(event, idx++); },
    onDone,
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
