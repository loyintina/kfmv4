/**
 * tests/plugtest.test.ts — kfm-plugtest 最小版 A 档考题（TASK §2.4）
 *
 * 验房师自己也得有考题：养一群「坏插件」fixture，八个错误码逐码钉死
 * 真的会被报出来——否则它说「没问题」没法信。
 *
 * 探针实证前提（2026-08-20 探针脚本实测）：
 *   - cordis fiber.dispose() 会等异步 cleanup（挂起 cleanup → 超时路径可用）；
 *   - 插件 apply 抛异常 → fiber promise reject（降级探针可抓）；
 *   - dispose 吞 cleanup 异常（故 cleanup 静默失败的后果由快照 diff 兜底）。
 *
 * 降级探针语义（与实现同步）：裸 context 上抛「公约错误」（[xxx] 前缀）
 * 或 cordis 依赖错误（without inject）= 有意降级，合格；
 * 裸 TypeError 等意外炸 = DEGRADE_CRASH。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①摘掉快照 diff（after/before 不比对）→ LEAK_DOM/LEAK_SERVICE 钉红；
 *   ②事件探针不发射（摘 emit）→ LEAK_EVENT 钉红。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { PlugtestRunner, type PluginFn } from '../src/client/plugtest.ts';
import { RenderHost } from '../src/client/host.ts';
import { GestureRegistry } from '../src/client/gesture.ts';
import { CardTypeBroker, registerCardType } from '../src/client/card-types.ts';
import { PermissionEngine, declareToolRisk } from '../src/client/permission.ts';
import { FakeDoc } from './fake-dom.ts';

function newEnv(): { runner: PlugtestRunner; root: Context } {
  const host = new RenderHost();
  host.init(new FakeDoc() as unknown as Document);
  const root = new Context();
  const deps = {
    host,
    gestures: new GestureRegistry(),
    cardTypes: new CardTypeBroker(),
    permissions: new PermissionEngine(),
  };
  root.provide('host', deps.host);
  root.provide('gestures', deps.gestures);
  root.provide('cardTypes', deps.cardTypes);
  root.provide('permissions', deps.permissions);
  const runner = new PlugtestRunner(deps, root, { unloadTimeoutMs: 100 });
  root.provide('plugtest', runner);
  return { runner, root };
}

// ========== fixture 插件群 ==========

/** 乖插件：一切登记走 ctx.effect（回滚白送） */
const good: PluginFn = (ctx) => {
  registerCardType(ctx, { id: 'pt-good', name: 'Good' });
  declareToolRisk(ctx, 'pt-good-tool', 'read');
  ctx.host.create(ctx, { owner: 'pt-good', slot: 'main', kind: 'layout' });
};

/** 坏·DOM：往 root ctx 上建容器（绕开自己的 fiber，dispose 管不着）。
 *  裸探针下服务缺失有意跳过（可选链），实载才漏。 */
const leakDom: PluginFn = (ctx) => {
  ctx.host?.create(ctx.root, { owner: 'pt-leak-dom', slot: 'main', kind: 'layout' });
};

/** 坏·服务：直接调引擎登记、丢掉 disposer（不走 ctx.effect）。
 *  裸探针下有意跳过，实载才漏。 */
const leakService: PluginFn = (ctx) => {
  ctx.permissions?.declareRisk('pt-leak-tool', 'exec');
};

/** 坏·事件：往 root 上挂探针听者（dispose 后仍收货） */
const leakEvent: PluginFn = (ctx) => {
  ctx.root.on('plugtest/probe', (p) => p.hit());
};

/** 坏·卸载：cleanup 挂起（永不 resolve → dispose 超时） */
const unloadHang: PluginFn = (ctx) => {
  ctx.effect(() => () => new Promise<void>(() => { /* 永不回来 */ }));
};

/** 坏·降级：与依赖缺失无关的意外炸（裸 TypeError，非公约/非 cordis 依赖错误） */
const degradeCrash: PluginFn = () => {
  const cfg = undefined as unknown as { deep: { x(): void } };
  cfg.deep.x();
};

/** 坏·重载：第三次被装载才炸（降级探针 1 + 实载 2 都过，重载 3 炸） */
let recoverCalls = 0;
const recoverFail: PluginFn = () => {
  recoverCalls += 1;
  if (recoverCalls % 3 === 0) throw new Error('重载时状态没清干净');
};

group('plugtest（插件验房师）');

