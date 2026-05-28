/**
 * logger.ts — KFM 日志系统
 *
 * 唯一日志收集/分发入口。不主动记录任何日志，只等待外部调用 log()。
 * 卡片通过 getLogs() 读取历史日志，通过 onLog() 订阅实时更新。
 *
 * 将来插件系统搭好后，此文件将迁入 cards/plugins/debug-card/logger.ts
 * （目前 tsconfig rootDir 限制阻止从 src/ 外 import）。
 */
type LogSubscriber = (logs: string[]) => void;

const MAX_LOG_LINES = 200;
const _logs: string[] = [];
const _subs: Set<LogSubscriber> = new Set();

function _fmt(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

/** 追加一条日志 */
export function log(msg: string): void {
  _logs.push(`[${_fmt()}] ${msg}`);
  if (_logs.length > MAX_LOG_LINES) _logs.shift();
  const snapshot = [..._logs];
  _subs.forEach(cb => { try { cb(snapshot); } catch { /* 安全的订阅者清理 */ } });
}

/** 读取当前全部日志（快照） */
export function getLogs(): string[] {
  return [..._logs];
}

/** 清空日志 */
export function clearLogs(): void {
  _logs.length = 0;
  const empty: string[] = [];
  _subs.forEach(cb => { try { cb(empty); } catch { /* noop */ } });
}

/** 复制日志到剪贴板（单行模式，换行 → 箭头） */
export function copyLogs(): void {
  const text = _logs.join('\n');
  const singleLine = text.replace(/\n/g, ' → ');
  navigator.clipboard.writeText(singleLine).catch(() => {
    /* 剪贴板不可用时静默失败 */
  });
}

/** 订阅日志更新。返回取消订阅函数。 */
export function onLog(cb: LogSubscriber): () => void {
  _subs.add(cb);
  return () => { _subs.delete(cb); };
}
