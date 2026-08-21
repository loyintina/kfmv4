/**
 * smoke.mjs — kfm-nz 冒烟：node 侧验证 Cordis 根总线全链（kfmv4 8.7.1 同款）
 * 运行：npm run smoke
 */
import { rootCtx, helloFiber, bootCtxSelfTest, isHelloCleaned } from './src/client/ctx.ts';
import { FiberState } from 'cordis';
import { readFileSync } from 'fs';

await helloFiber;
if (helloFiber.state !== FiberState.ACTIVE) throw new Error('hello 未 ACTIVE');
if (isHelloCleaned()) throw new Error('hello 不应被清理');

const ok = await bootCtxSelfTest();
if (!ok) throw new Error('自测未通过');

// churn 小量：注册/注销 20 轮全链
let failed = 0;
for (let i = 0; i < 20; i++) {
  let cleaned = false;
  const f = rootCtx.plugin((ctx) => ctx.effect(() => () => { cleaned = true; }));
  await f;
  await f.dispose();
  if (f.state !== FiberState.DISPOSED || !cleaned) failed++;
}
if (failed > 0) throw new Error(`churn ${failed} 次未走完全链`);

// 8.8.2 探针：rio-vt WASM 解析核 node 冒烟（initSync 路径，与浏览器同一份 glue）
const { probeTermCore } = await import('./src/client/term-core.ts');
const termGlue = await import('./public/term-core/kfm_term_core.js');
termGlue.initSync({ module: readFileSync(new URL('./public/term-core/kfm_term_core_bg.wasm', import.meta.url)) });
console.log('SMOKE term-core: ' + probeTermCore(termGlue));

console.log('SMOKE PASS: hello ACTIVE / 自测绿 / churn 20 轮全链');
