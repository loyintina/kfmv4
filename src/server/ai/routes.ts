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
import { verifyLocalOrigin, isValidSessionId, KFM_DATA_DIR } from '../path-utils.js';
import { resolve, join, sep } from 'path';
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
    // body: { sessionId, messages, model, provider, roleFile, userText, tools, extraSystem, maxTokens, params, sessionClass, sandboxRoot }
    const { sessionId, messages, model, provider, roleFile, userText, tools, extraSystem, maxTokens, params, sessionClass, sandboxRoot } = req.body;
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
    // script 类会话落盘分流（2026-08-06 泄漏根治）：先登记再写任何消息——
    // hydrate/落盘路径随之切到 sessions/script/，从构造上不进面板区。
    // 须先于 appendUserMessage（它内部即触发 hydrate+flush）。
    if (sessionClass === 'script') {
      sessionStore.markSessionScript(sessionId);
    }
    if (rawUserText.trim()) {
      sessionStore.appendUserMessage(sessionId, rawUserText, model, provider);
    }
    // 会话权限档案（2026-08-05 用户拍板，实验臂污染事故后立规）：
    // script 类会话（实验跑批）未显式指定工具时默认只读白名单——实验臂与运维者同权限，
    // 曾 write 污染 repo/sed 改源码/rm 删会话（experiments/paradigm/index.md §工具权限纪律）。
    // panel（缺省）保持全量工具。显式 tools 透传不变（Enforcement by construction：
    // 不给白名单的模型根本看不到 bash/write）。
    const explicitTools = Array.isArray(tools) ? tools.filter((t): t is string => typeof t === 'string') : undefined;
    const toolWhitelist = explicitTools ?? (sessionClass === 'script' ? ['read', 'grep', 'glob'] : undefined);
    // 写监狱沙箱根（2026-08-06 e13 逃逸事故）：仅 script 会话可设，且必须落在
    // sessions/script/ 内——防任意目录被宣称为"沙箱"（监狱语义是 script 会话的
    // 臂级隔离，不是通用 chroot）。面板会话传了也忽略。
    let jailRoot: string | undefined;
    if (sessionClass === 'script' && typeof sandboxRoot === 'string' && sandboxRoot.trim()) {
      const resolved = resolve(sandboxRoot);
      const allowed = resolve(join(KFM_DATA_DIR, 'sessions', 'script')) + sep;
      if (resolved.startsWith(allowed)) jailRoot = resolved;
      else console.warn('[ai/chat/start] sandboxRoot 越出 sessions/script/，忽略:', sandboxRoot.slice(0, 80));
    }
    const run = startRunFn(
      sessionId, messages,
      model || 'deepseek-v4-flash',
      provider || 'deepseek',
      wsServer,
      typeof roleFile === 'string' ? roleFile : undefined,
      undefined, // streamFn 默认
      toolWhitelist,
      typeof extraSystem === 'string' ? extraSystem : undefined,
      typeof maxTokens === 'number' && Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : undefined,
      params && typeof params === 'object' && !Array.isArray(params) ? params as Record<string, unknown> : undefined,
      jailRoot,
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

