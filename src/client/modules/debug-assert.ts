/**
 * debug-assert.ts — 运行时断言
 *
 * 在关键路径上检查架构不变量，违反时打印 console.error。
 * DEBUG 常开是有意决策（2026-07-29，client-shell#15 结案）：本应用是本地单用户
 * 应用，用户即开发者，断言日志就是 bug 上报通道，断言正常不触发、开销可忽略。
 * 注：debugger 语句已移除——它在 devtools 打开时会冻结页面，不得随包发布。
 */

const DEBUG = true;

export function assert(condition: boolean, message: string): void {
  if (DEBUG && !condition) {
    console.error(`[ASSERT FAILED] ${message}`);
  }
}

export function warn(message: string): void {
  if (DEBUG) {
    console.warn(`[WARN] ${message}`);
  }
}
