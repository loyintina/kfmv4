/**
 * tab-worker.ts — WorkerCore: 在 worker 线程里驱动 puppeteer page
 *
 * 移植自 omp browser/tab-worker.ts (~1446 行 → ~800 行)。
 * 替换:
 *   - @oh-my-pi/pi-utils → 内联 untilAborted / postmortem passthrough
 *   - JsRuntime → AsyncFunction 执行
 *   - Bun.sleep → setTimeout + Promise.withResolvers
 *   - Bun.write → fs.promises.writeFile
 *   - resizeImage → 直接用 buffer
 *   - Snowflake.next() → crypto.randomUUID()
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type {
  Browser, Dialog, ElementHandle, ElementScreenshotOptions,
  ImageFormat, KeyInput, Page, SerializedAXNode, Target,
} from 'puppeteer-core';
import {
  captureAriaSnapshot, parseAriaRefSelector, resolveAriaRefHandle,
} from './aria/aria-snapshot.js';
import { applyStealthPatches, applyViewport, BROWSER_PROTOCOL_TIMEOUT_MS, DEFAULT_VIEWPORT, loadPuppeteerInWorker } from './launch.js';
import { extractReadableFromHtml, type ReadableFormat } from './readable.js';
import { markHandled, waitForBrowserRun } from './run-cancellation.js';
import {
  type Observation, type ObservationEntry, type ReadyInfo,
  type RunErrorPayload, type RunResultOk, type ScreenshotResult,
  type SessionSnapshot, type ToolReply, type Transport,
  type WorkerInbound, type WorkerInitPayload,
} from './tab-protocol.js';
import { ToolAbortError, ToolError, throwIfAborted } from '../../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise<void>(r => setTimeout(r, ms));
}

function untilAborted<T>(signal: AbortSignal | undefined | null, pr: Promise<T> | (() => Promise<T>)): Promise<T> {
  if (!signal) return typeof pr === 'function' ? pr() : pr;
  if (signal.aborted) return Promise.reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
  signal.addEventListener('abort', onAbort, { once: true });
  void (async () => {
    try { resolve(await (typeof pr === 'function' ? pr() : pr)); }
    catch (err) { reject(err); }
    finally { signal.removeEventListener('abort', onAbort); }
  })();
  return promise;
}

function resolveToCwd(p: string, cwd: string): string {
  return path.isAbsolute(p) ? p : path.join(cwd, p);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTERACTIVE_AX_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
  'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'tab',
  'switch', 'slider', 'spinbutton', 'searchbox',
]);

const LEGACY_SELECTOR_PREFIXES = ['p-aria/', 'p-text/', 'p-xpath/', 'p-pierce/'] as const;
const SELECTOR_HANDLER_PREFIXES = [
  'aria/', 'text/', 'xpath/', 'pierce/', 'p-aria/', 'p-text/', 'p-xpath/', 'p-pierce/',
] as const;

const QUICK_OP_TIMEOUT_MS = 20_000;
const ACTION_OP_TIMEOUT_MS = 15_000;
const OP_DEADLINE_SLACK_MS = 1_000;

interface ScreenshotOptions {
  fullPage?: boolean;
  selector?: string;
  save?: string;
  silent?: boolean;
}

type DragTarget = string | { readonly x: number; readonly y: number };
type ActionabilityResult = { ok: true; x: number; y: number } | { ok: false; reason: string };

interface OpTimeouts { quickOpMs: number; actionOpMs: number; }
function resolveOpTimeouts(cellTimeoutMs: number): OpTimeouts {
  const quickMs = Math.min(QUICK_OP_TIMEOUT_MS, cellTimeoutMs - OP_DEADLINE_SLACK_MS);
  const actionMs = Math.min(ACTION_OP_TIMEOUT_MS, cellTimeoutMs - OP_DEADLINE_SLACK_MS);
  return { quickOpMs: Math.max(1_000, quickMs), actionOpMs: Math.max(1_000, actionMs) };
}
function resolveWaitTimeout(cellTimeoutMs: number, explicit?: number): number {
  return Math.min(cellTimeoutMs - OP_DEADLINE_SLACK_MS, explicit ?? cellTimeoutMs - OP_DEADLINE_SLACK_MS);
}

interface InflightOp { label: string; startedAt: number; }

interface ActiveRun {
  id: string;
  ac: AbortController;
  signal: AbortSignal;
  displays: RunResultOk['displays'];
  screenshots: ScreenshotResult[];
  pendingTools: Map<string, { resolve(value: unknown): void; reject(error: Error): void }>;
  inflight: Map<number, InflightOp>;
  opCounter: number;
}

interface TabApi {
  name: string;
  page: Page;
  signal: AbortSignal;
  url(): string;
  title(): Promise<string>;
  goto(url: string, opts?: { waitUntil?: string }): Promise<void>;
  observe(opts?: { includeAll?: boolean; viewportOnly?: boolean }): Promise<Observation>;
  ariaSnapshot(selector?: string, opts?: { depth?: number; boxes?: boolean }): Promise<string>;
  screenshot(opts?: ScreenshotOptions): Promise<ScreenshotResult>;
  extract(format?: ReadableFormat): Promise<string>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  press(key: KeyInput, opts?: { selector?: string }): Promise<void>;
  scroll(deltaX: number, deltaY: number): Promise<void>;
  drag(from: DragTarget, to: DragTarget): Promise<void>;
  waitFor(selector: string, opts?: { timeout?: number }): Promise<ElementHandle>;
  waitForSelector(selector: string, opts?: { timeout?: number; visible?: boolean; hidden?: boolean }): Promise<ElementHandle | null>;
  waitForNavigation(opts?: { waitUntil?: string; timeout?: number }): Promise<void>;
  evaluate(fn: string | ((...args: unknown[]) => unknown), ...args: unknown[]): Promise<unknown>;
  scrollIntoView(selector: string): Promise<void>;
  select(selector: string, ...values: string[]): Promise<string[]>;
  uploadFile(selector: string, ...filePaths: string[]): Promise<void>;
  waitForUrl(pattern: string | RegExp, opts?: { timeout?: number }): Promise<string>;
  waitForResponse(pattern: string | RegExp | ((resp: unknown) => boolean), opts?: { timeout?: number }): Promise<unknown>;
  id(id: number): Promise<ElementHandle>;
  ref(id: string): Promise<ElementHandle>;
}

// ---------------------------------------------------------------------------
// Selector normalization
// ---------------------------------------------------------------------------

function normalizeSelector(selector: string): string {
  for (const prefix of LEGACY_SELECTOR_PREFIXES) {
    if (selector.startsWith(prefix)) return selector;
  }
  if (selector.startsWith('aria/')) return selector;
  if (selector.startsWith('text/')) return selector;
  if (selector.startsWith('xpath/')) return selector;
  if (selector.startsWith('pierce/')) return selector;
  return selector;
}

function isInteractiveNode(node: SerializedAXNode): boolean {
  if (node.role && INTERACTIVE_AX_ROLES.has(node.role)) return true;
  if (node.role === 'heading' || node.role === 'text' || node.role === 'image') return false;
  return false;
}

function asElementHandle(handle: unknown): ElementHandle | null {
  return handle ? (handle as ElementHandle) : null;
}

function redactUrlCredentials(url: string): string {
  try { return url.replace(/\/\/[^@]+@/, '//'); } catch { return url; }
}

function errorPayload(error: unknown): RunErrorPayload {
  if (error instanceof ToolAbortError) {
    return { name: 'ToolAbortError', message: error.message, stack: error.stack, isToolError: false, isAbort: true };
  }
  if (error instanceof ToolError) {
    return { name: 'ToolError', message: error.message, stack: error.stack, isToolError: true, isAbort: false };
  }
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack, isToolError: false, isAbort: false };
  }
  return { name: 'Error', message: String(error), isToolError: false, isAbort: false };
}

function safeJsonStringify(value: unknown): string {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function replyError(payload: RunErrorPayload): Error {
  if (payload.isAbort) {
    const err = new ToolAbortError(payload.message || 'Tool call aborted');
    if (payload.stack) err.stack = payload.stack;
    return err;
  }
  const Ctor = payload.isToolError ? ToolError : Error;
  const err = new Ctor(payload.message);
  if (payload.name) err.name = payload.name;
  if (payload.stack) err.stack = payload.stack;
  return err;
}

async function targetIdForTarget(target: Target): Promise<string> {
  const raw = target as unknown as { _targetId?: unknown };
  if (typeof raw._targetId === 'string') return raw._targetId;
  const session = await target.createCDPSession();
  try {
    const info = (await session.send('Target.getTargetInfo')) as { targetInfo?: { targetId?: string } };
    if (info.targetInfo?.targetId) return info.targetInfo.targetId;
    throw new ToolError('Target id unavailable from CDP target info');
  } finally { await session.detach().catch(() => undefined); }
}

function describeScreenshot(opts?: ScreenshotOptions): string {
  if (opts?.selector) return `tab.screenshot({ selector: ${JSON.stringify(opts.selector)} })`;
  if (opts?.fullPage) return 'tab.screenshot({ fullPage: true })';
  return 'tab.screenshot()';
}

function imageFormatForPath(filePath: string): ImageFormat {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.webp') return 'webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
  return 'png';
}

function describeInflight(inflight: Map<number, InflightOp>): string {
  const now = Date.now();
  return [...inflight.values()]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map(op => `${op.label} (${((now - op.startedAt) / 1000).toFixed(1)}s)`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Observation collection
// ---------------------------------------------------------------------------

async function collectObservationEntries(
  core: WorkerCore,
  node: SerializedAXNode,
  entries: ObservationEntry[],
  options: { viewportOnly: boolean; includeAll: boolean },
): Promise<void> {
  if (options.includeAll || isInteractiveNode(node)) {
    const handle = await node.elementHandle();
    if (handle) {
      let inViewport = true;
      if (options.viewportOnly) {
        try { inViewport = await handle.isIntersectingViewport(); } catch { inViewport = false; }
      }
      if (inViewport) {
        const id = core.nextElementId();
        const states: string[] = [];
        if (node.disabled) states.push('disabled');
        if (node.checked !== undefined) states.push(`checked=${String(node.checked)}`);
        if (node.pressed !== undefined) states.push(`pressed=${String(node.pressed)}`);
        if (node.selected !== undefined) states.push(`selected=${String(node.selected)}`);
        if (node.expanded !== undefined) states.push(`expanded=${String(node.expanded)}`);
        if (node.required) states.push('required');
        if (node.readonly) states.push('readonly');
        if (node.multiselectable) states.push('multiselectable');
        if (node.multiline) states.push('multiline');
        if (node.modal) states.push('modal');
        if (node.focused) states.push('focused');
        core.cacheElement(id, handle as ElementHandle);
        entries.push({ id, role: node.role, name: node.name, value: node.value,
          description: node.description, keyshortcuts: node.keyshortcuts, states });
      } else {
        await handle.dispose();
      }
    }
  }
  for (const child of node.children ?? []) {
    await collectObservationEntries(core, child, entries, options);
  }
}

// ---------------------------------------------------------------------------
// Text click handler
// ---------------------------------------------------------------------------

async function clickQueryHandlerText(page: Page, selector: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const clickSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const start = Date.now();
  let lastSeen = 0;
  let lastReason: string | null = null;
  while (Date.now() - start < timeoutMs) {
    throwIfAborted(clickSignal);
    const handles = (await untilAborted(clickSignal, () => page.$$(selector))) as ElementHandle[];
    try {
      lastSeen = handles.length;
      const target = await resolveActionableClickTarget(handles);
      if (!target) {
        lastReason = handles.length ? 'no-visible-candidate' : 'no-matches';
        await untilAborted(clickSignal, () => sleep(100));
        continue;
      }
      try {
        await untilAborted(clickSignal, () => target.click());
        return;
      } catch (err) {
        lastReason = err instanceof Error ? err.message : String(err);
        await untilAborted(clickSignal, () => sleep(100));
      }
    } finally {
      await Promise.all(handles.map(async h => h.dispose().catch(() => undefined)));
    }
  }
  throw new ToolError(`Timed out clicking ${selector} (seen ${lastSeen} matches; last reason: ${lastReason ?? 'unknown'}).`);
}

async function resolveActionableClickTarget(handles: ElementHandle[]): Promise<ElementHandle | null> {
  const candidates: Array<{ handle: ElementHandle; rect: { x: number; y: number; w: number; h: number } }> = [];
  for (const handle of handles) {
    try {
      const intersecting = await handle.isIntersectingViewport();
      if (!intersecting) continue;
      const rect = (await handle.evaluate(el => {
        const r = (el as Element).getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      })) as { x: number; y: number; w: number; h: number };
      if (rect.w < 1 || rect.h < 1) continue;
      candidates.push({ handle, rect });
    } catch { /* skip */ }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  return candidates[0]?.handle ?? null;
}

