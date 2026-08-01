/**
 * KFM v4 — 路径处理工具（服务端安全关键模块）
 *
 * 共享的 SAFE_ROOT / sanitizePath，避免在多个文件中重复定义。
 *
 * ## 安全约束
 * - `sanitizePath()` 是 AI 命令执行前的唯一路径校验守卫
 * - 所有用户路径必须经过它校验，拒绝任何逃逸 SAFE_ROOT 的路径
 * - 返回 `` 表示路径非法，调用方应拒绝操作并记录日志
 *
 * ## 依赖方
 * - `routes/files.ts` / `prompt-assembler.ts` 等 — 文件操作前调用 sanitizePath 校验
 *
 * ## 环境变量
 * - `KFM_ROOT` — 项目根目录（可选，默认取 HOME）
 */

import path from 'path';
import fs from 'fs';

/** 根目录（环境变量或 HOME）— 不可变，KFM_DATA_DIR 永远基于此 */
export const ROOT_DIR = process.env.KFM_ROOT || process.env.HOME || '.';

/** KFM 数据目录：所有 .kfmv4/ 配置文件存储在此（不随 root 切换变化） */
export const KFM_DATA_DIR = path.join(ROOT_DIR, '.kfmv4');

// ========== 动态 activeRoot（sibling-switcher 切换用） ==========

let _activeRoot: string = path.resolve(ROOT_DIR);

/** 当前活跃根目录（无尾 sep）— 文件操作默认路径、sanitizePath 边界 */
export function getActiveRoot(): string {
  return _activeRoot;
}

/** 当前活跃根目录（带尾 sep）— sanitizePath 内部前缀比对用 */
export function getSafeRoot(): string {
  return _activeRoot + path.sep;
}

/** 切换活跃根目录。调用方须先校验目标合法性。 */
export function setActiveRoot(newRoot: string): void {
  _activeRoot = path.resolve(newRoot);
}

/**
 * 路径校验：确保用户路径不逃逸出 SAFE_ROOT。返回 null 表示拒绝。
 *
 * 三层防护：
 *   1. 字符串层：path.resolve 后必须落在 SAFE_ROOT 内（挡 ../ 和绝对路径逃逸）。
 *   2. 符号链接层：对目标（或新建时的最深已存在祖先）做 realpath 解析真实位置，
 *      再次校验落在 SAFE_ROOT 内——挡 "SAFE_ROOT 内放一个指向 /etc/passwd 的软链"
 *      这类逃逸（path.resolve 是纯字符串运算，不跟随软链）。
 *   3. .kfmv4/ 不再屏蔽。
 *      数据在 $HOME/.kfmv4/ 不在项目仓库中，不存在 git 泄露风险。
 */
export function sanitizePath(userPath: string): string | null {
  const safeRoot = getSafeRoot();
  const resolved = path.resolve(safeRoot, userPath);
  if (resolved !== safeRoot.slice(0, -1) && !resolved.startsWith(safeRoot)) return null;

  // 符号链接解析：找最深的已存在路径段做 realpath（新建文件时目标尚不存在，
  // 需对其父目录链解析，防止用软链目录把写入/读取重定向到 activeRoot 外）。
  let probe = resolved;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break; // 抵达根，停止
    probe = parent;
  }
  try {
    const real = fs.realpathSync(probe);
    if (real !== safeRoot.slice(0, -1) && !real.startsWith(safeRoot)) return null;
  } catch {
    return null; // realpath 失败（如断链）→ 拒绝
  }

  return resolved;
}

/**
 * sessionId 格式白名单（BAR-SEC-14）：会话 id 会被拼进文件路径
 * `join(SESSIONS_DIR, ${sessionId}.json)`，故只允许安全字符集——
 * Unicode 字母/数字（含中文，生产会话 id 就是中文标题）+ `-`/`_`，1..128 位。
 * 任何路径分隔符/`.`/空白/控制字符一律拒绝（无 `.` 即无 `..` 逃逸）。
 * 另限 UTF-8 字节 ≤ 200（防 128 位全 CJK 超 ext4 文件名 255 字节上限 → ENAMETOOLONG）。
 * 全入口统一校验（/ai/chat/start、/sessions/messages、session-store 落盘点）。
 */
export const SESSION_ID_RE = /^[\p{L}\p{N}_-]{1,128}$/u;

export function isValidSessionId(id: unknown): boolean {
  return typeof id === 'string' && SESSION_ID_RE.test(id) && Buffer.byteLength(id, 'utf8') <= 200;
}

/**
 * 判断 URL hostname 是否为本地回环。
 *
 * 注意 IPv6：`new URL('http://[::1]:80').hostname` 返回带方括号的 `[::1]`，
 * 故两种写法都接受。
 */
export function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

/**
 * 判断请求是否可信（非跨源）——WS 握手与文件写删接口共用的 drive-by 判据。
 *
 * drive-by 攻击的本质是**跨源**：恶意网页的 Origin host 与本服务的 host 不同。
 * 因此正确判据是「同源」——Origin 的 host 等于请求实际到达的 Host 头。这样无论
 * 用户从 localhost、局域网 IP 还是反向代理域名访问，同源请求都放行；只有 host
 * 不匹配的外部网站被拒。loopback 作为额外兜底（Host 头缺失等边界情形）。
 *
 * @param origin  请求的 Origin 头（无则视为非浏览器客户端）
 * @param hostHeader  请求的 Host 头（服务实际被访问的 host:port）
 * @returns true=可信放行，false=跨源拒绝
 */
export function isTrustedOrigin(origin: string | undefined, hostHeader: string | undefined): boolean {
  if (!origin) return true; // 非浏览器客户端（脚本/curl/测试）不带 Origin
  let originHost: string;
  try {
    originHost = new URL(origin).hostname;
  } catch {
    return false; // Origin 存在但无法解析 → 可疑，拒绝
  }
  // 同源：Origin 的 host（含端口）与 Host 头一致 → 放行
  if (hostHeader) {
    // Host 头形如 "example.com:8021" 或 "example.com"；Origin 的 host 亦含端口。
    const originHostPort = (() => { try { return new URL(origin).host; } catch { return ''; } })();
    if (originHostPort === hostHeader) return true;
    // 仅 hostname 匹配（端口差异，如代理改写端口）也视为同源
    const hostHeaderName = hostHeader.replace(/:\d+$/, '');
    if (originHost === hostHeaderName) return true;
  }
  // 兜底：loopback 始终可信
  return isLoopbackHost(originHost);
}

/**
 * Express 中间件：写删类文件接口的 drive-by 防护（安全关键）。
 *
 * 变更类接口（write/copy/move/delete/rename/create-*）能改用户磁盘。用户访问的
 * 恶意网页可从浏览器向本服务发跨源写请求（drive-by）。浏览器发起时自动带真实
 * Origin 头且 JS 无法伪造，故校验「同源」即可挡住外部网站的跨源写删（见
 * isTrustedOrigin）。同源/无 Origin/loopback 放行，跨源 403。
 */
export function verifyLocalOrigin(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { status(code: number): { json(body: unknown): void } },
  next: () => void,
): void {
  const pick = (h: string | string[] | undefined) => Array.isArray(h) ? h[0] : h;
  if (isTrustedOrigin(pick(req.headers['origin']), pick(req.headers['host']))) { next(); return; }
  res.status(403).json({ error: '跨源写操作被拒绝' });
}