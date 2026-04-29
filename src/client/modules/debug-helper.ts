// 调试助手 - 将日志写入全局数组，可通过 window.getDebugLogs() 获取
let debugLogs: string[] = [];
const MAX_LOGS = 50;

export function debugLog(...args: any[]): void {
  const time = new Date().toLocaleTimeString();
  const msg = args.map(a => a === null ? 'null' : a === undefined ? 'undefined' : String(a)).join(' ');\n  debugLogs.unshift('[' + time + '] ' + msg);
  if (debugLogs.length > MAX_LOGS) debugLogs.pop();
  console.log('[DEBUG]', msg); // 同时输出到 console
}

export function getDebugLogs(): string[] {
  return [...debugLogs];
}

// 挂载到 window 供外部调用
(window as any).getDebugLogs = getDebugLogs;
