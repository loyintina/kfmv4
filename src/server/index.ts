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

const ROOT_DIR = process.env.KFM_ROOT || '.';
const SAFE_ROOT = path.resolve(ROOT_DIR) + path.sep;

/** 路径校验：确保用户路径不逃逸出 SAFE_ROOT */
function sanitizePath(userPath: string): string | null {
  const resolved = path.resolve(SAFE_ROOT, userPath);
  if (resolved !== SAFE_ROOT.slice(0, -1) && !resolved.startsWith(SAFE_ROOT)) return null;
  return resolved;
}

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

  router.post('/files/write', (req: express.Request, res: express.Response) => {
    try {
      const targetPath = sanitizePath(req.body.path);
      if (!targetPath) { res.json({ error: '路径不合法' }); return; }
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
