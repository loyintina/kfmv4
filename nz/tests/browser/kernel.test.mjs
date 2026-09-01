/**
 * tests/browser/kernel.test.mjs — UI 内核契约 A 档标准（plugin-contract §6
 * Step 1 验收卷，2026-09-01 立项）
 *
 * 宪法 docs/plugin-contract.md：UI 插件 = { id, mount(slot, ctx) →
 * handle{unmount} }；React=当前适配器非地基。本卷钉四件事：
 *   ①内核钩子存在（__kfmNzKernel：list/mount/unmount）
 *   ②React 适配器端到端（内置 _react-smoke 夹具在真 bundle 里渲染出
 *     JSX 节点——jsx automatic 链+react-dom 真证）
 *   ③unmount 删干净（DOM 摘除+handle 清理回调被调=契约 §2 卸载纪律）
 *   ④重复 id 拒绝（注册表唯一性）
 *
 * 跑法：手机 proot（KFM_NZ_URL 指 8023），node tests/browser/kernel.test.mjs。
 */
import { launchBrowser } from './launch.mjs';

const URL = process.env.KFM_NZ_URL || 'http://127.0.0.1:8023/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
await page.waitForSelector('.nz-term', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

const K = () => page.evaluate(() => {
  const k = window.__kfmNzKernel;
  return k ? { hasList: typeof k.list === 'function', hasMount: typeof k.mount === 'function', hasUnmount: typeof k.unmount === 'function', hasSmoke: !!k.plugins?.reactSmoke, list: k.list() } : null;
});

// ① 内核钩子存在
const k0 = await K();
check('①内核钩子（__kfmNzKernel：list/mount/unmount+smoke 夹具）', !!k0 && k0.hasList && k0.hasMount && k0.hasUnmount && k0.hasSmoke,
      k0 ? `list=${JSON.stringify(k0.list)}` : '无 __kfmNzKernel');

// ② React 适配器端到端：_react-smoke 夹具渲染出 JSX 节点
const smokeOk = await page.evaluate(() => {
  const k = window.__kfmNzKernel;
  if (!k) return { ok: false, why: 'no kernel' };
  const slot = document.createElement('div');
  slot.id = 'kernel-smoke-slot';
  document.body.appendChild(slot);
  try { k.mount('_react-smoke', k.plugins.reactSmoke, slot); } catch (e) { return { ok: false, why: String(e).slice(0, 80) }; }
  return { ok: true };
});
await page.waitForTimeout(300); // createRoot.render 并发调度，让一拍
const smokeNode = await page.evaluate(() => {
  const el = document.querySelector('#kernel-smoke-slot [data-react-smoke]');
  return el ? { ok: true, text: el.textContent } : { ok: false };
});
check('②React 冒烟夹具→JSX 节点真渲染（适配器端到端）', smokeOk.ok && smokeNode.ok && smokeNode.text === 'react-smoke',
      `mount=${smokeOk.ok ? 'ok' : smokeOk.why} node=${JSON.stringify(smokeNode)}`);

// ③ unmount 删干净：DOM 摘除 + 清理回调被调
const clean = await page.evaluate(() => {
  const k = window.__kfmNzKernel;
  if (!k) return { had: false, cleaned: 0, domGone: false };
  const slot = document.getElementById('kernel-smoke-slot');
  let cleaned = 0;
  const vanilla = { id: '_vanilla-probe', mount: (s, c) => { s.setAttribute('data-vanilla', '1'); return { unmount: () => { cleaned++; s.removeAttribute('data-vanilla'); } }; } };
  k.mount('_vanilla-probe', vanilla, slot);
  const had = slot.hasAttribute('data-vanilla');
  k.unmount('_vanilla-probe');
  k.unmount('_react-smoke');
  return { had, cleaned, domGone: !slot.hasAttribute('data-vanilla') && !slot.querySelector('[data-react-smoke]') };
});
await page.waitForTimeout(300);
const reactGone = await page.evaluate(() => !document.querySelector('#kernel-smoke-slot [data-react-smoke]'));
check('③unmount 删干净（DOM 摘除+清理回调被调+React 树卸载）', clean.had && clean.cleaned === 1 && clean.domGone && reactGone,
      `had=${clean.had} cleaned=${clean.cleaned} domGone=${clean.domGone} reactGone=${reactGone}`);

// ④ 重复 id 拒绝
const dup = await page.evaluate(() => {
  const k = window.__kfmNzKernel;
  if (!k) return { ok: false };
  const p = { id: '_dup', mount: () => ({ unmount() {} }) };
  const slot = document.createElement('div');
  try { k.mount('_dup', p, slot); k.mount('_dup', p, slot); return { ok: false }; } catch { return { ok: true }; }
});
check('④重复 id 拒绝（注册表唯一性）', dup.ok, `rejected=${dup.ok}`);

await browser.close();
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} 通过`);
process.exit(fails.length ? 1 : 0);
