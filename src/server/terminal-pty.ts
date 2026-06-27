/**
 * KFM v4 — PTY 会话管理（Phase 8: 03 号终端卡后端）
 *
 * 管理 node-pty 伪终端进程的生命周期：
 * spawn / write / resize / kill / killAll
 *
 * 设计文档：docs/design/TERMINAL_CARD_SPEC.md
 */

import * as pty from 'node-pty-prebuilt-multiarch';
import { WebSocket } from 'ws';

// ========== 类型定义 ==========

interface PtySession {
  id: string;
  pty: pty.IPty;
  ws: WebSocket;
  cwd: string;
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

  /** 创建 PTY 会话，返回 sessionId */
  spawn(ws: WebSocket, cwd?: string): string {
    const sessionId = crypto.randomUUID();
    const dir = cwd || process.env.HOME || '/';
    const cols = 80;
    const rows = 24;

    const term = pty.spawn(this._shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: dir,
      env: process.env as Record<string, string>,
    });

    const session: PtySession = { id: sessionId, pty: term, ws, cwd: dir };
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

  /** 查询会话信息 */
  getSession(sessionId: string): PtySession | undefined {
    return this._sessions.get(sessionId);
  }

  /** 当前活跃会话数 */
  get sessionCount(): number {
    return this._sessions.size;
  }
}
