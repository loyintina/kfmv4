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
 * - `capability-executor.ts` — AI 命令执行前调用 sanitizePath 校验
 * - `ai-tools.ts` — AI 工具函数中校验文件路径
 *
 * ## 环境变量
 * - `KFM_ROOT` — 项目根目录（可选，默认取 HOME）
 */

import path from 'path';
import fs from 'fs';

/** 根目录（环境变量或 HOME） */
export const ROOT_DIR = process.env.KFM_ROOT || process.env.HOME || '.';

/** 安全根目录：所有用户路径不得逃逸出此目录 */
export const SAFE_ROOT = path.resolve(ROOT_DIR) + path.sep;

/** KFM 数据目录：所有 .kfmv4/ 配置文件存储在此 */
export const KFM_DATA_DIR = path.join(ROOT_DIR, '.kfmv4');

/**
 * 路径校验：确保用户路径不逃逸出 SAFE_ROOT。返回 null 表示拒绝。
 *
 * 三层防护：
 *   1. 字符串层：path.resolve 后必须落在 SAFE_ROOT 内（挡 ../ 和绝对路径逃逸）。
 *   2. 符号链接层：对目标（或新建时的最深已存在祖先）做 realpath 解析真实位置，
 *      再次校验落在 SAFE_ROOT 内——挡 "SAFE_ROOT 内放一个指向 /etc/passwd 的软链"
 *      这类逃逸（path.resolve 是纯字符串运算，不跟随软链）。
 *   3. 敏感文件层：拒绝 .kfmv4/providers.json（含明文 API key）。
 *      其余 .kfmv4/ 子目录（sessions/roles/configs/active.json）是用户数据，正常读写。
 */
export function sanitizePath(userPath: string): string | null {
  const resolved = path.resolve(SAFE_ROOT, userPath);
  if (resolved !== SAFE_ROOT.slice(0, -1) && !resolved.startsWith(SAFE_ROOT)) return null;

  // 敏感文件：providers.json 含明文 API key，不对文件 API 开放。
  // 其余 .kfmv4/ 子目录（sessions/roles/configs/active.json）是用户内容，需正常读写。
  const dataReal = path.resolve(KFM_DATA_DIR);
  if (resolved === path.join(dataReal, 'providers.json')) return null;

  // 符号链接解析：找最深的已存在路径段做 realpath（新建文件时目标尚不存在，
  // 需对其父目录链解析，防止用软链目录把写入/读取重定向到 SAFE_ROOT 外）。
  let probe = resolved;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break; // 抵达根，停止
    probe = parent;
  }
  try {
    const real = fs.realpathSync(probe);
    if (real !== SAFE_ROOT.slice(0, -1) && !real.startsWith(SAFE_ROOT)) return null;
  } catch {
    return null; // realpath 失败（如断链）→ 拒绝
  }

  return resolved;
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