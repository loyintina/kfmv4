/**
 * routes/files.ts — 文件 CRUD API 端点
 *
 * 从 server/index.ts 拆分。提供文件列表、读取、写入、复制、移动、删除、
 * 重命名、新建文件/文件夹等操作。所有路径经过 sanitizePath() 安全校验。
 */

import type { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getActiveRoot, KFM_DATA_DIR, PROJECT_ROOT, sanitizePath, setActiveRoot, verifyLocalOrigin, isValidSessionId } from '../path-utils.js';
import { invalidateSession } from '../ai/session-store.js';

/**
 * 若目标路径是 .kfmv4/sessions/<id>.json，同步失效 session-store 内存缓存。
 * 串档 bug（2026-08-01 实测）：删除/移动/重命名会话文件只动磁盘，_sessions
 * 缓存不失效——同名新会话接续旧 ctx，两段历史串档合并、旧消息全量发给 API。
 * 只在文件直属 sessions/ 目录时触发（basename 即 sessionId，天然过白名单）。
 */
const SESSIONS_DIR = path.join(KFM_DATA_DIR, 'sessions');
function _invalidateIfSessionFile(p: string): void {
  if (path.dirname(p) === SESSIONS_DIR && p.endsWith('.json')) {
    invalidateSession(path.basename(p, '.json'));
  }
}

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

/** 单次响应文本预算（2026-08-05，e9b-t0p4m0r7 实案）：失控臂单条消息可超 300KB，
 *  「limit=12 取尾部」返回 1MB+ 垃圾 → 手机端 JSON.parse + md 渲染把主线程打满（页面冻死）。
 *  条数语义不变（limit 仍按条切），只截断超限 text 块并标注，客户端渲染不受影响。 */
export const MSG_PAYLOAD_BUDGET = 400_000; // 单次响应 text 总量上限（字节近似，按字符数计）
export const MSG_SINGLE_CAP = 100_000;     // 单条消息 text 上限

