/**
 * kfmv4 AI 路由
 *
 * 提供 SSE 流式对话端点
 */

import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { KFM_DATA_DIR } from '../path-utils.js';
import { streamChat } from './chat.js';
import type { WsServer } from '../ws-server.js';

/** 读取 providers.json */
function loadProviders(): Array<{ id: string; name: string; baseUrl: string; apiKey: string; models: string[] }> {
  try {
    const configPath = join(KFM_DATA_DIR, 'providers.json');
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('[routes] loadProviders failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** 生成标题 */
async function generateTitle(prompt: string, model?: string, provider?: string): Promise<string> {
  const providers = loadProviders();
  const apiProvider = providers.find(p => p.id === provider) || providers[0];
  if (!apiProvider) throw new Error('未找到 API Provider');

  const response = await fetch(`${apiProvider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiProvider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || apiProvider.models[0] || 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      stream: false,
    }),
  });

  if (!response.ok) throw new Error(`API 请求失败: ${response.status}`);

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '新会话';
}

export function setupAiRoutes(router: Router, wsServer: WsServer) {
  /**
   * POST /api/ai/chat
   *
   * 流式对话端点
   * 请求体: { messages, model, provider }
   * 响应: SSE 流
   */
  router.post('/ai/chat', async (req, res) => {
    const { messages, model, provider } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: '缺少 messages 参数' });
      return;
    }
    
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    
    try {
      for await (const event of streamChat(
        messages,
        model || 'deepseek-v4-flash',
        provider || 'opencode-go',
        wsServer
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
    }
    
    res.end();
  });
  
  /**
   * POST /api/ai/generate-title
   *
   * 生成会话标题
   * 请求体: { userMessage, aiResponse, model?, provider? }
   * 响应: { title: string }
   */
  router.post('/ai/generate-title', async (req, res) => {
    const { userMessage, aiResponse, model, provider } = req.body;
    
    if (!userMessage) {
      res.status(400).json({ error: '缺少 userMessage 参数' });
      return;
    }
    
    try {
      const prompt = aiResponse
        ? `请为以下对话生成一个简短的标题（10-20字），只返回标题，不要其他内容：\n用户：${userMessage}\nAI：${aiResponse}`
        : `请为以下消息生成一个简短的标题（10-20字），只返回标题，不要其他内容：\n${userMessage}`;
      
      const title = await generateTitle(prompt, model, provider);
      res.json({ title: title.trim() });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.status(500).json({ error: errorMessage });
    }
  });
}