// ---------------------------------------------------------------------------
// WorkerCore
// ---------------------------------------------------------------------------

export class WorkerCore {
  #transport: Transport;
  #browser?: Browser;
  #page?: Page;
  #targetId?: string;
  #elementCache = new Map<number, ElementHandle>();
  #elementCounter = 0;
  #active: ActiveRun | null = null;
  #mode?: WorkerInitPayload['mode'];
  #dialogPolicy?: 'accept' | 'dismiss';
  #dialogHandler?: (dialog: Dialog) => void;

  constructor(transport: Transport) {
    this.#transport = transport;
    const unsub = this.#transport.onMessage(msg => { void this.#handleMessage(msg as WorkerInbound); });
    this.#unsub = unsub;
  }
  #unsub!: () => void;

  nextElementId(): number { this.#elementCounter += 1; return this.#elementCounter; }
  cacheElement(id: number, handle: ElementHandle): void { this.#elementCache.set(id, handle); }

  async #handleMessage(msg: WorkerInbound): Promise<void> {
    switch (msg.type) {
      case 'init': await this.#init(msg.payload); return;
      case 'run': await this.#run(msg); return;
      case 'abort':
        if (this.#active?.id === msg.id) this.#active.ac.abort(new ToolAbortError());
        return;
      case 'tool-reply': this.#deliverToolReply(msg.id, msg.reply); return;
      case 'close': await this.#close(); return;
    }
  }

  async #init(payload: WorkerInitPayload): Promise<void> {
    try {
      this.#mode = payload.mode;
      const puppeteer = await loadPuppeteerInWorker(payload.safeDir);
      this.#browser = await puppeteer.connect({
        browserWSEndpoint: payload.browserWSEndpoint,
        defaultViewport: null,
        protocolTimeout: BROWSER_PROTOCOL_TIMEOUT_MS,
      });
      if (payload.mode === 'headless') {
        this.#page = await this.#browser.newPage();
        await applyStealthPatches(this.#browser, this.#page, { browserSession: null, override: null });
        await applyViewport(this.#page, payload.viewport);
        if (payload.dialogs) this.#applyDialogPolicy(payload.dialogs);
        if (payload.url) {
          await this.#page.goto(payload.url, {
            waitUntil: payload.waitUntil ?? 'load',
            timeout: payload.timeoutMs,
          });
        }
      } else {
        this.#page = await this.#findAttachedPage(payload.targetId);
        if (payload.dialogs) this.#applyDialogPolicy(payload.dialogs);
      }
      this.#targetId = await targetIdForTarget(this.#page.target());
      this.#transport.send({ type: 'ready', info: await this.#currentReadyInfo() });
    } catch (error) {
      this.#transport.send({ type: 'init-failed', error: errorPayload(error) });
    }
  }

  async #findAttachedPage(targetId: string): Promise<Page> {
    if (!this.#browser) throw new ToolError('Browser is not connected');
    for (const target of this.#browser.targets()) {
      const tid = await targetIdForTarget(target).catch(() => '');
      if (tid !== targetId) continue;
      const page = await target.page();
      if (page) return page;
    }
    throw new ToolError(`Target ${targetId} is no longer available on the attached browser`);
  }

  async #currentReadyInfo(): Promise<ReadyInfo> {
    const page = this.#requirePage();
    const targetId = this.#targetId ?? (await targetIdForTarget(page.target()));
    this.#targetId = targetId;
    return {
      url: redactUrlCredentials(page.url()),
      title: await page.title().catch(() => undefined),
      viewport: page.viewport() ?? DEFAULT_VIEWPORT,
      targetId,
    };
  }

  #applyDialogPolicy(policy: 'accept' | 'dismiss'): void {
    const page = this.#requirePage();
    if (this.#dialogPolicy === policy && this.#dialogHandler) return;
    if (this.#dialogHandler) page.off('dialog', this.#dialogHandler);
    const handler = (dialog: Dialog): void => {
      void (policy === 'accept' ? dialog.accept() : dialog.dismiss()).catch(() => undefined);
    };
    page.on('dialog', handler);
    this.#dialogPolicy = policy;
    this.#dialogHandler = handler;
  }

  // ---- Run ----

  async #run(msg: Extract<WorkerInbound, { type: 'run' }>): Promise<void> {
    if (this.#active) {
      this.#transport.send({ type: 'result', id: msg.id, ok: false, error: errorPayload(new ToolError('Tab worker is busy')) });
      return;
    }
    const timeoutSignal = AbortSignal.timeout(msg.timeoutMs);
    const ac = new AbortController();
    const runAc = new AbortController();
    const signal = AbortSignal.any([timeoutSignal, ac.signal, runAc.signal]);
    const displays: RunResultOk['displays'] = [];
    const screenshots: ScreenshotResult[] = [];
    const active: ActiveRun = {
      id: msg.id, ac, signal, displays, screenshots,
      pendingTools: new Map(), inflight: new Map(), opCounter: 0,
    };
    this.#active = active;
    try {
      throwIfAborted(signal);
      const page = this.#requirePage();
      const browser = this.#requireBrowser();
      const tabApi = this.#createTabApi(msg.name, msg.timeoutMs, signal, msg.session, displays, screenshots, active);
      const onCancel = (): void => {
        const abortError = signal.reason instanceof ToolAbortError
          ? signal.reason
          : new ToolAbortError(undefined, { cause: signal.reason });
        const stalled = describeInflight(active.inflight);
        const cancelErr = timeoutSignal.aborted
          ? new ToolError(`Browser code timed out after ${msg.timeoutMs}ms${stalled ? ` (stalled on ${stalled})` : ''}`)
          : abortError;
        for (const pending of active.pendingTools.values()) pending.reject(cancelErr);
        active.pendingTools.clear();
      };
      if (signal.aborted) onCancel();
      else signal.addEventListener('abort', onCancel, { once: true });
      try {
        const returnValue = await Promise.race([
          this.#executeCode(msg.code, { page, browser, tab: tabApi,
            display: (v: unknown) => { displays.push({ type: 'text', text: typeof v === 'string' ? v : safeJsonStringify(v) }); },
            assert: (cond: unknown, text?: string) => { if (!cond) throw new ToolError(text ?? 'Assertion failed'); },
            wait: (ms: number) => waitForBrowserRun(ms, signal),
          }),
          new Promise<never>((_, reject) => {
            const onReject = (): void => {
              const err = timeoutSignal.aborted
                ? new ToolError(`Browser code timed out after ${msg.timeoutMs}ms`)
                : (signal.reason instanceof Error ? signal.reason : new ToolAbortError());
              reject(err);
            };
            if (signal.aborted) onReject();
            else signal.addEventListener('abort', onReject, { once: true });
          }),
        ]);
        await this.#postReadyInfo();
        this.#transport.send({ type: 'result', id: msg.id, ok: true,
          payload: { displays, returnValue: cloneSafe(returnValue), screenshots } });
      } finally {
        signal.removeEventListener('abort', onCancel);
      }
    } catch (error) {
      this.#transport.send({ type: 'result', id: msg.id, ok: false, error: errorPayload(error) });
    } finally {
      if (this.#active?.id === msg.id) this.#active = null;
      runAc.abort();
    }
  }

  async #executeCode(code: string, globals: Record<string, unknown>): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor as new (...args: string[]) => (...a: unknown[]) => Promise<unknown>;
    const keys = Object.keys(globals);
    const values = Object.values(globals);
    const fn = new AsyncFunction(...keys, code);
    return await fn(...values);
  }

  async #postReadyInfo(): Promise<void> {
    try { this.#transport.send({ type: 'ready', info: await this.#currentReadyInfo() }); }
    catch { /* best-effort */ }
  }

  async #callTool(active: ActiveRun, name: string, args: unknown): Promise<unknown> {
    const id = `tab-tc-${active.id}-${crypto.randomUUID()}`;
    let resolve!: (value: unknown) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
    active.pendingTools.set(id, { resolve: resolve as (value: unknown) => void, reject: reject as (error: Error) => void });
    this.#transport.send({ type: 'tool-call', id, runId: active.id, name, args });
    return await promise;
  }

  #deliverToolReply(id: string, reply: ToolReply): void {
    const active = this.#active;
    if (!active) return;
    const pending = active.pendingTools.get(id);
    if (!pending) return;
    active.pendingTools.delete(id);
    if (reply.ok) pending.resolve(reply.value);
    else pending.reject(replyError(reply.error));
  }

  async #runOp<T>(active: ActiveRun, label: string, cellSignal: AbortSignal, perOpTimeoutMs: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const opId = active.opCounter++;
    active.inflight.set(opId, { label, startedAt: Date.now() });
    const capped = Number.isFinite(perOpTimeoutMs) && perOpTimeoutMs > 0;
    const opTimeout = capped ? AbortSignal.timeout(perOpTimeoutMs) : undefined;
    const opSignal = opTimeout ? AbortSignal.any([cellSignal, opTimeout]) : cellSignal;
    try {
      return await fn(opSignal);
    } catch (err) {
      if (capped && !cellSignal.aborted &&
          (opTimeout?.aborted || (err instanceof Error && err.name === 'TimeoutError'))) {
        throw new ToolError(`${label} timed out after ${perOpTimeoutMs}ms`);
      }
      throw err;
    } finally { active.inflight.delete(opId); }
  }

  // ---- Tab API ----

  #createTabApi(
    name: string, timeoutMs: number, signal: AbortSignal,
    session: SessionSnapshot, displays: RunResultOk['displays'],
    screenshots: ScreenshotResult[], active: ActiveRun,
  ): TabApi {
    const page = this.#requirePage();
    const { quickOpMs, actionOpMs } = resolveOpTimeouts(timeoutMs);
    const waitMs = (explicit?: number): number => resolveWaitTimeout(timeoutMs, explicit);
    const INF = Number.POSITIVE_INFINITY;
    const op = <T>(label: string, perOpMs: number, fn: (sig: AbortSignal) => Promise<T>): Promise<T> =>
      markHandled(this.#runOp(active, label, signal, perOpMs, fn));
    return {
      name, page, signal,
      url: () => page.url(),
      title: () => op('tab.title()', INF, sig => untilAborted(sig, () => page.title())),
      goto: (url, opts) => op(`tab.goto(${JSON.stringify(url)})`, INF, async sig => {
        this.#clearElementCache();
        await untilAborted(sig, () => page.goto(url, { waitUntil: (opts?.waitUntil ?? 'load') as 'load', timeout: timeoutMs }));
      }),
      observe: opts => op('tab.observe()', quickOpMs, sig => this.#collectObservation({ ...opts, signal: sig })),
      ariaSnapshot: (selector, opts) => op(selector ? `tab.ariaSnapshot(${JSON.stringify(selector)})` : 'tab.ariaSnapshot()', quickOpMs, async sig => {
        let root: ElementHandle | null = null;
        if (selector) {
          root = (await untilAborted(sig, () => page.$(normalizeSelector(selector)))) as ElementHandle | null;
          if (!root) throw new ToolError(`tab.ariaSnapshot: selector ${JSON.stringify(selector)} matched no element`);
        }
        try { return await untilAborted(sig, () => captureAriaSnapshot(page, root, opts)); }
        finally { await root?.dispose().catch(() => undefined); }
      }),
      screenshot: opts => op(describeScreenshot(opts), quickOpMs, sig =>
        this.#captureScreenshot(session, displays, screenshots, sig, opts)),
      extract: (format = 'markdown') => op(`tab.extract(${JSON.stringify(format)})`, quickOpMs, async sig => {
        const html = (await untilAborted(sig, () => page.content())) as string;
        const result = await extractReadableFromHtml(html, page.url(), format);
        if (!result) throw new ToolError(`tab.extract(${JSON.stringify(format)}) found no readable content on ${page.url()}`);
        const content = format === 'markdown' ? result.markdown : result.text;
        if (!content) throw new ToolError(`tab.extract(${JSON.stringify(format)}) produced empty ${format} content for ${page.url()}`);
        return content;
      }),
      click: selector => op(`tab.click(${JSON.stringify(selector)})`, actionOpMs, async sig => {
        if (parseAriaRefSelector(selector) !== null) {
          const handle = await this.#resolveAriaRef(selector);
          try { await untilAborted(sig, () => handle.click()); }
          finally { await handle.dispose().catch(() => undefined); }
          return;
        }
        const resolved = normalizeSelector(selector);
        if (resolved.startsWith('text/')) await clickQueryHandlerText(page, resolved, actionOpMs, sig);
        else await untilAborted(sig, () => page.locator(resolved).setTimeout(actionOpMs).click({ signal: sig }));
      }),
      type: (selector, text) => op(`tab.type(${JSON.stringify(selector)})`, actionOpMs, async sig => {
        const handle = await this.#resolveActionHandle(selector, actionOpMs, sig);
        try { await untilAborted(sig, () => handle.type(text, { delay: 0 })); }
        finally { await handle.dispose().catch(() => undefined); }
      }),
      fill: (selector, value) => op(`tab.fill(${JSON.stringify(selector)})`, actionOpMs, async sig => {
        if (parseAriaRefSelector(selector) !== null) {
          const handle = await this.#resolveAriaRef(selector);
          try {
            await untilAborted(sig, () => handle.evaluate(el => {
              const node = el as unknown as { value?: string; focus?: () => void };
              node.focus?.();
              if ('value' in node) node.value = '';
            }));
            await untilAborted(sig, () => handle.type(value, { delay: 0 }));
          } finally { await handle.dispose().catch(() => undefined); }
          return;
        }
        await untilAborted(sig, () => page.locator(normalizeSelector(selector)).setTimeout(actionOpMs).fill(value, { signal: sig }));
      }),
      press: (key, opts) => op(`tab.press(${JSON.stringify(key)})`, actionOpMs, async sig => {
        if (opts?.selector) await untilAborted(sig, () => page.focus(normalizeSelector(opts.selector!)));
        await untilAborted(sig, () => page.keyboard.press(key));
      }),
      scroll: (deltaX, deltaY) => op('tab.scroll()', actionOpMs, sig =>
        untilAborted(sig, () => page.mouse.wheel({ deltaX, deltaY }))),
      drag: (from, to) => op('tab.drag()', actionOpMs, sig => this.#drag(from, to, sig)),
      waitFor: (selector, opts) => {
        const w = waitMs(opts?.timeout);
        return op(`tab.waitFor(${JSON.stringify(selector)})`, w, sig => this.#resolveActionHandle(selector, w, sig));
      },
      waitForSelector: (selector, opts) => {
        const w = waitMs(opts?.timeout);
        return op(`tab.waitForSelector(${JSON.stringify(selector)})`, w, async sig => {
          if (parseAriaRefSelector(selector) !== null) return this.#resolveAriaRef(selector);
          return (await untilAborted(sig, () =>
            page.waitForSelector(normalizeSelector(selector), { timeout: w, visible: opts?.visible, hidden: opts?.hidden, signal: sig }),
          )) as ElementHandle | null;
        });
      },
      waitForNavigation: opts => {
        const w = waitMs(opts?.timeout);
        return op('tab.waitForNavigation()', w, sig =>
          untilAborted(sig, () => page.waitForNavigation({ waitUntil: (opts?.waitUntil ?? 'load') as 'load', timeout: w, signal: sig })).then(() => {}));
      },
      evaluate: (fn, ...args) => op('tab.evaluate()', INF, sig =>
        untilAborted(sig, () =>
          typeof fn === 'string' ? page.evaluate(fn) : page.evaluate(fn as (...a: unknown[]) => unknown, ...args),
        )) as Promise<unknown>,
      scrollIntoView: selector => op(`tab.scrollIntoView(${JSON.stringify(selector)})`, actionOpMs, async sig => {
        const handle = await this.#resolveActionHandle(selector, actionOpMs, sig);
        try {
          await untilAborted(sig, () => handle.evaluate(el => {
            (el as unknown as { scrollIntoView: (opts: { behavior: string; block: string; inline: string }) => void })
              .scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
          }));
        } finally { await handle.dispose().catch(() => undefined); }
      }),
      select: (selector, ...values) => op(`tab.select(${JSON.stringify(selector)})`, actionOpMs, sig =>
        this.#select(selector, values, actionOpMs, sig)),
      uploadFile: (selector, ...filePaths) => op(`tab.uploadFile(${JSON.stringify(selector)})`, actionOpMs, sig =>
        this.#uploadFile(selector, filePaths, actionOpMs, sig, session)),
      waitForUrl: (pattern, opts) => {
        const w = waitMs(opts?.timeout);
        return op('tab.waitForUrl()', w, sig => this.#waitForUrl(pattern, w, sig));
      },
      waitForResponse: (pattern, opts) => {
        const w = waitMs(opts?.timeout);
        return op('tab.waitForResponse()', w, sig => {
          const predicate: (resp: unknown) => boolean | Promise<boolean> =
            typeof pattern === 'function' ? pattern
            : pattern instanceof RegExp ? (resp: unknown) => pattern.test((resp as { url(): string }).url())
            : (resp: unknown) => (resp as { url(): string }).url().includes(pattern);
          return untilAborted(sig, () => page.waitForResponse(predicate as never, { timeout: w, signal: sig }));
        }) as Promise<unknown>;
      },
      id: (id) => this.#resolveCachedHandle(id),
      ref: (id) => this.#resolveAriaRef(id),
    };
  }

  // ---- Observation ----

  async #collectObservation(options: { includeAll?: boolean; viewportOnly?: boolean; signal?: AbortSignal }): Promise<Observation> {
    const page = this.#requirePage();
    this.#clearElementCache();
    const snapshot = (await untilAborted(options.signal, () =>
      page.accessibility.snapshot({ interestingOnly: !options.includeAll }),
    )) as SerializedAXNode | null;
    if (!snapshot) throw new ToolError('Accessibility snapshot unavailable');
    const entries: ObservationEntry[] = [];
    await collectObservationEntries(this, snapshot, entries, { includeAll: options.includeAll ?? false, viewportOnly: options.viewportOnly ?? false });
    const scroll = (await untilAborted(options.signal, () =>
      page.evaluate(() => {
        const w = globalThis as unknown as { scrollX: number; scrollY: number; innerWidth: number; innerHeight: number; document: { documentElement: { scrollWidth: number; scrollHeight: number } } };
        const d = w.document.documentElement;
        return { x: w.scrollX, y: w.scrollY, width: w.innerWidth, height: w.innerHeight, scrollWidth: d.scrollWidth, scrollHeight: d.scrollHeight };
      }),
    )) as Observation['scroll'];
    return { url: page.url(), title: await untilAborted(options.signal, () => page.title()) as string,
      viewport: page.viewport() ?? DEFAULT_VIEWPORT, scroll, elements: entries };
  }

  // ---- Screenshot ----

  async #captureScreenshot(
    session: SessionSnapshot, displays: RunResultOk['displays'],
    screenshots: ScreenshotResult[], signal: AbortSignal | undefined,
    opts: ScreenshotOptions = {},
  ): Promise<ScreenshotResult> {
    const page = this.#requirePage();
    const fullPage = opts.selector ? false : (opts.fullPage ?? false);
    const explicitPath = opts.save ? resolveToCwd(opts.save, session.cwd) : undefined;
    const captureType = explicitPath ? imageFormatForPath(explicitPath) : 'png';
    const captureMime = `image/${captureType}` as const;
    let buffer: Buffer;
    if (opts.selector) {
      const handle = (await untilAborted(signal, () => page.$(normalizeSelector(opts.selector!)))) as ElementHandle | null;
      if (!handle) throw new ToolError('Screenshot selector did not resolve to an element');
      try {
        await untilAborted(signal, () => handle.evaluate(el => {
          (el as unknown as { scrollIntoView: (opts: { behavior: string; block: string; inline: string }) => void })
            .scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        })).catch(() => undefined);
        const shotOpts: ElementScreenshotOptions = { type: captureType, scrollIntoView: false };
        buffer = (await untilAborted(signal, () => handle.screenshot(shotOpts))) as Buffer;
      } finally { await handle.dispose().catch(() => undefined); }
    } else {
      buffer = (await untilAborted(signal, () => page.screenshot({ type: captureType, fullPage }))) as Buffer;
    }
    const savedBuffer = buffer;
    const savedMimeType = captureMime;
    const ext = captureType === 'webp' ? 'webp' : captureType === 'jpeg' ? 'jpg' : 'png';
    const dest = explicitPath ?? (session.browserScreenshotDir
      ? path.join(session.browserScreenshotDir, `screenshot-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -1)}.${ext}`)
      : path.join(os.tmpdir(), `browser-ss-${crypto.randomUUID().slice(0, 8)}.${ext}`));
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, savedBuffer);
    const info: ScreenshotResult = { dest, mimeType: savedMimeType, bytes: savedBuffer.length, width: 0, height: 0 };
    screenshots.push(info);
    if (!opts.silent) {
      displays.push({ type: 'text', text: `[screenshot] ${dest} (${savedBuffer.length} bytes, ${savedMimeType})` });
      displays.push({ type: 'image', data: buffer.toString('base64'), mimeType: savedMimeType });
    }
    return info;
  }

  // ---- Drag ----

  async #drag(from: DragTarget, to: DragTarget, signal: AbortSignal): Promise<void> {
    const page = this.#requirePage();
    const resolveDragPoint = async (target: DragTarget, role: 'from' | 'to'): Promise<{ x: number; y: number; handle?: ElementHandle }> => {
      if (typeof target === 'string') {
        const handle = (await untilAborted(signal, () => page.$(normalizeSelector(target)))) as ElementHandle | null;
        if (!handle) throw new ToolError(`Drag ${role} selector did not resolve: ${target}`);
        const box = (await untilAborted(signal, () => handle.boundingBox())) as { x: number; y: number; width: number; height: number } | null;
        if (!box) { await handle.dispose().catch(() => undefined); throw new ToolError(`Drag ${role} element has no bounding box: ${target}`); }
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, handle };
      }
      if (target !== null && typeof target === 'object' && typeof (target as { x: unknown }).x === 'number' && typeof (target as { y: unknown }).y === 'number') {
        const pt = target as { x: number; y: number };
        return { x: pt.x, y: pt.y };
      }
      throw new ToolError(`Drag ${role} must be a selector string or { x, y } point.`);
    };
    const start = await resolveDragPoint(from, 'from');
    let end: { x: number; y: number; handle?: ElementHandle } | undefined;
    try {
      end = await resolveDragPoint(to, 'to');
      await untilAborted(signal, () => page.mouse.move(start.x, start.y));
      await untilAborted(signal, () => page.mouse.down());
      await untilAborted(signal, () => page.mouse.move(end!.x, end!.y, { steps: 12 }));
      await untilAborted(signal, () => page.mouse.up());
    } finally {
      if (start.handle) await start.handle.dispose().catch(() => undefined);
      if (end?.handle) await end.handle.dispose().catch(() => undefined);
    }
  }

  // ---- Select ----

  async #select(selector: string, values: string[], timeoutMs: number, signal: AbortSignal): Promise<string[]> {
    const page = this.#requirePage();
    const handle = (await untilAborted(signal, () =>
      page.locator(normalizeSelector(selector)).setTimeout(timeoutMs).waitHandle({ signal }),
    )) as ElementHandle;
    try {
      return (await untilAborted(signal, () =>
        handle.evaluate((el, vals: string[]) => {
          const select = el as unknown as { tagName: string; options: ArrayLike<{ value: string; selected: boolean }>; dispatchEvent: (event: unknown) => boolean };
          if (select?.tagName !== 'SELECT') throw new Error('tab.select() requires a <select> element');
          const EventCtor = (globalThis as unknown as { Event: new (type: string, init?: { bubbles: boolean }) => unknown }).Event;
          const wanted = new Set(vals);
          const selected: string[] = [];
          for (let i = 0; i < select.options.length; i++) {
            const opt = select.options[i] as { value: string; selected: boolean };
            opt.selected = wanted.has(opt.value);
            if (opt.selected) selected.push(opt.value);
          }
          select.dispatchEvent(new EventCtor('input', { bubbles: true }));
          select.dispatchEvent(new EventCtor('change', { bubbles: true }));
          return selected;
        }, values),
      )) as string[];
    } finally { await handle.dispose().catch(() => undefined); }
  }

  // ---- UploadFile ----

  async #uploadFile(selector: string, filePaths: string[], timeoutMs: number, signal: AbortSignal, session: SessionSnapshot): Promise<void> {
    if (!filePaths.length) throw new ToolError('tab.uploadFile() requires at least one file path');
    const page = this.#requirePage();
    const handle = (await untilAborted(signal, () =>
      page.locator(normalizeSelector(selector)).setTimeout(timeoutMs).waitHandle({ signal }),
    )) as ElementHandle;
    try {
      const absolute = filePaths.map(fp => resolveToCwd(fp, session.cwd));
      const uploadHandle = handle as unknown as { uploadFile: (...paths: string[]) => Promise<void> };
      const tagName = (await untilAborted(signal, () =>
        handle.evaluate(el => (el as unknown as { tagName: string }).tagName),
      )) as string;
      if (tagName !== 'INPUT') throw new ToolError(`tab.uploadFile() requires <input type="file"> (got <${tagName.toLowerCase()}>)`);
      await untilAborted(signal, () => uploadHandle.uploadFile(...absolute));
    } finally { await handle.dispose().catch(() => undefined); }
  }

  // ---- Wait helpers ----

  async #waitForUrl(pattern: string | RegExp, timeout: number, signal: AbortSignal): Promise<string> {
    const page = this.#requirePage();
    const isRegex = pattern instanceof RegExp;
    const matcher = isRegex ? pattern.source : pattern;
    const flags = isRegex ? pattern.flags : '';
    await untilAborted(signal, () =>
      page.waitForFunction((m: string, isRe: boolean, fl: string) => {
        const url = (globalThis as unknown as { location: { href: string } }).location.href;
        return isRe ? new RegExp(m, fl).test(url) : url.includes(m);
      }, { timeout, polling: 200, signal }, matcher, isRegex, flags),
    );
    return page.url();
  }

  async #resolveCachedHandle(id: number): Promise<ElementHandle> {
    const handle = this.#elementCache.get(id);
    if (!handle) throw new ToolError(`Unknown element id ${id}. Run tab.observe() to refresh the element list.`);
    try {
      const isConnected = (await handle.evaluate(el => el.isConnected)) as boolean;
      if (!isConnected) { this.#clearElementCache(); throw new ToolError(`Element id ${id} is stale. Run tab.observe() again.`); }
    } catch (err) {
      if (err instanceof ToolError) throw err;
      this.#clearElementCache();
      throw new ToolError(`Element id ${id} is stale. Run tab.observe() again.`);
    }
    return handle;
  }

  async #resolveAriaRef(id: string): Promise<ElementHandle> {
    const ref = parseAriaRefSelector(id) ?? id.trim();
    const handle = await resolveAriaRefHandle(this.#requirePage(), ref);
    if (!handle) throw new ToolError(`Unknown ARIA ref ${JSON.stringify(ref)}. Run tab.ariaSnapshot() to refresh refs.`);
    return handle;
  }

  async #resolveActionHandle(selector: string, timeoutMs: number, sig: AbortSignal): Promise<ElementHandle> {
    if (parseAriaRefSelector(selector) !== null) return this.#resolveAriaRef(selector);
    return (await untilAborted(sig, () =>
      this.#requirePage().locator(normalizeSelector(selector)).setTimeout(timeoutMs).waitHandle({ signal: sig }),
    )) as ElementHandle;
  }

  #clearElementCache(): void {
    if (this.#elementCache.size === 0) { this.#elementCounter = 0; return; }
    const handles = [...this.#elementCache.values()];
    this.#elementCache.clear();
    this.#elementCounter = 0;
    for (const handle of handles) void handle.dispose().catch(() => undefined);
  }

  async #close(): Promise<void> {
    this.#unsub();
    this.#clearElementCache();
    const page = this.#page;
    if (this.#dialogHandler && page && !page.isClosed()) page.off('dialog', this.#dialogHandler);
    if (this.#mode === 'headless' && page && !page.isClosed()) await page.close().catch(() => undefined);
    if (this.#browser?.connected) this.#browser.disconnect();
    this.#transport.send({ type: 'closed' });
    this.#transport.close();
  }

  #requirePage(): Page { if (!this.#page) throw new ToolError('Tab worker is not initialized'); return this.#page; }
  #requireBrowser(): Browser { if (!this.#browser) throw new ToolError('Tab worker is not initialized'); return this.#browser; }
}

function cloneSafe(value: unknown): unknown {
  try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
}
