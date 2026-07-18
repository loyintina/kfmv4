/**
 * kfmv4 AI 调用层
 *
 * 使用 kfmv4 的 API 卡配置和 proxy 端点实现流式对话
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR } from '../path-utils.js';
import type { WsServer } from '../ws-server.js';
import { getToolDefinitions, executeTool } from './tools/index.js';
import type { KfmTool, ToolContext } from './tools/types.js';
import { buildAlwaysApplyPrompt, checkToolCallRules } from './rule-engine.js';

/** 从 prompts/tools/*.md 加载工具描述 */
const PROMPTS_DIR = join(process.cwd(), 'src', 'server', 'prompts', 'tools');
const toolDocs = new Map<string, string>();
function loadToolDocs(): void {
  try {
    const files = readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const name = f.replace('.md', '');
      toolDocs.set(name, readFileSync(join(PROMPTS_DIR, f), 'utf-8'));
    }
  } catch (e) {
    console.error('[chat] loadToolDocs failed:', e instanceof Error ? e.message : e);
  }
}
loadToolDocs();

function buildToolDocsPrompt(): string {
  if (toolDocs.size === 0) return '';
  let text = '\n\n## 可用工具\n\n';
  for (const [name, doc] of toolDocs) {
    text += `### ${name}\n\n${doc}\n\n`;
  }
  return text;
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** 流式事件（content block 协议）
 *
 * 协议结构（按 SSE 顺序）：
 *   message_start                        ← 新一轮 LLM 消息开始（客户端推新气泡）
 *   content_block_start  index type      ← 创建 block（text / tool_use）
 *   content_block_delta  index delta     ← 增量更新 block 内容
 *   content_block_stop   index           ← block 完成
 *   tool_result          toolUseId       ← 工具执行结果（填入对应 ToolBlock）
 *   message_stop                         ← 本轮消息结束
 *   done                                 ← 全部结束
 *   error                                ← 错误
 */
export interface StreamEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'tool_result'
    | 'message_stop'
    | 'error'
    | 'done'
    | 'rule_warning';
  // content_block_start
  index?: number;
  blockType?: 'text' | 'tool_use';
  toolUseId?: string;
  toolName?: string;
  // content_block_delta
  deltaType?: 'text_delta' | 'thinking_delta' | 'input_json_delta';
  deltaText?: string;
  // tool_result
  toolResult?: { content: Array<{ type: string; text?: string }>; isError?: boolean };
  // error / rule_warning
  content?: string;
}

/** API Provider 配置 */
interface ApiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

