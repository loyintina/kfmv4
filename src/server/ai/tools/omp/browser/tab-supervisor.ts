/**
 * tab-supervisor.ts — Tab 生命周期管理
 *
 * 移植自 omp browser/tab-supervisor.ts。
 * 替换:
 *   - Bun Worker → node:worker_threads Worker
 *   - @oh-my-pi/logger → no-op
 *   - Snowflake.next() → crypto.randomUUID()
 *   - 删除 cmux 路径（只保留 headless 模式）
 */

import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { Worker as NodeWorker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import type { Browser } from 'puppeteer-core';
import { launchHeadlessBrowser, type LaunchHeadlessOptions } from './launch.js';
import type {
  ReadyInfo, RunResultOk, RunErrorPayload, SessionSnapshot,
  WorkerInbound, WorkerOutbound,
} from './tab-protocol.js';
import { ToolError } from '../../types.js';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerHandle {
  mode: 'worker' | 'inline';
  send(msg: WorkerInbound): void;
  onMessage(handler: (msg: WorkerOutbound) => void): () => void;
  onError(handler: (error: Error) => void): () => void;
  terminate(): Promise<void>;
}

interface BrowserHandle {
  browser: Browser;
  refCount: number;
  wsEndpoint: string;
  launchOptions: LaunchHeadlessOptions;
}

interface WorkerTabSession {
  tabName: string;
  worker: WorkerHandle;
  readyInfo: ReadyInfo | null;
  pendingRun: PendingRun | null;
  browser: BrowserHandle;
  dialogPolicy?: 'accept' | 'dismiss';
}

export type TabSession = WorkerTabSession;

export interface PendingRun {
  resolve(result: RunResultOk): void;
  reject(error: Error): void;
  timeoutMs: number;
  timer?: NodeJS.Timeout;
}

export interface AcquireTabOptions {
  url?: string;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeoutMs?: number;
  dialogs?: 'accept' | 'dismiss';
  app?: { path?: string; cdp_url?: string; args?: string[]; target?: string };
}

export interface RunInTabOptions {
  code: string;
  timeoutMs: number;
  signal?: AbortSignal;
  session: SessionSnapshot;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const tabs = new Map<string, TabSession>();
const acquireChains = new Map<string, Promise<void>>();
const GRACE_MS = 750;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getTab(name: string): TabSession | undefined {
  return tabs.get(name);
}

export async function acquireTab(name: string, opts: AcquireTabOptions): Promise<{ session: TabSession; info: ReadyInfo }> {
  const chain = acquireChains.get(name) ?? Promise.resolve();
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  acquireChains.set(name, promise);
  try {
    await chain;
  } catch { /* ignore previous chain error */ }
  try {
    const result = await acquireTabImpl(name, opts);
    resolve();
    return result;
  } catch (err) {
    reject(err as Error);
    throw err;
  } finally {
    if (acquireChains.get(name) === promise) acquireChains.delete(name);
  }
}

async function acquireTabImpl(name: string, opts: AcquireTabOptions): Promise<{ session: TabSession; info: ReadyInfo }> {
  const existing = tabs.get(name);
  if (existing) {
    if (existing.worker) {
      return { session: existing, info: existing.readyInfo! };
    }
  }
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const launchOpts: LaunchHeadlessOptions = {
    headless: true,
    viewport: opts.viewport,
  };
  const browser = await launchHeadlessBrowser(launchOpts);
  const wsEndpoint = browser.wsEndpoint();
  const browserHandle: BrowserHandle = { browser, refCount: 1, wsEndpoint, launchOptions: launchOpts };
  const worker = await spawnTabWorker();
  const session: WorkerTabSession = {
    tabName: name,
    worker,
    readyInfo: null,
    pendingRun: null,
    browser: browserHandle,
    dialogPolicy: opts.dialogs,
  };
  tabs.set(name, session);

  worker.onMessage(msg => handleTabMessage(session, msg));
  worker.onError(err => {
    if (session.pendingRun) {
      session.pendingRun.reject(err);
      session.pendingRun = null;
    }
  });

  const initTimeout = AbortSignal.timeout(timeoutMs);
  let resolveReady!: (value: ReadyInfo | PromiseLike<ReadyInfo>) => void;
  let rejectReady!: (reason?: unknown) => void;
  const readyPromise = new Promise<ReadyInfo>((res, rej) => { resolveReady = res; rejectReady = rej; });
  const timer = setTimeout(() => rejectReady(new ToolError(`Tab worker init timed out after ${timeoutMs}ms`)), timeoutMs);
  const origOnMsg = worker.onMessage(msg => {
    if (msg.type === 'ready') { clearTimeout(timer); resolveReady(msg.info); }
    if (msg.type === 'init-failed') { clearTimeout(timer); rejectReady(new ToolError(msg.error.message)); }
  });

  const sessionSnapshot: SessionSnapshot = { cwd: process.cwd() };
  const safeDir = path.dirname(fileURLToPath(import.meta.url));
  worker.send({
    type: 'init',
    payload: {
      mode: 'headless',
      browserWSEndpoint: wsEndpoint,
      safeDir,
      viewport: opts.viewport,
      dialogs: opts.dialogs,
      url: opts.url,
      waitUntil: opts.waitUntil,
      timeoutMs,
    },
  });

  const info = await readyPromise;
  session.readyInfo = info;
  return { session, info };
}

export async function runInTab(name: string, opts: RunInTabOptions): Promise<RunResultOk> {
  const session = tabs.get(name);
  if (!session) throw new ToolError(`No tab named "${name}"`);
  if (session.pendingRun) throw new ToolError(`Tab "${name}" is busy`);
  let resolve!: (value: RunResultOk) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<RunResultOk>((res, rej) => { resolve = res; reject = rej; });
  const timer = setTimeout(() => {
    session.pendingRun = null;
    reject(new ToolError(`Browser code timed out after ${opts.timeoutMs}ms`));
  }, opts.timeoutMs);
  session.pendingRun = { resolve, reject, timeoutMs: opts.timeoutMs, timer };

  if (opts.signal) {
    const onAbort = (): void => {
      session.worker.send({ type: 'abort', id: session.pendingRun ? 'current' : '' });
    };
    if (opts.signal.aborted) onAbort();
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }

  session.worker.send({
    type: 'run',
    id: `run-${crypto.randomUUID().slice(0, 8)}`,
    name: 'browser-run',
    code: opts.code,
    timeoutMs: opts.timeoutMs,
    session: opts.session,
  });

  return await promise;
}

export async function releaseTab(name: string): Promise<boolean> {
  const session = tabs.get(name);
  if (!session) return false;
  tabs.delete(name);
  try {
    session.worker.send({ type: 'close' });
    await session.worker.terminate();
  } catch { /* best-effort */ }
  session.browser.refCount--;
  if (session.browser.refCount <= 0) {
    try { await session.browser.browser.close(); } catch { /* best-effort */ }
  }
  return true;
}

export async function releaseAllTabs(): Promise<number> {
  const names = [...tabs.keys()];
  await Promise.all(names.map(n => releaseTab(n)));
  return names.length;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function handleTabMessage(session: WorkerTabSession, msg: WorkerOutbound): void {
  switch (msg.type) {
    case 'result': {
      const run = session.pendingRun;
      if (!run) return;
      session.pendingRun = null;
      if (run.timer) clearTimeout(run.timer);
      if (msg.ok) run.resolve(msg.payload);
      else run.reject(new ToolError(msg.error.message));
      return;
    }
    case 'ready':
      session.readyInfo = msg.info;
      return;
    case 'log':
      process.stderr.write(`[browser:${session.tabName}] ${msg.level}: ${msg.msg}\n`);
      return;
    case 'closed':
      session.readyInfo = null;
      return;
  }
}

async function spawnTabWorker(): Promise<WorkerHandle> {
  try {
    // Use tsx loader for worker thread (handles TypeScript imports)
    const workerDir = path.dirname(fileURLToPath(import.meta.url));
    const workerPath = path.join(workerDir, 'tab-worker-entry.ts');
    // Extract tsx loader args from process.execArgv, filter out --eval/-e and the eval script
    // Use tsx to run the worker entry (handles .ts imports without interfering with CDP)
    const tsxBin = process.argv[0]; // node binary
    const tsxLoader = process.execArgv.find(a => a.includes('tsx/dist/loader'));
    const tsxRequire = process.execArgv.find(a => a.includes('tsx/dist/preflight'));
    const worker = new NodeWorker(workerPath, {
      execArgv: tsxRequire && tsxLoader ? [tsxRequire, tsxLoader] : [],
    });
    return wrapNodeWorker(worker);
  } catch (err) {
    return spawnInlineWorker();
  }
}

function wrapNodeWorker(worker: NodeWorker): WorkerHandle {
  return {
    mode: 'worker',
    send(msg) { worker.postMessage(msg); },
    onMessage(handler) {
      const wrap = (message: unknown): void => handler(message as WorkerOutbound);
      worker.on('message', wrap);
      return () => worker.off('message', wrap);
    },
    onError(handler) {
      const onError = (err: Error): void => handler(err);
      worker.on('error', onError);
      return () => worker.off('error', onError);
    },
    async terminate() { await worker.terminate(); },
  };
}

async function spawnInlineWorker(): Promise<WorkerHandle> {
  const hostListeners = new Set<(message: WorkerOutbound) => void>();
  const workerListeners = new Set<(message: unknown) => void>();
  const workerTransport = {
    send: (msg: WorkerOutbound | WorkerInbound) =>
      queueMicrotask(() => { for (const listener of hostListeners) listener(msg as WorkerOutbound); }),
    onMessage: (handler: (msg: WorkerOutbound | WorkerInbound) => void) => {
      workerListeners.add(handler as (message: unknown) => void);
      return () => workerListeners.delete(handler as (message: unknown) => void);
    },
    close: () => {},
  };
  const { WorkerCore } = await import('./tab-worker.js');
  new WorkerCore(workerTransport as never);
  return {
    mode: 'inline',
    send: msg => queueMicrotask(() => { for (const listener of workerListeners) listener(msg); }),
    onMessage: handler => { hostListeners.add(handler); return () => hostListeners.delete(handler); },
    onError: () => () => {},
    async terminate() {},
  };
}
