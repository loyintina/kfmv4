/**
 * cdp-connection.ts — Node.js CDP 调试连接层
 *
 * 基于 Node.js 22 自带的 inspector 协议（Chrome DevTools Protocol）。
 * 不使用外部 DAP 适配器，直接在进程内通过 WebSocket 连接调试目标。
 *
 * 两种工作模式：
 *   launch — 启动子进程，用 --inspect-brk 暂停在第一行，连入 CDP
 *   attach  — 连入已有进程的 inspector 端口（本机或远程）
 *
 * CDP 域：Debugger、Runtime（核心 17 个操作所需）
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { WebSocket } from 'ws';

// ========== 类型 ==========

export interface CdpSession {
  ws: WebSocket;
  child?: ChildProcess;
  msgId: number;
  pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  callbacks: Map<string, (params: unknown) => void>;
  pausedCallFrames?: unknown[];
}

export interface CdpLaunchOptions {
  program: string;          // 要调试的程序路径（.js 或 .mjs）
  args?: string[];           // 程序参数
  cwd?: string;              // 工作目录
  env?: Record<string, string>; // 额外环境变量
  port?: number;             // inspector 端口，默认 0（自动分配）
}

export interface CdpAttachOptions {
  host: string;
  port: number;
}

// CDP 命令返回类型
export interface CdpPausedEvent {
  callFrames: Array<{
    callFrameId: string;
    functionName: string;
    location: { scriptId: string; lineNumber: number; columnNumber: number };
    scopeChain: Array<{
      type: string;
      object: { objectId?: string; type: string; description: string };
    }>;
  }>;
  reason: string;
}

// ========== 连接层 ==========

/**
 * 连接到 CDP 端点（WebSocket URL 或 host:port）
 */
function connectCdp(
  wsUrlOrOptions: string | { host: string; port: number }
): Promise<CdpSession> {
  return new Promise((resolve, reject) => {
    const wsUrl = typeof wsUrlOrOptions === 'string'
      ? wsUrlOrOptions
      : `ws://${wsUrlOrOptions.host}:${wsUrlOrOptions.port}`;

    const ws = new WebSocket(wsUrl);
    const session: CdpSession = {
      ws,
      msgId: 1,
      pending: new Map(),
      callbacks: new Map(),
    };

    ws.on('open', () => {
      // 启用 Debugger 域
      sendCmd(session, 'Debugger.enable').then(() => {
        // 启用 Runtime 域
        sendCmd(session, 'Runtime.enable').then(() => {
          resolve(session);
        }).catch(reject);
      }).catch(reject);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        // 检查是不是事件（method: 'Debugger.paused'）
        if (msg.method) {
          const cb = session.callbacks.get(msg.method);
          if (cb) cb(msg.params);
          return;
        }
        // 检查是不是命令响应
        if (msg.id) {
          const pending = session.pending.get(msg.id);
          if (pending) {
            session.pending.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(msg.error.message));
            } else {
              pending.resolve(msg.result);
            }
          }
        }
      } catch {
        // 非 JSON 消息（二进制数据），忽略
      }
    });

    ws.on('error', reject);
    ws.on('close', () => {
      // 清理所有待处理的 Promise
      for (const p of session.pending.values()) {
        p.reject(new Error('CDP connection closed'));
      }
      session.pending.clear();
    });
  });
}

/**
 * 发送 CDP 命令并等待响应
 */
export function sendCmd(session: CdpSession, method: string, params?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = session.msgId++;
    session.pending.set(id, { resolve, reject });
    session.ws.send(JSON.stringify({ id, method, params }));
  });
}

/**
 * 注册 CDP 事件回调
 */
export function onCdpEvent(session: CdpSession, method: string, cb: (params: unknown) => void): void {
  session.callbacks.set(method, cb);
}

/**
 * 启动模式：启动子进程 + 获取 WebSocket inspector URL
 */
export function launchCdp(opts: CdpLaunchOptions): Promise<CdpSession> {
  return new Promise((resolve, reject) => {
    const port = opts.port || 0;
    const inspectFlag = `--inspect-brk=${port === 0 ? '' : port}`;

    const args = [inspectFlag];
    if (opts.args?.length) args.push(...opts.args);

    const child = spawn(process.execPath, [...args, opts.program], {
      cwd: opts.cwd || process.cwd(),
      env: { ...process.env, ...opts.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let wsUrl = '';
    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error(`launch timeout: no inspector URL from child process (got: ${output.slice(0, 200)})`));
    }, 10000);

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;

      // 从 stderr 中解析 inspector URL：
      // "Debugger listening on ws://127.0.0.1:9229/..."
      const match = text.match(/Debugger listening on (ws:\/\/[^\s]+)/);
      if (match) {
        wsUrl = match[1];
        clearTimeout(timeout);

        // 连接 CDP
        connectCdp(wsUrl).then(session => {
          session.child = child;
          resolve(session);
        }).catch(reject);
      }
    };

    child.stderr?.on('data', onData);
    child.stdout?.on('data', onData);

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (!wsUrl) {
        reject(new Error(`Process exited with code ${code} before debugger started`));
      }
    });
  });
}

/**
 * 附加模式：连接到已有进程的 CDP WebSocket
 */
export function attachCdp(opts: CdpAttachOptions): Promise<CdpSession> {
  // 先通过 HTTP 获取 WebSocket URL
  return new Promise((resolve, reject) => {
    const http = require('node:http');
    const url = `http://${opts.host}:${opts.port}/json/list`;

    http.get(url, (res: { on: (e: string, cb: (d: Buffer) => void) => void }) => {
      let body = '';
      res.on('data', (d: Buffer) => { body += d.toString(); });
      res.on('end', () => {
        try {
          const targets = JSON.parse(body) as Array<{ webSocketDebuggerUrl: string }>;
          if (!targets.length) {
            reject(new Error('No debug targets found'));
            return;
          }
          const wsUrl = targets[0].webSocketDebuggerUrl;
          if (!wsUrl) {
            reject(new Error('Target has no WebSocket debugger URL'));
            return;
          }
          connectCdp(wsUrl).then(resolve).catch(reject);
        } catch (e) {
          reject(new Error(`Failed to parse targets: ${body.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 关闭 CDP 会话
 */
export function closeCdp(session: CdpSession): void {
  if (session.child) {
    try { session.child.kill(); } catch { /* 子进程可能已退出 */ }
  }
  try { session.ws.close(); } catch { /* 可能已关闭 */ }
}
