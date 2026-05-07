/**
 * debug-assert.ts — 运行时断言
 *
 * 在关键路径上检查架构不变量。
 * DEBUG=true 时违反断言会打印 console.error。
 * 线上部署时设 DEBUG=false 即可零开销关闭。
 */

const DEBUG = true;

export function assert(condition: boolean, message: string): void {
  if (DEBUG && !condition) {
    console.error(`[ASSERT FAILED] ${message}`);
    // 在浏览器 devtools 中自动断点（打开控制台时生效）
    debugger;
  }
}

export function warn(message: string): void {
  if (DEBUG) {
    console.warn(`[WARN] ${message}`);
  }
}
