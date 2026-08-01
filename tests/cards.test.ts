import { test, group } from './runner.js';
import assert from 'assert';
import { openCardStack, closeCardStack, isCardStackOpen, focusNext, focusPrev } from '../src/client/modules/card-stack.js';
import { cardRegistry as _cr } from '../src/client/modules/card-registry.js';
import type { CardInstance } from '../src/client/modules/card-registry.js';
import { createTmuxCardHandler } from '../src/client/modules/tmux-card.js';
import { createFloatingCard, enterFullscreen, dismissFloatingCard, hasFloatingCard } from '../src/client/modules/floating-card.js';
import { registerCardType } from '../src/client/modules/card-registry.js';

group('card-stack');

test('starts closed', () => {
  if (isCardStackOpen()) closeCardStack();
  if (isCardStackOpen()) throw new Error('should start closed');
});

test('openCardStack changes state', () => {
  if (isCardStackOpen()) closeCardStack();
  openCardStack();
  if (!isCardStackOpen()) throw new Error('should be open after open');
});

test('closeCardStack changes state', () => {
  if (!isCardStackOpen()) openCardStack();
  closeCardStack();
  if (isCardStackOpen()) throw new Error('should be closed after close');
});

test('open when already open is no-op', () => {
  if (!isCardStackOpen()) openCardStack();
  openCardStack();
  if (!isCardStackOpen()) throw new Error('should still be open');
});

test('close when already closed is no-op', () => {
  if (isCardStackOpen()) closeCardStack();
  closeCardStack();
  if (isCardStackOpen()) throw new Error('should still be closed');
});

test('focusNext cycles forward', () => {
  if (!isCardStackOpen()) openCardStack();
  for (let i = 0; i < 14; i++) focusNext();
  // Should not crash after wrapping around 7 cards twice
});

test('focusPrev cycles backward', () => {
  if (!isCardStackOpen()) openCardStack();
  for (let i = 0; i < 14; i++) focusPrev();
  // Should not crash
});

group('card-registry');

let _instCount = 0;
function _makeEl(): HTMLElement { return document.createElement('div'); }

test('focusCard sets focusedInstanceId', () => {
  const el = _makeEl();
  const inst = _cr.createInstance('test-type', el, el, { color1: '#fff', color2: '#000' });
  _cr.focusCard(inst.instanceId);
  if (_cr.focusedInstanceId !== inst.instanceId) throw new Error('focusedInstanceId should match');
  _cr.destroyInstance(inst.instanceId);
});

test('focusedInstanceId is null when no focus set', () => {
  if (_cr.focusedInstanceId !== null) throw new Error('should be null without focus');
});

test('focusCard overwrites previous focus', () => {
  const el1 = _makeEl(); const el2 = _makeEl();
  const a = _cr.createInstance('t', el1, el1, { color1: '#fff', color2: '#000' });
  const b = _cr.createInstance('t', el2, el2, { color1: '#fff', color2: '#000' });
  _cr.focusCard(a.instanceId);
  _cr.focusCard(b.instanceId);
  if (_cr.focusedInstanceId !== b.instanceId) throw new Error('should point to b');
  _cr.destroyInstance(a.instanceId);
  _cr.destroyInstance(b.instanceId);
});

test('destroyInstance clears focus if it was the focused card', () => {
  const el = _makeEl();
  const inst = _cr.createInstance('t', el, el, { color1: '#fff', color2: '#000' });
  _cr.focusCard(inst.instanceId);
  _cr.destroyInstance(inst.instanceId);
  if (_cr.focusedInstanceId !== null) throw new Error('focus should clear after destroy');
});

test('destroyInstance does not clear focus for other card', () => {
  const el1 = _makeEl(); const el2 = _makeEl();
  const a = _cr.createInstance('t', el1, el1, { color1: '#fff', color2: '#000' });
  const b = _cr.createInstance('t', el2, el2, { color1: '#fff', color2: '#000' });
  _cr.focusCard(a.instanceId);
  _cr.destroyInstance(b.instanceId);
  if (_cr.focusedInstanceId !== a.instanceId) throw new Error('focus should remain on a');
  _cr.destroyInstance(a.instanceId);
});

test('allocId allocates sequential numbers per pool', () => {
  const a1 = _cr.allocId('pool-A');
  const a2 = _cr.allocId('pool-A');
  if (a1 !== 1 || a2 !== 2) throw new Error('should be 1 then 2');
  const b1 = _cr.allocId('pool-B');
  if (b1 !== 1) throw new Error('pool-B should start at 1');
});

