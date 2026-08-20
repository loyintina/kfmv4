/**
 * tests/ctx-kernel.test.ts — L0 内核（Cordis 根总线）回归钉子
 *
 * 8.7.1 验收的正式考题化（原散在 smoke.mjs 里）；smoke.mjs 保留为全链快检，
 * 本文件进 npm test 回归体系。考题同 kfmv4 tests/ctx-kernel.test.ts 五钉。
 */
import { test, group, assert } from './runner.ts';
import { rootCtx, helloFiber, bootCtxSelfTest, isHelloCleaned } from '../src/client/ctx.ts';
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

test('churn 20 轮注册/注销全部走完 ACTIVE→DISPOSED 且清理执行', async () => {
  let failed = 0;
  for (let i = 0; i < 20; i++) {
    let cleaned = false;
    const f = rootCtx.plugin((ctx) => ctx.effect(() => () => { cleaned = true; }));
    await f;
    await f.dispose();
    // dispose 副作用 TS 不可见（const enum 窄化假象），同 ctx.ts 处理
    if ((f.state as FiberState) !== FiberState.DISPOSED || !cleaned) failed++;
  }
  assert(failed === 0, `churn 有 ${failed} 次未走完全链`);
});

test('死后访问判红：dispose 后再 effect 抛 INACTIVE_EFFECT', async () => {
  let saved: import('cordis').Context | null = null;
  const f = rootCtx.plugin((ctx) => { saved = ctx; });
  await f;
  await f.dispose();
  assert((f.state as FiberState) === FiberState.DISPOSED, `dispose 后 state=${f.state}，期望 DISPOSED(4)`);
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
