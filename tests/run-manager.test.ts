// ==========================================================================
// tests/run-manager.test.ts — AI 对话后台挂机运行时 · 回归钉子
//
// 规格来源：docs/design/AI_CHAT_RUNTIME.md §3-4（后台挂机 + 时序契约）。
// 方法论：docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 A（垂直切片样板）。
//
// 用依赖注入的 streamFn 把 streamChat 换成受控 mock 生成器，
// 完全离线测试 run-manager 的编排逻辑（runId 分配 / 事件缓冲 / 订阅广播 /
// onDone 收尾时序 / supersede 语义），不碰 provider、不碰网络。
//
// 无墙钟计时器（rule ts-no-test-timers）：不 sleep 猜时长，改为 await 代码
// 真正暴露的信号——onDone 回调是运行结束的确定性信号，包一层 Promise 等它。
// ==========================================================================

import assert from 'assert';
import { readFileSync } from 'fs';
import { test, group, regression } from './runner.js';
import {
  startRun, attachRun, getActiveRun, getRun, cancelRun, _setStallMsForTest,
  type StreamFn,
} from '../src/server/ai/run-manager.js';
import type { StreamEvent } from '../src/server/ai/chat.js';

group('run-manager');

// ---- 测试夹具 ----

// run-manager 只是把 wsServer 透传给 streamFn，自身从不调用它 → 空对象足够。
const fakeWs = {} as any;

/** 订阅一个 run，返回 { seen, wasDoneCalled }。onDone 只记录，不作为等待信号——
 *  因为 onDone 触发本身就是 BAR-101 要测的东西，用它当等待信号会形成循环。 */
function subscribe(runId: string, fromIndex = 0) {
  const seen: StreamEvent[] = [];
  let doneCalled = false;
  attachRun(runId, fromIndex, (e) => seen.push(e), () => { doneCalled = true; });
  return { seen, wasDoneCalled: () => doneCalled };
}

/** 独立的运行完成信号：轮询 run.done（它在 finally 里翻转，与 onDone 修复无关），
 *  跨微任务轮询，有界轮数——确定性，不依赖墙钟。bug 存在时 run 仍会完成，
 *  故此 helper 不会挂，让断言以「失败」而非「超时」暴露 bug。 */
async function awaitRunDone(run: { done: boolean }, maxTurns = 1000): Promise<void> {
  for (let i = 0; i < maxTurns && !run.done; i++) {
    await Promise.resolve(); // 让出一个微任务轮
  }
  if (!run.done) throw new Error('run 未在预期微任务轮内完成');
}

/** 立即产出给定事件序列然后结束的 mock 生成器工厂 */
function fixedStream(events: StreamEvent[]): StreamFn {
  return async function* () {
    for (const e of events) yield e;
  };
}

/** 受控生成器：手动 push 事件 / 结束 / 抛错（fire-and-forget）。
 *  测试用 awaitRunDone(run) 等真实完成信号，不依赖内部时序握手。 */
function controllableStream() {
  let wake: (() => void) | null = null;
  const queue: StreamEvent[] = [];
  let ended = false;
  let error: Error | null = null;

  const gen: StreamFn = async function* () {
    while (true) {
      if (queue.length) { yield queue.shift()!; continue; }
      if (error) throw error;
      if (ended) return;
      await new Promise<void>(res => { wake = res; });
    }
  };

  const kick = () => { wake?.(); wake = null; };
  return {
    fn: gen,
    push(e: StreamEvent) { queue.push(e); kick(); },
    end() { ended = true; kick(); },
    fail(msg: string) { error = new Error(msg); kick(); },
  };
}

const TEXT: StreamEvent = { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'hi' };
const STOP: StreamEvent = { type: 'message_stop' };
const DONE: StreamEvent = { type: 'done' };

// ==========================================================================
// BAR-101 (a5bf0c4): 生成结束后实时订阅者的 onDone 必被触发
//
// 根因：run.done 在 finally 才置 true，派发最后一个 done 事件时它仍是 false，
// 依赖 onEvent 内 if(run.done) 永不触发 → __end__ 不发 → 客户端死等 → 按钮卡死。
// 修复：finally 里 run.done=true 之后显式遍历 subscribers 调 onDone。
// ==========================================================================

