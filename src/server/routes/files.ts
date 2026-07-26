/**
 * routes/files.ts — 文件 CRUD API 端点
 *
 * 从 server/index.ts 拆分。提供文件列表、读取、写入、复制、移动、删除、
 * 重命名、新建文件/文件夹等操作。所有路径经过 sanitizePath() 安全校验。
 */

import type { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getActiveRoot, KFM_DATA_DIR, sanitizePath, setActiveRoot, verifyLocalOrigin } from '../path-utils.js';

// ========== 类型 ==========

export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
}
/**
 * 会话消息分段切片（纯函数，供 /sessions/messages 端点 + 回归测试复用）。
 *   from='tail'：末尾优先，offset=0 取最后 limit 条（面板追底）。
 *   from='head'：开头优先，offset=0 取最前 limit 条（会话卡预览）。
 * offset/limit 已由调用方钳为非负；limit<=0 视为取全部（调用方传 total）。
 */
export function sliceMessages<T>(all: T[], from: 'head' | 'tail', offset: number, limit: number): T[] {
  const total = all.length;
  const lim = limit > 0 ? limit : total;
  if (from === 'tail') {
    const end = total - offset;
    const start = Math.max(0, end - lim);
    return all.slice(start, Math.max(start, end));
  }
  return all.slice(offset, offset + lim);
}

// ========== 路由注册 ==========

