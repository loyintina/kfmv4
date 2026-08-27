/**
 * scripts/cdp-relay.ts — CDP 中继服务器（实验台 P1 服务器侧半边）
 *
 * 架构（信箱 kfmv4-9.0-nz-device-agent-p1-response）：
 *   手机 APK 中继线程 → 出站 TCP（kalo 隧道 -L 8025）→ 本服务 8025「桥口」
 *   评审 CDP 客户端（playwright connectOverCDP）→ 本服务 8026「客户端口」
 *   本服务把一对连接管道互转——纯字节，不解协议。
 *
 * 为什么桥口要多条待命：CDP 是多次顺序连接（HTTP /json/version →
 * /json/list → WebSocket /devtools/page/<id>），每次客户端连接要配
 * 一条新桥。APK 侧干净桥断开立刻补新（CdpRelay.java loop 的
 * bridged=true 快路径），本服务 FIFO 配对：有等待客户端先配客户端，
 * 否则桥进 pending 队列待命。
 *
 * 两端口都绑 loopback：8025 靠 kalo 隧道 -L 8025 伸手进来，8026 只供
 * 本机评审用——零公网暴露面。
 *
 * 跑法：npx tsx scripts/cdp-relay.ts
 * 端口覆盖：NZ_CDP_BRIDGE_PORT / NZ_CDP_CLIENT_PORT（默认 8025/8026）。
 */
import net from 'node:net';
import { pathToFileURL } from 'node:url';

export interface CdpRelayOpts {
  bridgePort?: number;
  clientPort?: number;
  host?: string;
  log?: (msg: string) => void;
}

export interface CdpRelay {
  bridgePort: number;
  clientPort: number;
  /** 观测面：当前待命桥数/等待客户端数/累计配对数 */
  stats(): { pendingBridges: number; waitingClients: number; paired: number };
  close(): Promise<void>;
}

export async function createCdpRelay(opts: CdpRelayOpts = {}): Promise<CdpRelay> {
  const host = opts.host ?? '127.0.0.1';
  const log = opts.log ?? ((m: string) => console.log(`[cdp-relay] ${m}`));

  const pendingBridges: net.Socket[] = [];
  const waitingClients: net.Socket[] = [];
  let paired = 0;

  function drop(list: net.Socket[], s: net.Socket): void {
    const i = list.indexOf(s);
    if (i !== -1) list.splice(i, 1);
  }

  function pair(): void {
    while (pendingBridges.length > 0 && waitingClients.length > 0) {
      const bridge = pendingBridges.shift()!;
      const client = waitingClients.shift()!;
      paired++;
      log(`paired #${paired}（client ⇄ bridge）`);
      bridge.pipe(client);
      client.pipe(bridge);
      // 任一头关=这对管道报废，另一头陪葬——APK 会补新桥，
      // 客户端（playwright）断连即整段会话结束
      bridge.once('close', () => client.destroy());
      client.once('close', () => bridge.destroy());
      bridge.once('error', () => client.destroy());
      client.once('error', () => bridge.destroy());
    }
  }

  const bridgeServer = net.createServer((s) => {
    s.setNoDelay(true);
    pendingBridges.push(s);
    log(`bridge up（pending=${pendingBridges.length}）`);
    s.once('close', () => drop(pendingBridges, s));
    s.once('error', () => drop(pendingBridges, s));
    pair();
  });

  const clientServer = net.createServer((s) => {
    s.setNoDelay(true);
    waitingClients.push(s);
    log(`client waiting（waiting=${waitingClients.length}）`);
    s.once('close', () => drop(waitingClients, s));
    s.once('error', () => drop(waitingClients, s));
    pair();
  });

  await Promise.all([
    new Promise<void>((r) => bridgeServer.listen(opts.bridgePort ?? 8025, host, r)),
    new Promise<void>((r) => clientServer.listen(opts.clientPort ?? 8026, host, r)),
  ]);

  const bridgePort = (bridgeServer.address() as net.AddressInfo).port;
  const clientPort = (clientServer.address() as net.AddressInfo).port;
  log(`listening: bridge=${host}:${bridgePort} client=${host}:${clientPort}`);

  return {
    bridgePort,
    clientPort,
    stats: () => ({
      pendingBridges: pendingBridges.length,
      waitingClients: waitingClients.length,
      paired,
    }),
    close: () =>
      Promise.all([
        new Promise<void>((r) => bridgeServer.close(() => r())),
        new Promise<void>((r) => clientServer.close(() => r())),
      ]).then(() => {
        for (const s of [...pendingBridges, ...waitingClients]) s.destroy();
      }),
  };
}

// 直跑入口（import 时不启动）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createCdpRelay({
    bridgePort: Number(process.env.NZ_CDP_BRIDGE_PORT ?? 8025),
    clientPort: Number(process.env.NZ_CDP_CLIENT_PORT ?? 8026),
  }).catch((e) => {
    console.error('[cdp-relay] fatal:', e);
    process.exit(1);
  });
}
