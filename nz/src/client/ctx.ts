/**
 * src/client/ctx.ts — kfm-nz L0 内核：Cordis 根总线
 *
 * 移植自 kfmv4 8.7.1（src/client/ctx.ts，2026-08-18 已验证：node 冒烟 +
 * 浏览器实拍 + churn 无泄漏）。nz 从第一天就长在 Cordis 上。
 *
 * 与 kfmv4 版的差异：无调试桥（nz 无 kfmv4 window.__kfmDebug），bootLog
 * 由 main.ts 渲染到页面（守视 snapshot/eval 可读）。tsconfig 用 bundler
 * 解析——kfmv4 的 d.ts 补丁脚本（node16 专用坑）不需要带过来。
 */
import { Context, FiberState } from 'cordis';

/** 启动日志：页面渲染 + 守视可读 */
export const bootLog: string[] = [];
function blog(msg: string): void {
  bootLog.push(msg);
  console.info('[kfm-nz] ' + msg);
}

/** 全客户端唯一根总线 */
export const rootCtx = new Context();

// ========== hello 见证插件：首个注册件，证明总线活了 ==========
let helloCleaned = false;
export const helloFiber = rootCtx.plugin((ctx) => {
  ctx.effect(() => () => {
    helloCleaned = true;
    blog('hello 见证插件 effect 清理执行');
  });
  blog('总线活了（hello 见证插件注册）');
});

export function isHelloCleaned(): boolean {
  return helloCleaned;
}

// ========== 探针自测：注册→消费→注销→清理 全链 ==========
export async function bootCtxSelfTest(): Promise<boolean> {
  try {
    await helloFiber; // Fiber 是 PromiseLike——等 ACTIVE（kfmv4 步 0 勘误存档）
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
      consumed = (ctx as unknown as Record<string, unknown>).ctxProbe; // escape-ok: cordis 服务名靠声明合并扩展 Context 类型，探针键是临时服务不走声明合并
    });
    await probe;
    if (probe.state !== FiberState.ACTIVE || consumed !== 1) {
      blog('自测 FAIL：探针未 ACTIVE 或 inject 未消费到服务');
      return false;
    }
    await probe.dispose();
    // 控制流窄化把 probe.state 钉死在 ACTIVE（const enum 窄化假象），dispose 副作用 TS 不可见
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
