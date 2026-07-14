/**
 * KFM v4 服务端入口 — Express HTTP + WebSocket + API 路由
 *
 * 职责：
 *   - Express 4 静态文件服务 + API 路由
 *   - WebSocket 服务（服务端↔浏览器双向通信）
 *   - AI Tools 路由层挂载
 *   - 文件读写/复制/移动/删除/创建 REST API
 *
 * 路由前缀：/api 和 /kfmv4/api 双前缀支持
 */
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupAiTools } from './ai-tools.js';
import { setupAiRoutes } from './ai/routes.js';
import { WsServer } from './ws-server.js';
import { ROOT_DIR, SAFE_ROOT, sanitizePath, KFM_DATA_DIR } from './path-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// 静态文件
app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.static(path.join(__dirname, '../..')));


interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
}

// API 路由（支持 /api 和 /kfmv4/api 两种前缀）
function setupApiRoutes(router: express.Router) {
  router.post('/files/list', (req: express.Request, res: express.Response) => {
    try {
      const targetPath = req.body.path || ROOT_DIR;
      const resolvedPath = sanitizePath(targetPath === '~' ? ROOT_DIR : targetPath);
      if (!resolvedPath) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(resolvedPath)) { res.json({ error: '路径不存在', path: resolvedPath }); return; }
      const items: FileItem[] = fs.readdirSync(resolvedPath)
        .filter(name => !name.startsWith('.') || req.body.showHidden)
        .map(name => {
          const fullPath = path.join(resolvedPath, name);
          try { const stats = fs.statSync(fullPath); return { name, path: fullPath, isDir: stats.isDirectory(), size: stats.size, modified: stats.mtime.toISOString() }; } catch { return null; }
        })
        .filter((item): item is FileItem => item !== null)
        .sort((a, b) => { if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; return a.name.localeCompare(b.name); });
      res.json({ path: resolvedPath, items });
    } catch (error: any) { res.json({ error: error.message }); }
  });

  // 递归获取目录树：一次返回指定路径下所有层级的子目录内容
  // depth 限制递归深度，默认 5 层，防止超大目录卡住
  router.post('/files/list-recursive', (req: express.Request, res: express.Response) => {
    try {
      const targetPath = req.body.path || ROOT_DIR;
      const maxDepth = req.body.depth || 20;
      const expandedPaths: Record<string, boolean> = req.body.expandedPaths || {};
      const resolvedPath = sanitizePath(targetPath === '~' ? ROOT_DIR : targetPath);
      if (!resolvedPath) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(resolvedPath)) { res.json({ error: '路径不存在', path: resolvedPath }); return; }

      interface TreeNode {
        name: string;
        path: string;
        isDir: boolean;
        size: number;
        modified: string;
        children?: TreeNode[];
      }

      function readDirRecursive(dirPath: string, depth: number): TreeNode[] {
        if (depth <= 0) return [];
        try {
          return fs.readdirSync(dirPath)
            .map(name => {
              const fullPath = path.join(dirPath, name);
              try {
                const stats = fs.statSync(fullPath);
                const node: TreeNode = {
                  name, path: fullPath, isDir: stats.isDirectory(),
                  size: stats.size, modified: stats.mtime.toISOString(),
                };
                // 只有展开的目录才递归获取子节点
                if (stats.isDirectory()) {
                  const isExpanded = expandedPaths[fullPath] || Object.keys(expandedPaths).some(ep => ep.startsWith(fullPath + '/'));
                  if (isExpanded) {
                    node.children = readDirRecursive(fullPath, depth - 1);
                  }
                }
                return node;
              } catch { return null; }
            })
            .filter((item): item is TreeNode => item !== null)
            .sort((a, b) => { if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; return a.name.localeCompare(b.name); });
        } catch { return []; }
      }

      const tree = readDirRecursive(resolvedPath, maxDepth);
      res.json({ path: resolvedPath, tree });
    } catch (error: any) { res.json({ error: error.message }); }
  });

  router.post('/files/read', (req: express.Request, res: express.Response) => {
    try {
      const targetPath = sanitizePath(req.body.path);
      if (!targetPath) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(targetPath)) { res.json({ error: '文件不存在' }); return; }
      res.json({ path: targetPath, content: fs.readFileSync(targetPath, 'utf-8') });
    } catch (error: any) { res.json({ error: error.message }); }
  });

  router.get('/files/media', (req: express.Request, res: express.Response) => {
    try {
      const targetPath = sanitizePath(req.query.path as string);
      if (!targetPath) { res.status(400).json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(targetPath)) { res.status(404).json({ error: '文件不存在' }); return; }
      const ext = path.extname(targetPath).toLowerCase();
      const mime: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
      };
      res.type(mime[ext] || 'application/octet-stream');
      fs.createReadStream(targetPath).pipe(res);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  router.post('/files/write', (req: express.Request, res: express.Response) => {
    try {
      const targetPath = sanitizePath(req.body.path);
      if (!targetPath) { res.json({ error: '路径不合法' }); return; }
      const content: string = req.body.content;
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (req.body.append) fs.appendFileSync(targetPath, content, 'utf-8');
      else fs.writeFileSync(targetPath, content, 'utf-8');
      res.json({ success: true, path: targetPath });
    } catch (error: any) { res.json({ error: error.message }); }
  });

  router.post('/files/copy', (req: express.Request, res: express.Response) => {
    try {
      const src = sanitizePath(req.body.source);
      const dest = sanitizePath(req.body.dest);
      if (!src || !dest) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(src)) { res.json({ error: '源路径不存在', path: src }); return; }
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(src, dest);
      }
      res.json({ success: true, source: src, dest });
    } catch (e: any) { res.json({ error: e.message }); }
  });

  router.post('/files/move', (req: express.Request, res: express.Response) => {
    try {
      const src = sanitizePath(req.body.source);
      const dest = sanitizePath(req.body.dest);
      if (!src || !dest) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(src)) { res.json({ error: '源路径不存在', path: src }); return; }
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(src, dest);
      } catch {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) { fs.cpSync(src, dest, { recursive: true }); fs.rmSync(src, { recursive: true, force: true }); }
        else { fs.cpSync(src, dest); fs.rmSync(src); }
      }
      res.json({ success: true, source: src, dest });
    } catch (e: any) { res.json({ error: e.message }); }
  });

  router.post('/files/delete', (req: express.Request, res: express.Response) => {
    try {
      const target = sanitizePath(req.body.path);
      if (!target) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(target)) { res.json({ error: '路径不存在', path: target }); return; }
      const stat = fs.statSync(target);
      if (stat.isDirectory()) { fs.rmSync(target, { recursive: true, force: true }); }
      else { fs.rmSync(target); }
      res.json({ success: true, path: target });
    } catch (e: any) { res.json({ error: e.message }); }
  });

  router.post('/files/rename', (req: express.Request, res: express.Response) => {
    try {
      const src = sanitizePath(req.body.path);
      const newName = req.body.newName;
      if (!src) { res.json({ error: '路径不合法' }); return; }
      if (!newName || typeof newName !== 'string' || newName.includes('/')) { res.json({ error: '文件名不合法' }); return; }
      if (!fs.existsSync(src)) { res.json({ error: '路径不存在', path: src }); return; }
      const dir = path.dirname(src);
      const dest = path.join(dir, newName);
      if (fs.existsSync(dest)) { res.json({ error: '目标已存在', path: dest }); return; }
      fs.renameSync(src, dest);
      res.json({ success: true, source: src, dest });
    } catch (e: any) { res.json({ error: e.message }); }
  });

  router.post('/files/create-folder', (req: express.Request, res: express.Response) => {
    try {
      const parentDir = sanitizePath(req.body.parentDir);
      if (!parentDir) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
        res.json({ error: '父目录不存在' }); return;
      }
      let name = '\u65B0\u5EFA\u6587\u4EF6\u5939';
      let dest = path.join(parentDir, name);
      let seq = 2;
      while (fs.existsSync(dest)) { dest = path.join(parentDir, name + ' ' + seq); seq++; }
      fs.mkdirSync(dest);
      res.json({ success: true, path: dest });
    } catch (e: any) { res.json({ error: e.message }); }
  });

  router.post('/files/create-file', (req: express.Request, res: express.Response) => {
    try {
      const parentDir = sanitizePath(req.body.parentDir);
      if (!parentDir) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
        res.json({ error: '父目录不存在' }); return; }
      let base = '\u65B0\u5EFA\u6587\u4EF6';
      let name = base + '.md';
      let dest = path.join(parentDir, name);
      let seq = 2;
      while (fs.existsSync(dest)) { name = base + ' ' + seq + '.md'; dest = path.join(parentDir, name); seq++; }
      fs.writeFileSync(dest, '');
      res.json({ success: true, path: dest });
    } catch (e: any) { res.json({ error: e.message }); }
  });

  router.get('/system/info', (_req: express.Request, res: express.Response) => {
    res.json({ user: process.env.USER || 'root', home: ROOT_DIR, cwd: process.cwd() });
  });

  // AI API 代理：绕过浏览器跨域限制（支持流式和非流式）
  router.post('/proxy/fetch', async (req: express.Request, res: express.Response) => {
    try {
      const { url, method, headers, body } = req.body;
      if (!url) { res.json({ error: '缺少 url 参数' }); return; }

      // 仅允许转发到已配置 Provider 的 baseUrl
      try {
        const providers: Array<{ baseUrl: string }> = JSON.parse(
          fs.readFileSync(path.join(KFM_DATA_DIR, 'providers.json'), 'utf-8')
        );
        const allowed = providers.some(p => url.startsWith(p.baseUrl));
        if (!allowed) {
          res.status(403).json({ error: '不允许的请求地址' });
          return;
        }
      } catch {
        // providers.json 不存在或为空 → 拒绝所有代理请求
        res.status(403).json({ error: '未配置 Provider' });
        return;
      }

      // 如果请求体含 stream:true，设为流式模式（去除 stream 字段后转发）
      let reqBody = body;
      let isStream = false;
      if (typeof reqBody === 'object' && reqBody?.stream) {
        isStream = true;
        reqBody = { ...reqBody };
        delete reqBody.stream;
      }

      if (isStream) {
        // 流式模式：用 readable stream pipe 到客户端
        const response = await fetch(url, {
          method: method || 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ ...reqBody, stream: true }),
        });
        if (!response.ok) {
          res.json({ status: response.status, ok: false, error: '上游请求失败' });
          return;
        }
        // 转发 SSE 头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // 用 Node.js 的管道转发响应体
        const nodeReader = response.body!.getReader();
        const decoder = new TextDecoder();
        function pump(): void {
          nodeReader.read().then((result) => {
            if (result.done) { res.end(); return; }
            res.write(decoder.decode(result.value, { stream: true }));
            // Express Response extends http.ServerResponse; flush() exists for SSE
            // but @types/express omits it, so we narrow through unknown.
            const httpRes = res as unknown as { flush?(): void };
            httpRes.flush?.();
            pump();
          }).catch(() => res.end());
        }
        pump();
      } else if (method === 'GET') {
        // 非流式 GET
        const response = await fetch(url, { headers });
        const data = await response.json();
        res.json({ status: response.status, ok: response.ok, data });
      } else {
        // 非流式 POST
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody),
        });
        const data = await response.json();
        res.json({ status: response.status, ok: response.ok, data });
      }
    } catch (e: any) {
      res.json({ error: e.message || '代理请求失败', status: 0, ok: false });
    }
  });
}


// API 路由（支持 /api 和 /kfmv4/api 两种前缀）
const apiRoutes = express.Router();
setupApiRoutes(apiRoutes);
app.use('/api', apiRoutes);
app.use('/kfmv4/api', apiRoutes);

// AI Tools 路由（挂载到 /api 和 /kfmv4/api 下）
const PORT = parseInt(process.env.KFM_PORT || '8021', 10);
const httpServer = http.createServer(app);
const wsServer = new WsServer(httpServer);
const aiRoutes = express.Router();
setupAiTools(aiRoutes, wsServer);
app.use('/api', aiRoutes);
app.use('/kfmv4/api', aiRoutes);

// AI 对话路由
const aiChatRoutes = express.Router();
setupAiRoutes(aiChatRoutes, wsServer);
app.use('/api', aiChatRoutes);
app.use('/kfmv4/api', aiChatRoutes);;

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`KFM v4 server running at http://localhost:${PORT}`);
  console.log(`[ws-server] WebSocket available at ws://localhost:${PORT}/ws`);
});