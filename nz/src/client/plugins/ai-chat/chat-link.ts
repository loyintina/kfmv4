/**
 * chat-link.ts — ai-chat 插件的脑（纯 TS，不碰 DOM 框架；宪法 §3 逻辑/皮分离）。
 *
 * 职责（设计 §2.2）：
 *   · SSE client：fetch + ReadableStream（不用 EventSource——要带 method/
 *     自定义头，且 cursor 查询参数自己控）；
 *   · cursor 跟踪（R2：信封 index 必须跟踪，cursor = 下一个待收 index）；
 *   · reducer 驱动 AiChatState——消息核 = shared/chat-protocol reducer 直接
 *     产物，不自造第二份状态（§1.2）；
 *   · 断线/页面切换重连 attach from cursor 补流（A9/A1 转换；补不上 → error
 *     事件入流）；
 *   · 观测环（≥50 拍 {t,type,idx,runId,phase}，§4.2 lastEvents 数据源）。
 *
 * 运行机词汇（§3.3 唯一真源，清单外状态名禁止——P9）：
 *   IDLE（无活跃 run）→ WAITING（已发送未收首事件）→ STREAMING（事件流中）
 *   → done/error → IDLE。本文件只出现这三个词。
 *
 * 慢流杠杆（B 档钉确定性时间窗）：window.__kfmNzAiChatTestLever =
 * { echoPaceMs } 在发送时读一次，经 start 载荷 paceMs 透传 EchoBrain
 * （0-500 夹取，direct 脑忽略）。生产路径永不设置。
 */
import { applyEvent } from '../../../shared/chat-protocol/reducer.js';
import type { ChatMessage } from '../../../shared/chat-protocol/messages.js';
import type { StreamEvent } from '../../../shared/chat-protocol/events.js';

/** 运行机词汇（§3.3，P9 唯一真源） */
export type RunPhase = 'IDLE' | 'WAITING' | 'STREAMING';
/** 页面机词汇（§3.3，P9 唯一真源） */
export type PageState = 'TERMINAL' | 'AI_PAGE';

/** 消息核（§1.2）：shared reducer 的直接产物 + 运行机相位 */
export interface AiChatState {
  messages: ChatMessage[];
  msgIdx: number;      // reducer cursor：当前流式消息索引，-1 = 无活跃
  phase: RunPhase;
}

export interface ProviderEntry { id: string; name: string; models: string[] }
export interface ProvidersInfo {
  providers: ProviderEntry[];
  default: { provider: string; model: string } | null;
}

export interface RunInfo {
  runId: string;
  provider: string;
  model: string;
  cursor: number;      // 下一个待收 index（attach from=N 的 N）
  deltas: number;
  chars: number;
  startedMs: number;
}

export interface RingEntry {
  t: number;
  type: string;        // 协议事件名 / 'ui:send' / 'ui:attach' / 'ui:suspend'
  idx: number;         // 信封 index（ui 拍为 -1）
  runId: string | null;
  phase: RunPhase;     // 该拍时刻的运行机相位（B6 词汇钉直读）
  page: PageState;     // 该拍时刻的页面机相位（同上）
}

export interface AiChatLink {
  readonly state: AiChatState;
  readonly run: RunInfo | null;
  readonly lastError: string | null;
  readonly ring: RingEntry[];
  providersInfo: ProvidersInfo | null;
  selection: { provider: string; model: string };
  loadProviders(): Promise<void>;
  send(text: string): Promise<void>;
  cancel(): Promise<void>;
  /** A2：页面切走——断流不死 run（server 缓冲续命），相位保持 */
  suspendStream(): void;
  /** A1/A9：切回/回前台——有活跃 run 则 attach from cursor 补流（幂等） */
  resumeStream(): void;
  close(): void;
}

const RING_CAP = 64; // ≥50（§4.2/契约 §7 可观测性约束）
const MAX_RECONNECT = 3;

