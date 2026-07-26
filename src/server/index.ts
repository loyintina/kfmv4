/**
 * KFM v4 服务端入口 — Express HTTP + WebSocket
 *
 * 路由层已拆分到 routes/：
 *   routes/files.ts  — /api/files/*（文件 CRUD）+ /api/system/info
 *   routes/proxy.ts  — /api/proxy/fetch（CORS 代理）
 *   server/ai/routes.ts  — /api/ai/chat（SSE 流式对话）
 *   server/ai-tools.ts   — /api/ai/tools/*（Agent 工具端点）
 *
 * index.ts 只做 Express 装配：静态文件 → 路由挂载 → 启动。
 */

import fs from 'fs';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupFileRoutes } from './routes/files.js';
import { setupProxyRoutes } from './routes/proxy.js';
import { setupAiTools } from './ai-tools.js';
import { setupAiRoutes } from './ai/routes.js';
import { WsServer } from './ws-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10mb' }));

// 静态文件
app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.static(path.join(__dirname, '../..')));

// 文件 API 路由
const apiRoutes = express.Router();
setupFileRoutes(apiRoutes);
setupProxyRoutes(apiRoutes);
app.use('/api', apiRoutes);
app.use('/kfmv4/api', apiRoutes);

// WebSocket + AI
const PORT = parseInt(process.env.KFM_PORT || '8021', 10);
const httpServer = http.createServer(app);
const wsServer = new WsServer(httpServer);

// 调试探针注册表（runtime probe）：debug 工具通过 evaluate 注入包装函数来捕获调用信息。
// 存储在 index.ts 的模块作用域中，CDP evaluate 通过 globalThis.__kfmProbes 访问。
// 探针机制：包装目标方法 → 首次调用时捕获 args + stack → 自动恢复原函数。
// 这是 step/variables/stack_trace 的非侵入式替代方案——不暂停进程，30-50ms 内完成。
(globalThis as Record<string, unknown>).__kfmDebugServer = { wsServer };
// 存储上一次探测结果，供 debug 工具通过 evaluate 读取
let _lastTracepointResult: unknown = null;
(globalThis as Record<string, unknown>).__kfmProbe = {
  /** 设置探针：targetExpr 是访问目标对象的表达式，methodName 是要包装的方法名 */
  set(targetExpr: string, methodName: string): string {
    try {
      const target = new Function('return ' + targetExpr)();
      if (!target || typeof target[methodName] !== 'function') {
        return `Error: ${targetExpr}.${methodName} 不是函数或不存在`;
      }
      const original = target[methodName].bind(target);
      let called = false;
      let capturedArgs: unknown = null;
      let capturedStack = '';
      target[methodName] = function(...args: unknown[]) {
        if (!called) {
          called = true;
          capturedArgs = args.map((a: unknown) => {
            try { return JSON.parse(JSON.stringify(a)); }
            catch { return String(a).slice(0, 200); }
          });
          capturedStack = new Error().stack || '';
        }
        return original.apply(this, args);
      };
      target.__kfmProbeRestore = function() { target[methodName] = original; };
      _lastTracepointResult = { called, args: capturedArgs, stack: capturedStack };
      return `OK: 探针已注入 ${targetExpr}.${methodName}`;
    } catch (e) { return `Error: ${e instanceof Error ? e.message : String(e)}`; }
  },
  /** 读取探针结果并恢复原函数 */
  read(): string {
    const result = _lastTracepointResult as { called: boolean; args: unknown[]; stack: string } | null;
    if (!result) return JSON.stringify({ called: false, args: [], stack: '' });
    return JSON.stringify(result);
  },
  /** 恢复所有被包装的原函数 */
  restore(): string {
    try {
      // 尝试恢复 wsServer.handleMessage（常见的探测目标）
      const wsSrv = (globalThis as Record<string, unknown>).__kfmDebugServer as { wsServer: Record<string, unknown> };
      if (wsSrv?.wsServer?.__kfmProbeRestore) {
        (wsSrv.wsServer.__kfmProbeRestore as () => void)();
      }
      return 'OK';
    } catch (e) { return `Error: ${e instanceof Error ? e.message : String(e)}`; }
  }
};

// AI Tools 路由
const aiRoutes = express.Router();
setupAiTools(aiRoutes, wsServer);
app.use('/api', aiRoutes);
app.use('/kfmv4/api', aiRoutes);

// AI 对话路由
const aiChatRoutes = express.Router();
setupAiRoutes(aiChatRoutes, wsServer);
app.use('/api', aiChatRoutes);
app.use('/kfmv4/api', aiChatRoutes);

// ========== 系统管理端点 ==========

// POST /api/system/restart — 安全重启服务
// 关键设计：先响应 200，再 spawn detached 子进程。子进程脱离 kfmv4 进程组，
// 不受 SIGTERM 影响，能在 kfmv4 被 systemd 杀死后继续完成重启命令。
// 解决 AI agent 调用 systemctl restart 时自身也被 kill 导致命令超时的问题。
import { spawn } from 'node:child_process';
app.post('/api/system/restart', (_req, res) => {
  res.json({ status: 'restarting', message: 'Service restart initiated. kfmv4 will be back in ~5s.' });
  // 立即 flush 响应，然后委托给独立子进程
  setTimeout(() => {
    const child = spawn('systemctl', ['restart', 'kfmv4'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref(); // 让子进程完全脱离父进程生命周期
  }, 100);
});

// 检查 providers.json 权限（明文 API key 安全提醒）
try {
  const provPath = path.join(process.env.HOME || '/root', '.kfmv4/providers.json');
  try {
    const mode = fs.statSync(provPath).mode & 0o777;
    if (mode !== 0o600) console.warn(`[kfmv4] ⚠ ${provPath} 权限 ${mode.toString(8)}，建议 chmod 600（含 API key）`);
  } catch {}
} catch {}

// v8 冷恢复：检测 restart-pending.json 标记（kfm-restart 工具写入）
// 存在 → 说明是重启后的新进程 → 删除标记 → 延迟广播 server-restarted（等客户端 WS 重连）
import { KFM_DATA_DIR } from './path-utils.js';
let _justRestarted = false;
try {
  const markerPath = path.join(KFM_DATA_DIR, 'restart-pending.json');
  if (fs.existsSync(markerPath)) {
    fs.unlinkSync(markerPath);
    _justRestarted = true;
    console.log('[kfmv4] 检测到重启标记，将在客户端重连后广播 server-restarted');
  }
} catch {}

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[kfmv4] http://127.0.0.1:${PORT}`);
  if (_justRestarted) {
    // 等 3s 让客户端 WS 重连完成，再广播
    setTimeout(() => {
      wsServer.broadcast('server-restarted', { at: new Date().toISOString() });
      console.log('[kfmv4] 已广播 server-restarted');
    }, 3000);
  }
});
