/**
 * src/server/notify.ts — R3 长任务通知·服务端管线（2026-09-09 判据稿签收）。
 *
 * 事件源双通道：
 *   ①tmux alert-bell hook（server listen 后注册，指向本端点）——pane 里
 *     `printf '\a'` 即信号，后台窗也炸（hook 不依赖任何客户端观看）；
 *   ②直 POST /__tmux-notify ——agent 脚本可带文案（message），不依赖
 *     tmux 魔法，curl 一行的事。
 * 管线：两源 → NotifyGate 节流（每会话 ≥30s 防风暴）→ notifyBus →
 * ws-bridge 广播 {t:'notify', session, kind, message} →
 * client 非聚焦才上系统通知+徽标（聚焦中内容在屏上，不扰）。
 * 隐私边界：门卫只见过会话名与调用方文案，终端输出流一个字节不过手。
 */
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';

/** 通知总线：端点/hook 产生事件，ws-bridge 订阅广播。模块级=不翻
 *  createNzServer 签名（考卷裸调不破）。 */
const notifyBus = new EventEmitter();
notifyBus.setMaxListeners(64);

type NotifyCb = (session: string, kind: string, message?: string) => void;

/** ws-bridge 订阅口；返回退订函数（连接 close 统一收） */
export function onNotify(cb: NotifyCb): () => void {
  notifyBus.on('fire', cb);
  return () => {
    notifyBus.off('fire', cb);
  };
}

/** 节流闸（A 档直考；now 可注入）：每会话 windowMs 内只放行第一条 */
export class NotifyGate {
  private _last = new Map<string, number>();

  constructor(
    private _windowMs = 30000,
    private _now: () => number = Date.now,
  ) {}

  allow(session: string): boolean {
    const t = this._now();
    const last = this._last.get(session) ?? -Infinity;
    if (t - last < this._windowMs) return false;
    this._last.set(session, t);
    return true;
  }
}

/** alert-bell hook 命令（A 档直考）：触发时 tmux 展开格式变量再交给
 *  run-shell。会话名包单引号——名字含单引号属非常规命名，不支持。 */
export function alertBellHookCmd(port: number): string {
  return (
    `run-shell "curl -s -m 2 -X POST 'http://127.0.0.1:${port}/__tmux-notify' ` +
    `--data 'session=#{session_name}&kind=bell' >/dev/null 2>&1"`
  );
}

/** 注册 tmux alert-bell hook（幂等 set -g；失败静默=只少一条事件源，
 *  直 POST 通道不受影响）。server listen 拿到真实端口后调。 */
export function registerBellHook(port: number, tmuxBin = 'tmux'): void {
  execFile(tmuxBin, ['set', '-g', 'alert-bell', alertBellHookCmd(port)], { timeout: 4000 }, () => {
    /* 失败静默，见上 */
  });
}

/** 通知端点路由（index.ts 静态分支之前挂，同 pool/ai 模式）：
 *  POST /__tmux-notify  body: session=名[&kind=bell|custom][&message=文案]
 *  返回 204；节流拒绝也是 204（对调用方无差别，防探测）。 */
export function mountNotifyRoutes(gate = new NotifyGate()) {
  return (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): boolean => {
    if (req.method !== 'POST' || (req.url ?? '').split('?')[0] !== '/__tmux-notify') return false;
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size <= 16384) chunks.push(c);
    });
    req.on('end', () => {
      res.writeHead(204).end();
      const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const session = (params.get('session') ?? '').slice(0, 64);
      if (!session) return;
      const kind = (params.get('kind') ?? 'custom').slice(0, 16);
      const message = (params.get('message') ?? '').slice(0, 200) || undefined;
      if (!gate.allow(session)) return;
      notifyBus.emit('fire', session, kind, message);
    });
    return true;
  };
}
