/**
 * kfmv4 AI 路由
 *
 * 提供 SSE 流式对话端点
 */

import { Router } from 'express';
import { streamChat } from './chat.js';
import type { WsServer } from '../ws-server.js';

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
}

