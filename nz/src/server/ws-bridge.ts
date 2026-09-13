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
import { TmuxControl, listSessions, tmuxSessionCmd } from './tmux-connection.js';
import { onPoolChanged, type PoolChangedEvent } from './pool/bus.ts';
import { onNotify } from './notify.ts';

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
  | { t: 'tmux-cmd'; session: string; cmd: string }
  | { t: 'tmux-sessions-open' }
  | { t: 'tmux-grid-pin'; cols: number; rows: number; sessions?: string[] }
  | { t: 'tmux-session-new'; name: string }
  | { t: 'tmux-session-kill'; name: string }
  | { t: 'pool-watch' }; // 配置池 A2a：订阅 pool/changed 推送（§1.6，多路复用同桥）

export function mountWsBridge(ctx: Context, server: Server, path = '/ws/term'): void {
  const wss = new WebSocketServer({ noServer: true });

  // pool/changed 广播腿（配置池 A2a §1.6）：池数据层 emit → 订阅过的连接
  // 收 {t:'pool-changed'} 帧。订阅制（pool-watch 开关）与 tmux-sessions 同款
  // ——纯终端连接不被池事件打扰。
  const poolWatchers = new Set<{ send: (m: Record<string, unknown>) => void }>();
  const offPoolChanged: () => void = onPoolChanged((ev: PoolChangedEvent) => {
    for (const w of poolWatchers) w.send({ t: 'pool-changed', pool: ev.pool, id: ev.id, op: ev.op });
  });

  // R3 通知广播腿（2026-09-09 判据稿）：__tmux-notify/alert-bell 两源经
  // NotifyGate 节流后从这里推给每条连接；连接断开在各自 close 里退订
  const offNotify = onNotify((session, kind, message) => {
    for (const w of [...clients]) w.send({ t: 'notify', session, kind, message });
  });
  const clients = new Set<{ send: (m: Record<string, unknown>) => void }>();

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
    /** 会话表轮询器（0902 标签=会话；变化才推，3s 一拍） */
    let sessionsTimer: ReturnType<typeof setInterval> | undefined;
    let sessionsSig = '';
    const me = { send: (m: Record<string, unknown>) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); } };
    clients.add(me);
    const send = me.send;
    /** pool-watch 订阅票（§1.6）：进 poolWatchers 后才收 pool-changed 帧 */
    const watcher = { send };
    const sessionsTick = async (): Promise<void> => {
      const sessions = await listSessions();
      const sig = JSON.stringify(sessions);
      if (sig !== sessionsSig) { sessionsSig = sig; send({ t: 'tmux-sessions', sessions }); }
    };

    const subscribe = (id: string) => {
      if (subs.has(id)) return;
      const sess = ctx.termConn.attach(id);
      if (!sess) return;
      // R3-reaper 订阅记账：有人看=存活宽限持续刷新（退订/exit 双路扣减，幂等）
      ctx.termConn.subscriberAdd(id);
      const offOut = sess.onOutput((data) => send({ t: 'output', id, data }));
      const offExit = sess.onExit((code) => {
        send({ t: 'exit', id, code });
        // 退订挪到 exit 之后：exit 帧发得出，订阅才收尸
        ctx.termConn.subscriberRemove(id);
        subs.get(id)?.();
        subs.delete(id);
      });
      subs.set(id, () => { offOut(); offExit(); ctx.termConn.subscriberRemove(id); });
    };

    ws.on('message', (raw: Buffer): void => {
      void (async () => {
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
        // 主世界格网钉窗（2026-09-13 点阵案）：manual 窗跟随主格网——
        // 卡片格网是唯一权威，会话窗统一 manual+resize；窗与卡等大
        // 则 tmux 的「客户端>窗」填充点阵永不出现。sessions 缺省=全部
        // 会话；显式列表=只钉声明范围（考卷/多线共存时的防波及闸）。钳位防灌
        case 'tmux-grid-pin': {
          const cols = Math.max(20, Math.min(300, Math.round(m.cols)));
          const rows = Math.max(10, Math.min(200, Math.round(m.rows)));
          const sessions = Array.isArray(m.sessions) && m.sessions.length
            ? m.sessions.slice(0, 32).map((s: unknown) => String(s).slice(0, 64))
            : await listSessions();
          void (async () => {
            for (const s of sessions) {
              const o = await tmuxSessionCmd(['set-window-option', '-t', s, 'window-size', 'manual']);
              if (!o.ok) continue;
              await tmuxSessionCmd(['resize-window', '-t', s, '-x', String(cols), '-y', String(rows)]);
            }
          })();
          break;
        }
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
        // 会话表（0902 标签=会话）：开轮询（幂等）+会话级管理命令。
        // 命令完成后立刻补一拍，不等下个 3s 周期。
        case 'tmux-sessions-open': {
          if (sessionsTimer) break; // 幂等
          void sessionsTick();
          sessionsTimer = setInterval(() => { void sessionsTick(); }, 3000);
          break;
        }
        // pool/changed 订阅（配置池 A2a §1.6）：幂等入列；断线 close 统一清
        case 'pool-watch': {
          poolWatchers.add(watcher);
          break;
        }
        case 'tmux-session-new': {
          const name = m.name.trim().slice(0, 64);
          if (!name || /[.:]/.test(name)) { send({ t: 'error', message: `会话名非法：${name}` }); break; }
          const r = await tmuxSessionCmd(['new-session', '-d', '-s', name]);
          if (!r.ok) send({ t: 'error', message: `new-session 失败：${r.err}` });
          await sessionsTick();
          break;
        }
        case 'tmux-session-kill': {
          const name = m.name.trim().slice(0, 64);
          const r = await tmuxSessionCmd(['kill-session', '-t', name]);
          if (!r.ok) send({ t: 'error', message: `kill-session 失败：${r.err}` });
          await sessionsTick();
          break;
        }
        default:
          send({ t: 'error', message: '未知帧型' });
      }
      })();
    });

    ws.on('close', () => {
      for (const off of subs.values()) off();
      subs.clear();
      for (const c of tmuxes.values()) c.close();
      tmuxes.clear();
      poolWatchers.delete(watcher);
      clients.delete(me);
      if (sessionsTimer) { clearInterval(sessionsTimer); sessionsTimer = undefined; }
    });
  });

  ctx.effect(() => () => { offPoolChanged(); offNotify(); wss.close(); });
}
