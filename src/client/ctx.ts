/**
 * src/client/ctx.ts — 9.0 L0 内核：Cordis 根总线（8.7.1 落地）
 *
 * 这是什么：全客户端唯一的 Cordis root Context（总线出生点，接线六点①）。
 * 本模块必须是 main.ts 的第一个副作用 import——总线先于一切 v8 init 出生。
 *
 * 8.7.1 范围（最小接线，任务图 8.7.1 行）：
 * - rootCtx 创建 + hello 见证插件（接线六点②：注册即证明总线活了）；
 * - 探针自测 bootCtxSelfTest()：注册→ACTIVE→inject 消费→dispose→DISPOSED
 *   →清理执行，验证注册/注销/清理全链（验收：浏览器跑通+注册/卸载无泄漏）；
 * - ctxChurn(n)：注册/注销压测助手，经调试桥 __kfmDebug.ctx 暴露给守视，
 *   用于 in-situ 泄漏实测（内存以 GC 后净增量为准，№14 修订注口径）。
 *
 * 锁定版本 cordis@4.0.0-rc.8（package.json 精确版本无 ^/~；升级走契约化
 * 评估——rc.7→rc.8 diff 档案已入任务图审计记录：LoggerLevel 枚举数值对调
 * /emit 循环化/Caller 机制）。
 *
 * 过程勘误（步 0 学费，信箱存档）：Fiber 是 PromiseLike，读 state 前必须
 * await，否则读到的还是 LOADING。
 */
import { Context, FiberState } from 'cordis';

/** 启动日志：调试桥可读（守视 eval 验证用）；内核不引 logger，保持零依赖 */
export const bootLog: string[] = [];
function blog(msg: string): void {
  bootLog.push(msg);
  console.info('[kfm-ctx] ' + msg);
}

/** 全客户端唯一根总线 */
export const rootCtx = new Context();

// ========== hello 见证插件（接线六点②）：首个注册件 ==========
// 常态常驻、从不摘除——它是「总线活着」的见证；注销链路由探针自测证明。
let helloCleaned = false;
export const helloFiber = rootCtx.plugin((ctx) => {
  ctx.effect(() => () => {
    helloCleaned = true;
    blog('hello 见证插件 effect 清理执行');
  });
  blog('总线活了（hello 见证插件注册）');
});

/** 供测试/守视断言：hello 见证的清理标志（正常态恒 false） */
export function isHelloCleaned(): boolean {
  return helloCleaned;
}

// ========== 探针自测：注册→消费→注销→清理 全链 ==========
export async function bootCtxSelfTest(): Promise<boolean> {
  try {
    await helloFiber; // Fiber 是 PromiseLike——等 ACTIVE
    if (helloFiber.state !== FiberState.ACTIVE) {
      blog('自测 FAIL：hello 未进 ACTIVE（state=' + helloFiber.state + '）');
      return false;
    }
    let probeCleaned = false;
    const probe = rootCtx.plugin((ctx) => {
      ctx.provide('ctxProbe', 1);
      ctx.effect(() => () => { probeCleaned = true; });
    });
    let consumed: unknown = null;
    rootCtx.inject(['ctxProbe'], (ctx) => {
      consumed = (ctx as unknown as Record<string, unknown>).ctxProbe; // escape-ok: cordis 服务名靠声明合并扩展 Context 类型，探针键 ctxProbe 是临时服务不走声明合并，按未知键读取须断言
    });
    await probe;
    if (probe.state !== FiberState.ACTIVE || consumed !== 1) {
      blog('自测 FAIL：探针未 ACTIVE 或 inject 未消费到服务');
      return false;
    }
    await probe.dispose();
    // 控制流窄化把 probe.state 钉死在 ACTIVE（const enum 窄化假象），
    // dispose 的副作用 TS 不可见——按 FiberState 显式断言后比较
    if ((probe.state as FiberState) !== FiberState.DISPOSED || !probeCleaned) {
      blog('自测 FAIL：探针未 DISPOSED 或 effect 清理未执行');
      return false;
    }
    blog('探针自测 PASS：注册/注入/注销/清理全链绿');
    return true;
  } catch (e) {
    blog('自测 FAIL：异常 ' + (e instanceof Error ? e.message : String(e)));
    return false;
  }
}

// ========== 注册/注销压测助手（守视泄漏实测用） ==========
export interface ChurnResult {
  n: number;
  msTotal: number;
  usPerCycle: number;
  failed: number; // 未走完 ACTIVE→DISPOSED 全链的次数（应恒 0）
}

export async function ctxChurn(n: number): Promise<ChurnResult> {
  const t0 = performance.now();
  let failed = 0;
  for (let i = 0; i < n; i++) {
    let cleaned = false;
    const f = rootCtx.plugin((ctx) => {
      ctx.effect(() => () => { cleaned = true; });
    });
    await f;
    await f.dispose();
    if (f.state !== FiberState.DISPOSED || !cleaned) failed++;
  }
  const msTotal = performance.now() - t0;
  return { n, msTotal, usPerCycle: (msTotal * 1000) / n, failed };
}
