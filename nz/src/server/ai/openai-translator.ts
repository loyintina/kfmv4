/**
 * openai-translator.ts — 上游 OpenAI chunk → 九事件 StreamEvent（纯逻辑零 IO）。
 *
 * 语义基准 = na src/brain.rs OpenAiTranslator + error_event_from_http，
 * 错误语义对齐 kfmv4 chat.ts / 设计 §1.4：
 *   - 首个内容帧懒发 message_start + content_block_start{index:0,text}
 *     （thinking + 正文同块混排，deltaType 分流——chat.ts 历史教训）；
 *   - reasoning_content → thinking_delta，content → text_delta，恒 index=0；
 *   - 方言全容忍：role 每帧重复（glm）/ 空 delta:{} / choices:[] usage 帧
 *     （kimi）/ system_fingerprint 有无 / 未知字段；usage 只记账不进事件流；
 *   - 流内错误块（chunk.error / type:'error'，无 choices）→ error 事件
 *     「模型服务错误：…」，不许静默结束（chat.ts:385-389，§1.4）；
 *   - 坏 JSON 帧 → error 事件入流（不例外不静默）；
 *   - delta.tool_calls 碎片 A1 容忍忽略（不翻译不炸，A3 再接）。
 */

import type { StreamEvent } from '../../shared/chat-protocol/events.ts';

export interface UsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class OpenAiTranslator {
  private started = false;
  private closed = false;
  /** usage 记账（只记账不进事件流；双份帧后帧覆盖，同值无害）。 */
  usage: UsageRecord | null = null;

  private lazyStart(out: StreamEvent[]): void {
    if (!this.started) {
      this.started = true;
      out.push({ type: 'message_start' });
      out.push({ type: 'content_block_start', index: 0, blockType: 'text' });
    }
  }

  /** 翻译一帧 SSE 载荷为 0..N 个事件。静默帧（零事件）是常态。 */
  translatePayload(payload: string): StreamEvent[] {
    const out: StreamEvent[] = [];
    const text = payload.trim();
    if (text === '[DONE]') {
      this.closeBlock(out);
      out.push({ type: 'done' });
      return out;
    }
    let chunk: unknown;
    try {
      chunk = JSON.parse(text);
    } catch (e) {
      out.push({ type: 'error', content: `上游帧 JSON 解析失败: ${e instanceof Error ? e.message : String(e)}` });
      return out;
    }
    const c = chunk as Record<string, unknown>;
    // 流内错误块（无 choices 的异常形状）：必须显式 error 事件，不许静默结束
    const errObj = c?.error as { message?: unknown } | undefined;
    if (errObj || c?.type === 'error') {
      const em = (typeof errObj?.message === 'string' && errObj.message)
        || (typeof c?.message === 'string' && c.message)
        || '上游服务错误';
      out.push({ type: 'error', content: `模型服务错误：${em}` });
      return out;
    }
    // usage 记账（kimi 双份帧：choices[0].usage 与顶层 usage 都收，只记账）
    const usage = (c?.usage ?? (Array.isArray(c?.choices) ? (c.choices[0] as Record<string, unknown>)?.usage : undefined)) as
      { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    if (usage && typeof usage.prompt_tokens === 'number') {
      this.usage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      };
    }
    if (!Array.isArray(c?.choices)) return out; // 无 choices（异常形状），静默容忍
    const choice = c.choices[0] as Record<string, unknown> | undefined;
    if (!choice) return out; // choices: [] usage-only 帧（Kimi 方言）
    const delta = (choice.delta ?? {}) as Record<string, unknown>;
    // role 字段：Kimi 仅首帧、GLM 每帧重复——一律忽略（方言表已登记）
    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content !== '') {
      this.lazyStart(out);
      out.push({ type: 'content_block_delta', index: 0, deltaType: 'thinking_delta', deltaText: delta.reasoning_content });
    }
    if (typeof delta.content === 'string' && delta.content !== '') {
      this.lazyStart(out);
      out.push({ type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: delta.content });
    }
    // delta.tool_calls（OpenAI 碎片格式）：A1 容忍忽略，不翻译不炸
    if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
      this.closeBlock(out);
    }
    return out;
  }

  /** 流终结兜底：无 [DONE]/finish_reason 的截断流也把开着的块关上。 */
  finish(): StreamEvent[] {
    const out: StreamEvent[] = [];
    this.closeBlock(out);
    return out;
  }

  private closeBlock(out: StreamEvent[]): void {
    if (this.started && !this.closed) {
      this.closed = true;
      out.push({ type: 'content_block_stop', index: 0 });
      out.push({ type: 'message_stop' });
    }
  }
}

/**
 * 上游非 200 → error 事件人话（na error_event_from_http 同语义，
 * kfmv4 chat.ts:337 口径）：能解析出 error.message 用 message（双路 401
 * 体形状不同但都有它——Kimi {error:{message,type}} / 智谱 {error:{code:"401",message}}）；
 * 否则原样截断 300 字（按字符计，防巨型 HTML 错误页糊脸；完整体只落 server 日志）。
 * 空错误体只报状态码（kfmv4 同款，不拖空尾巴）。
 */
export function errorEventFromHttp(status: number, body: string): StreamEvent {
  let detail = '';
  if (body) {
    try {
      const v = JSON.parse(body) as { error?: { message?: unknown } };
      if (typeof v?.error?.message === 'string') detail = v.error.message;
    } catch { /* 非 JSON 错误体走截断 */ }
    if (!detail) detail = [...body].slice(0, 300).join('');
  }
  return { type: 'error', content: `API 请求失败: ${status}${detail ? ` — ${detail}` : ''}` };
}