export function createAiChatLink(onUpdate: () => void, env?: { page?: () => PageState }): AiChatLink {
  const state: AiChatState = { messages: [], msgIdx: -1, phase: 'IDLE' };
  const ring: RingEntry[] = [];
  let run: RunInfo | null = null;
  let lastError: string | null = null;
  let disposed = false;
  let suspended = false;
  let gen = 0;                 // 代际守卫：旧泵的迟到帧不得入境（新泵 ++gen 即废旧泵）
  let abort: AbortController | null = null;

  const pushRing = (type: string, idx: number): void => {
    ring.push({ t: Date.now(), type, idx, runId: run?.runId ?? null, phase: state.phase, page: env?.page?.() ?? 'TERMINAL' });
    if (ring.length > RING_CAP) ring.shift();
  };

  const link: AiChatLink = {
    state,
    get run() { return run; },
    get lastError() { return lastError; },
    get ring() { return ring; },
    providersInfo: null,
    selection: { provider: '', model: '' },

    async loadProviders(): Promise<void> {
      try {
        const res = await fetch('/ai/providers');
        if (!res.ok) return;
        const info = (await res.json()) as ProvidersInfo;
        link.providersInfo = info;
        // 默认 = server 下发的 default（2026-09-04 拍板⑮=智谱 glm-5.3-flash）
        if (info.default && !link.selection.provider) {
          link.selection = { provider: info.default.provider, model: info.default.model };
        } else if (!link.selection.provider && info.providers.length > 0) {
          link.selection = { provider: info.providers[0].id, model: info.providers[0].models[0] ?? '' };
        }
        onUpdate();
      } catch { /* picker 数据源暂不可得：保持空表，UI 显示加载中 */ }
    },

    async send(text: string): Promise<void> {
      if (disposed || state.phase !== 'IDLE') return; // P2 双保险（皮已把发送钮换成停止钮）
      const content = text.trim();
      if (!content) return;
      state.messages.push({ role: 'user', content: [{ type: 'text', text: content }], ts: new Date().toISOString() });
      state.msgIdx = -1; // WAITING 期间无活跃消息（旧消息不得挂流式光标），message_start 由 reducer 重指
      state.phase = 'WAITING'; // A3
      lastError = null;
      pushRing('ui:send', -1);
      onUpdate();
      const lever = (window as unknown as Record<string, unknown>).__kfmNzAiChatTestLever as { echoPaceMs?: number } | undefined;
      try {
        const res = await fetch('/ai/chat/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: state.messages,
            provider: link.selection.provider,
            model: link.selection.model,
            ...(typeof lever?.echoPaceMs === 'number' ? { paceMs: lever.echoPaceMs } : {}),
          }),
        });
        if (!res.ok) {
          // 400 参数非法（§1.4）：也走 error 事件入流，不破消息核语义
          failIntoStream(`请求被拒: HTTP ${res.status}`);
          return;
        }
        const { runId } = (await res.json()) as { runId: string };
        run = {
          runId, provider: link.selection.provider, model: link.selection.model,
          cursor: 0, deltas: 0, chars: 0, startedMs: Date.now(),
        };
        suspended = false;
        void pump(String(runId), 0);
      } catch (e) {
        failIntoStream(`网络错误: ${e instanceof Error ? e.message : String(e)}`);
      }
    },

    async cancel(): Promise<void> {
      if (!run || state.phase === 'IDLE') return;
      // A8：server 推 error「已取消」入流收尾（P5）——本地只发 cancel，收尾帧走同一条流
      await fetch(`/ai/chat/${encodeURIComponent(run.runId)}/cancel`, { method: 'POST' }).catch(() => { /* 尽力而为 */ });
    },

    suspendStream(): void {
      suspended = true;
      gen++; // 作废旧泵
      try { abort?.abort(); } catch { /* 已断即达意 */ }
      pushRing('ui:suspend', -1);
      // 相位保持（run 不死，server 缓冲续命——§3.0 tmux-tabs 同哲学）
    },

    resumeStream(): void {
      if (disposed || !suspended) return;
      suspended = false;
      pushRing('ui:attach', -1);
      if (run && state.phase !== 'IDLE') {
        void pump(run.runId, run.cursor); // A1/A9：attach from cursor 补流（++gen 废旧泵）
      }
    },

    close(): void {
      disposed = true;
      gen++;
      try { abort?.abort(); } catch { /* 已断即达意 */ }
    },
  };

  /** error 事件入流收尾（A7/A9 补不上；reducer 把文案写成消息内容——不是 toast） */
  function failIntoStream(message: string): void {
    applyEvent(state, { type: 'error', content: message });
    state.phase = 'IDLE';
    lastError = message;
    pushRing('error', run ? run.cursor : -1);
    onUpdate();
  }

  function applyFrame(index: number, event: StreamEvent): void {
    if (!run) return;
    run.cursor = index + 1;
    if (state.phase === 'WAITING') state.phase = 'STREAMING'; // A4
    if (event.type === 'content_block_delta') {
      run.deltas++;
      run.chars += event.deltaText?.length ?? 0;
    }
    applyEvent(state, event); // A5：原地 mutate 消息核（reducer 语义）
    if (event.type === 'done') state.phase = 'IDLE'; // A6
    if (event.type === 'error') { state.phase = 'IDLE'; lastError = event.content ?? ''; } // A7
    pushRing(event.type, index);
    onUpdate();
  }

  /**
   * 流泵：attach from=N → 逐帧入 reducer → __end__。
   * A9：通道断（fetch 抛/读到半截）→ 退避重连 attach from cursor；重连
   * 耗尽或 run 已不存在（__end__ 时相位仍活跃）→ error 事件入流。
   */
  async function pump(runId: string, from: number): Promise<void> {
    const myGen = ++gen;
    let attempts = 0;
    for (;;) {
        if (disposed || suspended || myGen !== gen) return;
        let sawEnd = false;
        try {
          abort = new AbortController();
          const res = await fetch(`/ai/chat/${encodeURIComponent(runId)}/stream?from=${from}`, { signal: abort.signal });
          if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let cut: number;
            while ((cut = buf.indexOf('\n\n')) >= 0) {
              const frame = buf.slice(0, cut);
              buf = buf.slice(cut + 2);
              const line = frame.split('\n').find((l) => l.startsWith('data: '));
              if (!line) continue;
              const payload = JSON.parse(line.slice(6)) as { type?: string; index?: number; event?: StreamEvent };
              if (payload.type === '__end__') { sawEnd = true; break; }
              if (disposed || suspended || myGen !== gen) return;
              if (typeof payload.index === 'number' && payload.event) applyFrame(payload.index, payload.event);
            }
            if (sawEnd) break;
          }
          // 未见 __end__ 的半截流 = 通道断（A9），走重连补流而非终结
          if (!sawEnd) throw new Error('流中断（未见 __end__）');
          // 流尽：run 正常完结时 done/error 已先入境（相位 IDLE）；仍活跃 = run
          // 消失（淘汰/server 重启）——补不上，error 事件入流（A9 尾巴）
          if (state.phase !== 'IDLE') failIntoStream('连接中断：对话流已结束且无法补流（run 已不存在）');
          return;
        } catch (e) {
          if (disposed || suspended || myGen !== gen) return;
          if (e instanceof DOMException && e.name === 'AbortError') return;
          attempts++;
          if (attempts > MAX_RECONNECT || state.phase === 'IDLE') {
            if (state.phase !== 'IDLE') failIntoStream(`通道断且重连 ${MAX_RECONNECT} 次失败: ${e instanceof Error ? e.message : String(e)}`);
            return;
          }
          pushRing('ui:reconnect', -1);
          await new Promise((r) => setTimeout(r, attempts * 600));
          from = run?.cursor ?? from; // A9：重连 attach from cursor
        }
    }
  }

  return link;
}
