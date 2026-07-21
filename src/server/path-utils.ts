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
 *   3. 敏感区层：拒绝 .kfmv4/ 配置目录（含明文 API key 的 providers.json）。
 *      该目录的正当读取全部走服务端内部，从不经过 sanitizePath，故可安全拒绝。
 */
export function sanitizePath(userPath: string): string | null {
  const resolved = path.resolve(SAFE_ROOT, userPath);
  if (resolved !== SAFE_ROOT.slice(0, -1) && !resolved.startsWith(SAFE_ROOT)) return null;

  // 敏感区：.kfmv4/ 配置目录（含 API key）不对文件 API 开放
  const dataReal = path.resolve(KFM_DATA_DIR);
  if (resolved === dataReal || resolved.startsWith(dataReal + path.sep)) return null;

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
 * 判断 URL hostname 是否为本地回环。用于 WS 与文件写删接口的 Origin 校验。
 *
 * 注意 IPv6：`new URL('http://[::1]:80').hostname` 返回带方括号的 `[::1]`，
 * 故两种写法都接受。
 */
export function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

/**
 * Express 中间件：写删类文件接口的 drive-by 防护（安全关键）。
 *
 * 变更类接口（write/copy/move/delete/rename/create-*）能改用户磁盘。服务虽绑
 * 127.0.0.1，但用户访问的恶意网页可从浏览器向 http://localhost 发跨源写请求
 * （drive-by）。浏览器发起时会自动带上发起页面的真实 Origin 头，且 JS 无法伪造它，
 * 因此校验 Origin 为本地回环即可挡住外部网站的跨源写删。
 *
 * 放行规则（与 ws-server._verifyOrigin 一致）：
 *   - 无 Origin 头（非浏览器客户端：本地脚本/curl/测试）→ 放行
 *   - Origin 的 host 是 localhost / 127.0.0.1 / [::1] → 放行
 *   - 其余（任何外部网站）→ 403 拒绝
 */
export function verifyLocalOrigin(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { status(code: number): { json(body: unknown): void } },
  next: () => void,
): void {
  const originHeader = req.headers['origin'];
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (!origin) { next(); return; } // 非浏览器客户端不带 Origin
  try {
    if (isLoopbackHost(new URL(origin).hostname)) { next(); return; }
  } catch { /* 无法解析 → 落到下面拒绝 */ }
  res.status(403).json({ error: '跨源写操作被拒绝' });
}