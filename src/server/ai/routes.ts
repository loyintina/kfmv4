/**
 * kfmv4 AI 路由
 *
 * 持久化挂机模型（像 tmux 会话）：
 *   POST /ai/chat/start          → 后台启动生成任务，返回 { runId, fromIndex }
 *   GET  /ai/chat/:runId/stream  → SSE 续读（先补齐已缓冲事件，再实时尾随）
 *   POST /ai/chat/:runId/cancel  → 取消生成
 * 生成在服务端后台跑到完成，与客户端连接解耦——刷新/切后台后可重连续读。
 */

import { Router } from 'express';
import { getToolDefinitions } from './tools/index.js';
import { startRun, attachRun, cancelRun, getActiveRun, getRun } from './run-manager.js';
import * as sessionStore from './session-store.js';
import { verifyLocalOrigin, isValidSessionId } from '../path-utils.js';
import type { WsServer } from '../ws-server.js';

/** 可注入的 startRun 签名（测试用，生产走默认值） */
export type StartRunFn = typeof startRun;

export function setupAiRoutes(router: Router, wsServer: WsServer, startRunFn: StartRunFn = startRun) {
  /**
   * POST /ai/chat/start
   * body: { sessionId, messages, model, provider }
   * 返回: { runId, fromIndex } —— fromIndex 是客户端应从该索引开始读的事件位置
   */
  router.post('/ai/chat/start', verifyLocalOrigin, (req, res) => {
    // body: { sessionId, messages, model, provider, roleFile, userText }
    const { sessionId, messages, model, provider, roleFile, userText } = req.body;
    if (!sessionId || !messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: '缺少 sessionId 或 messages 参数' });
      return;
    }
    // BAR-SEC-14：sessionId 会拼进落盘文件路径，格式白名单全入口校验（防 ../ 逃逸 sessions/）
    if (!isValidSessionId(sessionId)) {
      res.status(400).json({ error: 'sessionId 格式不合法' });
      return;
    }
    // 落盘用户消息必须用 userText 原文——messages 是投影产物（带 [MM-DD HH:MM] 前缀、
    // 可能压缩），把投影文本回写真相源会造成前缀叠加污染（v8.3.x ts 泄漏病灶：
    // 会话文件里用户消息长出 [07-30 21:05] 前缀，下轮投影再盖一层）。
    // userText 缺省时退回旧路径（老客户端兼容）。
    const rawUserText = typeof userText === 'string' && userText.trim() ? userText
      : (() => { const m = [...messages].reverse().find((x: any) => x?.role === 'user'); return m && typeof m.content === 'string' ? m.content : ''; })();
    if (rawUserText.trim()) {
      sessionStore.appendUserMessage(sessionId, rawUserText, model, provider);
    }
    const run = startRunFn(
      sessionId, messages,
      model || 'deepseek-v4-flash',
      provider || 'opencode-go',
      wsServer,
      typeof roleFile === 'string' ? roleFile : undefined,
    );
    res.json({ runId: run.id, fromIndex: 0, done: run.done });
  });

  /**
   * GET /ai/chat/:runId/stream?from=N
   * SSE 续读：先回放 events[N:]（补齐错过的），再实时尾随到 done。
   * 客户端断开（刷新/切后台）不影响后台生成；重连再次 GET 即可补齐。
   */
  router.get('/ai/chat/:runId/stream', (req, res) => {
    const { runId } = req.params;
    const from = parseInt((req.query.from as string) || '0', 10) || 0;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 每个事件带 index，客户端据此记录已读位置（cursor），断线重连用
    const unsubscribe = attachRun(
      runId, from,
      (event, index) => {
        try { res.write(`data: ${JSON.stringify({ index, event })}\n\n`); } catch { /* 写失败=客户端断开，后台继续 */ }
      },
      () => {
        try { res.write(`data: ${JSON.stringify({ type: '__end__' })}\n\n`); } catch { /* ignore */ }
        res.end();
      },
    );
    // 客户端断开：仅退订，不取消后台生成（挂机核心）
    req.on('close', () => { unsubscribe(); });
  });

  /** POST /ai/chat/:runId/cancel — 用户主动停止生成 */
  router.post('/ai/chat/:runId/cancel', (req, res) => {
    const ok = cancelRun(req.params.runId);
    res.json({ ok });
  });

  /** GET /ai/chat/:runId/status — 重连前探活：{ exists, done } */
  router.get('/ai/chat/:runId/status', (req, res) => {
    const run = getRun(req.params.runId);
    res.json(run ? { exists: true, done: run.done, eventCount: run.events.length } : { exists: false, done: false });
  });

  /** GET /ai/chat/active?sessionId=X — 查询该 session 是否有活跃 run（重连入口） */
  router.get('/ai/chat/active', (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) { res.json({ runId: null }); return; }
    const run = getActiveRun(sessionId);
    res.json(run ? { runId: run.id, eventCount: run.events.length, done: run.done } : { runId: null });
  });

  /** GET /ai/tools — 返回所有已注册的 AI 工具 */
  router.get('/ai/tools', (_req, res) => {
    const tools = getToolDefinitions();
    const categories = [...new Set(tools.map(t => t.category))];
    res.json({ categories, tools });
  });
}

