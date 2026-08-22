/**
 * src/client/term/bridge.ts — 终端 WS 桥客户端（8.8.2③c）。
 *
 * 与服务端 ws-bridge.ts 的帧协议镜像（见彼文件头注释）。职责只有
 * 「帧 ↔ 调用」翻译 + 断线重连（attach + tail 补断档）——终端语义
 * 一字节不懂（语义在 TermCore/解析核，会话生死在服务端连接家族）。
 *
 * 重连策略 v1：socket 意外断开 → 指数退避重连（0.5s 起封顶 5s），
 * 连上后对簿上每个会话发 attach，tail 回放补断档期输出。
 */
export interface BridgeEvents {
  /** 会话输出（含 attach 的 tail 回放——回放帧 replay=true） */
  onOutput(id: string, data: string, replay: boolean): void;
  onExit(id: string, code: number): void;
  /** 链路状态（UI 亮灯用） */
  onLink?(up: boolean): void;
}

export class TermWsBridge {
  private ws: WebSocket | null = null;
  /** 簿上会话（断线重连要重新 attach 的花名册） */
  private _sessions = new Set<string>();
  private _retry = 0;
  private _stopped = false;
  /** open 等待方：socket 没连上时排队，连上后重放 */
  private _pending: Array<() => void> = [];
  /** opened 帧的等待队列（FIFO 配对 open 调用） */
  private _openWaiters: Array<(id: string) => void> = [];

  constructor(
    private _url: string,
    private _ev: BridgeEvents,
  ) {}

  connect(): void {
    if (this._stopped) return;
    const ws = new WebSocket(this._url);
    this.ws = ws;
    ws.onopen = () => {
      this._retry = 0;
      this._ev.onLink?.(true);
      for (const fn of this._pending.splice(0)) fn();
      // 重连：簿上会话逐个 attach，tail 补断档
      for (const id of this._sessions) {
        this._send({ t: 'attach', id });
      }
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as Record<string, unknown>;
      switch (m.t) {
        case 'opened': {
          const id = String(m.id);
          this._sessions.add(id);
          this._openWaiters.shift()?.(id);
          break;
        }
        case 'attached': {
          const id = String(m.id);
          this._sessions.add(id);
          const tail = String(m.tail ?? '');
          if (tail) this._ev.onOutput(id, tail, true);
          break;
        }
        case 'output':
          this._ev.onOutput(String(m.id), String(m.data), false);
          break;
        case 'exit':
          this._ev.onExit(String(m.id), Number(m.code));
          break;
        case 'error':
          console.warn('[term-bridge] 服务端报错帧：', m.message);
          break;
      }
    };
    ws.onclose = () => {
      this._ev.onLink?.(false);
      if (this._stopped) return;
      const delay = Math.min(500 * 2 ** this._retry++, 5000);
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  /** 停桥：不再重连，会话簿清空（插件 unload 用） */
  stop(): void {
    this._stopped = true;
    this.ws?.close();
    this._sessions.clear();
  }

  private _send(m: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else this._pending.push(() => this._send(m));
  }

  /** 开会话：opened 帧 FIFO 配对回 sessionId（连不上先排队，连上重放） */
  open(opts: { command?: string; cols?: number; rows?: number } = {}): Promise<string> {
    return new Promise((resolve) => {
      this._openWaiters.push(resolve);
      this._send({ t: 'open', ...opts });
    });
  }

  input(id: string, data: string): void {
    this._send({ t: 'input', id, data });
  }

  resize(id: string, cols: number, rows: number): void {
    this._send({ t: 'resize', id, cols, rows });
  }

  close(id: string): void {
    this._send({ t: 'close', id });
    this._sessions.delete(id);
  }

  get sessionIds(): readonly string[] {
    return [...this._sessions];
  }
}
