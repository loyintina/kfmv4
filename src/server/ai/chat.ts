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

/** 流式事件 */
export interface StreamEvent {
  type: 'message_start' | 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'rule_warning';
  content?: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  toolResult?: { content: Array<{ type: string; text?: string }>; isError?: boolean };
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
    let thinkingBuf = ''; // P1: 收集 thinking

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
              if (!toolCallBufs.has(idx)) toolCallBufs.set(idx, { id: '', name: '', args: '' });
              const buf = toolCallBufs.get(idx)!;
              if (tc.id) buf.id = tc.id as string;
              if ((tc.function as Record<string, string>)?.name) buf.name += (tc.function as Record<string, string>).name;
              if ((tc.function as Record<string, string>)?.arguments) buf.args += (tc.function as Record<string, string>).arguments;
            }
          }

          if (delta.reasoning_content) {
            thinkingBuf += delta.reasoning_content as string;
            yield { type: 'thinking', content: delta.reasoning_content as string };
          }
          if (delta.content) {
            contentBuf += delta.content as string;
            yield { type: 'text', content: delta.content as string };
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // 检查是否需要执行工具
    if (finishReason === 'tool_calls' && toolCallBufs.size > 0) {
      const assistantMsg: Record<string, unknown> = { role: 'assistant', content: contentBuf || null };
      const toolCalls: Array<Record<string, unknown>> = [];
      const todo: Array<{ name: string; params: Record<string, unknown>; tcId: string }> = [];
      let tcIdx = 0;
      for (const [, buf] of toolCallBufs) {
        const tcId = buf.id || `call_${turn}_${tcIdx}`;
        const params = safeParseJson(buf.args);
        toolCalls.push({ id: tcId, type: 'function', function: { name: buf.name, arguments: buf.args } });
        todo.push({ name: buf.name, params, tcId });
        tcIdx++;
      }
      assistantMsg.tool_calls = toolCalls;
      apiMessages.push(assistantMsg);

      // 先 yield 所有工具调用和结果（挂在当前气泡），再继续到下一轮
      const pendingWarnings: string[] = [];
      for (const t of todo) {
        // 规则检查：工具调用前扫描，违规收集（不在 assistant/tool 序列中间插入）
        const ruleWarning = checkToolCallRules(t.name, t.params);
        if (ruleWarning) {
          pendingWarnings.push(ruleWarning);
          yield { type: 'rule_warning', content: ruleWarning };
        }
        yield { type: 'tool_call', toolName: t.name, toolParams: t.params };
        let result;
        try {
          result = await executeTool(t.name, t.params, toolCtx);
        } catch (err) {
          result = {
            content: [{ type: 'text', text: `工具执行失败: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
        if (result.isError) {
          toolFailureCount++;
          if (toolFailureCount >= 3) {
            yield { type: 'tool_result', toolResult: result };
            yield { type: 'error', content: '工具连续失败 3 次，终止对话' };
            return;
          }
        } else {
          toolFailureCount = 0;
        }
        yield { type: 'tool_result', toolResult: result };
        apiMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: t.tcId });
      }
      // 所有 tool result 推完后，再注入 warning（用 user 角色避免 400）
      if (pendingWarnings.length > 0) {
        apiMessages.push({ role: 'user', content: pendingWarnings.join('\n\n---\n\n') });
      }
      // 工具全部执行完毕后，通知客户端创建新气泡，再进入下一轮 LLM 调用
      yield { type: 'message_start' };
      continue;
    }

    yield { type: 'done' };
    return;
  }
}

function safeParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
