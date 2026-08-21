/**
 * tests/eyes.test.ts — 眼睛最小包 A 档考题（№5 / nz 8.7.6）
 *
 * 验收三件套：抽文件测试两式（变异抽检 / 配置禁用）、禁用后系统无损、
 * 过 plugtest。外加基建钉与失败降级钉。
 *
 * 变异抽检靶子（本文件指定）：
 *   ①eyes.refresh 不写 source 审计字段 → 「逐段 source」钉红；
 *   ②卸载遗言不写了（摘 farewell）→ 「禁用后系统无损」钉红；
 *   ③段 collect 抛错直接外抛（不写占位）→ 「失败写占位不抛」钉红。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { mountDynamicPromptFiles } from '../src/client/plugins/core/dynamic-prompt-files.ts';
import { applyEyesBundle } from '../src/client/plugins/eyes/index.ts';
import { EYES_FILE, EYES_FAREWELL } from '../src/client/plugins/eyes/eyes.ts';
import { PlugtestRunner } from '../src/client/plugtest.ts';
import { RenderHost } from '../src/client/host.ts';
import { GestureRegistry } from '../src/client/gesture.ts';
import { CardTypeBroker } from '../src/client/card-types.ts';
import { PermissionEngine } from '../src/client/permission.ts';
import { FakeDoc } from './fake-dom.ts';

function newEnv() {
  const host = new RenderHost();
  host.init(new FakeDoc() as unknown as Document);
  const root = new Context();
  const gestures = new GestureRegistry();
  const cardTypes = new CardTypeBroker();
  const permissions = new PermissionEngine();
  root.provide('host', host);
  root.provide('gestures', gestures);
  root.provide('cardTypes', cardTypes);
  root.provide('permissions', permissions);
  const runner = new PlugtestRunner({ host, gestures, cardTypes, permissions }, root, { unloadTimeoutMs: 100 });
  root.provide('plugtest', runner);
  mountDynamicPromptFiles(root);
  return { root, runner, permissions, cardTypes };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

group('eyes（眼睛最小包）');

test('dynamic-prompt-files 基建：写读列删 + 变更事件 + 非法名公约错误', async () => {
  const { root } = newEnv();
  const seen: string[] = [];
  root.on('dynfiles/written', (n) => seen.push(n));
  root.dynFiles.write('a.md', '内容甲');
  assert(root.dynFiles.read('a.md') === '内容甲', '写入后可读回');
  assert(root.dynFiles.list().includes('a.md') && root.dynFiles.size === 1, 'list/size 正确');
  assert(seen.join() === 'a.md', '写入应发 dynfiles/written 事件');
  let threw = '';
  try { root.dynFiles.write('../escape.md', 'x'); } catch (e) { threw = (e as Error).message; }
  assert(threw.startsWith('[dynfiles]'), '逃逸文件名应抛公约错误');
  root.dynFiles.delete('a.md');
  assert(root.dynFiles.size === 0, '删除后清零');
  await flush();
});

test('bundle 整包 apply：eyes.md 含 coords + 骨架自态两段，MD 外壳 + YAML 内核 + source 审计', async () => {
  const { root } = newEnv();
  const fiber = root.plugin((ctx) => applyEyesBundle(ctx));
  await fiber; await flush();
  const file = root.dynFiles.read(EYES_FILE);
  assert(!!file, 'apply 后 eyes.md 应已写盘');
  const f = file!;
  assert(f.includes('## 标定坐标系（coords）'), '应含 coords 段');
  assert(f.includes('## 骨架自态（skeleton-state）'), '应含骨架自态段');
  assert(f.includes('origin: top-left'), 'coords 段 YAML 内核应有标定值');
  assert((f.match(/source: /g) ?? []).length >= 2, '每段应带 source 审计字段');
  assert(f.includes('投影不是真相源'), 'MD 外壳应有投影语义引导');
  await fiber.dispose();
});

test('抽文件测试式一·变异抽检：broker 账变化 → 刷新后投影反映新内容', async () => {
  const { root, permissions } = newEnv();
  const fiber = root.plugin((ctx) => applyEyesBundle(ctx));
  await fiber; await flush();
  const before = root.dynFiles.read(EYES_FILE)!;
  assert(!before.includes('mutate-probe-tool'), '变异前投影不应含探针工具');
  permissions.declareRisk('mutate-probe-tool', 'read');
  permissions.evaluate({ tool: 'mutate-probe-tool', params: { path: 'x.md' } });
  root.emit('eyes/refresh-requested');
  await flush();
  const after = root.dynFiles.read(EYES_FILE)!;
  assert(after.includes('mutate-probe-tool'), '刷新后投影应反映审计账新条目');
  assert(after.includes('declaredRisks: 1'), '刷新后投影应反映 RiskClass 新账');
  await fiber.dispose();
});

test('抽文件测试式二·配置禁用：关停 skeleton 段 → 投影缺该段，其余不动', async () => {
  const { root } = newEnv();
  const fiber = root.plugin((ctx) => applyEyesBundle(ctx, { sections: { skeleton: false } }));
  await fiber; await flush();
  const file = root.dynFiles.read(EYES_FILE)!;
  assert(file.includes('## 标定坐标系（coords）'), 'coords 段应在');
  assert(!file.includes('skeleton-state'), '被关停的段不应出现在投影里');
  await fiber.dispose();
});

test('禁用后系统无损：卸载写遗言占位，broker 账零变化，基建仍可用', async () => {
  const { root, runner } = newEnv();
  const brokerBefore = JSON.stringify(runner.list().snapshot);
  const fiber = root.plugin((ctx) => applyEyesBundle(ctx));
  await fiber; await flush();
  await fiber.dispose();
  await flush();
  const file = root.dynFiles.read(EYES_FILE)!;
  assert(file.includes('眼睛已关闭'), '卸载后应写遗言占位（发射类补偿）');
  assert(!file.includes('标定坐标系'), '遗言后旧段内容应被占位覆盖');
  assert(JSON.stringify(runner.list().snapshot) === brokerBefore, '禁用后 broker 账应零变化');
  root.dynFiles.write('still-alive.md', 'x');
  assert(root.dynFiles.read('still-alive.md') === 'x', '包外基建应不受包禁用影响');
});

test('失败写占位不抛：段 collect 炸 → 该段占位，投影照常写盘', async () => {
  const { root } = newEnv();
  const fiber = root.plugin((ctx) => {
    applyEyesBundle(ctx);
    ctx.inject(['eyes'], (ctx) => {
      ctx.eyes.registerSection({
        id: 'boom', title: '爆炸段', source: '考题夹具',
        collect: () => { throw new Error('有意爆炸'); },
      });
    });
  });
  await fiber; await flush();
  const file = root.dynFiles.read(EYES_FILE)!;
  assert(file.includes('段采集失败（占位）'), '炸掉的段应写占位');
  assert(file.includes('标定坐标系'), '别的段不受爆炸段影响');
  await fiber.dispose();
});

test('过 plugtest：eyes 包体检 PLUGTEST_OK（装/卸/量残留/重载/降级）', async () => {
  const { root, runner } = newEnv();
  runner.register('eyes', (ctx) => applyEyesBundle(ctx));
  const r = await runner.testOne('eyes');
  assert(r.code === 'PLUGTEST_OK', `体检应 OK，实际 ${r.code}（${r.leaks.join('；')}）`);
});