export function capMessagesPayload<T>(messages: T[], budget: number = MSG_PAYLOAD_BUDGET, singleCap: number = MSG_SINGLE_CAP): T[] {
  let used = 0;
  return messages.map((m: any) => {
    if (!m || !Array.isArray(m.content)) return m;
    let changed = false;
    const content = m.content.map((b: any) => {
      if (!b || b.type !== 'text' || typeof b.text !== 'string') return b;
      const room = Math.min(singleCap, Math.max(0, budget - used));
      if (b.text.length <= room) { used += b.text.length; return b; }
      changed = true;
      const kept = b.text.slice(0, room);
      used += kept.length;
      return { ...b, text: kept + `\n\n…[已截断：原消息 ${b.text.length} 字符，完整内容见会话文件]` };
    });
    return changed ? { ...m, content } : m;
  });
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

  // 已知二进制扩展名：文本读取直接拒绝（2026-08-07 事故：用户文件树点开 materials.db 250MB，
  // readFileSync 全量进内存 + utf-8 解码 + res.json 序列化，单次峰值 700M+，cgroup MemoryHigh
  // 刹车直接踩死事件循环——前端无响应）
  const READ_DENY_EXT = new Set(['.db', '.sqlite', '.sqlite3', '.bin', '.so', '.wasm', '.zip', '.gz', '.tar', '.7z', '.rar', '.exe', '.dll', '.ico', '.icns']);
  // 文本读取硬上限：超出给截断预览（手机端渲染 1MB+ JSON 也会冻死主线程，见上方 sliceMessages 注释同款教训）
  const READ_MAX_BYTES = 2 * 1024 * 1024;

  router.post('/files/read', (req, res) => {
    try {
      const targetPath = sanitizePath(req.body.path);
      if (!targetPath) { res.json({ error: '路径不合法' }); return; }
      if (!fs.existsSync(targetPath)) { res.json({ error: '文件不存在' }); return; }
      const ext = path.extname(targetPath).toLowerCase();
      if (READ_DENY_EXT.has(ext)) { res.json({ error: `二进制文件（${ext}）不支持文本预览` }); return; }
      const size = fs.statSync(targetPath).size;
      if (size > READ_MAX_BYTES) {
        const fd = fs.openSync(targetPath, 'r');
        const buf = Buffer.alloc(READ_MAX_BYTES);
        fs.readSync(fd, buf, 0, READ_MAX_BYTES, 0);
        fs.closeSync(fd);
        res.json({ path: targetPath, content: buf.toString('utf-8'), truncated: true, totalSize: size });
        return;
      }
      res.json({ path: targetPath, content: fs.readFileSync(targetPath, 'utf-8') });
    } catch (error: any) { res.json({ error: error.message }); }
  });
  // 会话元数据列表：只读顶层字段（messageCount/tokenCount 由 saveSessionFile 写入），
  // 不再解析 messages 数组——大会话文件 1.5MB，3 个会话 = 4.5MB 磁盘 IO + JSON.parse。
  router.get('/sessions/list', (_req, res) => {
    try {
      const sessionsDir = path.join(KFM_DATA_DIR, 'sessions');
      if (!fs.existsSync(sessionsDir)) { res.json({ sessions: [] }); return; }
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      const sessions: Array<{ id: string; title: string; createdAt: string; updatedAt: string; manuallyNamed?: boolean; providerId?: string; modelId?: string; messageCount: number; tokenCount: number; fullTokenCount?: number }> = [];
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') continue;
          const p = parsed as Record<string, unknown>;
          const id = typeof p['id'] === 'string' ? p['id'] : '';
          const title = typeof p['title'] === 'string' ? p['title'] : '';
          if (!id || !title) continue;
          // messageCount/tokenCount 优先取顶层字段（由 saveSessionFile 写入），
          // 旧文件无此字段时回退计数（仅首次，下次保存即更新）
          let messageCount = typeof p['messageCount'] === 'number' ? p['messageCount'] : 0;
          let tokenCount = typeof p['tokenCount'] === 'number' ? p['tokenCount'] : 0;
          if (messageCount === 0 && tokenCount === 0) {
            const messages = Array.isArray(p['messages']) ? p['messages'] : [];
            for (const msg of messages) {
              if (!msg || typeof msg !== 'object') continue;
              const content = Array.isArray((msg as Record<string, unknown>)['content']) ? (msg as Record<string, unknown>)['content'] as unknown[] : [];
              for (const block of content) {
                if (!block || typeof block !== 'object') continue;
                const b = block as Record<string, unknown>;
                if (b['type'] === 'text') {
                  const t = typeof b['text'] === 'string' ? b['text'] : '';
                  const r = typeof b['reasoning'] === 'string' ? b['reasoning'] : '';
                  tokenCount += t.length + r.length;
                  if (t.trim()) { messageCount++; break; }
                } else if (b['type'] === 'tool') {
                  if (b['input'] && typeof b['input'] === 'object') tokenCount += JSON.stringify(b['input']).length;
                  const result = b['result'] as Record<string, unknown> | undefined;
                  if (result) {
                    const rc = Array.isArray(result['content']) ? result['content'] as unknown[] : [];
                    for (const c of rc) {
                      if (c && typeof c === 'object' && 'text' in (c as Record<string, unknown>)) {
                        tokenCount += String((c as Record<string, unknown>)['text']).length;
                      }
                    }
                  }
                }
              }
            }
            tokenCount = Math.round(tokenCount / 3);
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
            tokenCount,
            ...(typeof p['fullTokenCount'] === 'number' && { fullTokenCount: p['fullTokenCount'] }),
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
      if (!id || !isValidSessionId(id)) { res.json({ error: '会话 id 不合法' }); return; }
      const from = req.query.from === 'head' ? 'head' : 'tail';
      const offset = Math.max(0, parseInt(typeof req.query.offset === 'string' ? req.query.offset : '0', 10) || 0);
      const rawLimit = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '0', 10) || 0;
      const filePath = path.join(KFM_DATA_DIR, 'sessions', `${id}.json`);
      if (!fs.existsSync(filePath)) { res.json({ error: '会话不存在' }); return; }
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!parsed || typeof parsed !== 'object' || !('messages' in parsed) || !Array.isArray(parsed.messages)) {
        res.json({ total: 0, offset, limit: rawLimit, from, messages: [] });
        return;
      }
      const all = parsed.messages;
      const total = all.length;
      const limit = rawLimit > 0 ? rawLimit : total;
      const slice = sliceMessages(all, from, offset, limit);
      // 载荷保险丝：条数按 limit 切，但 text 总量封顶（失控会话单条可超 300KB，
      // limit=12 曾返回 1MB+ 把移动端主线程打满——见 capMessagesPayload 注释）
      res.json({ total, offset, limit, from, messages: capMessagesPayload(slice) });
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

  // KFM-NA APK 下载（2026-08-13）：硬编码路径，天然无路径逃逸问题。
  // 带 Content-Disposition，手机浏览器直接落下载而不是内联乱码。
  const KFM_NA_APK = '/root/kfm-na/target/release/apk/kfm-na.apk';

  router.get('/download/apk/info', (_req, res) => {
    try {
      if (!fs.existsSync(KFM_NA_APK)) { res.status(404).json({ error: 'APK 不存在' }); return; }
      const stat = fs.statSync(KFM_NA_APK);
      res.json({ size: stat.size, mtime: stat.mtime.toISOString() });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  router.get('/download/apk', (_req, res) => {
    try {
      if (!fs.existsSync(KFM_NA_APK)) { res.status(404).json({ error: 'APK 不存在' }); return; }
      // no-store：手机浏览器启发式缓存会让用户装到旧版（2026-08-13 实拍嫌疑变量）
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="kfm-na.apk"');
      res.setHeader('Content-Length', fs.statSync(KFM_NA_APK).size);
      fs.createReadStream(KFM_NA_APK).pipe(res);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  // KFM-NA 飞鸽传书（2026-08-13）：手机实拍现场回传通道。
  // 手机无 adb 通路（蜂窝 NAT 反连不回），APK 的 panic/启动里程碑
  // 直接 POST 到服务器落盘，C 档实拍判卷的证据链。
  // 不挂 verifyLocalOrigin——手机是外部来源，本就不是本地浏览器。
  const NA_REPORT_LOG = '/root/kfm-na/field-reports.log';
  router.post('/na-report', (req, res) => {
    try {
      const stage = String(req.body?.stage ?? '?').slice(0, 64);
      const msg = String(req.body?.msg ?? '').slice(0, 2000);
      const line = `${new Date().toISOString()} [${stage}] ${msg}\n`;
      fs.appendFileSync(NA_REPORT_LOG, line, 'utf-8');
      res.json({ ok: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  router.post('/files/write', verifyLocalOrigin, (req, res) => { try {
    const targetPath = sanitizePath(req.body.path);
    if (!targetPath) { res.json({ error: '路径不合法' }); return; }
    const content: string = req.body.content;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (req.body.append) fs.appendFileSync(targetPath, content, 'utf-8');
    else fs.writeFileSync(targetPath, content, 'utf-8');
    _invalidateIfSessionFile(targetPath); // 2026-08-10 消息删除 bug：会话卡编辑/删除消息经
    // files/write 落盘，不失效缓存则服务端旧 ctx 在下次对话 flush 覆盖还原（双写竞争）。
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
    _invalidateIfSessionFile(src); // 串档修复：移出 sessions/ 的会话文件缓存同步失效
    res.json({ success: true, source: src, dest });
  } catch (e: any) { res.json({ error: e.message }); } });

  router.post('/files/delete', verifyLocalOrigin, (req, res) => { try {
    const target = sanitizePath(req.body.path);
    if (!target) { res.json({ error: '路径不合法' }); return; }
    if (!fs.existsSync(target)) { res.json({ error: '路径不存在', path: target }); return; }
    const stat = fs.statSync(target);
    if (stat.isDirectory()) { fs.rmSync(target, { recursive: true, force: true }); }
    else { fs.rmSync(target); }
    _invalidateIfSessionFile(target); // 串档修复：删会话文件必须同步失效内存缓存
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
    _invalidateIfSessionFile(src); // 串档修复：旧 id 缓存随重命名失效（新 id 未缓存，会从磁盘重载）
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
    // buildInfo：构建时间戳（版本握手——「线上跑的是哪天的包」必须可机械查证，
    // 历史高发模式「反复修反复没效果」多数根因是旧包，见 diagnostics 构建/Bundle #4）
    let buildInfo: Record<string, unknown> | null = null;
    try {
      buildInfo = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'dist', 'build-info.json'), 'utf-8'));
    } catch { /* 未构建过 */ }
    res.json({ user: process.env.USER || 'root', home: getActiveRoot(), cwd: PROJECT_ROOT, buildInfo });
  });
}
