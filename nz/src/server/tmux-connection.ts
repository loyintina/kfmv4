/**
 * src/server/tmux-connection.ts — tmux 控制通道（宪法 §6 Step 2 server 侧，
 * 2026-09-01）。结构化事实源：`tmux -C attach`（control mode）第二 PTY，
 * 窗口列表/增删改名通知由 tmux 主动推送——**不解析画面**，这是与 v8
 * 「抓屏猜状态」路线的正式分野。
 *
 * 协议要点（v0 用到的子集）：
 * - 命令输出包裹在 `%begin …` / `%end …` 块内，块内是命令的原始 stdout；
 * - `%` 开头的通知行（window-add/renamed/close/session-changed/layout…）
 *   = 世界变了；v0 不逐型解析语义，一律触发「重发 list-windows 刷新」
 *   ——通知只当扳机，状态正确性由 list-windows 全量兜底（debounce 防抖）；
 * - `%output …`（pane 输出洪流）显式忽略：标签条不需要 pane 内容，
 *   咬它=把洪峰引进服务器。
 */
import { Context } from 'cordis';
import * as pty from 'node-pty-prebuilt-multiarch';

export interface TmuxWindowInfo {
  id: string;
  name: string;
  active: boolean;
}
export interface TmuxState {
  session: string | null;
  windows: TmuxWindowInfo[];
  ready: boolean;
  exited: boolean;
}
export interface TmuxControlOpts {
  session: string;
  cols?: number;
  rows?: number;
  tmuxBin?: string;
}

const LIST_FMT = '#{window_id}\x1f#{window_name}\x1f#{window_active}';
const REFRESH_DEBOUNCE_MS = 120;

/** tmux 控制模式输出转义还原：不可见字符按八进制 \NNN 出线（0x1f→\037）、
 *  反斜杠自身 → \\。（0901 实锤：分隔符在 wire 上是字面 \037，按原字节
 *  split 永远切不开——考卷「name 空」钉当场抓获。） */
function tmuxUnescape(s: string): string {
  return s.replace(/\\(?:([0-7]{3})|\\)/g, (_, oct?: string) =>
    oct !== undefined ? String.fromCharCode(parseInt(oct, 8)) : '\\');
}

