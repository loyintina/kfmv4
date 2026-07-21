/**
 * KFM v4 — WebSocket 通信通道
 *
 * 服务端↔浏览器端双向实时通信。
 * 解决 §5.5 问题：Registry snapshot 在浏览器内存中，AI agent 在服务端需要获取。
 *
 * 职责：
 *   1. 接收浏览器端推送的 snapshot，存储在内存中
 *   2. 接收浏览器端推送的能力列表
 *   3. 向浏览器端转发操作指令（AI agent → UI操作）
 *   4. 心跳检测 + 断线清理
 *
 * 设计参见 docs/notes/WEBSOCKET_CHANNEL_PROPOSAL.md
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { PtyManager } from './terminal-pty.js';
import { isLoopbackHost } from './path-utils.js';
import { execFile } from 'child_process';

// ========== 类型定义 ==========

/** 浏览器端推上来的 PageDescription（简化定义，避免依赖客户端类型） */
interface PageDescription {
  elements: unknown[];
  content: unknown[];
  capabilities: unknown[];
  timestamp: number;
}

interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

interface ClientState {
  terminalSessions: Set<string>;
}

// ========== WsServer 类 ==========

export class WsServer {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, ClientState>();
  private _latestSnapshot: PageDescription | null = null;
  private _latestCapabilities: unknown[] | null = null;
  private _ptyManager: PtyManager;
  private _evalPending = new Map<string, { resolve(v: unknown): void; reject(e: Error): void }>();

  /**
   * WebSocket 握手 origin 校验（安全关键）。
   *
   * WS 端点提供终端 PTY（任意命令执行）。浏览器发起 WS 连接时会自动带上
   * 发起页面的真实 Origin 头，且 JS 无法伪造它——因此校验 Origin 为本地回环
   * 即可挡住"用户访问的恶意网页偷偷连 ws://localhost 拿 shell"的 drive-by 攻击。
   *
   * 放行规则：
   *   - 无 Origin 头（非浏览器客户端，如本地脚本/测试）→ 放行
   *   - Origin 的 host 是 localhost / 127.0.0.1 / [::1] → 放行
   *   - 其余（任何外部网站）→ 拒绝握手
   */
  private static _verifyOrigin(info: { origin?: string }): boolean {
    const origin = info.origin;
    if (!origin) return true; // 非浏览器客户端不带 Origin
    try {
      return isLoopbackHost(new URL(origin).hostname);
    } catch {
      return false; // Origin 存在但无法解析 → 可疑，拒绝
    }
  }

  constructor(server: HttpServer) {
    this._ptyManager = new PtyManager(
      (ws, sessionId, data) => this.send(ws, 'terminal-output', { sessionId, data }),
      (ws, sessionId, code)  => this.send(ws, 'terminal-exit', { sessionId, code }),
    );

    this.wss = new WebSocketServer({ server, path: '/ws', verifyClient: WsServer._verifyOrigin });

    this.wss.on('connection', (ws) => {
      console.log('[ws-server] 客户端已连接');
      this.clients.set(ws, { terminalSessions: new Set() });
      // 协议级心跳存活标记：每轮心跳前若上一轮的 pong 未回 → 判定为死连接
      (ws as WebSocket & { _isAlive?: boolean })._isAlive = true;
      ws.on('pong', () => { (ws as WebSocket & { _isAlive?: boolean })._isAlive = true; });

      // 发送欢迎消息
      this.send(ws, 'ack', { received: 'hello', version: '1.0' });

      ws.on('message', (raw) => {
        try {
          const msg: WsMessage = JSON.parse(raw.toString());
          this.handleMessage(ws, msg);
        } catch (e) {
          console.error('[ws-server] 消息解析失败:', e);
          this.send(ws, 'error', { message: '无效的 JSON 消息' });
        }
      });

      ws.on('close', () => {
        console.log('[ws-server] 客户端已断开');
        this._ptyManager.killAll(ws);
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[ws-server] 连接错误:', err.message);
        this._ptyManager.killAll(ws);
        this.clients.delete(ws);
      });
    });

    // 心跳检测：每 30s 一轮。用 WebSocket 协议级 ping/pong 检测真实存活——
    // 上一轮 ping 后没回 pong 的连接判定为死连接（半开：TCP 已断但无 FIN），
    // terminate 强制关闭并清理其 PTY。仅查 readyState 无法发现半开连接，
    // 会导致 tmux 输出写进死 socket → 卡住。
    const heartbeat = setInterval(() => {
      for (const [client] of this.clients) {
        const c = client as WebSocket & { _isAlive?: boolean };
        if (client.readyState !== WebSocket.OPEN) {
          this._ptyManager.killAll(client);
          this.clients.delete(client);
          continue;
        }
        if (c._isAlive === false) {
          // 上一轮没回 pong → 死连接，强制终止
          this._ptyManager.killAll(client);
          this.clients.delete(client);
          try { client.terminate(); } catch { /* ignore */ }
          continue;
        }
        c._isAlive = false;       // 标记待验证，收到 pong 会置回 true
        try { client.ping(); } catch { /* ignore */ }
        this.send(client, 'ping', null); // 兼容旧的应用层 ping（无害）
      }
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(heartbeat);
    });

    console.log('[ws-server] WebSocket 服务已启动 (path: /ws)');
  }

