/**
 * KFM v4 服务端入口 — Express HTTP + WebSocket
 *
 * 路由层已拆分到 routes/：
 *   routes/files.ts  — /api/files/*（文件 CRUD）+ /api/system/info
 *   routes/proxy.ts  — /api/proxy/fetch（CORS 代理）
 *   server/ai/routes.ts  — /api/ai/chat（SSE 流式对话）
 *
 * index.ts 只做 Express 装配：静态文件 → 路由挂载 → 启动。
 */

import fs from 'fs';
import http from 'http';
import express from 'express';
import path from 'path';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { setupFileRoutes } from './routes/files.js';
import { setupProxyRoutes } from './routes/proxy.js';
import { setupProvidersRoutes } from './routes/providers.js';
import { setupAiRoutes } from './ai/routes.js';
import { WsServer } from './ws-server.js';
import { verifyLocalOrigin } from './path-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10mb' }));

// gzip 压缩（排除 /ai/ 路由——SSE 流式响应不能被缓冲压缩）
app.use(compression({
  filter: (req, res) => !req.url.includes('/ai/') && compression.filter(req, res),
}));

// 静态文件
// 带 ?v= 版本号的资源内容随 URL 变化，可安全永久缓存
app.use(express.static(path.join(__dirname, '../../public'), {
  setHeaders: (res) => {
    if (/[?&]v=/.test(res.req.url || '')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
// 安全：不挂载仓库根目录（曾把 .git/src/node_modules 暴露在 HTTP 上，虽仅绑
// 127.0.0.1 仍属纯冗余暴露；客户端全部资源都在 public/ 下）

// 文件 API 路由
const apiRoutes = express.Router();
setupFileRoutes(apiRoutes);
setupProxyRoutes(apiRoutes);
setupProvidersRoutes(apiRoutes);
// 客户端错误直报（2026-08-05 幽灵卡片堆排查装：手机端无 devtools，JS 异常即瞎猜——
// window.onerror/unhandledrejection 落盘 jsonl，服务端日志可见）
apiRoutes.post('/client-error', (req, res) => {
  try {
    const { message, stack, source, ua } = req.body || {};
    const line = JSON.stringify({ ts: new Date().toISOString(), message, stack, source, ua });
    const dir = path.join(KFM_DATA_DIR, 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'client-errors.jsonl'), line + '\n');
    console.error('[client-error]', message, source || '');
  } catch { /* 上报通道自身不得炸 */ }
  res.json({ ok: true });
});
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
app.post('/api/system/restart', verifyLocalOrigin, (_req, res) => {
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

// 检查 providers.json / .env 权限（明文 API key 安全提醒）
try {
  for (const secretFile of ['providers.json', '.env']) {
    const provPath = path.join(process.env.HOME || '/root', '.kfmv4', secretFile);
    try {
      const mode = fs.statSync(provPath).mode & 0o777;
      if (mode !== 0o600) console.warn(`[kfmv4] ⚠ ${provPath} 权限 ${mode.toString(8)}，建议 chmod 600（含 API key）`);
    } catch {}
  }
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
    // 客户端 WS 重连时立即推送 server-restarted（无固定延迟）
    wsServer.justRestarted = true;
  }
});
