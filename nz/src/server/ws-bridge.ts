/**
 * src/server/ws-bridge.ts — 终端 WS 桥（8.8.2③b）：把 term-connection 的
 * 传输无关会话管理接上网线。
 *
 * 设计锚点：连接家族（term-connection.ts）只管进程生死，本桥只做
 * 「帧 ↔ 方法」的翻译，一个字节的终端语义都不懂——桥可以随意换
 * （WS/SSE/轮询），会话层不动。
 *
 * 帧协议（JSON 文本帧；输出走文本帧，量产后视痛点再上二进制）：
 *   C→S  {t:'open', command?, cols?, rows?}      → {t:'opened', id}
 *        {t:'attach', id}                        → {t:'attached', id, tail}（重连补断档）
 *        {t:'input', id, data}
 *        {t:'resize', id, cols, rows}
 *        {t:'close', id}
 *        {t:'list'}                              → {t:'list', ids}（活会话名册）
 *        {t:'ping'}                              → {t:'pong'}（应用层心跳，浏览器发不了协议级 ping）
 *   S→C  {t:'output', id, data} / {t:'exit', id, code} / {t:'error', message}
 *
 * 权限：open 判定在 term-connection 层已挂（影子期落审计）；本桥不二次
 * 判定。转正期 enforce 在本桥边界生效（ask/deny 拦在这里）。
 *
 * 重连语义落实：socket 断开只退订输出，会话不死；客户端重连后
 * attach 同 id + tail 补断档。
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Context } from 'cordis';

type Msg =
  | { t: 'open'; command?: string; cols?: number; rows?: number }
  | { t: 'attach'; id: string }
  | { t: 'input'; id: string; data: string }
  | { t: 'resize'; id: string; cols: number; rows: number }
  | { t: 'close'; id: string }
  | { t: 'list' };

export function mountWsBridge(ctx: Context, server: Server, path = '/ws/term'): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if ((req.url ?? '').split('?')[0] !== path) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    /** 本连接订阅过的会话 → 退订函数（socket 断开统一退订，会话不死） */
    const subs = new Map<string, () => void>();
    const send = (m: Record<string, unknown>) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    };

    const subscribe = (id: string) => {
      if (subs.has(id)) return;
      const sess = ctx.termConn.attach(id);
      if (!sess) return;
      const offOut = sess.onOutput((data) => send({ t: 'output', id, data }));
      const offExit = sess.onExit((code) => {
        send({ t: 'exit', id, code });
        // 退订挪到 exit 之后：exit 帧发得出，订阅才收尸
        subs.get(id)?.();
        subs.delete(id);
      });
      subs.set(id, () => { offOut(); offExit(); });
    };

    ws.on('message', (raw: Buffer) => {
      let m: Msg;
      try {
        m = JSON.parse(raw.toString()) as Msg;
      } catch {
        send({ t: 'error', message: '帧不是 JSON' });
        return;
      }
      const conn = ctx.termConn;
      switch (m.t) {
        case 'open':
          void conn.open({ command: m.command, cols: m.cols, rows: m.rows }).then((s) => {
            subscribe(s.id);
            send({ t: 'opened', id: s.id });
          });
          break;
        case 'attach': {
          const sess = conn.attach(m.id);
          if (!sess) {
            send({ t: 'error', message: `会话不存在或已摘除：${m.id}` });
            break;
          }
          subscribe(m.id);
          send({ t: 'attached', id: m.id, tail: sess.replayTail() });
          break;
        }
        case 'input':
          conn.attach(m.id)?.sendInput(m.data);
          break;
        case 'resize':
          conn.attach(m.id)?.resize(m.cols, m.rows);
          break;
        case 'close':
          // 只杀会话；订阅留给 exit 回调收（否则 exit 帧发不出去）
          conn.attach(m.id)?.close();
          break;
        case 'list':
          send({ t: 'list', ids: conn.list() });
          break;
        // 应用层心跳（2026-08-31 僵尸页实锤：WS 会「悄悄死」无 close 事件；
        // 浏览器 WebSocket 发不了协议级 ping，只能应用层）——客户端看门狗
        // 靠 pong 判活，见 client/term/bridge.ts 心跳块。
        case 'ping':
          send({ t: 'pong' });
          break;
        default:
          send({ t: 'error', message: '未知帧型' });
      }
    });

    ws.on('close', () => {
      for (const off of subs.values()) off();
      subs.clear();
    });
  });

  ctx.effect(() => () => wss.close());
}