  /** 处理收到的消息 */
  private handleMessage(ws: WebSocket, msg: WsMessage): void {
    switch (msg.type) {
      case 'hello':
        console.log('[ws-server] 收到客户端 hello:', msg.payload);
        this.send(ws, 'ack', { received: 'hello' });
        break;

      case 'snapshot':
        this._latestSnapshot = msg.payload as PageDescription;
        this.send(ws, 'ack', { received: 'snapshot', timestamp: (msg.payload as PageDescription).timestamp });
        break;

      case 'capabilities':
        this._latestCapabilities = msg.payload as unknown[];
        this.send(ws, 'ack', { received: 'capabilities' });
        break;

      // 终端 PTY 会话（terminal-open → PtyManager.spawn）
      case 'terminal-open': {
        const p = msg.payload as { cwd?: string; command?: string; tag?: string };
        try {
          const sessionId = this._ptyManager.spawn(ws, p.cwd, p.command);
          const client = this.clients.get(ws);
          if (client) client.terminalSessions.add(sessionId);
          this.send(ws, 'terminal-opened', { sessionId, tag: p.tag });
        } catch (e: any) {
          this.send(ws, 'error', { message: 'PTY spawn failed: ' + (e?.message || String(e)) });
        }
        break;
      }

      case 'terminal-input': {
        const p = msg.payload as { sessionId: string; input: string };
        this._ptyManager.write(p.sessionId, p.input);
        break;
      }

      case 'terminal-resize': {
        const p = msg.payload as { sessionId: string; cols: number; rows: number };
        this._ptyManager.resize(p.sessionId, p.cols, p.rows);
        break;
      }

      case 'terminal-close': {
        const p = msg.payload as { sessionId: string };
        this._ptyManager.kill(p.sessionId);
        const client = this.clients.get(ws);
        if (client) client.terminalSessions.delete(p.sessionId);
        break;
      }

      case 'tmux-cmd': {
        const p = msg.payload as { cmd: string; args: string[] };
        if (p.cmd !== 'list-sessions') { this.send(ws, 'tmux-result', { cmd: p.cmd, result: { stdout: '', stderr: 'unknown command', exitCode: 1 } }); break; }

        execFile('tmux', ['list-sessions', '-F', '#S'], { timeout: 5000 }, (err, stdout, stderr) => {
          this.send(ws, 'tmux-result', {
            cmd: p.cmd,
            result: { stdout: stdout || '', stderr: stderr || '', exitCode: (err as { code?: string | number } | null)?.code ?? (err ? 1 : 0) },
          });
        });
        break;
      }

      case 'browser-eval-result': {
        const p = msg.payload as { id: string; result?: unknown; error?: string };
        const pending = this._evalPending.get(p.id);
        if (pending) {
          this._evalPending.delete(p.id);
          if (p.error !== undefined) pending.reject(new Error(p.error));
          else pending.resolve(p.result);
        }
        break;
      }

      default:
        console.warn('[ws-server] 未知消息类型:', msg.type);
        this.send(ws, 'error', { message: `未知消息类型: ${msg.type}` });
    }
  }

  /** 向单个客户端发送消息 */
  private send(ws: WebSocket, type: string, payload: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const msg: WsMessage = { type, payload, timestamp: Date.now() };
    ws.send(JSON.stringify(msg));
  }

  /** 广播给所有已连接客户端 */
  broadcast(type: string, payload: unknown): void {
    const msg: WsMessage = { type, payload, timestamp: Date.now() };
    const data = JSON.stringify(msg);
    for (const [client] of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /** 向所有客户端发送操作指令（AI → UI） */
  sendCommand(action: string, params: Record<string, unknown>): void {
    this.broadcast('command', { action, params, id: crypto.randomUUID() });
  }

  /** 获取最新的 snapshot（AI agent 查询用） */
  getLatestSnapshot(): PageDescription | null {
    return this._latestSnapshot;
  }

  /** 获取最新的能力列表 */
  getLatestCapabilities(): unknown[] | null {
    return this._latestCapabilities;
  }

  /** 当前连接数 */
  get connectionCount(): number {
    return this.clients.size;
  }

  /** 在连接的浏览器里执行 JS，返回结果（用于 AI 工具 browser_eval） */
  evalInBrowser(code: string, timeoutMs = 10_000): Promise<unknown> {
    if (this.clients.size === 0) return Promise.reject(new Error('没有已连接的浏览器'));
    const id = crypto.randomUUID();
    let resolve!: (v: unknown) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
    const timer = setTimeout(() => {
      this._evalPending.delete(id);
      reject(new Error(`browser_eval 超时（${timeoutMs}ms）`));
    }, timeoutMs);
    this._evalPending.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject:  (e) => { clearTimeout(timer); reject(e); },
    });
    this.broadcast('browser-eval', { id, code });
    return promise;
  }

  /** 关闭 WebSocket 服务 */
  close(): void {
    this.wss.close();
  }
}