test('freeId recycles number', () => {
  const id = _cr.allocId('pool-recycle');
  if (id !== 1) throw new Error('first id should be 1');
  _cr.freeId('pool-recycle', 1);
  const id2 = _cr.allocId('pool-recycle');
  if (id2 !== 1) throw new Error('after free, should recycle 1');
  const id3 = _cr.allocId('pool-recycle');
  if (id3 !== 2) throw new Error('next should be 2');
});

test('createInstance sets createdAt and accents', () => {
  const el = _makeEl();
  const inst = _cr.createInstance('test-k', el, el, { color1: '#f00', color2: '#0f0' });
  if (!inst.createdAt || inst.createdAt <= 0) throw new Error('createdAt should be set');
  if (inst.accents.color1 !== '#f00') throw new Error('color1 mismatch');
  if (inst.accents.color2 !== '#0f0') throw new Error('color2 mismatch');
  _cr.destroyInstance(inst.instanceId);
});

test('getAll returns all active instances', () => {
  const el1 = _makeEl(); const el2 = _makeEl();
  const a = _cr.createInstance('t', el1, el1, { color1: '#fff', color2: '#000' });
  const b = _cr.createInstance('t', el2, el2, { color1: '#fff', color2: '#000' });
  const all = _cr.getAll();
  if (all.length < 2) throw new Error('should have at least 2 instances');
  const ids = all.map(i => i.instanceId);
  if (!ids.includes(a.instanceId) || !ids.includes(b.instanceId)) throw new Error('both ids should be present');
  _cr.destroyInstance(a.instanceId);
  _cr.destroyInstance(b.instanceId);
});

test('getByType filters correctly', () => {
  const el1 = _makeEl(); const el2 = _makeEl();
  const a = _cr.createInstance('type-x', el1, el1, { color1: '#fff', color2: '#000' });
  const b = _cr.createInstance('type-y', el2, el2, { color1: '#fff', color2: '#000' });
  const xs = _cr.getByType('type-x');
  if (xs.length !== 1 || xs[0].instanceId !== a.instanceId) throw new Error('should find exactly type-x');
  const ys = _cr.getByType('type-y');
  if (ys.length !== 1 || ys[0].instanceId !== b.instanceId) throw new Error('should find exactly type-y');
  _cr.destroyInstance(a.instanceId);
  _cr.destroyInstance(b.instanceId);
});

test('getInstance returns instance by id', () => {
  const el = _makeEl();
  const inst = _cr.createInstance('t', el, el, { color1: '#fff', color2: '#000' });
  const found = _cr.getInstance(inst.instanceId);
  if (found !== inst) throw new Error('getInstance should return the same instance');
  const missing = _cr.getInstance('nonexistent');
  if (missing !== undefined) throw new Error('getInstance should return undefined for missing');
  _cr.destroyInstance(inst.instanceId);
});

test('getInstanceByContentEl maps correctly', () => {
  const el = _makeEl();
  const inst = _cr.createInstance('t', el, el, { color1: '#fff', color2: '#000' });
  const found = _cr.getInstanceByContentEl(el);
  if (found !== inst) throw new Error('should find instance by contentEl');
  _cr.destroyInstance(inst.instanceId);
  const afterDestroy = _cr.getInstanceByContentEl(el);
  if (afterDestroy !== undefined) throw new Error('should be gone after destroy');
});

test('count reflects active instance number', () => {
  const before = _cr.count;
  const el = _makeEl();
  const inst = _cr.createInstance('t', el, el, { color1: '#fff', color2: '#000' });
  if (_cr.count !== before + 1) throw new Error('count should increase by 1');
  _cr.destroyInstance(inst.instanceId);
  if (_cr.count !== before) throw new Error('count should return to before');
});

group('tmux-card (factory)');

test('createTmuxCardHandler returns { activate, deactivate }', () => {
  const handler = createTmuxCardHandler();
  if (typeof handler.activate !== 'function') throw new Error('activate should be a function');
  if (typeof handler.deactivate !== 'function') throw new Error('deactivate should be a function');
});

test('createTmuxCardHandler multiple calls return independent handlers', () => {
  const h1 = createTmuxCardHandler();
  const h2 = createTmuxCardHandler();
  if (h1 === h2) throw new Error('each call should return a new handler');
});

