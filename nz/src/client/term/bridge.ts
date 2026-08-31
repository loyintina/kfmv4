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
  /** 会话死透（重连后服务端报「会话不存在」=服务端重启过，旧会话全灭）——
   *  消费方自愈（摘账+reload/重开），bridge 只清簿不决策 */
  onSessionDead?(reason: string): void;
  /** 链路假死（心跳 pong 超时：WS 无 close 事件但已零回显——2026-08-31
   *  僵尸页实锤的形态）。消费方自愈（reload，续命账保留），bridge 不决策 */
  onSilentDead?(reason: string): void;
}

export class TermWsBridge {
  private ws: WebSocket | null = null;
  /** 簿上会话（断线重连要重新 attach 的花名册） */
  private _sessions = new Set<string>();
  private _retry = 0;
  private _stopped = false;
  /** 心跳看门狗（2026-08-31 僵尸页实锤：WS 会「悄悄死」——无 close 事件、
   *  inject 零回显，页面还以为活着）。每 hbMs 发一帧应用层 ping（浏览器
   *  WebSocket 发不了协议级 ping），下一拍还没等到 pong=链路假死→报
   *  onSilentDead（一次，消费方自愈 reload）。只在 OPEN 态跳，close/重连
   *  期停摆；后台标签 setInterval 被节流=检测变慢但不缺席。 */
  private _hbTimer: ReturnType<typeof setInterval> | null = null;
  private _awaitingPong = false;
  private _silentDeadFired = false;
  /** open 等待方：socket 没连上时排队，连上后重放 */
  private _pending: Array<() => void> = [];
  /** opened 帧的等待队列（FIFO 配对 open 调用） */
  private _openWaiters: Array<(id: string) => void> = [];
  /** attach 等待表（id → resolver）：attachSession/热更续命用；
   *  error 帧无关联 id，pending 非空时统一判失败（boot 期单请求，够用） */
  private _attachWaiters = new Map<string, (ok: boolean) => void>();

  constructor(
    private _url: string,
    private _ev: BridgeEvents,
    /** 心跳间隔毫秒（测试可压短；生产默认 15s） */
    private _hbMs = 15000,
  ) {}

  connect(): void {
    if (this._stopped) return;
    const ws = new WebSocket(this._url);
    this.ws = ws;
    ws.onopen = () => {
      this._retry = 0;
      this._silentDeadFired = false;
      this._ev.onLink?.(true);
      this._startHb();
      for (const fn of this._pending.splice(0)) fn();
      // 重连：簿上会话逐个 attach，tail 补断档
      for (const id of this._sessions) {
        this._send({ t: 'attach', id });
      }
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as Record<string, unknown>;
      switch (m.t) {
        case 'pong':
          this._awaitingPong = false;
          break;
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
          this._attachWaiters.get(id)?.(true);
          this._attachWaiters.delete(id);
          break;
        }
        case 'output':
          this._ev.onOutput(String(m.id), String(m.data), false);
          break;
        case 'exit':
          this._ev.onExit(String(m.id), Number(m.code));
          break;
        case 'error': {
          console.warn('[term-bridge] 服务端报错帧：', m.message);
          // attach 失败（会话不存在等）：pending 统一判负（error 帧不带 id）；
          // 簿上还有会话却被告知不存在 = 服务端重启过（重连 attach 全灭）→
          // 通报消费方自愈（reload），bridge 清簿不决策
          if (this._attachWaiters.size) {
            for (const resolve of this._attachWaiters.values()) resolve(false);
            this._attachWaiters.clear();
          }
          const msg = String(m.message ?? '');
          if (msg.includes('会话不存在') && this._sessions.size > 0) {
            this._sessions.clear();
            this._ev.onSessionDead?.(msg);
          }
          break;
        }
      }
    };
    ws.onclose = () => {
      this._stopHb();
      this._ev.onLink?.(false);
      if (this._stopped) return;
      const delay = Math.min(500 * 2 ** this._retry++, 5000);
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  private _startHb(): void {
    this._stopHb();
    this._awaitingPong = false;
    this._hbTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      if (this._awaitingPong) {
        // 上一拍 ping 无 pong=链路假死。报一次即停跳：消费方 reload
        // 后页面整世重启；不消费则下个 open 重新起跳（防风暴）。
        this._stopHb();
        if (!this._silentDeadFired) {
          this._silentDeadFired = true;
          this._ev.onSilentDead?.('心跳 pong 超时（链路假死）');
        }
        return;
      }
      this._awaitingPong = true;
      this._send({ t: 'ping' });
    }, this._hbMs);
  }

  private _stopHb(): void {
    if (this._hbTimer) { clearInterval(this._hbTimer); this._hbTimer = null; }
    this._awaitingPong = false;
  }

  /** 停桥：不再重连，会话簿清空（插件 unload 用） */
  stop(): void {
    this._stopped = true;
    this._stopHb();
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

  /** 续命 attach（热更/重载后会话不断的关键件）：显式 attach 指定会话，
   *  成功=true（tail 已回放给 onOutput replay）；失败/超时=false。
   *  与重连路径的隐式 attach 区别：这里等回执判成败（boot 决策用）。 */
  attachSession(id: string, timeoutMs = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      this._attachWaiters.set(id, resolve);
      this._send({ t: 'attach', id });
      setTimeout(() => {
        if (this._attachWaiters.delete(id)) resolve(false);
      }, timeoutMs);
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
