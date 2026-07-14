/**
 * kfmv4 AI 调用层
 *
 * 使用 kfmv4 的 API 卡配置和 proxy 端点实现流式对话
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR } from '../path-utils.js';
import type { WsServer } from '../ws-server.js';
import { getToolDefinitions, executeTool } from './tools/index.js';
import type { KfmTool, ToolContext } from './tools/types.js';

/** 聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** 流式事件 */
export interface StreamEvent {
  type: 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolParams?: unknown;
  toolResult?: unknown;
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

/** 构建系统提示词：基础提示词 + 角色卡的 promptFiles */
function buildSystemPrompt(): string {
  // 1. 读取基础系统提示词
  let basePrompt = '';
  try {
    const basePath = join(KFM_DATA_DIR, '..', 'kfmv4', 'src', 'server', 'prompts', 'system', 'base.md');
    basePrompt = readFileSync(basePath, 'utf-8');
  } catch {
    // 构建后 base.md 可能不在源路径，使用硬编码后备
    basePrompt = `你是 kfmv4 项目的 AI 开发助手。\n\n正确性优先，从源头修复问题。`;
  }

  // 2. 读取活跃角色
  let rolePrompt = '';
  try {
    const activePath = join(KFM_DATA_DIR, 'active.json');
    const active = JSON.parse(readFileSync(activePath, 'utf-8'));
    const roleFile = active.roleFile;
    if (roleFile) {
      const rolePath = join(KFM_DATA_DIR, 'roles', `${roleFile}.json`);
      const role = JSON.parse(readFileSync(rolePath, 'utf-8'));
      const promptFiles: string[] = role.promptFiles || [];
      for (const pf of promptFiles) {
        try {
          rolePrompt += readFileSync(pf, 'utf-8') + '\n\n';
        } catch { /* 跳过不可读的提示词文件 */ }
      }
    }
  } catch { /* 角色未配置，使用纯基础提示词 */ }

  return rolePrompt ? `${rolePrompt}\n---\n${basePrompt}` : basePrompt;
}
/** 流式对话 */
export async function* streamChat(
  messages: ChatMessage[],
  model: string,
  provider: string,
  wsServer: WsServer
): AsyncGenerator<StreamEvent> {
  const systemPrompt = buildSystemPrompt();
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
  
  // 检查是否有工具调用请求
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === 'user') {
    const userText = lastMessage.content.toLowerCase();
    
    // 检查是否需要调用工具
    if (userText.includes('状态') || userText.includes('页面') || userText.includes('snapshot')) {
      yield { type: 'tool_call', toolName: 'kfm-snapshot', toolParams: {} };
      const result = await executeTool('kfm-snapshot', {}, toolCtx);
      yield { type: 'tool_result', toolResult: result };
      yield { type: 'text', content: result.content[0]?.text || '无法获取页面状态' };
      yield { type: 'done' };
      return;
    }
    
    if (userText.includes('日志') || userText.includes('log')) {
      yield { type: 'tool_call', toolName: 'kfm-logs', toolParams: {} };
      const result = await executeTool('kfm-logs', {}, toolCtx);
      yield { type: 'tool_result', toolResult: result };
      yield { type: 'text', content: result.content[0]?.text || '无法获取日志' };
      yield { type: 'done' };
      return;
    }
    
    if (userText.includes('执行') || userText.includes('运行') || userText.includes('命令')) {
      const commandMatch = lastMessage.content.match(/["""](.+?)["""]/);
      const command = commandMatch ? commandMatch[1] : 'npm run check';
      
      yield { type: 'tool_call', toolName: 'kfm-exec', toolParams: { command } };
      const result = await executeTool('kfm-exec', { command }, toolCtx);
      yield { type: 'tool_result', toolResult: result };
      yield { type: 'text', content: result.content[0]?.text || '命令执行完成' };
      yield { type: 'done' };
      return;
    }
  }
  
  // 调用真正的 LLM API
  try {
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : m.role,
        content: m.content,
      })),
    ];
    
    const requestBody = {
      model: model || apiProvider.models[0] || 'deepseek-v4-flash',
      messages: apiMessages,
      max_tokens: 16384,
      stream: true,
    };
    
    // 直接调用 API（不经过 proxy）
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
    
    // 读取 SSE 流
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', content: '无响应体' };
      return;
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
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
          
          if (delta.reasoning_content) {
            yield { type: 'thinking', content: delta.reasoning_content };
          }
          if (delta.content) {
            yield { type: 'text', content: delta.content };
          }
        } catch (e) { console.error('[chat] SSE parse error:', e instanceof Error ? e.message : e); }
      }
    }
  } catch (error) {
    yield { type: 'error', content: `API 调用失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}