group('floating-card');

// 注册文件卡片类型（在 tree-swipe.ts 中也有注册，但测试环境隔离不冲突）
registerCardType({
  typeId: 'test-file',
  icon: '', name: '', description: '测试文件卡片',
  kind: 'file',
  createHandler: (meta) => ({
    activate: (contentEl) => {
      const d = document.createElement('div');
      d.style.cssText = 'height:1000px;width:100%;overflow:auto';
      d.textContent = meta._testContent as string || 'test content';
      contentEl.appendChild(d);
    },
    deactivate: () => {},
  }),
});

test('createFloatingCard creates card in active state', () => {
  const card = createFloatingCard({
    id: 'test-fc-1',
    typeId: 'test-file',
    color1: '#7c3aed', color2: '#00d4ff',
    name: 'test',
    sourceX: 100, sourceY: 200,
    contentHandler: null,
  });
  assert(card !== null, 'card should be created');
  if (!card) return;
  // 同步 mock 中动画立即完成，state 为 active
  assert(card.state === 'active', `state should be active, got ${card.state}`);
  assert(card.el.classList.contains('floating-card'), 'should have floating-card class');
  assert(card.contentEl !== null, 'should have content element');
});

test('createFloatingCard with contentHandler activates content', () => {
  const card = createFloatingCard({
    id: 'test-fc-2',
    typeId: 'test-file',
    color1: '#7c3aed', color2: '#00d4ff',
    name: 'content-test',
    sourceX: 100, sourceY: 200,
    contentHandler: {
      activate: (contentEl) => {
        const d = document.createElement('div');
        d.textContent = 'hello';
        d.id = 'test-content-div';
        contentEl.appendChild(d);
      },
      deactivate: () => {},
    },
  });
  assert(card !== null, 'card should be created');
  if (!card) return;
  const found = card.contentEl.querySelector('#test-content-div');
  assert(found !== null, `content should be activated, innerHTML=${card.contentEl.innerHTML}`);
});

test('enterFullscreen transitions to fullscreen state', () => {
  const card = createFloatingCard({
    id: 'test-fc-4',
    typeId: 'test-file',
    color1: '#7c3aed', color2: '#00d4ff',
    name: 'fs-test',
    sourceX: 100, sourceY: 200,
  });
  assert(card !== null, 'card should be created');
  if (!card) return;
  assert(card.state === 'active', `should be active before fullscreen, got ${card.state}`);
  enterFullscreen(card);
  assert(card.state === 'fullscreen', `state should be fullscreen, got ${card.state}`);
  assert(card.isFullscreen === true, 'isFullscreen should be true');
  assert(card.el.classList.contains('fullscreen'), 'should have fullscreen class');
  assert(card.contentEl.style.touchAction === 'pan-y', `contentEl should have pan-y touch-action, got "${card.contentEl.style.touchAction}"`);
});

test('dismissFloatingCard removes card', () => {
  // 清理所有残留浮卡
  while (hasFloatingCard()) dismissFloatingCard(false);
  const card = createFloatingCard({
    id: 'test-fc-5',
    typeId: 'test-file',
    color1: '#7c3aed', color2: '#00d4ff',
    name: 'dismiss-test',
    sourceX: 100, sourceY: 200,
  });
  assert(card !== null, 'card should be created');
  if (!card) return;
  assert(hasFloatingCard(), 'should have floating card after creation');
  dismissFloatingCard(false, card.el);
  assert(!hasFloatingCard(), 'should NOT have floating card after dismiss');
  while (hasFloatingCard()) dismissFloatingCard(false);
});

group('floating-card 全屏唯一槽位');

test('enterFullscreen 完全关闭旧全屏卡（新来旧关，不再窗口化退回）', async () => {
  const { _floatingCards } = await import('../src/client/modules/floating-shared.js');
  while (hasFloatingCard()) dismissFloatingCard(false);
  const a = createFloatingCard({
    id: 'test-fs-old', typeId: 'test-file',
    color1: '#7c3aed', color2: '#00d4ff', name: 'old-fs',
    sourceX: 50, sourceY: 50,
  });
  const b = createFloatingCard({
    id: 'test-fs-new', typeId: 'test-file',
    color1: '#7c3aed', color2: '#00d4ff', name: 'new-fs',
    sourceX: 80, sourceY: 80,
  });
  assert(a && b, 'both cards should be created');
  if (!a || !b) return;
  enterFullscreen(a);
  assert(a.state === 'fullscreen', `a should be fullscreen, got ${a.state}`);
  enterFullscreen(b);
  assert(b.state === 'fullscreen', `b should be fullscreen, got ${b.state}`);
  // 旧卡 a 必须被完全关闭（从浮卡列表消失），而不是 exitFullscreen 退回浮卡态
  assert(!_floatingCards.includes(a), `old fullscreen card should be dismissed from _floatingCards, state=${a.state}`);
  while (hasFloatingCard()) dismissFloatingCard(false);
});

