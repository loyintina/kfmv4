/**
 * tests/gesture.test.ts — 手势分发 A 档考题（№14：注册→命中→摘除 / 层带独占）
 *
 * DOM 选择器路径（targetFilter 字符串）与真机手势行为归守视实拍 C 档，
 * node 侧用函数过滤 + fake event 驱动分发核心。
 */
import { Context } from 'cordis';
import { test, group, assert } from './runner.ts';
import { GestureRegistry, GestureLayer, registerGesture } from '../src/client/gesture.ts';
import { FakeEl } from './fake-dom.ts';

function fakePointer(target: FakeEl, x = 10, y = 10, id = 1): PointerEvent {
  return {
    pointerId: id,
    clientX: x,
    clientY: y,
    button: 0,
    target,
    type: 'pointerdown',
    stopPropagation() {},
  } as unknown as PointerEvent; // escape-ok: 分发核心只读这些字段
}

const anyTarget = (): boolean => true;

group('gesture（手势分发）');

test('注册 → 命中 onStart/onMove/onEnd 全链（dx/dy 正确）', () => {
  const reg = new GestureRegistry();
  const target = new FakeEl();
  const calls: string[] = [];
  reg.register({
    id: 'h1',
    layer: GestureLayer.FullscreenCard,
    targetFilter: anyTarget,
    onStart: () => calls.push('start'),
    onMove: (_e, dx, dy) => calls.push(`move:${dx},${dy}`),
    onEnd: (_e, dx, dy) => calls.push(`end:${dx},${dy}`),
  });
  reg.handleStart(fakePointer(target, 10, 10));
  reg.handleMove(fakePointer(target, 25, 10));
  reg.handleEnd(fakePointer(target, 25, 10));
  assert(calls.join('|') === 'start|move:15,0|end:15,0', `实际：${calls.join('|')}`);
});

test('层带冲突高带独占：1000 命中则 700 不命中（№14 A 档原话）', () => {
  const reg = new GestureRegistry();
  const target = new FakeEl();
  const calls: string[] = [];
  reg.register({ id: 'low', layer: GestureLayer.FileTree, targetFilter: anyTarget, onStart: () => calls.push('low') });
  reg.register({ id: 'high', layer: GestureLayer.MainOrb, targetFilter: anyTarget, onStart: () => calls.push('high') });
  reg.handleStart(fakePointer(target));
  assert(calls.join(',') === 'high', `应只有 high 命中，实际：${calls.join(',')}`);
});

test('同层带内 order 大者优先（层带内小序）', () => {
  const reg = new GestureRegistry();
  const target = new FakeEl();
  const calls: string[] = [];
  reg.register({ id: 'o0', layer: GestureLayer.FileTree, order: 0, targetFilter: anyTarget, onStart: () => calls.push('o0') });
  reg.register({ id: 'o5', layer: GestureLayer.FileTree, order: 5, targetFilter: anyTarget, onStart: () => calls.push('o5') });
  reg.handleStart(fakePointer(target));
  assert(calls.join(',') === 'o5', `应只有 o5 命中，实际：${calls.join(',')}`);
});

test('层带公约强制：裸数字/非法层带注册即抛', () => {
  const reg = new GestureRegistry();
  let msg = '';
  try {
    reg.register({ id: 'bad', layer: 950 as GestureLayer, targetFilter: anyTarget, onStart: () => {} });
  } catch (e) {
    msg = (e as Error).message;
  }
  assert(msg.includes('非法层带'), `应抛非法层带，实际：${msg || '未抛错'}`);
  let msg2 = '';
  try {
    reg.register({ id: 'bad2', layer: GestureLayer.FileTree, order: 100, targetFilter: anyTarget, onStart: () => {} });
  } catch (e) {
    msg2 = (e as Error).message;
  }
  assert(msg2.includes('越界'), `order 100 应抛越界，实际：${msg2 || '未抛错'}`);
});

test('condition=false 跳过，轮到次优 handler', () => {
  const reg = new GestureRegistry();
  const target = new FakeEl();
  const calls: string[] = [];
  reg.register({ id: 'gated', layer: GestureLayer.MainOrb, condition: () => false, targetFilter: anyTarget, onStart: () => calls.push('gated') });
  reg.register({ id: 'next', layer: GestureLayer.FileTree, targetFilter: anyTarget, onStart: () => calls.push('next') });
  reg.handleStart(fakePointer(target));
  assert(calls.join(',') === 'next', `condition=false 应跳过，实际：${calls.join(',')}`);
});

test('ctx.effect 注册：插件 dispose 后同点位不再命中（№14 补丁 1）', async () => {
  const reg = new GestureRegistry();
  const ctx = new Context();
  ctx.provide('gestures', reg);
  const target = new FakeEl();
  const calls: string[] = [];
  const fiber = ctx.plugin((child) => {
    registerGesture(child, { id: 'g1', layer: GestureLayer.FullscreenCard, targetFilter: anyTarget, onStart: () => calls.push('hit') });
  });
  await fiber;
  reg.handleStart(fakePointer(target));
  reg.handleEnd(fakePointer(target));
  assert(calls.length === 1, '注册后应命中 1 次');
  await fiber.dispose();
  reg.handleStart(fakePointer(target));
  assert(calls.length === 1, 'dispose 后同点位不应再命中');
});