test('登记/枚举：插件户口 + 四 broker 快照', async () => {
  const { runner } = newEnv();
  runner.register('good', good);
  const l = runner.list();
  assert(l.plugins.join(',') === 'good', '户口应列出已登记插件');
  assert(l.snapshot.containers === 0 && l.snapshot.risks === 0, '初始账应为零');
});

test('乖插件 → PLUGTEST_OK，且体检记录落账', async () => {
  const { runner } = newEnv();
  runner.register('good', good);
  const r = await runner.testOne('good');
  assert(r.code === 'PLUGTEST_OK', `乖插件应 OK，实际 ${r.code}：${r.trace.join(' / ')}`);
  assert(r.leaks.length === 0 && runner.runs.length === 1, '应零残留且落一条体检记录');
});

test('未知插件 → PLUGTEST_UNKNOWN_PLUGIN（不排队不体检）', async () => {
  const { runner } = newEnv();
  const r = await runner.testOne('ghost');
  assert(r.code === 'PLUGTEST_UNKNOWN_PLUGIN', `应 UNKNOWN，实际 ${r.code}`);
});

test('DOM 残留 → PLUGTEST_LEAK_DOM（变异靶①）', async () => {
  const { runner } = newEnv();
  runner.register('leak-dom', leakDom);
  const r = await runner.testOne('leak-dom');
  assert(r.code === 'PLUGTEST_LEAK_DOM', `应 LEAK_DOM，实际 ${r.code}`);
  assert(r.leaks.some((l) => l.includes('容器残留')), 'leaks 应点名容器');
});

test('登记残留 → PLUGTEST_LEAK_SERVICE（变异靶①）', async () => {
  const { runner } = newEnv();
  runner.register('leak-svc', leakService);
  const r = await runner.testOne('leak-svc');
  assert(r.code === 'PLUGTEST_LEAK_SERVICE', `应 LEAK_SERVICE，实际 ${r.code}`);
  assert(r.leaks.some((l) => l.includes('RiskClass')), 'leaks 应点名 RiskClass');
});

test('事件残留 → PLUGTEST_LEAK_EVENT（变异靶②：dispose 后探针仍被收货）', async () => {
  const { runner } = newEnv();
  runner.register('leak-evt', leakEvent);
  const r = await runner.testOne('leak-evt');
  assert(r.code === 'PLUGTEST_LEAK_EVENT', `应 LEAK_EVENT，实际 ${r.code}`);
  assert(r.leaks.some((l) => l.includes('听者残留')), 'leaks 应点名事件听者');
});

test('卸载挂起 → PLUGTEST_UNLOAD_FAIL（dispose 超时）', async () => {
  const { runner } = newEnv();
  runner.register('hang', unloadHang);
  const r = await runner.testOne('hang');
  assert(r.code === 'PLUGTEST_UNLOAD_FAIL', `应 UNLOAD_FAIL，实际 ${r.code}`);
});

test('裸 context 就炸 → PLUGTEST_DEGRADE_CRASH（不会优雅降级）', async () => {
  const { runner } = newEnv();
  runner.register('crash', degradeCrash);
  const r = await runner.testOne('crash');
  assert(r.code === 'PLUGTEST_DEGRADE_CRASH', `应 DEGRADE_CRASH，实际 ${r.code}`);
});

test('重载才炸 → PLUGTEST_RECOVER_FAIL（卸载没回到处女地）', async () => {
  const { runner } = newEnv();
  runner.register('recover', recoverFail);
  const r = await runner.testOne('recover');
  assert(r.code === 'PLUGTEST_RECOVER_FAIL', `应 RECOVER_FAIL，实际 ${r.code}：${r.trace.join(' / ')}`);
});

test('串行纪律：并发两个 testOne 不交错（同刻只在测一个）', async () => {
  const { runner } = newEnv();
  let inFlight = 0;
  let maxInFlight = 0;
  const slow = (tag: string): PluginFn => (ctx) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    ctx.effect(() => async () => {
      await new Promise((res) => setTimeout(res, 30));
      inFlight -= 1;
    });
    void tag;
  };
  runner.register('slow-a', slow('a'));
  runner.register('slow-b', slow('b'));
  const [ra, rb] = await Promise.all([runner.testOne('slow-a'), runner.testOne('slow-b')]);
  assert(ra.code === 'PLUGTEST_OK' && rb.code === 'PLUGTEST_OK', '两个慢插件都应 OK');
  assert(maxInFlight === 1, `同刻在测插件数应 ≤1，实际峰值 ${maxInFlight}`);
});
