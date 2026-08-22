/**
 * src/server/index.ts — kfm-nz 服务端最小出生（8.8.1a）
 *
 * nz 服务端的第一次站立：HTTP 静态服务（public/）+ 服务端 cordis 根总线。
 * 之后一切服务端插件（term-connection 家族 / ws 桥 / agent-service…）都
 * 挂在这棵 serverCtx 上——本文件只负責「地基 + 门户」，不長业务。
 *
 * 端口：8023（kfmv4 本体 8022 已被佔——8022 是 sshd/生产；nz 用 8023
 * 与 v8 并存互不打扰，9.0 收口迁入时再归位）。
 *
 * 纪律：
 * - 静态服务越界防护：路径归一化后必须落在 public/ 内（fail-closed，
 *   875 教训向每个新模块迁移）；
 * - 服务端 cordis 化与客户端同窗口（8.7.1 接线六点⑥）：hello 见证插件
 *   + bootLog 同款模式，插件注册/注销/清理全链从第一天就有。
 */
import { createServer, type Server } from 'node:http';
import { readFile, appendFile } from 'node:fs/promises';
import { join, normalize, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Context } from 'cordis';

const PUBLIC_DIR = resolve(fileURLToPath(new URL('../../public/', import.meta.url)));

/** IME 事件流落盘位置（诊断取证；/tmp 易失正合适——取证完即弃，不入仓） */
const IME_LOG = process.env.NZ_IME_LOG ?? '/tmp/nz-ime-events.log';

/** 服务端启动日志（客户端同款模式；未来接 ledger-service） */
export const serverBootLog: string[] = [];
function slog(msg: string): void {
  serverBootLog.push(msg);
  console.info('[kfm-nz-server] ' + msg);
}

/** 全服务端唯一根总线 */
export const serverCtx = new Context();

// 服务端 hello 见证插件：证明总线活了（客户端 ctx.ts 同款）
serverCtx.plugin((ctx) => {
  ctx.effect(() => () => { slog('server hello 见证插件 effect 清理执行'); });
  slog('服务端总线活了（hello 见证插件注册）');
});

// 8.8.2③ 权限引擎服务端挂载（评审前置要求②：termConn.open 挂 exec 判定——
// permission.ts 是同构纯 TS，客户端/服务端同一颗引擎，各挂各的总线）
import { PermissionEngine } from '../client/permission.js';
const permissions = new PermissionEngine();
permissions.setSink((e) => slog(`[permission:${e.mode}] ${e.tool} → ${e.decision}（${e.rule}）`));
serverCtx.provide('permissions', permissions);

// 8.8.1 终端连接家族（№1 连接层）：纯会话管理挂服务端总线——传输无关，
// WS 桥/眼睛/审计各自订阅事件，互不染指
import { mountTermConnection } from './term-connection.js';
mountTermConnection(serverCtx);
slog('term-connection 已挂服务端总线（五动作：open/input/resize/close/重连=attach）');

// ========== 静态服务 ==========

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** URL 路径 → public/ 内绝对路径；越界返回 null（fail-closed） */
export function resolveStatic(urlPath: string): string | null {
  const raw = decodeURIComponent(urlPath.split('?')[0]);
  // 原样拒 '..':normalize 会把 '../../etc/passwd' 静默收编成 public 内路径，
  // 安全但语义含糊——显形拒绝（403）好过静默改道（404 分不清是逃逸还是没文件）
  if (raw.split(/[/\\]/).includes('..')) return null;
  const clean = normalize(raw).replace(/^([/\\])+/, '');
  const abs = resolve(join(PUBLIC_DIR, clean === '' ? 'index.html' : clean));
  if (abs !== PUBLIC_DIR && !abs.startsWith(PUBLIC_DIR + sep)) return null;
  return abs;
}

export function createNzServer(): Server {
  return createServer((req, res) => {
    // 诊断取证端点（IME 事件流探针，评审取证信）：?debug 客户端把
    // compositionstart/update/end + input + viewport 事件逐条 sendBeacon
    // 到此处，原样追加落盘——真实 IME 序列 headless 模拟不出，只能真机抓。
    if (req.method === 'POST' && (req.url ?? '').split('?')[0] === '/debug/ime-log') {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size <= 65536) chunks.push(c); // 单请求 64KB 封顶（诊断规模）
      });
      req.on('end', () => {
        appendFile(IME_LOG, Buffer.concat(chunks)).catch(() => { /* 诊断落盘失败不挡服务 */ });
        res.writeHead(204).end();
      });
      return;
    }
    const abs = resolveStatic(req.url ?? '/');
    if (!abs) {
      res.writeHead(403).end('forbidden');
      return;
    }
    readFile(abs)
      .then((buf) => {
        res.writeHead(200, { 'content-type': MIME[extname(abs)] ?? 'application/octet-stream' });
        res.end(buf);
      })
      .catch(() => {
        res.writeHead(404).end('not found');
      });
  });
}

// ========== 入口（直接运行时） ==========

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.NZ_PORT ?? 8023);
  // 绑 127.0.0.1：访问通道 = kalo 隧道 -L 8023（2026-08-21 评审代改——
  // 裸绑 * 等于公网直开，slog 声称的 127.0.0.1 与实际绑定不符）。
  // 确有公网直开需求时设 NZ_HOST=0.0.0.0 显式选择，不默认可达。
  const host = process.env.NZ_HOST ?? '127.0.0.1';
  const server = createNzServer();
  // 8.8.2③b 终端 WS 桥：/ws/term（桥只做帧↔方法翻译，不懂终端语义）
  import('./ws-bridge.js').then(({ mountWsBridge }) => {
    mountWsBridge(serverCtx, server);
    slog('终端 WS 桥已挂：/ws/term（open/attach/input/resize/close/list）');
  });
  server.listen(port, host, () => {
    slog(`HTTP 静态服务已起：http://${host}:${port}/（public/，越界 fail-closed）`);
  });
  process.on('SIGTERM', () => { server.close(); process.exit(0); });
  process.on('SIGINT', () => { server.close(); process.exit(0); });
}