export function setupFileRoutes(router: Router): void {
  router.post('/files/list', (req, res) => {
    try {
      const targetPath = req.body.path || getActiveRoot();
      const resolvedPath = sanitizePath(targetPath === '~' ? getActiveRoot() : targetPath);
      if (!resolvedPath) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(resolvedPath)) { res.json({ error: '路径不存在', path: resolvedPath }); return; }
      const items = fs.readdirSync(resolvedPath).filter(name => !name.startsWith('.') || req.body.showHidden).map(name => {
        const fullPath = path.join(resolvedPath, name);
        try { const stats = fs.statSync(fullPath); return { name, path: fullPath, isDir: stats.isDirectory(), size: stats.size, modified: stats.mtime.toISOString() }; } catch { return null; }
      }).filter((item): item is { name: string; path: string; isDir: boolean; size: number; modified: string } => item !== null).sort((a, b) => { if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; return a.name.localeCompare(b.name); });
      res.json({ path: resolvedPath, items });
    } catch (error) { res.json({ error: error instanceof Error ? error.message : 'unknown' }); }
  });

  // 递归获取目录树：一次返回指定路径下所有层级的子目录内容
  router.post('/files/list-recursive', (req, res) => {
    try {
      const targetPath = req.body.path || getActiveRoot();
      const maxDepth = req.body.depth || 20;
      const expandedPaths: Record<string, boolean> = req.body.expandedPaths || {};
      const showHidden = req.body.showHidden || false;
      const resolvedPath = sanitizePath(targetPath === '~' ? getActiveRoot() : targetPath);
      if (!resolvedPath) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(resolvedPath)) { res.json({ error: '路径不存在', path: resolvedPath }); return; }

      interface TreeNode {
        name: string; path: string; isDir: boolean;
        size: number; modified: string; children?: TreeNode[];
      }

      function readDirRecursive(dirPath: string, depth: number): TreeNode[] {
        if (depth <= 0) return [];
        try {
          return fs.readdirSync(dirPath)
            .filter(name => showHidden || !name.startsWith('.'))
            .map(name => {
              const fullPath = path.join(dirPath, name);
              try {
                const stats = fs.statSync(fullPath);
                const node: TreeNode = { name, path: fullPath, isDir: stats.isDirectory(), size: stats.size, modified: stats.mtime.toISOString() };
                if (stats.isDirectory()) {
                  const isExpanded = expandedPaths[fullPath] || Object.keys(expandedPaths).some(ep => ep.startsWith(fullPath + '/'));
                  if (isExpanded) node.children = readDirRecursive(fullPath, depth - 1);
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

  router.post('/files/read', (req, res) => {
    try {
      const targetPath = sanitizePath(req.body.path);
      if (!targetPath) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(targetPath)) { res.json({ error: '文件不存在' }); return; }
      res.json({ path: targetPath, content: fs.readFileSync(targetPath, 'utf-8') });
    } catch (error: any) { res.json({ error: error.message }); }
  });
  // 会话元数据列表：一次性返回所有会话的轻量元数据（不含 messages），
  // 比逐文件 list+read 快 N 倍（大会话文件可达 600KB，元数据仅约 200B/条）。
  router.get('/sessions/list', (_req, res) => {
    try {
      const sessionsDir = path.join(KFM_DATA_DIR, 'sessions');
      if (!fs.existsSync(sessionsDir)) { res.json({ sessions: [] }); return; }
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      const sessions: Array<{ id: string; title: string; createdAt: string; updatedAt: string; manuallyNamed?: boolean; providerId?: string; modelId?: string; messageCount: number; tokenCount: number }> = [];
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') continue;
          const p = parsed as Record<string, unknown>;
          const id = typeof p['id'] === 'string' ? p['id'] : '';
          const title = typeof p['title'] === 'string' ? p['title'] : '';
          if (!id || !title) continue;
          const messages = Array.isArray(p['messages']) ? p['messages'] : [];
          // 只统计有正文的消息数，不把整个 messages 数组传给客户端
          let messageCount = 0;
          let totalChars = 0;
          for (const msg of messages) {
            if (!msg || typeof msg !== 'object') continue;
            const content = Array.isArray((msg as Record<string, unknown>)['content']) ? (msg as Record<string, unknown>)['content'] as unknown[] : [];
            for (const block of content) {
              if (!block || typeof block !== 'object') continue;
              const b = block as Record<string, unknown>;
              if (b['type'] === 'text') {
                const t = typeof b['text'] === 'string' ? b['text'] : '';
                const r = typeof b['reasoning'] === 'string' ? b['reasoning'] : '';
                totalChars += t.length + r.length;
                if (t.trim()) { messageCount++; break; }
              } else if (b['type'] === 'tool') {
                if (b['input'] && typeof b['input'] === 'object') {
                  totalChars += JSON.stringify(b['input']).length;
                }
                const result = b['result'] as Record<string, unknown> | undefined;
                if (result) {
                  const rc = Array.isArray(result['content']) ? result['content'] as unknown[] : [];
                  for (const c of rc) {
                    if (c && typeof c === 'object' && 'text' in (c as Record<string, unknown>)) {
                      totalChars += String((c as Record<string, unknown>)['text']).length;
                    }
                  }
                }
              }
            }
          }
          sessions.push({
            id,
            title,
            createdAt: typeof p['createdAt'] === 'string' ? p['createdAt'] : '',
            updatedAt: typeof p['updatedAt'] === 'string' ? p['updatedAt'] : '',
            ...(typeof p['manuallyNamed'] === 'boolean' && { manuallyNamed: p['manuallyNamed'] }),
            ...(typeof p['providerId'] === 'string' && { providerId: p['providerId'] }),
            ...(typeof p['modelId'] === 'string' && { modelId: p['modelId'] }),
            messageCount,
            tokenCount: Math.round(totalChars / 3),
          });
        } catch { /* skip corrupt */ }
      }
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      res.json({ sessions });
    } catch (err: unknown) {
      res.json({ error: err instanceof Error ? err.message : 'unknown error' });
    }
  });
  // 会话消息分段读取：只切片指定范围，避免大会话（600KB）全量传输。
  //   query: id=会话id, from=head|tail（默认 tail）, offset, limit
  //   tail: 从末尾往前数，offset=0 表示最后 limit 条；面板追底优先渲染尾部
  //   head: 从开头往后数，offset=0 表示最前 limit 条；会话卡预览优先渲染头部
  //   返回 { total, offset, limit, from, messages }
  router.get('/sessions/messages', (req, res) => {
    try {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (!id || id.includes('/') || id.includes('..')) { res.json({ error: '会话 id 不合法' }); return; }
      const from = req.query.from === 'head' ? 'head' : 'tail';
      const offset = Math.max(0, parseInt(typeof req.query.offset === 'string' ? req.query.offset : '0', 10) || 0);
      const rawLimit = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '0', 10) || 0;
      const filePath = path.join(KFM_DATA_DIR, 'sessions', `${id}.json`);
      if (!filePath || !fs.existsSync(filePath)) { res.json({ error: '会话不存在' }); return; }
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!parsed || typeof parsed !== 'object' || !('messages' in parsed) || !Array.isArray(parsed.messages)) {
        res.json({ total: 0, offset, limit: rawLimit, from, messages: [] });
        return;
      }
      const all = parsed.messages;
      const total = all.length;
      const limit = rawLimit > 0 ? rawLimit : total;
      const slice = sliceMessages(all, from, offset, limit);
      res.json({ total, offset, limit, from, messages: slice });
    } catch (err: unknown) {
      res.json({ error: err instanceof Error ? err.message : 'unknown error' });
    }
  });
  // 列出文件系统根 / 下的所有顶层目录（兄弟目录切换用）。
  // 专用于 sibling-switcher UI，不经过 sanitizePath（不在 SAFE_ROOT 内的系统级路径）。
  router.get('/roots', verifyLocalOrigin, (_req, res) => {
    try {
      const items = fs.readdirSync('/').filter(name => {
        try { return fs.statSync('/' + name).isDirectory(); } catch { return false; }
      }).sort();
      res.json({ items });
    } catch (err: unknown) {
      res.json({ error: err instanceof Error ? err.message : 'unknown error' });
    }
  });

  // 动态根切换：将 sanitizePath 边界移动到目标目录（sibling-switcher 核心）
  router.post('/root/switch', verifyLocalOrigin, (req, res) => {
    try {
      const target = req.body.path;
      if (!target || typeof target !== 'string') { res.status(400).json({ error: '缺少 path 参数' }); return; }
      if (!path.isAbsolute(target)) { res.status(400).json({ error: '路径必须是绝对路径' }); return; }
      let resolved: string;
      try { resolved = fs.realpathSync(target); } catch { res.status(400).json({ error: '路径不存在或无法解析' }); return; }
      if (!fs.statSync(resolved).isDirectory()) { res.status(400).json({ error: '目标不是目录' }); return; }
      if (resolved === '/') { res.status(400).json({ error: '不能切换到文件系统根' }); return; }
      if (resolved === KFM_DATA_DIR || resolved.startsWith(KFM_DATA_DIR + path.sep)) { res.status(400).json({ error: '不能切换到 .kfmv4 数据目录内' }); return; }
      const topLevel = '/' + resolved.split('/').filter(Boolean)[0];
      const allowed = fs.readdirSync('/').filter(n => { try { return fs.statSync('/' + n).isDirectory(); } catch { return false; } });
      if (!allowed.includes(topLevel.slice(1))) { res.status(400).json({ error: '目标不在允许的根目录列表中' }); return; }
      setActiveRoot(resolved);
      res.json({ success: true, root: resolved });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'unknown error' });
    }
  });

  router.get('/root/current', (_req, res) => {
    res.json({ root: getActiveRoot() });
  });

  router.get('/files/media', (req, res) => {
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

  router.post('/files/write', verifyLocalOrigin, (req, res) => { try {
    const targetPath = sanitizePath(req.body.path);
    if (!targetPath) { res.json({ error: '路径不合法' }); return; }
    const content: string = req.body.content;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (req.body.append) fs.appendFileSync(targetPath, content, 'utf-8');
    else fs.writeFileSync(targetPath, content, 'utf-8');
    res.json({ success: true, path: targetPath });
  } catch (error: any) { res.json({ error: error.message }); } });

  router.post('/files/copy', verifyLocalOrigin, (req, res) => { try {
    const src = sanitizePath(req.body.source);
    const dest = sanitizePath(req.body.dest);
    if (!src || !dest) { res.json({ error: '路径不合法' }); return; }
    if (!fs.existsSync(src)) { res.json({ error: '源路径不存在', path: src }); return; }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) { fs.cpSync(src, dest, { recursive: true }); }
    else { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.cpSync(src, dest); }
    res.json({ success: true, source: src, dest });
  } catch (e: any) { res.json({ error: e.message }); } });

  router.post('/files/move', verifyLocalOrigin, (req, res) => { try {
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
  } catch (e: any) { res.json({ error: e.message }); } });

  router.post('/files/delete', verifyLocalOrigin, (req, res) => { try {
    const target = sanitizePath(req.body.path);
    if (!target) { res.json({ error: '路径不合法' }); return; }
    if (!fs.existsSync(target)) { res.json({ error: '路径不存在', path: target }); return; }
    const stat = fs.statSync(target);
    if (stat.isDirectory()) { fs.rmSync(target, { recursive: true, force: true }); }
    else { fs.rmSync(target); }
    res.json({ success: true, path: target });
  } catch (e: any) { res.json({ error: e.message }); } });

  router.post('/files/rename', verifyLocalOrigin, (req, res) => { try {
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
  } catch (e: any) { res.json({ error: e.message }); } });

  router.post('/files/create-folder', verifyLocalOrigin, (req, res) => { try {
    const parentDir = sanitizePath(req.body.parentDir);
    if (!parentDir) { res.json({ error: '路径不合法' }); return; }
    if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) { res.json({ error: '父目录不存在' }); return; }
    let name = '\u65B0\u5EFA\u6587\u4EF6\u5939';
    let dest = path.join(parentDir, name);
    let seq = 2;
    while (fs.existsSync(dest)) { dest = path.join(parentDir, name + ' ' + seq); seq++; }
    fs.mkdirSync(dest);
    res.json({ success: true, path: dest });
  } catch (e: any) { res.json({ error: e.message }); } });

  router.post('/files/create-file', verifyLocalOrigin, (req, res) => { try {
    const parentDir = sanitizePath(req.body.parentDir);
    if (!parentDir) { res.json({ error: '路径不合法' }); return; }
    if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) { res.json({ error: '父目录不存在' }); return; }
    let base = '\u65B0\u5EFA\u6587\u4EF6';
    let name = base + '.md';
    let dest = path.join(parentDir, name);
    let seq = 2;
    while (fs.existsSync(dest)) { name = base + ' ' + seq + '.md'; dest = path.join(parentDir, name); seq++; }
    fs.writeFileSync(dest, '');
    res.json({ success: true, path: dest });
  } catch (e: any) { res.json({ error: e.message }); } });

  router.get('/system/info', (_req, res) => {
    res.json({ user: process.env.USER || 'root', home: getActiveRoot(), cwd: process.cwd() });
  });
}