regression('BAR-101', 'a5bf0c4', '生成正常结束 → 实时订阅者 onDone 触发', async () => {
  const run = startRun('s1', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, fixedStream([TEXT, STOP, DONE]));
  const sub = subscribe(run.id);
  await awaitRunDone(run); // 独立完成信号，不用 onDone（那是被测对象）
  assert(run.done, 'run 应已完成');
  assert(sub.wasDoneCalled(), 'onDone 必须被触发（BAR-101 核心：finally 显式收尾）');
  assert(sub.seen.some(e => e.type === 'done'), '订阅者应收到 done 事件');
});

regression('BAR-101b', 'a5bf0c4', '生成器抛错 → onDone 仍触发 + error 事件入缓冲', async () => {
  const s = controllableStream();
  const run = startRun('s-err', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, s.fn);
  const sub = subscribe(run.id);
  s.push(TEXT);
  s.fail('boom');
  await awaitRunDone(run);
  assert(run.done, '抛错后 run 也应标记完成');
  assert(sub.wasDoneCalled(), '抛错路径 onDone 也必须触发');
  assert(sub.seen.some(e => e.type === 'error'), '错误应作为 error 事件广播');
});

// ==========================================================================
// BAR-104a (d4a60f7): run 已完成后 attachRun 补齐缓冲 + 立即 onDone（重连续读）
// ==========================================================================

regression('BAR-104a', 'd4a60f7', 'run 已完成 → attachRun 补齐历史事件 + 立即 onDone', async () => {
  const run = startRun('s2', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, fixedStream([TEXT, STOP, DONE]));
  await awaitRunDone(run); // 先等它跑完
  assert(run.done, '前置：run 已完成');
  // 完成之后才订阅（模拟重连）→ attachRun 对已完成 run 同步补齐 + 同步 onDone
  const sub = subscribe(run.id);
  assert(sub.seen.length === 3, `应补齐全部 3 个缓冲事件，实际 ${sub.seen.length}`);
  assert(sub.wasDoneCalled(), '已完成的 run 补齐后应立即 onDone');
});

regression('BAR-104b', 'd4a60f7', 'attachRun 从 fromIndex 续读（不重发已消费事件）', async () => {
  const run = startRun('s3', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, fixedStream([TEXT, STOP, DONE]));
  await awaitRunDone(run);
  const sub = subscribe(run.id, 2);
  assert(sub.seen.length === 1, `从 index=2 续读应只补 1 个事件，实际 ${sub.seen.length}`);
  assert(sub.seen[0].type === 'done', '续读的应是 index=2 的 done 事件');
});

// ==========================================================================
// BAR-104c (d4a60f7): startRun 语义是「取代」，不是「复用」
// 新消息一律取消旧 run 并起全新 run，不接旧上下文。
// ==========================================================================

regression('BAR-104c', 'd4a60f7', 'startRun 取代同 session 旧 run（新 run id 不同 + 旧 run 被取消）', async () => {
  const s1 = controllableStream();
  const first = startRun('sess-x', [{ role: 'user', content: 'a' }], 'm', 'p', fakeWs, undefined, s1.fn);
  s1.push(TEXT);
  assert(!first.done, '前置：第一个 run 仍在跑');

  // 同 session 再次 startRun → 取代
  const second = startRun('sess-x', [{ role: 'user', content: 'b' }], 'm', 'p', fakeWs, undefined, fixedStream([DONE]));
  await awaitRunDone(second);

  assert(second.id !== first.id, '新 run 必须是全新 id（取代而非复用）');
  assert(first.abort.signal.aborted, '旧 run 应被 abort');
  assert(getActiveRun('sess-x')!.id === second.id, '活跃 run 应指向新 run');
  assert(getRun(first.id) === null, '旧 run 应从注册表移除');
});

// ==========================================================================
// 基础编排：runId 分配、事件缓冲、cancel
// ==========================================================================