test('浮卡召唤不影响已有全屏卡', async () => {
  const { _floatingCards } = await import('../src/client/modules/floating-shared.js');
  while (hasFloatingCard()) dismissFloatingCard(false);
  const fs = createFloatingCard({
    id: 'test-fs-keep', typeId: 'test-file',
    color1: '#7c3aed', color2: '#00d4ff', name: 'keep-fs',
    sourceX: 50, sourceY: 50,
  });
  assert(fs, 'card should be created');
  if (!fs) return;
  enterFullscreen(fs);
  const f = createFloatingCard({
    id: 'test-float-1', typeId: 'test-file',
    color1: '#7c3aed', color2: '#00d4ff', name: 'float-1',
    sourceX: 100, sourceY: 100,
  });
  assert(f, 'floating card should be created');
  assert(fs.state === 'fullscreen', `fullscreen card should stay fullscreen after floating summon, got ${fs.state}`);
  assert(_floatingCards.includes(fs), 'fullscreen card should still exist');
  while (hasFloatingCard()) dismissFloatingCard(false);
});

group('card-stack 堆外点击关堆');

test('堆外 tap 关堆 / 堆内 tap 不关 / 滑动后不触发 tap 关堆', async () => {
  const { gestures } = await import('../src/client/modules/gesture-registry.js');
  const { initCardStack } = await import('../src/client/modules/card-stack.js');
  // 测试环境的 window mock 没有 addEventListener，先 stub（initCardStack 末尾要挂 resize 监听）
  const _origAdd = (window as any).addEventListener;
  if (typeof _origAdd !== 'function') (window as any).addEventListener = () => {};
  try {
    initCardStack();
  } finally {
    if (typeof _origAdd !== 'function') delete (window as any).addEventListener;
  }
  const h = (gestures as any)._handlers.find((x: any) => h_filter(x));
  function h_filter(x: any) { return x.id === 'card-stack-global'; }
  assert(h, 'card-stack-global handler should be registered');
  assert(typeof h.onEnd === 'function', 'card-stack-global should have onEnd (tap 关堆)');

  // 动画 mock 的 timeline onComplete 走 setTimeout（异步）但 reverse() 同步触发
  // onReverseComplete——close→open 紧挨会落到 closed。ensureOpen 循环重开+等落定来免疫。
  const settle = () => new Promise(r => setTimeout(r, 60));
  const ensureOpen = async () => {
    for (let i = 0; i < 5 && !isCardStackOpen(); i++) {
      openCardStack();
      await settle();
    }
    assert(isCardStackOpen(), 'stack should be open');
  };

  // 1) 堆外 tap（位移≈0，target 不在 .stack-card 内）→ 关堆
  await ensureOpen();
  h.onStart?.({} as any);
  h.onEnd?.({ target: document.body } as any, 0, 0, 100);
  assert(!isCardStackOpen(), 'tap outside stack should close it');

  // 2) 堆内 tap（target 在 .stack-card 内）→ 不关堆（走卡片自身 click 投卡）
  await ensureOpen();
  const cardEl = document.createElement('div');
  cardEl.className = 'stack-card';
  document.body.appendChild(cardEl);
  h.onStart?.({} as any);
  h.onEnd?.({ target: cardEl } as any, 0, 0, 100);
  assert(isCardStackOpen(), 'tap inside stack card should NOT close it');
  cardEl.remove();

  // 3) 形成滑动后松手 → 不触发 tap 关堆（位移超阈值）
  await ensureOpen();
  h.onStart?.({} as any);
  h.onMove?.({} as any, 30, 5, 100);
  h.onEnd?.({ target: document.body } as any, 30, 5, 100);
  assert(isCardStackOpen(), 'after real swipe, tap-close should not fire');
  closeCardStack();
});
