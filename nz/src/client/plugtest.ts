/**
 * src/client/plugtest.ts — kfm-plugtest 最小版：插件验房师（TASK §2.4）
 *
 * 9.0 的核心承诺是热插拔——「按设计应该不留痕」不算数，要实测。本工具
 * 对插件跑三轮体检：装→卸→量残留 / 重载 / 缺失降级，八个错误码机判。
 * 8.11.2 转正为 tool-host 工具（riskClass exec、审计接 ledger ns=plugtest），
 * 最小版先立机制：DoD「新插件必过 plugtest」从此可执行。
 *
 * 残留检查的取巧（也是 broker 架构的回报）：插件不许直接往 rootCtx 挂
 * 东西，一切登记走四个 broker——所以快照 diff 四个 broker 的账 +
 * 一条事件探针，就覆盖了所有该回滚的东西。broker 越全，验房越严，
 * 检查天然随架构成长：
 *   容器计数 diff     → LEAK_DOM（宿主是 DOM 生灭唯一入口）
 *   卡类/RiskClass diff → LEAK_SERVICE（登记类残留）
 *   手势计数 diff     → LEAK_EVENT（手势 = 事件响应器）
 *   事件探针 hit      → LEAK_EVENT（dispose 后听者仍收货）
 *
 * 两条纪律（§2.4 定稿）：串行执行（快照 diff 分不清并发两家的漏）；
 * 发射类只验证「停止」不验证「撤销」。
 *
 * 降级探针语义（最小版定稿）：裸 context 装载。插件在依赖缺失时允许
 * 「有意降级」——公约错误（`[xxx]` 前缀有意抛出，如「内核未挂载」）或
 * cordis 依赖错误（cannot get property … without inject，框架级依赖
 * 缺失的干净报错）视为合格降级；裸 TypeError 等意外炸 = 对依赖缺失
 * 毫无觉知，判 DEGRADE_CRASH。探针卸载同样受超时保护（挂起判 UNLOAD_FAIL）。
 *
 * 探针实证备注：cordis fiber.dispose() 吞掉 cleanup 异常（2026-08-20
 * 探针脚本实测）——故 UNLOAD_FAIL 的判定面 = dispose 自身 reject 或超时，
 * cleanup 静默失败的后果由快照 diff 兜底（残留照样现形）。
 */
import { Context } from 'cordis';
import type { RenderHost } from './host.js';
import type { GestureRegistry } from './gesture.js';
import type { CardTypeBroker } from './card-types.js';
import type { PermissionEngine } from './permission.js';

export type PlugtestCode =
  | 'PLUGTEST_OK'
  | 'PLUGTEST_UNLOAD_FAIL'
  | 'PLUGTEST_LEAK_DOM'
  | 'PLUGTEST_LEAK_EVENT'
  | 'PLUGTEST_LEAK_SERVICE'
  | 'PLUGTEST_DEGRADE_CRASH'
  | 'PLUGTEST_RECOVER_FAIL'
  | 'PLUGTEST_UNKNOWN_PLUGIN';

export interface PlugtestResult {
  plugin: string;
  code: PlugtestCode;
  /** 残留明细（机判用，空 = 无残留） */
  leaks: string[];
  /** 体检过程轨迹（人读） */
  trace: string[];
  durationMs: number;
}

/** 被测插件的标准形态：cordis 插件函数 */
export type PluginFn = (ctx: Context) => void;

/** 一次快照 = 四个 broker 的账目计数 */
interface Snapshot {
  containers: number;
  gestures: number;
  cardTypes: number;
  risks: number;
}

declare module 'cordis' {
  interface Events {
    /** plugtest 事件探针：dispose 后仍有听者收货 = 事件残留 */
    'plugtest/probe'(probe: { hit(): void }): void;
  }
  interface Context {
    /** kfm-plugtest 最小版（内核服务，main.ts 挂载到 rootCtx） */
    plugtest: PlugtestRunner;
  }
}

export class PlugtestRunner {
  private _registry = new Map<string, PluginFn>();
  private _runs: PlugtestResult[] = [];
  private _queue: Promise<unknown> = Promise.resolve();
  private _unloadTimeoutMs: number;

  constructor(
    private _deps: {
      host: RenderHost;
      gestures: GestureRegistry;
      cardTypes: CardTypeBroker;
      permissions: PermissionEngine;
    },
    private _root: Context,
    opts: { unloadTimeoutMs?: number } = {},
  ) {
    this._unloadTimeoutMs = opts.unloadTimeoutMs ?? 2000;
  }

  // ========== 插件户口 ==========

  /** 登记被测插件，返回 disposer。重名即抛（单一来源纪律）。 */
  register(name: string, fn: PluginFn): () => void {
    if (this._registry.has(name)) {
      throw new Error(`[plugtest] 插件 ${name} 重复登记（单一来源纪律）`);
    }
    this._registry.set(name, fn);
    return () => {
      this._registry.delete(name);
    };
  }

  /** 枚举：插件户口 + 当前各 broker 账 */
  list(): { plugins: string[]; snapshot: Snapshot } {
    return { plugins: [...this._registry.keys()], snapshot: this._snapshot() };
  }

  /** 体检记录（append-only；转正期接 ledger ns=plugtest） */
  get runs(): readonly PlugtestResult[] {
    return this._runs;
  }