test('startRun 分配唯一 runId 并注册为活跃', async () => {
  const run = startRun('s-basic', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, fixedStream([DONE]));
  assert(run.id.startsWith('run_'), 'runId 前缀应为 run_');
  assert(getActiveRun('s-basic')!.id === run.id, '应注册为该 session 的活跃 run');
  await awaitRunDone(run);
}, { tag: 'integration' });

test('cancelRun abort 正在运行的 run', async () => {
  const s = controllableStream();
  const run = startRun('s-cancel', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, s.fn);
  const sub = subscribe(run.id);
  s.push(TEXT);
  const ok = cancelRun(run.id);
  assert(ok, 'cancelRun 应返回 true');
  assert(run.abort.signal.aborted, 'run 应被 abort');
  s.end();
  await awaitRunDone(run);
}, { tag: 'integration' });

test('cancelRun 对不存在的 run 返回 false', () => {
  assert(cancelRun('run_nonexistent') === false);
}, { tag: 'integration' });

test('事件按到达顺序缓冲进 run.events', async () => {
  const run = startRun('s-buf', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, fixedStream([TEXT, STOP, DONE]));
  await awaitRunDone(run);
  assert(run.events.length === 3, `应缓冲 3 个事件，实际 ${run.events.length}`);
  assert(run.events[0].type === 'content_block_delta');
  assert(run.events[2].type === 'done');
}, { tag: 'integration' });

// ==========================================================================
// BAR-BASH-HANG-01：run 级停摆看门狗
// 2026-08-01 生产实锤：bash 进程替换管道死锁（comm 读 <(sort …)，pi-natives
// spawn 把管道写端泄漏进 node 进程，EOF 永不到达）→ executeShell Promise 悬挂
// 100 分钟 → for await 永卡 next() → run 永不完成 → 发送按钮永卡"生成中"。
// 看门狗：STALL_MS 无事件 → 中止 run + error 收尾。覆盖工具挂死/上游静默停摆
// （TCP 半开 reader.read() 永不返回）等一切"悬挂但不抛错"故障类。
// revert 验证：去掉看门狗竞速后，「停摆中止」钉会因 run 永不完成而失败（有界轮询耗尽）。
// ==========================================================================

/** 墙钟有界轮询 run.done——看门狗本身是定时器，微任务轮询等不到它。
 *  轮询只是「观察真实信号」，不是 sleep 猜时长（ts-no-test-timers 的精神）。 */
async function awaitDoneWall(run: { done: boolean }, maxMs = 4000): Promise<void> {
  const t0 = Date.now();
  while (!run.done && Date.now() - t0 < maxMs) {
    await new Promise(r => setTimeout(r, 10));
  }
  if (!run.done) throw new Error(`run 未在 ${maxMs}ms 内完成（看门狗未生效）`);
}

/** 产出一个事件后永久悬挂的 mock 生成器（复刻 executeShell 悬挂现场） */
function hangStream(): StreamFn {
  return async function* () {
    yield { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: 'x' };
    await new Promise<void>(() => {}); // 永不 resolve——工具挂死/上游半开的同构体
  };
}

regression('BAR-BASH-HANG-01', 'stall-watchdog', '生成器停摆 → 看门狗中止 run + error 收尾 + abort 透传', async () => {
  _setStallMsForTest(50);
  try {
    const run = startRun('s-stall', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, hangStream());
    const sub = subscribe(run.id);
    await awaitDoneWall(run);
    assert(run.error && run.error.includes('停滞'), `run.error 应含停摆说明，实际: ${run.error}`);
    assert(run.abort.signal.aborted, '停摆后 run 应被 abort（信号透传给上游/工具）');
    const errEvents = run.events.filter(e => e.type === 'error');
    assert(errEvents.length === 1, `应有 1 个 error 事件，实际 ${errEvents.length}`);
    assert(sub.wasDoneCalled(), '订阅者应收到 onDone（客户端发送按钮才能复位）');
  } finally {
    _setStallMsForTest(null);
  }
}, { tag: 'integration' });

