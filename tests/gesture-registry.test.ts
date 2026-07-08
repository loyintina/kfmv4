import { test, group } from './runner.js';
import assert from 'assert';
import { GestureRegistry } from '../src/client/modules/gesture-registry.js';

group('gesture-registry');

// Each test uses a fresh GestureRegistry with clean document listeners
function makeRegistry(): GestureRegistry {
  // Clear any stale listeners from previous tests
  (globalThis as any).__clearDocumentListeners?.();
  return new GestureRegistry();
}

test('register returns unregister function', () => {
  const r = makeRegistry();
  const unreg = r.register({ id: 'a', targetFilter: () => true, priority: 1 });
  if (typeof unreg !== 'function') throw new Error('register should return function');
  if (!r.isRegistered('a')) throw new Error('a should be registered');
  unreg();
  if (r.isRegistered('a')) throw new Error('a should be unregistered');
});

test('handlers sorted by priority descending', () => {
  const r = makeRegistry();
  r.register({ id: 'low', targetFilter: () => true, priority: 10 });
  r.register({ id: 'high', targetFilter: () => true, priority: 100 });
  r.register({ id: 'mid', targetFilter: () => true, priority: 50 });
  const handlers = (r as any)._handlers;
  if (handlers[0].id !== 'high') throw new Error('high should be first');
  if (handlers[1].id !== 'mid') throw new Error('mid should be second');
  if (handlers[2].id !== 'low') throw new Error('low should be last');
});

test('unregister cleans active gesture', () => {
  const r = makeRegistry();
  r.register({ id: 'active-clean', targetFilter: () => true, priority: 10 });
  // Set it as active
  (r as any)._active = { handler: (r as any)._handlers[0], startX: 0, startY: 0, startTime: 0 };
  r.unregister('active-clean');
  if ((r as any)._active !== null) throw new Error('active should be cleared on unregister');
});

test('init adds document listeners', () => {
  const r = makeRegistry();
  const addCalls: string[] = [];
  const orig = document.addEventListener.bind(document);
  document.addEventListener = ((type: string, fn: any, opts: any) => {
    addCalls.push(type);
    orig(type, fn, opts);
  }) as any;
  r.init();
  // Restore
  document.addEventListener = orig;
  if (!addCalls.includes('pointerdown')) throw new Error('pointerdown should be registered');
  if (!addCalls.includes('pointermove')) throw new Error('pointermove should be registered');
  if (!addCalls.includes('pointerup')) throw new Error('pointerup should be registered');
  // Second init should be no-op
  r.init();
  if (addCalls.filter(c => c === 'pointerdown').length !== 1) throw new Error('init should be idempotent');
});

test('destroy removes document listeners', () => {
  const r = makeRegistry();
  const removeCalls: string[] = [];
  const origRemove = document.removeEventListener.bind(document);
  document.removeEventListener = ((type: string, fn: any, opts: any) => {
    removeCalls.push(type);
    origRemove(type, fn, opts);
  }) as any;
  r.init();
  r.destroy();
  document.removeEventListener = origRemove;
  if (!removeCalls.includes('pointerdown')) throw new Error('pointerdown should be removed');
  if (!removeCalls.includes('pointermove')) throw new Error('pointermove should be removed');
});

// ---- Integration: actual pointer event dispatch ----

test('onStart called for matching target (string filter)', () => {
  const r = makeRegistry();
  const called: string[] = [];
  r.register({
    id: 'string-filter',
    targetFilter: '.aclass',
    priority: 10,
    onStart: () => { called.push('start'); },
  });
  r.init();
  const target = document.createElement('div');
  target.classList.add('aclass');
  const evt = new PointerEvent('pointerdown', {
    clientX: 100, clientY: 200, target, bubbles: false, button: 0,
  } as any);
  document.dispatchEvent(evt);
  if (called.length !== 1) throw new Error('onStart should be called for matching target');
});

test('onStart called for matching target (fn filter)', () => {
  const r = makeRegistry();
  const called: string[] = [];
  r.register({
    id: 'fn-filter',
    targetFilter: (target: any) => target.id === 'special-id',
    priority: 10,
    onStart: () => { called.push('start'); },
  });
  r.init();
  const target = document.createElement('div');
  target.id = 'special-id';
  const evt = new PointerEvent('pointerdown', {
    clientX: 100, clientY: 200, target, bubbles: false, button: 0,
  } as any);
  document.dispatchEvent(evt);
  if (called.length !== 1) throw new Error('onStart should be called for matching target');
});

test('condition prevents handler from firing', () => {
  const r = makeRegistry();
  const called: string[] = [];
  r.register({
    id: 'cond',
    targetFilter: () => true,
    condition: () => false,
    priority: 10,
    onStart: () => { called.push('start'); },
  });
  r.init();
  const evt = new PointerEvent('pointerdown', {
    clientX: 100, clientY: 200, bubbles: false, button: 0,
  } as any);
  document.dispatchEvent(evt);
  if (called.length > 0) throw new Error('handler should not fire when condition is false');
});

test('onBeforeStart can veto', () => {
  const r = makeRegistry();
  const called: string[] = [];
  r.register({
    id: 'veto',
    targetFilter: () => true,
    priority: 10,
    onBeforeStart: () => false,
    onStart: () => { called.push('start'); },
  });
  r.init();
  const evt = new PointerEvent('pointerdown', {
    clientX: 100, clientY: 200, bubbles: false, button: 0,
  } as any);
  document.dispatchEvent(evt);
  if (called.length > 0) throw new Error('handler should not fire when onBeforeStart returns false');
});

