
/**
 * KFM v4 — WebSocket 客户端通道
 *
 * 浏览器端 ↔ 服务端双向实时通信通道。
 * 职责：
 *   1. 连接服务端 WebSocket
 *   2. 自动推送 Registry snapshot 到服务端（通过 Registry.onChange + KFMState.subscribe）
 *   3. 自动推送能力列表到服务端
 *   4. 接收并派发服务端指令（AI → UI 操作）
 *   5. 断线自动重连（指数退避）
 *
 * 使用方式：
 *   import { initWsChannel } from './ws-channel.js';
 *   initWsChannel();
 *
 * 设计参见 docs/notes/WEBSOCKET_CHANNEL_PROPOSAL.md
 */

import { Registry } from './ui-registry.js';
import { KFMState } from './state.js';

// ========== 配置 ==========

const RECONNECT_BASE_MS = 1000;   // 初始重连间隔
const RECONNECT_MAX_MS = 30000;   // 最大重连间隔
const PUSH_DEBOUNCE_MS = 100;     // snapshot 推送防抖间隔

// ========== 类型定义 ==========

interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

type CommandHandler = (action: string, params: Record<string, unknown>) => void;

// ========== WsChannel 类 ==========

class WsChannel {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private _closed = false;
  private commandHandlers = new Map<string, CommandHandler>();

  /** 是否已连接 */
  get connected(): boolean {
    return this._connected;
  }

  /** 连接 WebSocket */
  connect(): void {
    if (this._closed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // hostname:port
    const url = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error('[ws-channel] 创建 WebSocket 失败:', e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[ws-channel] 已连接到服务端', url);
      this._connected = true;
      this.reconnectDelay = RECONNECT_BASE_MS;

      // 发送 hello
      this.send('hello', { version: '1.0', userAgent: navigator.userAgent });

      // 连接后立即推送当前状态
      this.pushSnapshot();
      this.pushCapabilities();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.error('[ws-channel] 消息解析失败:', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[ws-channel] 连接已关闭 (code: ${event.code})`);
      this._connected = false;
      this.ws = null;
      if (!this._closed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      console.error('[ws-channel] 连接错误');
      // onclose 会被自动调用，触发重连
    };
  }

  /** 断开连接（不再重连） */
  disconnect(): void {
    this._closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  /** 注册命令处理器（供各模块注册它们能处理的指令） */
  onCommand(action: string, handler: CommandHandler): void {
    this.commandHandlers.set(action, handler);
  }

  /** 取消注册命令处理器 */
  offCommand(action: string): void {
    this.commandHandlers.delete(action);
  }

  /** 推送当前 snapshot 到服务端（带防抖） */
  pushSnapshot(): void {
    if (this.pushTimer) return; // 防抖：已有待推送，跳过
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      if (!this._connected || !this.ws) return;
      const snapshot = Registry.snapshot();
      this.send('snapshot', snapshot);
    }, PUSH_DEBOUNCE_MS);
  }

  /** 推送能力列表到服务端 */
  pushCapabilities(): void {
    if (!this._connected || !this.ws) return;
    const caps = Registry.getCapabilities();
    if (caps.length > 0) {
      this.send('capabilities', caps);
    }
  }

  /** 发送消息 */
  private send(type: string, payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: WsMessage = { type, payload, timestamp: Date.now() };
    this.ws.send(JSON.stringify(msg));
  }

  /** 处理收到的服务端消息 */
  private handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'ack':
        // 确认收到——不需要处理
        break;

      case 'ping':
        // 心跳——不需要回复，WebSocket 的 ping/pong 由底层处理
        break;

      case 'command': {
        const cmd = msg.payload as { action: string; params: Record<string, unknown>; id: string };
        const handler = this.commandHandlers.get(cmd.action);
        if (handler) {
          handler(cmd.action, cmd.params);
        } else {
          console.warn('[ws-channel] 未注册的命令处理器:', cmd.action, '- 可用处理器:', [...this.commandHandlers.keys()]);
        }
        break;
      }

      case 'error':
        console.warn('[ws-channel] 服务端错误:', msg.payload);
        break;

      default:
        console.warn('[ws-channel] 未知消息类型:', msg.type);
    }
  }

  /** 调度重连（指数退避） */
  private scheduleReconnect(): void {
    if (this._closed) return;
    if (this.reconnectTimer) return; // 已有重连计划

    console.log(`[ws-channel] ${this.reconnectDelay}ms 后重连...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // 指数退避，上限 30s
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }
}

// ========== 全局单例 ==========

export const wsChannel = new WsChannel();

// ========== 初始化 ==========

/**
 * 初始化 WebSocket 通道。
 * 页面加载后自动连接，并挂载 snapshot 推送钩子。
 *
 * 需在 Registry 注册完成后调用（通常在 main.ts 中，所有 init*() 之后）。
 */
export function initWsChannel(): void {
  // 连接服务端
  wsChannel.connect();

  // 通过 Registry.onChange 监听 Registry 内容变化（注册/注销/能力变更），自动推送
  Registry.onChange((changeType) => {
    if (changeType === 'capability') {
      wsChannel.pushCapabilities();
    }
    wsChannel.pushSnapshot();
  });

  // 通过 KFMState.subscribe 监听状态层变化（展开折叠/隐藏文件开关等），自动推送 snapshot
  // 此订阅放在通信层（ws-channel）而非 Registry 自身，保持 Registry 的被动索引性质
  KFMState.subscribe(() => wsChannel.pushSnapshot());

  // 注册默认指令处理器（各模块可以覆盖或补充）
  registerDefaultCommandHandlers();
  console.log('[ws-channel] 初始化完成');
}
/** 注册默认的 AI 操作指令处理器。
 * 这些处理器将服务端发来的操作指令映射到具体的前端函数。
 * 各模块可以调用 wsChannel.onCommand() 注册更多处理器。
 */
function registerDefaultCommandHandlers(): void {
  // 点击元素
  wsChannel.onCommand('click', (_action, params) => {
    const elementId = params.elementId as string;
    if (!elementId) {
      console.warn('[ws-channel] click 指令缺少 elementId');
      return;
    }
    console.log('[ws-channel] AI 指令: 点击', elementId);
    // 优先通过 data-registry-id 查找
    let element = document.querySelector(`[data-registry-id="${elementId}"]`);
    // fallback: 尝试通过 HTML id 查找
    if (!element) {
      element = document.getElementById(elementId);
    }
    if (element instanceof HTMLElement) {
      element.click();
    } else {
      console.warn('[ws-channel] 未找到可点击的元素:', elementId);
    }
  });

  // 设置输入框值
  wsChannel.onCommand('set-input', (_action, params) => {
    const { elementId, value } = params as { elementId: string; value: string };
    console.log('[ws-channel] AI 指令: 设置输入', elementId, '=', value);
    const element = document.querySelector(`[data-registry-id="${elementId}"]`) as HTMLInputElement | null;
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // 执行文件搜索
  wsChannel.onCommand('file-search', async (_action, params) => {
    const pattern = params.pattern as string;
    if (!pattern) return;
    console.log('[ws-channel] AI 指令: 文件搜索', pattern);
    try {
      const resp = await fetch('/api/files/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: KFMState.currentRoot || '/', showHidden: true }),
      });
      const data = await resp.json();
      console.log('[ws-channel] 文件搜索结果:', data);
    } catch (e) {
      console.error('[ws-channel] 文件搜索失败:', e);
    }
  });

  // 触发 snapshot 刷新
  wsChannel.onCommand('refresh-snapshot', () => {
    wsChannel.pushSnapshot();
  });
}
