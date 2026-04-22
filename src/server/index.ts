import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// 静态文件
app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.static(path.join(__dirname, '../..')));

const ROOT_DIR = '/root';

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
      const resolvedPath = targetPath === '~' ? ROOT_DIR : targetPath;
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

  router.post('/files/read', (req: express.Request, res: express.Response) => {
    try {
      const targetPath: string = req.body.path;
      if (!fs.existsSync(targetPath)) { res.json({ error: '文件不存在' }); return; }
      res.json({ path: targetPath, content: fs.readFileSync(targetPath, 'utf-8') });
    } catch (error: any) { res.json({ error: error.message }); }
  });

  router.post('/files/write', (req: express.Request, res: express.Response) => {
    try {
      const targetPath: string = req.body.path;
      const content: string = req.body.content;
      if (req.body.append) fs.appendFileSync(targetPath, content, 'utf-8');
      else fs.writeFileSync(targetPath, content, 'utf-8');
      res.json({ success: true, path: targetPath });
    } catch (error: any) { res.json({ error: error.message }); }
  });

  router.get('/system/info', (_req: express.Request, res: express.Response) => {
    res.json({ user: process.env.USER || 'root', home: ROOT_DIR, cwd: process.cwd() });
  });
}

setupApiRoutes(app.use('/api', express.Router()) && app);
app.use('/api', (() => { const r = express.Router(); setupApiRoutes(r); return r; })());
app.use('/kfmv4/api', (() => { const r = express.Router(); setupApiRoutes(r); return r; })());

const PORT = 8021;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`KFM v4 server running at http://localhost:${PORT}`);
});
