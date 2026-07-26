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
// 暴露到全局供 debug tracepoint 探针访问（CDP Runtime.evaluate 无法访问模块局部变量）
(globalThis as Record<string, unknown>).__kfmDebugServer = { wsServer };

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

// 检查 providers.json 权限（明文 API key 安全提醒）
try {
  const provPath = path.join(process.env.HOME || '/root', '.kfmv4/providers.json');
  try {
    const mode = fs.statSync(provPath).mode & 0o777;
    if (mode !== 0o600) console.warn(`[kfmv4] ⚠ ${provPath} 权限 ${mode.toString(8)}，建议 chmod 600（含 API key）`);
  } catch {}
} catch {}

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[kfmv4] http://127.0.0.1:${PORT}`);
});
