/**
 * src/client/term/link-state.ts — 链路分层状态机（R1 断链自愈①，2026-09-08
 * 用户签收判据稿）。
 *
 * na 痛点（tmux-mgr-requirements-response 必须①④）：自愈骨架已在
 * （退避重连/心跳看门狗/续命账），但全程 console.warn 静默——断了、
 * 断多久、为什么断，用户一概不知。本件只做「状态可见」单源：
 *   OK           链路在，且注册会话无缺失
 *   RECONNECTING WS 断、HTTP 通（服务进程活着，退避重连走表）；boot 期
 *                一闪（retries=0）不可见，断过一次才可见
 *   DOWN         WS 断 + /healthz 连续 N 拍探不通（网断或服务器死）
 *   DEGRADED     链路在但注册会话缺失（服务器/机器重启 tmux 死透）
 *
 * 红线：不碰 bridge 的重连/心跳/续命语义——bridge 只多报一个 onLink
 * （悬空插座接线），本件自成单源；横幅（link-banner.ts）与考卷都只读。
 * 断因分层靠 /healthz：HTTP 通=服务在；HTTP 死=网断或服务器死。
 * probe/时序可注入，A 档考卷跑纯逻辑（tests/link-state.test.ts）。
 */
export type LinkPhase = 'OK' | 'RECONNECTING' | 'DOWN' | 'DEGRADED';

export interface LinkTransition {
  t: number;
  from: LinkPhase;
  to: LinkPhase;
  why: string;
}

export interface LinkSnapshot {
  phase: LinkPhase;
  /** 横幅可见否（boot 期 RECONNECTING 一闪不吓人） */
  visible: boolean;
  /** 注册在账但活表没有的会话名（DEGRADED 的重建名单） */
  missing: string[];
  /** 自上次 OK 以来的 WS 断拍数 */
  retries: number;
  /** 当前相态起点（ms 墙钟） */
  since: number;
  /** 最近一次 OK 时刻（恢复时刻取证） */
  lastOkAt: number;
  transitions: LinkTransition[];
}

export interface LinkTrackerOpts {
  /** 探针注入（考卷用）；默认 fetch('/healthz') 1.5s 超时 */
  probe?: () => Promise<boolean>;
  /** 探测节拍 ms（默认 2000，只在 WS 断期间走） */
  probeMs?: number;
  /** 连续败 N 拍降 DOWN（默认 2，防单拍抖动） */
  failsToDown?: number;
  /** 事件环容量（默认 50） */
  historyCap?: number;
}

export class LinkTracker {
  private _phase: LinkPhase = 'RECONNECTING';
  private _wsUp = false;
  private _retries = 0;
  private _missing: string[] = [];
  private _since = Date.now();
  private _lastOkAt = 0;
  private _hist: LinkTransition[] = [];
  private _probeTimer: ReturnType<typeof setInterval> | null = null;
  private _probeFails = 0;
  private _subs = new Set<(s: LinkSnapshot) => void>();

  constructor(private _opts: LinkTrackerOpts = {}) {}

  get phase(): LinkPhase {
    return this._phase;
  }

  private _cap(): number {
    return this._opts.historyCap ?? 50;
  }

  private _set(phase: LinkPhase, why: string): void {
    if (phase === this._phase) return;
    const from = this._phase;
    this._phase = phase;
    this._since = Date.now();
    this._hist.push({ t: this._since, from, to: phase, why });
    if (this._hist.length > this._cap()) this._hist.shift();
    this._emit();
  }

  private _emit(): void {
    const s = this.snapshot();
    for (const cb of [...this._subs]) cb(s);
  }

  snapshot(): LinkSnapshot {
    // 可见 = 非 OK 且非 boot 一闪（还没断过的 RECONNECTING 不吓人）
    const bootFlash = this._phase === 'RECONNECTING' && this._retries === 0;
    return {
      phase: this._phase,
      visible: this._phase !== 'OK' && !bootFlash,
      missing: [...this._missing],
      retries: this._retries,
      since: this._since,
      lastOkAt: this._lastOkAt,
      transitions: [...this._hist],
    };
  }

  subscribe(cb: (s: LinkSnapshot) => void): () => void {
    this._subs.add(cb);
    cb(this.snapshot());
    return () => {
      this._subs.delete(cb);
    };
  }

  /** bridge onLink 接线口（原悬空插座上钩） */
  wsLink(up: boolean): void {
    if (up) {
      this._wsUp = true;
      this._retries = 0;
      this._probeFails = 0;
      this._stopProbe();
      this._lastOkAt = Date.now();
      this._set(this._missing.length ? 'DEGRADED' : 'OK', 'ws-open');
    } else {
      this._wsUp = false;
      this._retries++;
      this._set('RECONNECTING', 'ws-close');
      this._startProbe();
    }
  }

  /** tabs 插件按注册表 diff 喂：缺了谁（ws down 时只记账，回 OK 定相） */
  setMissing(names: string[]): void {
    const same =
      names.length === this._missing.length &&
      names.every((n, i) => n === this._missing[i]);
    if (same) return;
    this._missing = [...names];
    if (this._wsUp) {
      this._set(
        this._missing.length ? 'DEGRADED' : 'OK',
        this._missing.length ? `missing:${this._missing.length}` : 'missing-cleared',
      );
    } else {
      this._emit();
    }
  }

  /** 无相变记事（自愈 reload 等事件进环，考卷/复盘取数） */
  note(why: string): void {
    this._hist.push({ t: Date.now(), from: this._phase, to: this._phase, why });
    if (this._hist.length > this._cap()) this._hist.shift();
    this._emit();
  }

  private _defaultProbe(): Promise<boolean> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    return fetch('/healthz', { cache: 'no-store', signal: ctrl.signal })
      .then((r) => {
        clearTimeout(timer);
        return r.ok;
      })
      .catch(() => {
        clearTimeout(timer);
        return false;
      });
  }

  private _startProbe(): void {
    if (this._probeTimer) return;
    this._probeFails = 0;
    const probe = this._opts.probe ?? (() => this._defaultProbe());
    const failsToDown = this._opts.failsToDown ?? 2;
    const tick = (): void => {
      if (this._wsUp) return;
      void probe().then((ok) => {
        if (this._wsUp) return;
        if (ok) {
          this._probeFails = 0;
          this._stopProbe();
          this._set('RECONNECTING', 'probe-ok');
        } else {
          this._probeFails++;
          if (this._probeFails >= failsToDown) {
            this._set('DOWN', `probe-fail×${this._probeFails}`);
          }
        }
      });
    };
    tick();
    this._probeTimer = setInterval(tick, this._opts.probeMs ?? 2000);
  }

  private _stopProbe(): void {
    if (this._probeTimer) {
      clearInterval(this._probeTimer);
      this._probeTimer = null;
    }
  }

  stop(): void {
    this._stopProbe();
    this._subs.clear();
  }
}

let _singleton: LinkTracker | null = null;

/** 页面单例（term 插件接线 / tabs 插件喂账共用）；考卷直接 new 不走此口 */
export function getLinkTracker(opts?: LinkTrackerOpts): LinkTracker {
  if (!_singleton) {
    _singleton = new LinkTracker(opts);
    try {
      (window as unknown as Record<string, unknown>).__kfmNzLink = () =>
        _singleton!.snapshot();
    } catch {
      /* 非浏览器态（单测）不挂钩子 */
    }
  }
  return _singleton;
}
