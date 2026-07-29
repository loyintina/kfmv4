/**
 * KFM v4 — PTY 会话管理（03 号终端卡后端）
 *
 * 管理 node-pty 伪终端进程的生命周期：
 * spawn / write / resize / kill / killAll
 *
 * 设计契约：docs/domains/server/contract.md（PTY 管理）
 */

import * as pty from 'node-pty-prebuilt-multiarch';
import { WebSocket } from 'ws';
import { readlinkSync } from 'fs';

// ========== 类型定义 ==========

interface PtySession {
  id: string;
  pty: pty.IPty;
  ws: WebSocket;
  cwd: string;
  tty: string;
}

export type PtyDataCallback = (ws: WebSocket, sessionId: string, data: string) => void;
export type PtyExitCallback = (ws: WebSocket, sessionId: string, exitCode: number) => void;

// ========== PtyManager ==========

export class PtyManager {
  private _sessions = new Map<string, PtySession>();
  private _onData: PtyDataCallback;
  private _onExit: PtyExitCallback;
  private _shell: string;

  constructor(onData: PtyDataCallback, onExit: PtyExitCallback) {
    this._onData = onData;
    this._onExit = onExit;
    this._shell = process.env.SHELL || 'zsh';
  }

  /** 创建 PTY 会话，返回 sessionId。command 为空则启动交互 shell */
  spawn(ws: WebSocket, cwd?: string, command?: string): string {
    const sessionId = crypto.randomUUID();
    const dir = cwd || process.env.HOME || '/';
    const cols = 80;
    const rows = 24;

    const shellArgs = command ? ['-c', command] : [];
    const term = pty.spawn(this._shell, shellArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: dir,
      env: process.env as Record<string, string>,
    });

    const session: PtySession = { id: sessionId, pty: term, ws, cwd: dir, tty: '' };
    try { session.tty = readlinkSync('/proc/' + term.pid + '/fd/0'); } catch { /* ignore */ }
    this._sessions.set(sessionId, session);

    term.onData((data: string) => {
      this._onData(ws, sessionId, data);
    });

    term.onExit(({ exitCode }: { exitCode: number }) => {
      this._onExit(ws, sessionId, exitCode);
      this._sessions.delete(sessionId);
    });

    return sessionId;
  }

  /** 往指定会话写入数据 */
  write(sessionId: string, data: string): void {
    const session = this._sessions.get(sessionId);
    if (session) session.pty.write(data);
  }

  /** 调整 PTY 窗口尺寸 */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this._sessions.get(sessionId);
    if (session) session.pty.resize(cols, rows);
  }

  /** 终止指定会话 */
  kill(sessionId: string): void {
    const session = this._sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      this._sessions.delete(sessionId);
    }
  }

  /** 断开指定客户端的所有会话 */
  killAll(ws: WebSocket): void {
    for (const [id, session] of this._sessions) {
      if (session.ws === ws) {
        session.pty.kill();
        this._sessions.delete(id);
      }
    }
  }

  /** 获取会话的 tty 路径（用于 tmux switch-client -c） */
  getTty(sessionId: string): string {
    return this._sessions.get(sessionId)?.tty || '';
  }
}
