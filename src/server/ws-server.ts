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

// ========== WsServer 类 ==========

export class WsServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private _latestSnapshot: PageDescription | null = null;
  private _latestCapabilities: unknown[] | null = null;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      console.log('[ws-server] 客户端已连接');
      this.clients.add(ws);

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
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('[ws-server] 连接错误:', err.message);
        this.clients.delete(ws);
      });
    });

    // 心跳检测：每 30s ping 所有连接
    const heartbeat = setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          this.send(client, 'ping', null);
        } else {
          this.clients.delete(client);
        }
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
    for (const client of this.clients) {
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

  /** 关闭 WebSocket 服务 */
  close(): void {
    this.wss.close();
  }
}
