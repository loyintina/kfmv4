/**
 * src/server/term-connection.ts — 终端连接家族·纯会话管理（№1 连接层，
 * 8.8.1 后半）。
 *
 * 定位：管 PTY 进程的生死簿（open/input/resize/close/重连），**传输无关**——
 * 切断 v8 PtyManager 把 WebSocket 焊进 spawn 的耦合。本服务只出事件和
 * 订阅口，谁要听谁订阅：WS 桥（8.8.2 前后）/ 眼睛 / 审计各听各的。
 *
 * 重连语义（传输无关化后的正解）：会话不绑定任何消费者——消费者退订
 * 不影响会话存活；新消费者按 sessionId 订阅（attach）即重连，并可
 * replayTail 捞回归环尾迹补齐断档期输出。
 *
 * 三状态归属：会话表 = 登记类（unload 逆序全杀）；输出字节 = 发射类，
 * 只保证停止不保证撤销；回环尾迹 = 数据类（封顶滚动，随会话销毁）。
 */
import { Context } from 'cordis';
import * as pty from 'node-pty-prebuilt-multiarch';

declare module 'cordis' {
  interface Events {
    /** 会话开启 */
    'term/opened'(id: string): void;
    /** 会话输出（同步观察式 emit；消费者也可直接 onOutput 订阅单会话） */
    'term/output'(id: string, data: string): void;
    /** 会话退出（含 close 主动杀与自然退出） */
    'term/exit'(id: string, code: number): void;
  }
  interface Context {
    /** 终端连接服务（№1 连接层） */
    termConn: TermConnectionService;
  }
}

export interface TermOpenOpts {
  cwd?: string;
  command?: string;
  cols?: number;
  rows?: number;
}

/** №1 契约接口：TermSession */
export interface TermSession {
  readonly id: string;
  sendInput(data: string): void;
  resize(cols: number, rows: number): void;
  close(): void;
  /** 订阅输出，返回退订函数。退订不影响会话存活（重连语义的地基） */
  onOutput(cb: (data: string) => void): () => void;
  onExit(cb: (code: number) => void): () => void;
  /** 回环尾迹（封顶）：重连者补齐断档期输出用 */
  replayTail(): string;
}

interface SessionInner {
  id: string;
  proc: pty.IPty;
  outCbs: Set<(data: string) => void>;
  exitCbs: Set<(code: number) => void>;
  tail: string;
  exited: boolean;
}

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
/** 回环尾迹封顶（字节）——够重连补屏，不够成内存坑 */
const TAIL_CAP = 64 * 1024;

export class TermConnectionService {
  private _sessions = new Map<string, SessionInner>();
  private _shell: string;

  constructor(private _ctx: Context, opts: { shell?: string } = {}) {
    this._shell = opts.shell ?? process.env.SHELL ?? '/bin/sh';
  }

  /** №1 契约：open。command 为空则起交互 shell。
   *  权限门（评审 8.8.2 前置要求②）：exec 级判定——交互 shell 以 shell
   *  路径为 command 送审（no-meta → allow），`-c` 任意命令含 shell 元
   *  字符 → ask。影子期只落审计不拦截；转正期在 WS 桥边界生效。 */
  open(opts: TermOpenOpts = {}): Promise<TermSession> {
    const perms = this._ctx.get('permissions');
    if (perms) {
      perms.evaluate({
        tool: 'term.open',
        params: { command: opts.command ?? this._shell },
        attended: true,
      });
    }
    const id = crypto.randomUUID();
    const proc = pty.spawn(this._shell, opts.command ? ['-c', opts.command] : [], {
      name: 'xterm-256color',
      cols: opts.cols ?? DEFAULT_COLS,
      rows: opts.rows ?? DEFAULT_ROWS,
      cwd: opts.cwd ?? process.env.HOME ?? '/',
      env: process.env as Record<string, string>,
    });
    const inner: SessionInner = {
      id, proc, outCbs: new Set(), exitCbs: new Set(), tail: '', exited: false,
    };
    proc.onData((data) => {
      inner.tail = (inner.tail + data).slice(-TAIL_CAP);
      for (const cb of inner.outCbs) cb(data);
      this._ctx.emit('term/output', id, data);
    });
    proc.onExit(({ exitCode }) => {
      inner.exited = true;
      for (const cb of inner.exitCbs) cb(exitCode);
      this._ctx.emit('term/exit', id, exitCode);
    });
    this._sessions.set(id, inner);
    this._ctx.emit('term/opened', id);
    return Promise.resolve(this._view(inner));
  }

  /** 按 id 取会话（重连接口）：活着给视图，没有给 undefined */
  attach(id: string): TermSession | undefined {
    const inner = this._sessions.get(id);
    return inner ? this._view(inner) : undefined;
  }

  /** 活会话名册（评审 8.8.2 前置要求①口径：exited 不向 list 暴露——
   *  客户端看不到尸体。死会话仍可按 id attach 捞 exit code/尾迹，
   *  直到 close/卸载被摘。留白：死会话 linger 无自动 reaper，单具尸体
   *  封顶 64KB 尾迹，量产后量级可控；真成负担再加 reaper。） */
  list(): string[] {
    return [...this._sessions.values()].filter((s) => !s.exited).map((s) => s.id);
  }

  /** 服务卸载清理：全杀（登记类逆序摘的对应动作） */
  closeAll(): void {
    for (const inner of this._sessions.values()) {
      try { inner.proc.kill(); } catch { /* 已死不阻断其余 */ }
    }
    this._sessions.clear();
  }

  get size(): number {
    return this._sessions.size;
  }

  private _view(inner: SessionInner): TermSession {
    return {
      id: inner.id,
      sendInput: (data) => { if (!inner.exited) inner.proc.write(data); },
      resize: (cols, rows) => { if (!inner.exited) inner.proc.resize(cols, rows); },
      close: () => {
        if (this._sessions.delete(inner.id)) {
          try { inner.proc.kill(); } catch { /* 已死 */ }
        }
      },
      onOutput: (cb) => {
        inner.outCbs.add(cb);
        return () => { inner.outCbs.delete(cb); };
      },
      onExit: (cb) => {
        inner.exitCbs.add(cb);
        return () => { inner.exitCbs.delete(cb); };
      },
      replayTail: () => inner.tail,
    };
  }
}

/** 挂载到服务端总线（main 挂 serverCtx；考题挂测试 ctx）。
 *  权限引擎在册时登记 'term.open' = exec 级户口（影子期登记即审计源）；
 *  引擎缺席（早期骨架/裸测试）则跳过登记与判定。 */
export function mountTermConnection(ctx: Context, opts: { shell?: string } = {}): void {
  const svc = new TermConnectionService(ctx, opts);
  ctx.provide('termConn', svc);
  ctx.effect(() => () => svc.closeAll());
  const perms = ctx.get('permissions');
  if (perms && !perms.declared('term.open')) {
    const dispose = perms.declareRisk('term.open', 'exec');
    ctx.effect(() => dispose);
  }
}