test('only highest priority handler fires', () => {
  const r = makeRegistry();
  const called: string[] = [];
  r.register({
    id: 'low', targetFilter: () => true, priority: 10,
    onStart: () => { called.push('low'); },
  });
  r.register({
    id: 'high', targetFilter: () => true, priority: 100,
    onStart: () => { called.push('high'); },
  });
  r.init();
  const evt = new PointerEvent('pointerdown', {
    clientX: 100, clientY: 200, bubbles: false, button: 0,
  } as any);
  document.dispatchEvent(evt);
  if (called.length !== 1) throw new Error('only one handler should fire');
  if (called[0] !== 'high') throw new Error('highest priority handler should fire');
});

test('disable/enable toggles all handlers', () => {
  const r = makeRegistry();
  const called: string[] = [];
  r.register({
    id: 'disable-test', targetFilter: () => true, priority: 10,
    onStart: () => { called.push('start'); },
  });
  r.init();
  const evt = new PointerEvent('pointerdown', {
    clientX: 100, clientY: 200, bubbles: false, button: 0,
  } as any);

  r.disable();
  document.dispatchEvent(evt);
  if (called.length > 0) throw new Error('handler should not fire when disabled');

  r.enable();
  document.dispatchEvent(evt);
  if (called.length !== 1) throw new Error('handler should fire after re-enable');
});

test('onMove receives dx, dy', () => {
  const r = makeRegistry();
  const moves: any[] = [];
  r.register({
    id: 'move-test', targetFilter: () => true, priority: 10,
    onStart: () => {},
    onMove: (_e: any, dx: number, dy: number) => { moves.push({ dx, dy }); },
  });
  r.init();
  // Start at (100, 100)
  document.dispatchEvent(new PointerEvent('pointerdown', {
    clientX: 100, clientY: 100, bubbles: false, button: 0,
  } as any));
  // Move to (150, 80) → dx=50, dy=-20
  document.dispatchEvent(new PointerEvent('pointermove', {
    clientX: 150, clientY: 80, bubbles: false, button: 0,
  } as any));
  if (moves.length !== 1) throw new Error('onMove should be called once');
  if (moves[0].dx !== 50) throw new Error(`dx should be 50, got ${moves[0].dx}`);
  if (moves[0].dy !== -20) throw new Error(`dy should be -20, got ${moves[0].dy}`);
});

test('condition change mid-gesture triggers onEnd', () => {
  const r = makeRegistry();
  let condValue = true;
  const ends: any[] = [];
  r.register({
    id: 'cond-end', targetFilter: () => true,
    condition: () => condValue,
    priority: 10,
    onStart: () => {},
    onEnd: (...args: any[]) => { ends.push(args); },
  });
  r.init();
  document.dispatchEvent(new PointerEvent('pointerdown', {
    clientX: 100, clientY: 100, bubbles: false, button: 0,
  } as any));
  condValue = false;
  document.dispatchEvent(new PointerEvent('pointermove', {
    clientX: 150, clientY: 100, bubbles: false, button: 0,
  } as any));
  if (ends.length !== 1) throw new Error('onEnd should be called when condition fails mid-gesture');
});

test('registered-by-id replaces previous', () => {
  const r = makeRegistry();
  r.register({ id: 'same-id', targetFilter: () => true, priority: 10 });
  r.register({ id: 'same-id', targetFilter: () => true, priority: 20 });
  const handlers = (r as any)._handlers;
  if (handlers.length !== 1) throw new Error('should only have one handler after replace');
  if (handlers[0].priority !== 20) throw new Error('priority should be updated');
});

group('gesture-registry (preMatchHook)');

function _makeReg(): GestureRegistry {
  // 清除文档事件监听残留
  (globalThis as any).__clearDocumentListeners?.();
  return new GestureRegistry();
}

function _clearReg(reg: GestureRegistry): void {
  reg.destroy();
}

test('addPreMatchHook fires on pointerdown', () => {
  const r = _makeReg();
  const calls: number[] = [];
  r.addPreMatchHook(() => { calls.push(1); });
  r.init();
  document.dispatchEvent(new PointerEvent('pointerdown', {
    clientX: 0, clientY: 0, button: 0, bubbles: false,
  } as any));
  if (calls.length !== 1) throw new Error('hook should be called once');
  _clearReg(r);
});

test('multiple hooks fire in registration order', () => {
  const r = _makeReg();
  const order: string[] = [];
  r.addPreMatchHook(() => { order.push('A'); });
  r.addPreMatchHook(() => { order.push('B'); });
  r.init();
  document.dispatchEvent(new PointerEvent('pointerdown', {
    clientX: 0, clientY: 0, button: 0, bubbles: false,
  } as any));
  if (order[0] !== 'A' || order[1] !== 'B') throw new Error('hooks should fire in order');
  _clearReg(r);
});

test('removePreMatchHook removes hook', () => {
  const r = _makeReg();
  let count = 0;
  const fn = () => { count++; };
  r.addPreMatchHook(fn);
  r.removePreMatchHook(fn);
  r.init();
  document.dispatchEvent(new PointerEvent('pointerdown', {
    clientX: 0, clientY: 0, button: 0, bubbles: false,
  } as any));
  if (count !== 0) throw new Error('removed hook should not fire');
  _clearReg(r);
});

test('removePreMatchHook of unregistered fn is no-op', () => {
  const r = _makeReg();
  r.removePreMatchHook(() => {}); // should not throw
  _clearReg(r);
});

test('addPreMatchHook hooks persist across gesture start/end', () => {
  const r = _makeReg();
  const calls: number[] = [];
  r.addPreMatchHook(() => { calls.push(1); });
  r.init();
  // Three separate pointerdown events
  for (let i = 0; i < 3; i++) {
    document.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: 0, clientY: 0, button: 0, bubbles: false,
    } as any));
  }
  if (calls.length !== 3) throw new Error('hook should fire on each pointerdown');
  _clearReg(r);
});
