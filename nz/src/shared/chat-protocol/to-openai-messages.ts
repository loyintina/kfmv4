/**
 * to-openai-messages.ts — A1 简版：content blocks → OpenAI 载荷投影（纯函数）。
 *
 * 设计 §1.1 末 + §八①：不搬 kfmv4 308 行整树（它 import 整个 tool-compaction/
 * 重件族），只保留三条有事故教训的规则：
 *
 *   ①ts 前缀只盖 user 消息（BAR-TS-MIMIC-01：assistant 盖前缀 = AI 在自己
 *     历史回复上看到统一行文格式 → 模仿复读。A1 无 ts 字段也要把这条写进
 *     结构，防后补时踩雷）；
 *   ②客户端产物占位符不进载荷（[错误: …] / [未收到回复，请重试] 整条过滤——
 *     本地事故记录不是对话内容，上行污染「最近的自己」；[已取消] 不过滤，
 *     是对话信号）。过滤只作用 assistant 投影：user 消息一字不动（G5）；
 *   ③空壳 assistant 一律丢弃（无 tool_calls 且正文空 → 严格端点 kimi 400
 *     「assistant must not be empty」，BAR-PROVIDER-02）。
 *
 * 与全量版的差异（诚实登记）：无压缩投影（tool-compaction 整族不搬）、
 * 思考链不上行（不带 reasoning_content）；工具块做最小投影（tool_calls +
 * tool 结果配对原样透出，不压缩）——A1 无工具，此为结构兜底防静默丢数据。
 */

import type { ChatMessage, TextBlock, ToolBlock } from './messages.js';

export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAiMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

function extractText(msg: ChatMessage): string {
  return msg.content
    .filter((b): b is TextBlock => b?.type === 'text')
    .map(b => b.text)
    .join('');
}

/** [ts MM-DD HH:MM:SS] 前缀（投影端本地时区）。ts 缺失/非法 → 空串。
 *  只盖 user（规则①，BAR-TS-MIMIC-01）。 */
function tsPrefix(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `[ts ${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}] `;
}

/** 客户端产物占位符（规则②）：要求整条都是占位符；混有真实正文的不在此列。
 *  [已取消] 不过滤：用户主动取消是对话信号。 */
function isClientArtifact(text: string): boolean {
  const t = text.trim();
  return (t.startsWith('[错误: ') && t.endsWith(']')) || t === '[未收到回复，请重试]';
}

export function toOpenAiMessages(messages: ChatMessage[]): OpenAiMessage[] {
  const apiMessages: OpenAiMessage[] = [];
  for (const m of messages) {
    if (!m) continue;
    if (m.role === 'user') {
      // G5：user 消息一个字不动（ts 前缀是元数据渲染，非压缩）
      apiMessages.push({ role: 'user', content: tsPrefix(m.ts) + extractText(m) });
      continue;
    }
    // AI 消息：text + tool blocks 最小投影
    const textBlocks = m.content.filter((b): b is TextBlock => b?.type === 'text');
    const toolBlocks = m.content.filter((b): b is ToolBlock => b?.type === 'tool');
    const mainText = textBlocks.map(b => b.text || '').join('');
    if (toolBlocks.length > 0) {
      const toolCalls = toolBlocks.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.input ?? {}) },
      }));
      const headText = mainText && !isClientArtifact(mainText) ? mainText : null;
      apiMessages.push({ role: 'assistant', content: headText, tool_calls: toolCalls });
      for (const tc of toolBlocks) {
        const resultText = tc.result?.content?.map(c => c.text || '').join('') || '';
        apiMessages.push({ role: 'tool', content: resultText, tool_call_id: tc.id });
      }
    } else {
      // 规则③ 空壳丢弃 + 规则② 占位符过滤
      if (mainText && !isClientArtifact(mainText)) {
        apiMessages.push({ role: 'assistant', content: mainText });
      }
    }
  }
  return apiMessages;
}
