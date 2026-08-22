/**
 * tests/term-core-shared.test.ts — glue 单例装载回归钉（8.8.2③c）
 *
 * 靶子 bug：main.ts 探针与终端卡各自调 loadTermCoreBrowser()，wasm-bindgen
 * glue 二次 init 把 wasm 导出绑定换成新实例 → 旧实例出生的 TermCore 指针
 * 喂进新实例函数表 → RuntimeError: memory access out of bounds（OPEN FAIL）。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①loadTermCoreShared 每次新建 promise（不缓存）→「并发/重复调用同一
 *     实例」钉红；
 *   ②每次都真调 loader →「loader 只跑一次」钉红。
 */
import { test, assert } from './runner.ts';
import { loadTermCoreShared, type TermCoreGlue } from '../src/client/term-core.ts';

test('loadTermCoreShared：并发与重复调用共享同一实例，loader 只跑一次', async () => {
  let calls = 0;
  const sentinel = {} as TermCoreGlue;
  const loader = async (_base: string): Promise<TermCoreGlue> => {
    calls++;
    // 模拟异步 init 耗时——并发第二call必须搭上同一 promise 而非再 init
    await new Promise((r) => setTimeout(r, 10));
    return sentinel;
  };
  const [a, b] = await Promise.all([
    loadTermCoreShared('/x', loader),
    loadTermCoreShared('/x', loader),
  ]);
  const c = await loadTermCoreShared('/x', loader); // 落定后再调
  assert(a === sentinel && b === sentinel && c === sentinel, '三次调用必须拿到同一 glue 实例');
  assert(calls === 1, `loader 必须只跑一次（实际 ${calls}）——二次 init 会换 wasm 实例`);
});
