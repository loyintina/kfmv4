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