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
import { assembleRoleSystemPrompt } from './prompt-assembler.js';
import { refreshPageState } from './page-state.js';

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

/** 聊天消息（支持 OpenAI 格式：tool_calls + tool_call_id） */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
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
  filesChanged?: boolean; // 工具执行后文件系统有变化，客户端应刷新文件树
  // error / rule_warning
  content?: string;
}

/**
 * 工具块索引映射器（BAR-106 修复的核心逻辑，抽出为可测的纯工厂）。
 *
 * provider 的 tc.index → 客户端连续块索引：text 恒占 0，工具块从 1 起按首见顺序
 * 连续递增。必须连续——Claude 等 provider 的 tc.index 可能不从 0 起（如 1），若直接
 * 用 idx+1 会在客户端 content 数组留下 undefined 空洞，.filter(b=>b.type) 读空洞即崩
 * "Cannot read properties of undefined (reading 'type')"。同一 providerIdx 多次映射
 * 返回同一 clientIdx（幂等）。
 */
export function createClientIdxMapper(): { clientIdx: (providerIdx: number) => number } {
  const toolBlockIdx = new Map<number, number>();
  let nextToolBlock = 1;
  return {
    clientIdx(providerIdx: number): number {
      let ci = toolBlockIdx.get(providerIdx);
      if (ci === undefined) { ci = nextToolBlock++; toolBlockIdx.set(providerIdx, ci); }
      return ci;
    },
  };
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

/** 流式对话。roleFile 供每轮重组 system prompt（读角色卡 promptFiles，含动态 page-state）。 */
export async function* streamChat(
  messages: ChatMessage[],
  model: string,
  provider: string,
  wsServer: WsServer,
  signal?: AbortSignal,
  roleFile?: string,
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
  // 对话消息：只保留 user/assistant/tool（透传 OpenAI 格式字段）。
  // 客户端发来的 system 一律剥离——system 由服务端每轮重组（眼睛系统核心）。
  const apiMessages: Array<Record<string, unknown>> = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const out: Record<string, unknown> = {
        role: m.role === 'assistant' ? 'assistant' : m.role,
        content: m.content,
      };
      if (m.tool_calls) out.tool_calls = m.tool_calls;
      if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
      return out;
    });
  // 静态 system 段（工具文档 + alwaysApply 规则）：整轮对话不变，算一次。
  const staticSystemParts: string[] = [];
  const toolDocsPrompt = buildToolDocsPrompt();
  if (toolDocsPrompt) staticSystemParts.push(toolDocsPrompt);
  const alwaysApplyPrompt = buildAlwaysApplyPrompt();
  if (alwaysApplyPrompt) staticSystemParts.push(alwaysApplyPrompt);

  // 每轮重组 system：角色 prompt（含动态 promptFiles，如 page-state.md）放最前，
  // 静态段（工具文档/规则）在后。角色部分每轮重读 → 工具改写 page-state 后 AI 即见新状态。
  const buildSystemMessages = (): Array<Record<string, unknown>> => {
    const roleSystem = assembleRoleSystemPrompt(roleFile);
    const msgs: Array<Record<string, unknown>> = [];
    if (roleSystem) msgs.push({ role: 'system', content: roleSystem });
    for (const part of staticSystemParts) msgs.push({ role: 'system', content: part });
    return msgs;
  };

  // 首轮前刷新一次 page-state（AI 发第一条前先看到当前页面）。
  refreshPageState(wsServer);
  // 工具调用循环（无轮次上限，连续失败 3 次则截断）
  let toolFailureCount = 0;
  let turn = 0;

  while (true) {
    if (signal?.aborted) { yield { type: 'error', content: '已取消' }; return; }
    turn++;
    // 每轮 LLM 调用前重组 system（读最新角色文件/page-state），拼在对话前
    const requestBody: Record<string, unknown> = {
      model: model || apiProvider.models[0] || 'deepseek-v4-flash',
      messages: [...buildSystemMessages(), ...apiMessages],
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
      signal,
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
    // text block（含 reasoning）始终在 index=0，tool_use block 从 index=1 开始
    // 设计决策：thinking(reasoning_content) 和 text(content) 合并到同一个 TextBlock，
    // 不拆成两个 block。客户端 content[0] 同时持有 reasoning 和 text，
    // renderChatContent 取 textBlocks[0] 即可正确渲染两者。
    // 历史问题：曾经 thinking 开 index=0，text 再 stop/reopen 到 index=1，
    // 导致 renderChatContent 的 textBlocks[0].text 永远为空。
    let hasTextBlock = false; // 已 yield content_block_start index=0
    const toolStarted = new Set<number>(); // 已 yield content_block_start 的工具 provider idx
    // 工具块索引连续化：见 createClientIdxMapper（BAR-106 核心）。
    const { clientIdx } = createClientIdxMapper();

    // 本轮 message_start
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
          // 上游错误块（配额/限流/内部错误）：非 OpenAI chunk 格式，无 choices。
          // 必须显式上抛，否则流静默结束——用户只看到思考后戛然而止、工具调用"被截断"。
          if (chunk?.error || chunk?.type === 'error') {
            const em = chunk.error?.message || chunk.message || '上游服务错误';
            yield { type: 'error', content: `模型服务错误：${em}` };
            return;
          }
          const delta = chunk?.choices?.[0]?.delta || {};
          if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;

          // 工具调用：流式累积 + 即时 yield content_block_start/delta
          // 设计决策：工具名一出现就 yield start（客户端立刻渲染卡片），参数片段到了就 yield delta。
          // 之前是等 LLM 整个响应结束后才一次性 yield 所有事件，导致工具卡出现有延迟。
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

              // 工具名出现即 yield start（客户端立刻显示工具卡片）
              if (!toolStarted.has(idx) && buf.name) {
                toolStarted.add(idx);
                yield {
                  type: 'content_block_start',
                  index: clientIdx(idx),
                  blockType: 'tool_use',
                  toolUseId: buf.id || `call_${turn}_${idx}`,
                  toolName: buf.name,
                };
              }
              // 参数片段到了即 yield delta（客户端流式显示参数）
              if (tc.function && (tc.function as Record<string, string>).arguments) {
                yield {
                  type: 'content_block_delta',
                  index: clientIdx(idx),
                  deltaType: 'input_json_delta',
                  deltaText: (tc.function as Record<string, string>).arguments,
                };
              }
            }
          }

          // thinking delta → 写入 index=0 block 的 reasoning 字段
          if (delta.reasoning_content) {
            if (!hasTextBlock) {
              hasTextBlock = true;
              yield { type: 'content_block_start', index: 0, blockType: 'text' };
            }
            yield { type: 'content_block_delta', index: 0, deltaType: 'thinking_delta', deltaText: delta.reasoning_content as string };
          }

          // text delta → 写入同一个 index=0 block 的 text 字段
          if (delta.content) {
            contentBuf += delta.content as string;
            if (!hasTextBlock) {
              hasTextBlock = true;
              yield { type: 'content_block_start', index: 0, blockType: 'text' };
            }
            yield { type: 'content_block_delta', index: 0, deltaType: 'text_delta', deltaText: delta.content as string };
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // 关闭 text/thinking block（如果开过）
    if (hasTextBlock) {
      yield { type: 'content_block_stop', index: 0 };
    }
    // 关闭已 start 的工具 block
    for (const idx of toolStarted) {
      yield { type: 'content_block_stop', index: clientIdx(idx) };
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
        todo.push({ name: buf.name, params, tcId, blockIdx: tcIdx + 1 });
        tcIdx++;
      }
      assistantMsg.tool_calls = toolCalls;
      apiMessages.push(assistantMsg);

      // 规则检查
      const pendingWarnings: string[] = [];
      for (const t of todo) {
        const ruleWarning = checkToolCallRules(t.name, t.params);
        if (ruleWarning) {
          pendingWarnings.push(ruleWarning);
          yield { type: 'rule_warning', content: ruleWarning };
        }
      }

      // 文件工具成功执行 → 标记 filesChanged（bash 可改任意路径，指纹覆盖不了子目录）
      const FILE_TOOLS: Record<string, true> = { write: true, edit: true, bash: true };

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
      let filesChanged = false;
      for (let i = 0; i < todo.length; i++) {
        const t = todo[i];
        const result = results[i];
        if (result.isError) {
          toolFailureCount++;
        } else {
          toolFailureCount = 0;
        }
        // 文件工具无论成败都标记 filesChanged
        if (t.name in FILE_TOOLS) filesChanged = true;
        // 每个工具都 yield tool_result（客户端需要收到每个事件更新动画）
        // 最后一个带 filesChanged 标记
        yield { type: 'tool_result', toolUseId: t.tcId, toolResult: result, filesChanged: i === todo.length - 1 ? filesChanged : undefined };
        apiMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: t.tcId });
      }

      // 注入 warning
      if (pendingWarnings.length > 0) {
        apiMessages.push({ role: 'user', content: pendingWarnings.join('\n\n---\n\n') });
      }

      // 连续失败 3 次 → 注入提示词让 AI 停止调工具，改用文字回复
      if (toolFailureCount >= 3) {
        apiMessages.push({ role: 'user', content: '你的工具调用已连续失败 3 次。请停止调用工具，直接用文字回复用户，说明当前情况。' });
        toolFailureCount = 0; // 重置，避免下一轮立即触发
      }
      // UI 变化是异步的：服务端发指令 → 浏览器应用 → 浏览器 pushSnapshot 回传。
      // 给一个 settle 窗口让最新快照到达，再刷新 page-state.md，使下一轮重组 system
      // 时 AI 能看到工具对页面的实际影响（眼睛闭环）。
      const { promise: settle, resolve: settleDone } = Promise.withResolvers<void>();
      setTimeout(settleDone, 250);
      await settle;
      refreshPageState(wsServer);
      // 本轮消息结束，进入下一轮
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