export class TmuxControl {
  private proc: pty.IPty;
  private buf = '';
  private inBlock = false;
  private blockLines: string[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private awaitingList = false;
  private _windows: TmuxWindowInfo[] = [];
  private _exited = false;
  private _ready = false;
  private readyResolvers: Array<() => void> = [];
  private readyRejecters: Array<(e: Error) => void> = [];
  private changeCbs = new Set<() => void>();
  private exitCbs = new Set<() => void>();

  constructor(private opts: TmuxControlOpts) {
    this.proc = pty.spawn(opts.tmuxBin ?? 'tmux', ['-C', 'attach', '-t', opts.session], {
      name: 'xterm-256color',
      cols: opts.cols ?? 120,
      rows: opts.rows ?? 30,
      cwd: process.env.HOME ?? '/',
      env: { ...process.env } as Record<string, string>,
    });
    this.proc.onData((data) => this.feed(data));
    this.proc.onExit(() => {
      this._exited = true;
      this._windows = [];
      const err = new Error(`tmux 控制通道退出（session=${opts.session}）`);
      for (const r of this.readyRejecters.splice(0)) r(err);
      for (const cb of this.exitCbs) cb();
    });
    this.refresh(); // 初始快照：attach 后主动拉一把（通知只会报「变了」不报全量）
  }

  /** 初始窗口列表就绪（首个 list-windows 块解析完成）；超时/通道死即拒 */
  ready(timeoutMs = 6000): Promise<void> {
    if (this._ready) return Promise.resolve();
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`tmux 控制通道就绪超时（${timeoutMs}ms）`)), timeoutMs);
      this.readyResolvers.push(() => { clearTimeout(t); res(); });
      this.readyRejecters.push((e) => { clearTimeout(t); rej(e); });
    });
  }

  state(): TmuxState {
    return {
      session: this._exited ? null : this.opts.session,
      windows: this._windows.map((w) => ({ ...w })),
      ready: this._ready,
      exited: this._exited,
    };
  }

  get exited(): boolean {
    return this._exited;
  }

  onChange(cb: () => void): () => void {
    this.changeCbs.add(cb);
    return () => this.changeCbs.delete(cb);
  }

  onExit(cb: () => void): () => void {
    this.exitCbs.add(cb);
    return () => this.exitCbs.delete(cb);
  }

  /** 通道内命令：select-window（'@1' 与 '1' 都收） */
  selectWindow(id: string): void {
    const target = id.startsWith('@') ? id : `@${id}`;
    this.proc.write(`select-window -t ${target}\n`);
  }

  /** 通道内裸命令（8.8.5 管理步：new-window/rename-window/kill-window…） */
  send(cmd: string): void {
    this.proc.write(cmd + '\n');
  }

  /** 收尸：杀控制客户端进程，**不碰 session 本身**（attach 客户端死≠会话死） */
  close(): void {
    if (this._exited) return;
    try { this.proc.kill(); } catch { /* 已死即达意 */ }
  }

  private refresh(): void {
    this.awaitingList = true;
    this.proc.write(`list-windows -F '${LIST_FMT}'\n`);
  }

  private scheduleRefresh(): void {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), REFRESH_DEBOUNCE_MS);
  }

  private feed(data: string): void {
    this.buf += data;
    let idx: number;
    while ((idx = this.buf.search(/\r?\n/)) >= 0) {
      const line = this.buf.slice(0, idx).replace(/\r$/, '');
      this.buf = this.buf.slice(idx + (this.buf[idx] === '\r' ? 2 : 1));
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    if (this.inBlock) {
      if (line.startsWith('%end')) {
        this.inBlock = false;
        this.handleBlock(this.blockLines);
        this.blockLines = [];
      } else {
        this.blockLines.push(line);
      }
      return;
    }
    if (line.startsWith('%begin')) { // 进块（bug 0901：曾裸 return 没置位，块内数据全被当噪声丢）
      this.inBlock = true;
      this.blockLines = [];
      return;
    }
    if (line.startsWith('%output') || line.startsWith('%extended-output')) return; // pane 输出洪流，标签条不咬
    if (line.startsWith('%')) { this.scheduleRefresh(); return; } // 任意通知=世界变了，重拉全量
    // 块外非 % 行： control 协议外噪声，丢弃（防脏手）
  }

  private handleBlock(lines: string[]): void {
    if (!this.awaitingList || lines.length === 0) return; // select-window 等命令的空块
    this.awaitingList = false;
    this._windows = lines.map((l) => {
      const parts = tmuxUnescape(l).split('\x1f');
      return { id: parts[0], name: parts.slice(1, -1).join('\x1f'), active: parts[parts.length - 1] === '1' };
    }).filter((w) => w.id.startsWith('@'));
    const first = !this._ready;
    this._ready = true;
    for (const r of this.readyResolvers.splice(0)) r();
    if (first || this.changeCbs.size) for (const cb of this.changeCbs) cb();
  }
}

/** 服务端总线挂载：控制通道工厂（UI 步的 WS 桥按此开门） */
export function mountTmuxConnection(ctx: Context): void {
  ctx.provide('tmuxControlOpen', (opts: TmuxControlOpts) => new TmuxControl(opts));
}

// ========== 会话表（0902 用户拍板：标签=会话；标签条改用本服务） ==========

import { execFile } from 'node:child_process';

export interface TmuxSessionInfo {
  name: string;
  windows: number;
  attached: boolean;
}

const SESSIONS_FMT = '#{session_name}\x1f#{session_windows}\x1f#{session_attached}';

/** 全服务器会话表快照（一次 exec；无会话服务器=空表不视为错） */
export function listSessions(tmuxBin = 'tmux'): Promise<TmuxSessionInfo[]> {
  return new Promise((resolve) => {
    execFile(tmuxBin, ['ls', '-F', SESSIONS_FMT], { timeout: 4000 }, (err, stdout) => {
      if (err) return resolve([]);
      const sessions = String(stdout).split('\n').filter(Boolean).map((l) => {
        const parts = tmuxUnescape(l).split('\x1f');
        return { name: parts[0] ?? '', windows: Number(parts[1]) || 0, attached: parts[2] === '1' };
      }).filter((s) => s.name !== '');
      resolve(sessions);
    });
  });
}

/** 会话级管理命令（new-session/kill-session；argv 直传不走 shell，无注入面） */
export function tmuxSessionCmd(args: string[], tmuxBin = 'tmux'): Promise<{ ok: boolean; err?: string }> {
  return new Promise((resolve) => {
    execFile(tmuxBin, args, { timeout: 4000 }, (err, _stdout, stderr) => {
      resolve(err ? { ok: false, err: String(stderr || err).slice(0, 200) } : { ok: true });
    });
  });
}
