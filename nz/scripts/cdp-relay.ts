/**
 * scripts/cdp-relay.ts — CDP 中继服务器 v2（实验台 P1 服务器侧半边）
 *
 * 架构（信箱 kfmv4-9.0-nz-device-agent-p1-response + v2 按需拨号改版）：
 *   手机 APK 控制信道（常驻）→ kalo 隧道 -L 8028 → 本服务 8028「控制口」
 *   手机 APK 数据信道（一次性）→ kalo 隧道 -L 8025 → 本服务 8025「桥口」
 *   评审 CDP 客户端（playwright connectOverCDP）→ 本服务 8026「客户端口」
 *
 * v2 为什么反转成按需拨号：v1「APK 预挂桥待命」真机证伪——Chromium
 * devtools socket 不养闲连接，预挂的桥等客户端来时已半死（parse error/
 * 挂起实测）。v2：客户端到 8026 排队 → 控制口发一行 DIAL → APK 当场连
 * devtools+8025 拨一条崭新的桥 → FIFO 配对。每个客户端连接吃新桥，
 * 永不复用。
 *
 * 三端口都绑 loopback：8025/8028 靠 kalo 隧道伸手进来，8026 只供本机
 * 评审——零公网暴露面。
 *
 * 跑法：npx tsx scripts/cdp-relay.ts
 * 端口覆盖：NZ_CDP_BRIDGE_PORT / NZ_CDP_CLIENT_PORT / NZ_CDP_CONTROL_PORT
 * （默认 8025/8026/8028）。
 */
import net from 'node:net';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export interface CdpRelayOpts {
  bridgePort?: number;
  clientPort?: number;
  controlPort?: number;
  host?: string;
  /** 状态落盘路径（attach 状态可见性，默认 /tmp/nz-cdp-relay.status.json；
   *  评审验收补充要求：attach 失败时要分得清「APK 未连」还是「CDP 协议不通」） */
  statusFile?: string | null;
  log?: (msg: string) => void;
}

export interface CdpRelay {
  bridgePort: number;
  clientPort: number;
  controlPort: number;
  /** 观测面：待命桥数/等待客户端数/累计配对数/控制信道在否 */
  stats(): {
    pendingBridges: number; waitingClients: number; paired: number;
    controlUp: boolean; dialsSent: number;
  };
  close(): Promise<void>;
}