  // ========== test-one：三轮体检（串行纪律：内部排队，同时只测一个） ==========

  testOne(name: string): Promise<PlugtestResult> {
    const fn = this._registry.get(name);
    if (!fn) {
      return Promise.resolve(this._record({
        plugin: name, code: 'PLUGTEST_UNKNOWN_PLUGIN', leaks: [],
        trace: [`插件 ${name} 未登记`], durationMs: 0,
      }));
    }
    const run = this._queue.then(() => this._run(name, fn));
    this._queue = run.catch(() => { /* 排队不断链 */ });
    return run;
  }

  private async _run(name: string, fn: PluginFn): Promise<PlugtestResult> {
    const t0 = Date.now();
    const trace: string[] = [];
    const done = (code: PlugtestCode, leaks: string[] = []): PlugtestResult =>
      this._record({ plugin: name, code, leaks, trace, durationMs: Date.now() - t0 });

    // 第〇轮：缺失降级——裸 context（无内核服务）上装。
    // 允许「有意降级」：报公约错误（`[xxx] …` 有意抛出，如内核未挂载）；
    // 裸 TypeError/意外炸 = 对依赖缺失毫无觉知 → DEGRADE_CRASH。
    try {
      const bare = new Context();
      const f = bare.plugin(fn);
      await f;
      await this._disposeWithTimeout(f);
      trace.push('降级探针：裸 context 装载/卸载未炸');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('超时')) {
        trace.push(`降级探针卸载挂起：${msg}`);
        return done('PLUGTEST_UNLOAD_FAIL');
      }
      if (msg.startsWith('[') || msg.includes('without inject')) {
        trace.push(`降级探针：有意降级（${msg}）`);
      } else {
        trace.push(`降级探针意外炸：${msg}`);
        return done('PLUGTEST_DEGRADE_CRASH');
      }
    }

    // 第一轮：装 → 卸 → 量残留
    const before = this._snapshot();
    let fiber;
    try {
      fiber = this._root.plugin(fn);
      await fiber;
      trace.push('装载 OK');
    } catch (e) {
      trace.push(`实载即炸：${(e as Error).message}`);
      return done('PLUGTEST_DEGRADE_CRASH');
    }
    try {
      await this._disposeWithTimeout(fiber);
      trace.push('卸载 OK');
    } catch (e) {
      trace.push(`卸载失败：${(e as Error).message}`);
      return done('PLUGTEST_UNLOAD_FAIL');
    }

    const after = this._snapshot();
    const leaks: string[] = [];
    if (after.containers !== before.containers) leaks.push(`DOM 容器残留 ${after.containers - before.containers}`);
    if (after.cardTypes !== before.cardTypes) leaks.push(`卡类型残留 ${after.cardTypes - before.cardTypes}`);
    if (after.risks !== before.risks) leaks.push(`RiskClass 登记残留 ${after.risks - before.risks}`);
    let code: PlugtestCode | null = null;
    if (after.containers !== before.containers) code = 'PLUGTEST_LEAK_DOM';
    else if (after.cardTypes !== before.cardTypes || after.risks !== before.risks) code = 'PLUGTEST_LEAK_SERVICE';
    if (after.gestures !== before.gestures) {
      leaks.push(`手势处理器残留 ${after.gestures - before.gestures}`);
      code = code ?? 'PLUGTEST_LEAK_EVENT';
    }

    // 事件探针：dispose 后发射，仍有听者收货 = 事件残留（发射类只验证停止）
    let hits = 0;
    this._root.emit('plugtest/probe', { hit: () => { hits += 1; } });
    if (hits > 0) {
      leaks.push(`事件听者残留 ${hits}（dispose 后仍收货）`);
      code = code ?? 'PLUGTEST_LEAK_EVENT';
    }
    if (leaks.length > 0) {
      trace.push(`残留现形：${leaks.join('；')}`);
      return done(code ?? 'PLUGTEST_LEAK_SERVICE', leaks);
    }
    trace.push('残留检查零发现');

    // 第二轮：重载——卸干净了才能回到处女地再装
    try {
      const f2 = this._root.plugin(fn);
      await f2;
      await this._disposeWithTimeout(f2);
      trace.push('重载 OK');
    } catch (e) {
      trace.push(`重载炸：${(e as Error).message}`);
      return done('PLUGTEST_RECOVER_FAIL');
    }

    return done('PLUGTEST_OK');
  }

  // ========== 内部 ==========

  private _snapshot(): Snapshot {
    return {
      containers: this._deps.host.containerCount,
      gestures: this._deps.gestures.handlerCount,
      cardTypes: this._deps.cardTypes.list().length,
      risks: this._deps.permissions.declaredCount,
    };
  }

  private async _disposeWithTimeout(fiber: { dispose(): Promise<void> | void }): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve(fiber.dispose()),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`dispose 超时（${this._unloadTimeoutMs}ms）`)), this._unloadTimeoutMs);
        }),
      ]);
    } finally {
      // 评审 877 观察①：dispose 成功时清掉超时定时器，验房师自己不留尾巴
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private _record(r: PlugtestResult): PlugtestResult {
    this._runs.push(r);
    return r;
  }
}
