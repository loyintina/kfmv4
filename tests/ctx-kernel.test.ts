/**
 * tests/ctx-kernel.test.ts — 9.0 L0 内核（Cordis 根总线）回归钉子
 *
 * 8.7.1 验收的 node 侧面：hello 见证 ACTIVE / 探针自测全链 /
 * churn 注销全绿 / 死后访问判红（INACTIVE_EFFECT 原生支持，步 0 实证）。
 * 浏览器侧面由守视实拍覆盖（bootLog + ctxChurn in-situ）。
 */
import { test, group } from './runner.js';
import assert from 'assert';
import { rootCtx, helloFiber, bootCtxSelfTest, ctxChurn, isHelloCleaned } from '../src/client/ctx.js';
import { FiberState } from 'cordis';

group('ctx-kernel');

test('hello 见证插件进入 ACTIVE（总线活了）', async () => {
  await helloFiber;
  assert(helloFiber.state === FiberState.ACTIVE, `hello state=${helloFiber.state}，期望 ACTIVE(2)`);
});

test('探针自测全链 PASS（注册/注入/注销/清理）', async () => {
  const ok = await bootCtxSelfTest();
  assert(ok, 'bootCtxSelfTest 应返回 true');
});

test('churn 50 轮注册/注销全部走完 ACTIVE→DISPOSED 且清理执行', async () => {
  const r = await ctxChurn(50);
  assert(r.failed === 0, `churn 有 ${r.failed} 次未走完全链`);
});

test('死后访问判红：dispose 后再 effect 抛 INACTIVE_EFFECT', async () => {
  let saved: import('cordis').Context | null = null;
  const f = rootCtx.plugin((ctx) => { saved = ctx; });
  await f;
  await f.dispose();
  assert(f.state === FiberState.DISPOSED, `dispose 后 state=${f.state}，期望 DISPOSED(4)`);
  let code = '';
  try {
    saved!.effect(() => () => {});
  } catch (e) {
    code = String((e as { code?: string })?.code || (e as Error).message || e);
  }
  assert(code.includes('INACTIVE'), `死后访问应抛 INACTIVE_EFFECT，实际：${code || '未抛错'}`);
});

test('hello 见证常态常驻：清理标志恒 false', () => {
  assert(!isHelloCleaned(), 'hello 见证不应被清理');
});