export async function createCdpRelay(opts: CdpRelayOpts = {}): Promise<CdpRelay> {
  const host = opts.host ?? '127.0.0.1';
  const log = opts.log ?? ((m: string) => console.log(`[cdp-relay] ${m}`));
  const statusFile =
    opts.statusFile === undefined ? '/tmp/nz-cdp-relay.status.json' : opts.statusFile;

  const pendingBridges: net.Socket[] = [];
  const waitingClients: net.Socket[] = [];
  let control: net.Socket | null = null;
  let paired = 0;
  let dialsSent = 0;
  let lastEvent = 'init';
  let lastCtlMsg: string | null = null; // APK 自报的最新一行（HELLO/CH-UP/CH-ERR）
  let hbSeen = 0; // 心跳计数：phone→server 方向活性的连续证据（半开黑洞探测）

  // attach 状态可见性：每次状态变化落一小坨 JSON——排障先读它：
  // controlUp=false = APK 控制信道没连（查手机 App/隧道）；
  // controlUp=true 但 pendingBridges 恒 0 = DIAL 发了桥没来（查 APK 日志）；
  // 有桥但 attach 失败 = CDP 协议层问题（查客户端）
  function writeStatus(): void {
    if (!statusFile) return;
    const s = {
      ts: new Date().toISOString(),
      controlUp: control !== null,
      pendingBridges: pendingBridges.length,
      waitingClients: waitingClients.length,
      paired,
      dialsSent,
      lastEvent,
      lastCtlMsg,
      hbSeen,
    };
    try {
      writeFileSync(statusFile, JSON.stringify(s, null, 2));
    } catch {
      // 状态落盘不挡路
    }
  }

  function drop(list: net.Socket[], s: net.Socket): void {
    const i = list.indexOf(s);
    if (i !== -1) list.splice(i, 1);
  }

  function pair(): void {
    while (pendingBridges.length > 0 && waitingClients.length > 0) {
      const bridge = pendingBridges.shift()!;
      const client = waitingClients.shift()!;
      paired++;
      lastEvent = `paired#${paired}`;
      log(`paired #${paired}（client ⇄ bridge）`);
      writeStatus();
      bridge.pipe(client);
      client.pipe(bridge);
      // 任一头关=这对管道报废，另一头陪葬——下一个客户端连接会触发
      // 新的 DIAL，APK 再拨新桥
      bridge.once('close', () => client.destroy());
      client.once('close', () => bridge.destroy());
      bridge.once('error', () => client.destroy());
      client.once('error', () => bridge.destroy());
    }
    // 配完还有客户端在等 = 桥不够，向 APK 再要（每个等待客户端一行 DIAL；
    // APK 每行拨一条，天然数量对齐）
    if (waitingClients.length > 0 && control && !control.destroyed) {
      for (let i = 0; i < waitingClients.length; i++) {
        dialsSent++;
        log(`DIAL #${dialsSent}（waiting=${waitingClients.length}）`);
        control.write('DIAL\n');
      }
      lastEvent = 'dial-sent';
      writeStatus();
    }
  }

  const bridgeServer = net.createServer((s) => {
    s.setNoDelay(true);
    pendingBridges.push(s);
    lastEvent = 'bridge-up';
    log(`bridge up（pending=${pendingBridges.length}）`);
    writeStatus();
    s.once('close', () => {
      drop(pendingBridges, s);
      lastEvent = 'bridge-close';
      writeStatus();
    });
    s.once('error', () => drop(pendingBridges, s));
    pair();
  });

  const clientServer = net.createServer((s) => {
    s.setNoDelay(true);
    waitingClients.push(s);
    lastEvent = 'client-waiting';
    log(`client waiting（waiting=${waitingClients.length}）`);
    writeStatus();
    s.once('close', () => {
      drop(waitingClients, s);
      writeStatus();
    });
    s.once('error', () => drop(waitingClients, s));
    pair();
  });

  // 控制口：APK 常驻连接（单槽，新连接顶替旧的）。服务器只往这里写
  // DIAL；APK 回话（HELLO/HB/CH-UP/CH-ERR）逐行进日志+状态盘——
  // 分锅面：HB 断=半开黑洞；CH-ERR=APK 连 devtools/8025 失败（带原因）。
  const controlServer = net.createServer((s) => {
    s.setNoDelay(true);
    if (control && !control.destroyed) control.destroy();
    control = s;
    lastEvent = 'control-up';
    log('control up（APK 在线）');
    writeStatus();
    let buf = '';
    s.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        if (line === 'HB') {
          // 心跳：回 PONG（APK 看门狗靠它判半开黑洞）；计数+每 12 跳
          // （≈1 分钟）落一次盘，不刷日志噪音
          hbSeen++;
          try { s.write('PONG\n'); } catch { /* 回执不挡路 */ }
          if (hbSeen % 12 === 1) {
            lastEvent = `hb#${hbSeen}`;
            writeStatus();
          }
          continue;
        }
        lastCtlMsg = line;
        lastEvent = `ctl:${line.slice(0, 40)}`;
        log(`APK 自报：${line}`);
        writeStatus();
      }
    });
    s.once('close', () => {
      if (control === s) control = null;
      lastEvent = 'control-close';
      writeStatus();
    });
    s.once('error', () => {
      if (control === s) control = null;
    });
    pair(); // 控制后上线：给在等的客户端补发 DIAL（①b 钉）
  });

  await Promise.all([
    new Promise<void>((r) => bridgeServer.listen(opts.bridgePort ?? 8025, host, r)),
    new Promise<void>((r) => clientServer.listen(opts.clientPort ?? 8026, host, r)),
    new Promise<void>((r) => controlServer.listen(opts.controlPort ?? 8028, host, r)),
  ]);

  const bridgePort = (bridgeServer.address() as net.AddressInfo).port;
  const clientPort = (clientServer.address() as net.AddressInfo).port;
  const controlPort = (controlServer.address() as net.AddressInfo).port;
  log(`listening: bridge=${host}:${bridgePort} client=${host}:${clientPort} control=${host}:${controlPort}`);
  writeStatus();

  return {
    bridgePort,
    clientPort,
    controlPort,
    stats: () => ({
      pendingBridges: pendingBridges.length,
      waitingClients: waitingClients.length,
      paired,
      controlUp: control !== null,
      dialsSent,
    }),
    close: () =>
      Promise.all([
        new Promise<void>((r) => bridgeServer.close(() => r())),
        new Promise<void>((r) => clientServer.close(() => r())),
        new Promise<void>((r) => controlServer.close(() => r())),
      ]).then(() => {
        for (const s of [...pendingBridges, ...waitingClients]) s.destroy();
        if (control) control.destroy();
      }),
  };
}

// 直跑入口（import 时不启动）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createCdpRelay({
    bridgePort: Number(process.env.NZ_CDP_BRIDGE_PORT ?? 8025),
    clientPort: Number(process.env.NZ_CDP_CLIENT_PORT ?? 8026),
    controlPort: Number(process.env.NZ_CDP_CONTROL_PORT ?? 8028),
  }).catch((e) => {
    console.error('[cdp-relay] fatal:', e);
    process.exit(1);
  });
}
