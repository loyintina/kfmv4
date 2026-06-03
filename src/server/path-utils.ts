/**
 * KFM v4 — 路径处理工具
 *
 * 共享的 SAFE_ROOT / sanitizePath，避免在多个文件中重复定义。
 */

import path from 'path';

/** 根目录（环境变量或 HOME） */
export const ROOT_DIR = process.env.KFM_ROOT || process.env.HOME || '.';

/** 安全根目录：所有用户路径不得逃逸出此目录 */
export const SAFE_ROOT = path.resolve(ROOT_DIR) + path.sep;

/** 路径校验：确保用户路径不逃逸出 SAFE_ROOT */
export function sanitizePath(userPath: string): string | null {
  const resolved = path.resolve(SAFE_ROOT, userPath);
  if (resolved !== SAFE_ROOT.slice(0, -1) && !resolved.startsWith(SAFE_ROOT)) return null;
  return resolved;
}