/** 读取 providers.json */
function loadProviders(): ApiProvider[] {
  try {
    const configPath = join(KFM_DATA_DIR, 'providers.json');
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('[chat] loadProviders failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** 流式对话 */
export async function* streamChat(
  messages: ChatMessage[],
  model: string,
  provider: string,
  wsServer: WsServer
): AsyncGenerator<StreamEvent> {
  const tools = getToolDefinitions();

  // 构建工具上下文
  const toolCtx: ToolContext = {
    cwd: '/root/kfmv4',
    wsServer,
  };

  // 读取 API 配置
  const providers = loadProviders();
  const apiProvider = providers.find(p => p.id === provider) || providers[0];

  if (!apiProvider) {
    yield { type: 'error', content: '未配置 API Provider，请先在 API 卡中添加。' };
    return;
  }

  // 构建 OpenAI 格式的 tools 参数
  const toolsParam = tools.length > 0 ? tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  })) : undefined;

  // 基础消息
  const baseMessages: Array<Record<string, unknown>> = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
    content: m.content,
  }));
  const toolDocsPrompt = buildToolDocsPrompt();
  if (toolDocsPrompt) {
    baseMessages.push({ role: 'system', content: toolDocsPrompt });
  }
  // 注入 alwaysApply 规则到 system prompt
  const alwaysApplyPrompt = buildAlwaysApplyPrompt();
  if (alwaysApplyPrompt) {
    baseMessages.push({ role: 'system', content: alwaysApplyPrompt });
  }

  // 工具调用循环（无轮次上限，连续失败 3 次则截断）
  const apiMessages: Array<Record<string, unknown>> = [...baseMessages];
  let toolFailureCount = 0;
  let turn = 0;

  while (true) {
    turn++;
    const requestBody: Record<string, unknown> = {
      model: model || apiProvider.models[0] || 'deepseek-v4-flash',
      messages: apiMessages,
      max_tokens: 16384,
      stream: true,
    };
    if (toolsParam) requestBody.tools = toolsParam;

    const response = await fetch(`${apiProvider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiProvider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      yield { type: 'error', content: `API 请求失败: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', content: '无响应体' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const toolCallBufs = new Map<number, { id: string; name: string; args: string }>();
    let finishReason = '';
    let contentBuf = '';
    // block index 计数：text block 固定 index=0，tool_use block 从 1 开始
    let blockIndex = 0;
    let hasTextBlock = false;
    let hasThinkingBlock = false;

    // 本轮 message_start（第一轮不需要，已在外层 while 前 yield 过）
    yield { type: 'message_start' };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const chunk = JSON.parse(jsonStr);
          const delta = chunk?.choices?.[0]?.delta || {};
          if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;

          if (delta.tool_calls) {
            for (const tc of (delta.tool_calls as Array<Record<string, unknown>>)) {
              const idx = (tc.index as number) ?? 0;
              if (!toolCallBufs.has(idx)) {
                toolCallBufs.set(idx, { id: '', name: '', args: '' });
              }
              const buf = toolCallBufs.get(idx)!;
              if (tc.id) buf.id = tc.id as string;
              if ((tc.function as Record<string, string>)?.name) buf.name += (tc.function as Record<string, string>).name;
              if ((tc.function as Record<string, string>)?.arguments) buf.args += (tc.function as Record<string, string>).arguments;
            }
          }

          // thinking delta → thinking_delta 事件
          if (delta.reasoning_content) {
            if (!hasThinkingBlock) {
              hasThinkingBlock = true;
              yield { type: 'content_block_start', index: blockIndex, blockType: 'text' };
            }
            yield { type: 'content_block_delta', index: blockIndex, deltaType: 'thinking_delta', deltaText: delta.reasoning_content as string };
          }

          // text delta → text_delta 事件
          if (delta.content) {
            contentBuf += delta.content as string;
            if (!hasTextBlock) {
              // 如果之前有 thinking block，先关闭它再开新 text block
              if (hasThinkingBlock) {
                yield { type: 'content_block_stop', index: blockIndex };
                blockIndex++;
              }
              hasTextBlock = true;
              yield { type: 'content_block_start', index: blockIndex, blockType: 'text' };
            }
            yield { type: 'content_block_delta', index: blockIndex, deltaType: 'text_delta', deltaText: delta.content as string };
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // 关闭当前 text/thinking block
    if (hasTextBlock || hasThinkingBlock) {
      yield { type: 'content_block_stop', index: blockIndex };
      blockIndex++;
    }

    // 检查是否需要执行工具
    if (finishReason === 'tool_calls' && toolCallBufs.size > 0) {
      const assistantMsg: Record<string, unknown> = { role: 'assistant', content: contentBuf || null };
      const toolCalls: Array<Record<string, unknown>> = [];
      const todo: Array<{ name: string; params: Record<string, unknown>; tcId: string; blockIdx: number }> = [];
      let tcIdx = 0;
      for (const [, buf] of toolCallBufs) {
        const tcId = buf.id || `call_${turn}_${tcIdx}`;
        const params = safeParseJson(buf.args);
        toolCalls.push({ id: tcId, type: 'function', function: { name: buf.name, arguments: buf.args } });
        // 每个工具调用占一个 block index
        todo.push({ name: buf.name, params, tcId, blockIdx: blockIndex + tcIdx });
        tcIdx++;
      }
      assistantMsg.tool_calls = toolCalls;
      apiMessages.push(assistantMsg);

      // yield tool_use block（先全部 start，并行工具同时可见）
      const pendingWarnings: string[] = [];
      for (const t of todo) {
        const ruleWarning = checkToolCallRules(t.name, t.params);
        if (ruleWarning) {
          pendingWarnings.push(ruleWarning);
          yield { type: 'rule_warning', content: ruleWarning };
        }
        yield { type: 'content_block_start', index: t.blockIdx, blockType: 'tool_use', toolUseId: t.tcId, toolName: t.name };
        yield { type: 'content_block_delta', index: t.blockIdx, deltaType: 'input_json_delta', deltaText: JSON.stringify(t.params) };
        yield { type: 'content_block_stop', index: t.blockIdx };
      }

      // 并行执行所有工具
      const results = await Promise.all(todo.map(async t => {
        try {
          return await executeTool(t.name, t.params, toolCtx);
        } catch (err) {
          return {
            content: [{ type: 'text', text: `工具执行失败: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      }));

      // yield tool_result，同时推入 apiMessages
      for (let i = 0; i < todo.length; i++) {
        const t = todo[i];
        const result = results[i];
        if (result.isError) {
          toolFailureCount++;
          if (toolFailureCount >= 3) {
            yield { type: 'tool_result', toolUseId: t.tcId, toolResult: result };
            yield { type: 'error', content: '工具连续失败 3 次，终止对话' };
            return;
          }
        } else {
          toolFailureCount = 0;
        }
        yield { type: 'tool_result', toolUseId: t.tcId, toolResult: result };
        apiMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: t.tcId });
      }

      // 注入 warning
      if (pendingWarnings.length > 0) {
        apiMessages.push({ role: 'user', content: pendingWarnings.join('\n\n---\n\n') });
      }

      // 本轮消息结束，进入下一轮（下一轮 while 开头会 yield message_start）
      yield { type: 'message_stop' };
      continue;
    }

    yield { type: 'message_stop' };
    yield { type: 'done' };
    return;
  }
}

function safeParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
