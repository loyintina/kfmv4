/**
 * tests/card-types.test.ts — 卡片类型 broker A 档考题（№6）
 *
 * 变异抽检靶子（№6 验收清单指定）：
 *   ①注册不进 fiber（helper 不走 ctx.effect）→ 「dispose 自动销户」钉红；
 *   ②disposer 不守卫实例 → 「relied 守卫」钉红。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { CardTypeBroker, registerCardType, type CardTypeDef } from '../src/client/card-types.ts';

const defA: CardTypeDef = { id: 'card-a', name: 'Alpha' };
const defB: CardTypeDef = { id: 'card-b', name: 'Beta' };

group('card-types（卡片 broker）');

test('注册→枚举→注销观察等价（注销后与从没登记过不可区分）', () => {
  const broker = new CardTypeBroker();
  const dispose = broker.registerType(defA);
  assert(broker.list().length === 1 && broker.get('card-a')?.name === 'Alpha', '注册后应可枚举');
  dispose();
  assert(broker.list().length === 0 && broker.get('card-a') === undefined, '注销后应无痕迹');
});

test('ctx.effect 注册：插件 dispose → 类型自动销户（题眼）', async () => {
  const broker = new CardTypeBroker();
  const ctx = new Context();
  ctx.provide('cardTypes', broker);
  const fiber = ctx.plugin((child) => {
    registerCardType(child, defA);
  });
  await fiber;
  assert(broker.list().length === 1, '插件活着类型应在册');
  await fiber.dispose();
  assert(broker.list().length === 0, '插件卸载后类型应自动销户（幽灵入口不可能）');
});

test('relied 守卫：有活实例禁销户；关实例后可销户', () => {
  const broker = new CardTypeBroker();
  const dispose = broker.registerType(defA);
  const inst = broker.createInstance('card-a');
  let msg = '';
  try {
    dispose();
  } catch (e) {
    msg = (e as Error).message;
  }
  assert(msg.includes('relied 守卫'), `有活实例应拒绝销户，实际：${msg || '未抛错'}`);
  assert(broker.get('card-a') !== undefined, '守卫拦截后类型应仍在册');
  broker.destroyInstance(inst.id);
  dispose();
  assert(broker.get('card-a') === undefined, '实例关后销户应成功');
});

test('枚举序：兄弟 name 字典序（与注册顺序无关）', () => {
  const broker = new CardTypeBroker();
  broker.registerType({ id: 'z1', name: 'Zulu' }); // 先注册名字靠后的
  broker.registerType(defA); // Alpha
  broker.registerType(defB); // Beta
  const names = broker.list().map((d) => d.name);
  assert(names.join(',') === 'Alpha,Beta,Zulu', `兄弟应按 name 序，实际：${names.join(',')}`);
});

test('枚举序：dependsOn 依赖拓扑（依赖排前）', () => {
  const broker = new CardTypeBroker();
  broker.registerType({ id: 'child', name: 'Aaa', dependsOn: ['base'] }); // name 字典序在前的反而依赖后者
  broker.registerType({ id: 'base', name: 'Zzz' });
  const ids = broker.list().map((d) => d.id);
  assert(ids.join(',') === 'base,child', `依赖应排前，实际：${ids.join(',')}`);
});

test('singleton：重复开卡聚焦已有实例不新建；多实例类型正常新建', () => {
  const broker = new CardTypeBroker();
  broker.registerType({ id: 'pool', name: 'Pool', singleton: true });
  broker.registerType({ id: 'win', name: 'Window' });
  const p1 = broker.createInstance('pool');
  const p2 = broker.createInstance('pool');
  assert(p1.id === p2.id, 'singleton 重复开卡应返回同一实例');
  assert(broker.focused?.id === p1.id, '聚焦应指向已有实例');
  assert(broker.getByType('pool').length === 1, 'singleton 应只有 1 个活实例');
  const w1 = broker.createInstance('win');
  const w2 = broker.createInstance('win');
  assert(w1.id !== w2.id && broker.getByType('win').length === 2, '多实例类型应正常新建');
});

test('serialize/restore 交班：实例表 + focused 一致（reload 户口不失忆）', () => {
  const broker = new CardTypeBroker();
  broker.registerType({ id: 'win', name: 'Window' });
  const w1 = broker.createInstance('win');
  const w2 = broker.createInstance('win');
  broker.destroyInstance(w1.id); // 留 w2，focused 置 null 后手动聚回
  broker.createInstance('win'); // w3，focused → w3
  const snap = broker.serialize();

  const fresh = new CardTypeBroker();
  fresh.registerType({ id: 'win', name: 'Window' });
  fresh.restore(snap);
  assert(fresh.getByType('win').length === 2, '交班后实例数应一致');
  assert(fresh.focused?.id === snap.focusedId, '交班后 focused 应一致');
  const w4 = fresh.createInstance('win');
  assert(!snap.instances.some((i) => i.id === w4.id), `新实例 id 不应撞旧户口：${w4.id}`);
  assert(w2.id !== w4.id, 'seq 续接不应复用 id');
});

test('disposeAll：broker 卸载 = 全类型销户 + 户口清零', () => {
  const broker = new CardTypeBroker();
  broker.registerType(defA);
  broker.registerType(defB);
  broker.createInstance('card-a');
  broker.disposeAll();
  assert(broker.list().length === 0 && broker.getByType('card-a').length === 0, '卸载后应全清零');
  assert(broker.focused === null, 'focused 应清空');
});

test('重名注册即抛（单一来源纪律）', () => {
  const broker = new CardTypeBroker();
  broker.registerType(defA);
  let msg = '';
  try {
    broker.registerType({ id: 'card-a', name: 'Alpha2' });
  } catch (e) {
    msg = (e as Error).message;
  }
  assert(msg.includes('重复注册'), `重名应抛，实际：${msg || '未抛错'}`);
});

test('未注册类型开卡即抛；未挂载内核时插件入口显式报错', () => {
  const broker = new CardTypeBroker();
  let msg = '';
  try {
    broker.createInstance('ghost');
  } catch (e) {
    msg = (e as Error).message;
  }
  assert(msg.includes('未注册类型'), `未注册开卡应抛，实际：${msg || '未抛错'}`);
  const ctx = new Context(); // 未 provide cardTypes
  let msg2 = '';
  try {
    registerCardType(ctx, defA);
  } catch (e) {
    msg2 = (e as Error).message;
  }
  assert(msg2.includes('内核未挂载'), `未挂载应显式报错，实际：${msg2 || '未抛错'}`);
});
