/**
 * brain.ts — 脑插座接口 + 两个脑 + run 薄层登记表（设计 §2.1/§八⑥）。
 *
 * na 三层分离落到 nz：本文件 = 脑插座层（start/cancel/attach，na brain_ep.rs
 * 同形状）。echo 夹具脑与 direct 脑同接口，换脑零改动。
 *
 *   · DirectApiBrain：唯一碰网络的件。node fetch 直连 provider
 *     POST {base}/chat/completions（stream:true + include_usage），SSE 经
 *     阶段一 sse-parser/openai-translator 出九事件；所有失败落 error 事件
 *     入流不 throw（P3）；取消语义 = AbortController + error「已取消」入流
 *     收尾（P5）；网络层失败重试 2 次（2s/4s 线性退避，chat.ts:303-327）。
 *   · EchoBrain：回放 nz/tests/fixtures/ai-chat/ 的 probe fixture（na 抓的
 *     真流当节目单——假数据的形状 = 真数据的形状），pace 节奏注入（默认
 *     5ms/事件，NZ_AI_ECHO_PACE_MS 可配，0=尽快）。与生产同路径：同一个
 *     BrainEndpoint 接口、同一个事件流、同一个登记表。
 *   · run 登记表（RunRegistry）：内存 Map + 封顶缓冲（1 万条，base 前移）+
 *     done 后 5min 淘汰 + 同会话新 start 取代旧 run（P2 兜底）。attach =
 *     回放 [from:] + 尾随（页面切换/刷新补流语义）。这是薄层不是 8.x
 *     run-manager：无落盘、无会话档案、无权限钩子。
 *
 * API 调试落盘（§4.3）：/tmp/nz-ai-chat.log（JSONL，NZ_AI_CHAT_LOG 可覆盖），
 * 每个 run 逐拍落 start/upstream-status+TTFB/first-delta/done+usage/error。
 * **不落 key、不落完整消息正文**（P1）；NZ_AI_DEBUG_BODY=1 时请求/响应全文
 * 落 /tmp/nz-ai-chat-body-<runId>.log（Authorization 永不落盘），默认关。
 */

import { appendFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { StreamEvent } from '../../shared/chat-protocol/events.ts';
import type { ChatMessage } from '../../shared/chat-protocol/messages.ts';
import { toOpenAiMessages } from '../../shared/chat-protocol/to-openai-messages.ts';
import { SseParser } from './sse-parser.ts';
import { OpenAiTranslator, errorEventFromHttp, type UsageRecord } from './openai-translator.ts';
import { loadProviders, findProvider, resolveKey } from './providers.ts';

/** 默认 provider/模型（§八③ 用户拍板：官方渠道此名可通，C 档实测验证） */
export const DEFAULT_PROVIDER = 'Kimi';
export const DEFAULT_MODEL = 'kimi-k2.7-code';

const RUN_EVENT_CAP = 10_000;
const RUN_DONE_TTL_MS = 5 * 60_000;

// ========== run 薄层登记表（§八⑥） ==========

export interface RunMeta {
  provider: string;
  model: string;
}

export interface Run {
  id: string;
  provider: string;
  model: string;
  /** 封顶环形缓冲：绝对 index = base + 数组下标 */
  events: StreamEvent[];
  base: number;
  done: boolean;
  cancelRequested: boolean;
  abort: AbortController;
  waiters: Set<() => void>;
  createdAt: number;
  doneAt: number;
  /** 观测记账（done 落盘用） */
  deltas: number;
  chars: number;
  usage: UsageRecord | null;
}

export interface AttachedEvent {
  index: number;
  event: StreamEvent;
}

export class RunRegistry {
  private runs = new Map<string, Run>();
  constructor(private now: () => number = () => Date.now()) {}

  /** 开 run。同会话新 start 取代旧 run（P2 兜底：活跃旧 run 取消收尾）。 */
  open(meta: RunMeta): Run {
    this.sweep();
    for (const r of this.runs.values()) {
      if (!r.done) this.finishCancel(r);
    }
    const run: Run = {
      id: `run_${this.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      provider: meta.provider,
      model: meta.model,
      events: [],
      base: 0,
      done: false,
      cancelRequested: false,
      abort: new AbortController(),
      waiters: new Set(),
      createdAt: this.now(),
      doneAt: 0,
      deltas: 0,
      chars: 0,
      usage: null,
    };
    this.runs.set(run.id, run);
    return run;
  }

  /** 事件入流（done 后静默丢弃——取消竞态下泵的迟到事件不污染收尾）。 */
  push(run: Run, event: StreamEvent): void {
    if (run.done) return;
    if (event.type === 'content_block_delta') {
      run.deltas++;
      run.chars += event.deltaText?.length ?? 0;
    }
    if (run.events.length >= RUN_EVENT_CAP) {
      run.events.shift();
      run.base++;
    }
    run.events.push(event);
    this.wake(run);
  }

  /** 收尾：done 盖章 + 唤醒全部 attach 尾随者（幂等）。 */
  finish(run: Run): void {
    if (run.done) return;
    run.done = true;
    run.doneAt = this.now();
    this.wake(run);
  }

  /** 取消：error「已取消」入流收尾（P5）+ AbortController 杀上游读取。尽力而为。 */
  cancel(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.done) return false;
    this.finishCancel(run);
    return true;
  }

  private finishCancel(run: Run): void {
    run.cancelRequested = true;
    this.push(run, { type: 'error', content: '已取消' });
    this.finish(run);
    run.abort.abort();
  }

  /** attach = 回放 [from:] + 尾随；不存在/已淘汰 → null（路由落 __end__，不 404）。 */
  attach(runId: string, from: number): AsyncGenerator<AttachedEvent, void, void> | null {
    const run = this.runs.get(runId);
    if (!run) return null;
    return this.attachGen(run, from);
  }

  private async *attachGen(run: Run, from: number): AsyncGenerator<AttachedEvent, void, void> {
    let idx = Math.max(from, run.base);
    for (;;) {
      while (idx < run.base + run.events.length) {
        yield { index: idx, event: run.events[idx - run.base] };
        idx++;
      }
      if (run.done) return;
      await new Promise<void>((resolve) => { run.waiters.add(resolve); });
    }
  }

  private wake(run: Run): void {
    for (const w of run.waiters) w();
    run.waiters.clear();
  }

  /** done 超 5min 淘汰（惰性清扫：open 时顺手，不起定时器）。 */
  private sweep(): void {
    const t = this.now();
    for (const [id, r] of this.runs) {
      if (r.done && t - r.doneAt > RUN_DONE_TTL_MS) this.runs.delete(id);
    }
  }
}

// ========== 脑插座接口（na brain_ep.rs 同形状） ==========

export interface BrainStartRequest {
  messages: ChatMessage[];
  model?: string;
  provider?: string;
}

export interface RunHandle {
  runId: string;
}

export interface BrainEndpoint {
  start(req: BrainStartRequest): RunHandle;
  cancel(runId: string): boolean;
  attach(runId: string, from: number): AsyncGenerator<AttachedEvent, void, void> | null;
}

// ========== API 调试落盘（§4.3） ==========

export function aiChatLogPath(): string {
  return process.env.NZ_AI_CHAT_LOG ?? '/tmp/nz-ai-chat.log';
}

/** JSONL 落一拍（不落 key 不落全文——调用方只给摘要与计数；落盘失败不挡服务）。 */
export function aiDebugLog(rec: Record<string, unknown>): void {
  const line = JSON.stringify({ t: new Date().toISOString(), ...rec });
  appendFile(aiChatLogPath(), line + '\n').catch(() => { /* 诊断落盘失败不挡服务 */ });
}

function debugBodyEnabled(): boolean {
  return process.env.NZ_AI_DEBUG_BODY === '1';
}

const clip300 = (s: string): string => [...s].slice(0, 300).join('');

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ========== EchoBrain：回放 probe fixture 的假脑（B 档/断网开发腿） ==========

export class EchoBrain implements BrainEndpoint {
  private programCache: StreamEvent[] | null = null;

  constructor(
    private registry: RunRegistry,
    private opts: { fixturePath?: string; paceMs?: number } = {},
  ) {}

  start(req: BrainStartRequest): RunHandle {
    const run = this.registry.open({ provider: 'echo', model: req.model || 'echo' });
    const pace = this.opts.paceMs ?? Number(process.env.NZ_AI_ECHO_PACE_MS ?? '5');
    aiDebugLog({
      kind: 'start', runId: run.id, provider: 'echo', model: run.model,
      msgCount: req.messages.length, bodyBytes: 0,
    });
    void this.pump(run, pace);
    return { runId: run.id };
  }

  cancel(runId: string): boolean {
    return this.registry.cancel(runId);
  }

  attach(runId: string, from: number): AsyncGenerator<AttachedEvent, void, void> | null {
    return this.registry.attach(runId, from);
  }

  /** 节目单 = probe fixture（kfmv4 服务端真流实录）过阶段一 SseParser 解析。 */
  private program(): StreamEvent[] {
    if (this.programCache) return this.programCache;
    const path = this.opts.fixturePath
      ?? fileURLToPath(new URL('../../../tests/fixtures/ai-chat/probe-kimi-k3-256k-20260830.sse', import.meta.url));
    const parser = new SseParser();
    parser.feed(readFileSync(path, 'utf-8') + '\n\n');
    this.programCache = parser.drainFrames()
      .map((f) => (JSON.parse(f) as { event?: StreamEvent }).event)
      .filter((e): e is StreamEvent => !!e);
    return this.programCache;
  }

  private async pump(run: Run, paceMs: number): Promise<void> {
    try {
      for (const ev of this.program()) {
        if (run.done) return; // 取消：「已取消」已由登记表入流收尾
        this.registry.push(run, ev);
        if (paceMs > 0) await sleepMs(paceMs);
      }
      this.registry.finish(run);
      aiDebugLog({
        kind: 'done', runId: run.id, deltas: run.deltas, chars: run.chars,
        usage: null, ms: Date.now() - run.createdAt,
      });
    } finally {
      if (run.cancelRequested) {
        aiDebugLog({ kind: 'error', runId: run.id, errorKind: 'cancel', message: '已取消' });
      }
    }
  }
}

// ========== DirectApiBrain：唯一碰网络的件 ==========

export class DirectApiBrain implements BrainEndpoint {
  constructor(
    private registry: RunRegistry,
    private opts: { configDir?: string } = {},
  ) {}

  start(req: BrainStartRequest): RunHandle {
    const provider = req.provider || DEFAULT_PROVIDER;
    const model = req.model || DEFAULT_MODEL;
    const run = this.registry.open({ provider, model });
    void this.pump(run, req, provider, model);
    return { runId: run.id };
  }

  cancel(runId: string): boolean {
    return this.registry.cancel(runId);
  }

  attach(runId: string, from: number): AsyncGenerator<AttachedEvent, void, void> | null {
    return this.registry.attach(runId, from);
  }

  private async pump(run: Run, req: BrainStartRequest, providerName: string, model: string): Promise<void> {
    const t0 = Date.now();
    /** 一切失败落 error 事件入流收尾，不 throw（P3）；message 截 300 字（P4）。 */
    const fail = (message: string, errorKind: string): void => {
      this.registry.push(run, { type: 'error', content: message });
      this.registry.finish(run);
      aiDebugLog({ kind: 'error', runId: run.id, errorKind, message: clip300(message) });
    };
    try {
      // provider 解析（BAR-PROVIDER-MATCH-01：id/name 匹配，无静默回退）
      const providers = loadProviders(this.opts.configDir);
      const p = findProvider(providers, providerName);
      if (!p) {
        fail(`Provider「${providerName}」不存在（id/name 均未匹配）——请检查 providers.json 或面板 API 卡。`, 'config');
        return;
      }
      // 代字 fuse：使用点展开，变量缺失 → 人话点名，绝不裸发代字（§1.3）
      const key = resolveKey(p.apiKey, this.opts.configDir);
      if (key.missingVar) {
        fail(`Provider「${p.name || p.id}」的 apiKey 引用了环境变量 ${key.missingVar}，但未设置——请在 .kfmv4/.env 中配置（或 export 后重启服务）。`, 'config');
        return;
      }
      const apiMessages = toOpenAiMessages(req.messages);
      // max_tokens 照 kfmv4 chat.ts 16384（思考链计入预算，过低会吃光正文）
      const requestBody = {
        model,
        messages: apiMessages,
        max_tokens: 16384,
        stream: true,
        stream_options: { include_usage: true },
      };
      const bodyText = JSON.stringify(requestBody);
      aiDebugLog({
        kind: 'start', runId: run.id, provider: providerName, model,
        msgCount: apiMessages.length, bodyBytes: bodyText.length,
      });
      const bodyLog = debugBodyEnabled() ? `/tmp/nz-ai-chat-body-${run.id}.log` : null;
      if (bodyLog) {
        // 深排障专用（默认关）：请求/响应全文。Authorization 头永不落盘。
        writeFileSync(bodyLog, `POST ${p.baseUrl}/chat/completions\nAuthorization: Bearer <redacted>\n\n${bodyText}\n`);
      }

      // 网络层失败重试 2 次（2s/4s 线性退避，chat.ts:303-327）；HTTP 错误是
      // 确定性失败不重试；取消（AbortController）立即退出不重试。
      const MAX_NET_RETRIES = 2;
      let response: Response | null = null;
      for (let attempt = 0; attempt <= MAX_NET_RETRIES; attempt++) {
        if (run.done) return;
        try {
          response = await fetch(`${p.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key.value}`,
              'Content-Type': 'application/json',
            },
            body: bodyText,
            signal: run.abort.signal,
          });
          break;
        } catch (err) {
          if (run.abort.signal.aborted || run.done) return;
          if (attempt >= MAX_NET_RETRIES) {
            fail(`网络错误（已重试 ${MAX_NET_RETRIES} 次仍失败）: ${err instanceof Error ? err.message : String(err)}`, 'network');
            return;
          }
          await sleepMs((attempt + 1) * 2000);
        }
      }
      if (!response) {
        fail('网络错误：未能建立连接', 'network');
        return;
      }
      aiDebugLog({ kind: 'upstream-status', runId: run.id, status: response.status, ttfbMs: Date.now() - t0 });

      if (!response.ok) {
        // 完整错误体只落 body 调试文件；error 事件与 JSONL 都截 300 字（P4）
        const errBody = await response.text().catch(() => '');
        if (bodyLog) appendFileSync(bodyLog, `<<< status ${response.status}\n${errBody}\n`);
        fail(errorEventFromHttp(response.status, errBody).content ?? `API 请求失败: ${response.status}`, 'upstream');
        return;
      }

      const reader = (response.body as ReadableStream<Uint8Array> | null)?.getReader();
      if (!reader) {
        fail('无响应体', 'upstream');
        return;
      }
      const decoder = new TextDecoder();
      const parser = new SseParser();
      const translator = new OpenAiTranslator();
      let firstDeltaLogged = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          if (bodyLog) appendFileSync(bodyLog, text);
          parser.feed(text);
          for (const frame of parser.drainFrames()) {
            for (const ev of translator.translatePayload(frame)) {
              if (!firstDeltaLogged && ev.type === 'content_block_delta') {
                firstDeltaLogged = true;
                aiDebugLog({ kind: 'first-delta', runId: run.id, atMs: Date.now() - t0 });
              }
              this.registry.push(run, ev);
              if (run.done) { void reader.cancel().catch(() => {}); return; }
              if (ev.type === 'error') {
                // 上游流内错误块：不许静默结束（§1.4）
                this.registry.finish(run);
                aiDebugLog({ kind: 'error', runId: run.id, errorKind: 'upstream-stream', message: clip300(ev.content ?? '') });
                return;
              }
            }
          }
        }
        // 截断流兜底：无 [DONE]/finish_reason 也把开着的块关上
        for (const ev of translator.finish()) this.registry.push(run, ev);
      } catch (err) {
        if (run.abort.signal.aborted || run.done) return;
        fail(`网络错误: ${err instanceof Error ? err.message : String(err)}`, 'network');
        return;
      }
      run.usage = translator.usage;
      this.registry.finish(run);
      aiDebugLog({
        kind: 'done', runId: run.id, deltas: run.deltas, chars: run.chars,
        usage: translator.usage, ms: Date.now() - t0,
      });
    } finally {
      if (run.cancelRequested) {
        aiDebugLog({ kind: 'error', runId: run.id, errorKind: 'cancel', message: '已取消' });
      }
    }
  }
}
