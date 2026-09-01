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
import { TmuxControl } from './tmux-connection.js';

type Msg =
  | { t: 'open'; command?: string; cols?: number; rows?: number }
  | { t: 'attach'; id: string }
  | { t: 'input'; id: string; data: string }
  | { t: 'resize'; id: string; cols: number; rows: number }
  | { t: 'close'; id: string }
  | { t: 'list' }
  | { t: 'tmux-open'; session: string }
  | { t: 'tmux-select'; session: string; id: string }
  | { t: 'tmux-close'; session: string }
  | { t: 'tmux-cmd'; session: string; cmd: string };

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
    /** 本连接开的 tmux 控制通道（socket 断开统一收尸，session 不死） */
    const tmuxes = new Map<string, TmuxControl>();
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
        // tmux 控制通道开门（宪法 §6 Step 2）：一连接一通道，state 推送
        // 由 TmuxControl 的 debounce 刷新驱动；socket 断开统一收尸
        // （close 只杀控制客户端，session 不死——tmux-connection ④钉）。
        case 'tmux-open': {
          if (tmuxes.has(m.session)) break; // 幂等：重复 open 不另开通道
          const open = (ctx as unknown as { tmuxControlOpen?: (o: { session: string }) => TmuxControl }).tmuxControlOpen;
          if (!open) { send({ t: 'error', message: 'tmux 服务未挂载' }); break; }
          const c = open({ session: m.session });
          tmuxes.set(m.session, c);
          c.onChange(() => send({ t: 'tmux-state', session: m.session, windows: c.state().windows }));
          c.onExit(() => send({ t: 'tmux-exit', session: m.session }));
          break;
        }
        case 'tmux-select':
          tmuxes.get(m.session)?.selectWindow(m.id);
          break;
        case 'tmux-cmd': {
          // 控制通道裸命令透传（标签条 new-window/kill-window/automatic-
          // rename 等管理动作）；长度封顶防灌，命令合法性由 tmux 裁决
          const cmd = m.cmd.slice(0, 200);
          tmuxes.get(m.session)?.send(cmd);
          break;
        }
        case 'tmux-close': {
          const c = tmuxes.get(m.session);
          if (c) { tmuxes.delete(m.session); c.close(); }
          break;
        }
        default:
          send({ t: 'error', message: '未知帧型' });
      }
    });

    ws.on('close', () => {
      for (const off of subs.values()) off();
      subs.clear();
      for (const c of tmuxes.values()) c.close();
      tmuxes.clear();
    });
  });

  ctx.effect(() => () => wss.close());
}