regression('BAR-BASH-HANG-01', 'watchdog-no-false-positive', '持续产出事件的 run 不触发看门狗', async () => {
  _setStallMsForTest(80);
  try {
    const s = controllableStream();
    const run = startRun('s-nostall', [{ role: 'user', content: 'x' }], 'm', 'p', fakeWs, undefined, s.fn);
    s.push(TEXT);
    // 间隔小于阈值地持续产出：每次 next() 都赶在定时器前返回
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 30));
      s.push(TEXT);
    }
    s.end();
    await awaitDoneWall(run);
    assert(run.error === null, `正常 run 不应有 error，实际: ${run.error}`);
    assert(run.events[run.events.length - 1].type !== 'error', '末尾不应是 error 事件');
  } finally {
    _setStallMsForTest(null);
  }
}, { tag: 'integration' });

regression('BAR-BASH-HANG-01', 'bash-backend-node', 'bash 工具后端为 node:child_process（pi-natives fd 泄漏类根除）+ 缺省超时 + 信号接线', () => {
  const src = readFileSync(new URL('../src/server/ai/tools/omp/bash.ts', import.meta.url), 'utf-8');
  assert(src.includes("from 'child_process'"), 'bash.ts 后端应为 node:child_process（pi-natives executeShell 进程替换管道泄漏 = 本次事故根因）');
  assert(!src.includes("from './native.js'"), 'bash.ts 不应再引用 pi-natives 原生层');
  assert(src.includes('300_000'), 'bash.ts 缺省 timeoutMs 应为 300_000（缺省无超时 = 挂死无兜底）');
  assert(src.includes("addEventListener('abort'"), 'bash.ts 必须接 ctx.signal 的 abort');
  assert(src.includes('detached: true'), 'bash.ts 必须 detached 成组，超时/中止才能杀整棵进程树');
}, { tag: 'integration' });

// ---- 真刀实枪行为钉（node 后端真实执行，秒级确定性） ----

regression('BAR-BASH-HANG-01', 'proc-subst-no-hang', '事故现场命令：进程替换 comm 正常完成（旧后端在此死锁 100 分钟）', async () => {
  const { ompBashTool } = await import('../src/server/ai/tools/omp/bash.js');
  const r = await ompBashTool.execute(
    { command: 'comm -23 <(printf "a\\nb\\nc\\n") <(printf "b\\n")', timeout: 10 },
    { cwd: '/tmp', wsServer: fakeWs },
  );
  assert(!r.isError, `进程替换命令应成功，实际: ${JSON.stringify(r.content)}`);
  const text = r.content[0]?.text || '';
  assert(text.includes('a') && text.includes('c') && !text.trim().startsWith('b'), `comm 输出应为 a/c，实际: ${text}`);
}, { tag: 'integration' });

regression('BAR-BASH-HANG-01', 'timeout-kills', '超时杀死挂死命令（sleep 30 + timeout 1s → ~1s 返回 isError）', async () => {
  const { ompBashTool } = await import('../src/server/ai/tools/omp/bash.js');
  const t0 = Date.now();
  const r = await ompBashTool.execute({ command: 'sleep 30', timeout: 1 }, { cwd: '/tmp', wsServer: fakeWs });
  const dt = Date.now() - t0;
  assert(dt < 5000, `应 ~1s 返回，实际 ${dt}ms`);
  assert(r.isError, '超时应标记 isError');
}, { tag: 'integration' });

regression('BAR-BASH-HANG-01', 'abort-kills', 'ctx.signal abort 杀死运行中命令（sleep 30 + 100ms 后 abort → 快速返回）', async () => {
  const { ompBashTool } = await import('../src/server/ai/tools/omp/bash.js');
  const ac = new AbortController();
  const t0 = Date.now();
  const p = ompBashTool.execute({ command: 'sleep 30' }, { cwd: '/tmp', wsServer: fakeWs, signal: ac.signal });
  setTimeout(() => ac.abort(), 100);
  const r = await p;
  const dt = Date.now() - t0;
  assert(dt < 5000, `abort 应快速返回，实际 ${dt}ms`);
  assert(r.isError, 'abort 应标记 isError');
}, { tag: 'integration' });
