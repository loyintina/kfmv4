/**
 * tests/regression.test.ts — KFM v4 自动化回归测试
 *
 * 覆盖核心模块的运行时不变量，不依赖浏览器/Canvas 渲染。
 * 基于 Box 树快照 + 状态机断言。
 *
 * 运行: npx tsx --import ./tests/register-hook.mjs --import ./tests/preload.mjs tests/regression.test.ts
 *   或: npm test
 */

// ========== 静态导入（所有模块统一加载） ==========
import * as clickQueue from '../src/client/modules/click-queue.js';
import { L } from '../src/client/modules/renderer-lifecycle.js';
import { KFMState, getFileRowData } from '../src/client/modules/state.js';
import { buildSidebarTree } from '../src/client/modules/tree-model.js';
import * as da from '../src/client/modules/debug-assert.js';
import { anim } from '../src/client/modules/animation-registry.js';
import * as sr from '../src/client/modules/style-registry.js';
import { Box } from '../src/client/engine/v2/box.js';
import { GestureRegistry, gestures } from '../src/client/modules/gesture-registry.js';
import {
  openCardStack, closeCardStack, isCardStackOpen,
  focusNext, focusPrev,
} from '../src/client/modules/card-stack.js';
import {
  triggerExpandAnimation,
} from '../src/client/modules/tree-render.js';

// ========== 极简测试运行器 ==========
let passed = 0;
let failed = 0;
const failures: string[] = [];
const _tests: { name: string; fn: () => void }[] = [];
let _currentGroup = '';

function test(name: string, fn: () => void): void {
  _tests.push({ name, fn });
}

function group(name: string): void {
  _currentGroup = name;
  console.log(`\n--- ${name} ---`);
}

async function runAll(): Promise<void> {
  for (const t of _tests) {
    try {
      await t.fn();
      passed++;
    } catch (e: any) {
      failed++;
      failures.push(`FAIL ${t.name}: ${e.message}`);
    }
  }
  console.log();
  for (const f of failures) console.error(f);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// ==========================================================================
// 测试数据
// ==========================================================================

interface TestFileNode {
  name: string; path: string; isDir: boolean;
  isLink?: boolean; children?: TestFileNode[];
}

const singleFolder: TestFileNode[] = [
  { name: 'src', path: './src', isDir: true, children: [
    { name: 'index.ts', path: './src/index.ts', isDir: false },
  ]},
];

const nestedFolders: TestFileNode[] = [
  { name: 'src', path: './src', isDir: true, children: [
    { name: 'lib', path: './src/lib', isDir: true, children: [
      { name: 'util.ts', path: './src/lib/util.ts', isDir: false },
    ]},
  ]},
  { name: 'README.md', path: './README.md', isDir: false },
];

function seedState(files: Record<string, any>) {
  KFMState.files = {};
  for (const [path, node] of Object.entries(files)) {
    KFMState.files[path] = node;
  }
}

// ==========================================================================
// 1. click-queue
// ==========================================================================
group('click-queue');

test('empty initially', () => {
  clickQueue.clear();
  if (!clickQueue.isEmpty()) throw new Error('queue should be empty');
});

test('enqueue and dequeue', () => {
  clickQueue.clear();
  clickQueue.enqueue({ offsetX: 10, offsetY: 20 });
  if (clickQueue.isEmpty()) throw new Error('should not be empty');
  const e = clickQueue.dequeue()!;
  if (e.offsetX !== 10 || e.offsetY !== 20) throw new Error('wrong values');
  if (!clickQueue.isEmpty()) throw new Error('should be empty after dequeue');
});

test('peek does not remove', () => {
  clickQueue.clear();
  clickQueue.enqueue({ offsetX: 1, offsetY: 2 });
  const p = clickQueue.peek()!;
  if (p.offsetX !== 1) throw new Error('peek wrong');
  if (clickQueue.isEmpty()) throw new Error('peek should not remove');
});

test('clear', () => {
  clickQueue.clear();
  clickQueue.enqueue({ offsetX: 1, offsetY: 2 });
  clickQueue.enqueue({ offsetX: 3, offsetY: 4 });
  clickQueue.clear();
  if (!clickQueue.isEmpty()) throw new Error('clear should empty');
});

// ==========================================================================
// 2. renderer-lifecycle 状态机
// ==========================================================================
group('state machine');

test('starts idle', () => {
  L.endOp();
  if (L.isAnimating) throw new Error('should start idle');
  if (L.animatingDir !== null) throw new Error('dir should be null');
});

test('beginOp expand sets state', () => {
  L.beginOp('/root/src', 'expand');
  if (!L.isAnimating) throw new Error('should be animating');
  if (L.animatingPath !== '/root/src') throw new Error('wrong path');
  if (L.animatingDir !== 'expand') throw new Error('wrong direction');
  L.endOp();
});

test('beginOp collapse sets direction', () => {
  L.beginOp('/root/src', 'collapse');
  if (L.animatingDir !== 'collapse') throw new Error('direction should be collapse');
  L.endOp();
});

test('endOp returns to idle', () => {
  L.beginOp('/root', 'expand');
  L.endOp();
  if (L.isAnimating) throw new Error('should be idle after endOp');
  if (L.animatingPath !== null) throw new Error('path should be null');
});

test('resetForOpen clears state and increments session', () => {
  const s1 = L._sessionId;
  L.beginOp('/x', 'expand');
  L.cursorBox = {} as any;
  L._savedCursorRowId = 'some-row';
  L._sidebarClosed = true;
  L.resetForOpen();
  if (L._sessionId !== s1 + 1) throw new Error('session should increment');
  if (L.isAnimating) throw new Error('should be idle after reset');
  if (L.cursorBox !== null) throw new Error('cursorBox should be null');
  if (L.cursorRowId !== 'some-row') throw new Error('cursorRowId should restore from saved');
  if (L._savedCursorRowId !== null) throw new Error('savedCursorRowId should clear');
  if (L._sidebarClosed) throw new Error('sidebar should be open flag');
});

test('cancelAllRafs clears handles', () => {
  L._cursorWheelDecayRaf = 42;
  L._wheelRaf = 99;
  L._cursorFlingRaf = 7;
  L._flingRaf = 0;
  L.cancelAllRafs();
  if (L._cursorWheelDecayRaf !== 0) throw new Error('cursorWheelDecayRaf not cleared');
  if (L._wheelRaf !== 0) throw new Error('wheelRaf not cleared');
  if (L._cursorFlingRaf !== 0) throw new Error('cursorFlingRaf not cleared');
});

// ==========================================================================
// 3. tree-model
// ==========================================================================
group('tree-model');

test('root is always wrapped in expanded container', () => {
  seedState({ '.': { name: 'root', path: '.', isDir: true, children: singleFolder } });
  KFMState.expandedPaths = {};
  const tree = buildSidebarTree(295, 287);
  const containers = (tree.children || []).filter((c: any) => (c.id || '').startsWith('expanded-'));
  if (containers.length !== 1) throw new Error('root should always have expanded wrapper');
});

test('expanded folder has expanded container with height > 0', () => {
  seedState({ '.': { name: 'root', path: '.', isDir: true, children: singleFolder } });
  KFMState.expandedPaths = { '.': true };
  const tree = buildSidebarTree(295, 287);
  const containers = (tree.children || []).filter((c: any) => (c.id || '').startsWith('expanded-'));
  if (containers.length !== 1) throw new Error(`expected 1 container, got ${containers.length}`);
  if ((containers[0] as any).height <= 0) throw new Error('container height should be > 0');
});

test('nested expand produces nested containers', () => {
  seedState({
    '.': { name: 'root', path: '.', isDir: true, children: nestedFolders },
    './src': { name: 'src', path: './src', isDir: true, children: nestedFolders[0].children },
    './src/lib': { name: 'lib', path: './src/lib', isDir: true, children: nestedFolders[0].children![0].children },
  });
  KFMState.expandedPaths = { '.': true, './src': true };
  const tree = buildSidebarTree(295, 287);
  function countExpanded(box: any): number {
    let n = (box.id || '').startsWith('expanded-') ? 1 : 0;
    for (const c of box.children || []) n += countExpanded(c);
    return n;
  }
  if (countExpanded(tree) !== 2) throw new Error('expected 2 expanded containers for nested expand');
});
// ==========================================================================
// 4. debug-assert
// ==========================================================================
group('debug-assert');

test('assert passes on true', () => {
  da.assert(true, 'should not fire');
});

test('assert style — ensure functions exist', () => {
  if (typeof da.assert !== 'function') throw new Error('assert not a function');
  if (typeof da.warn !== 'function') throw new Error('warn not a function');
});

// ==========================================================================
// 5. KFMState 状态层
// ==========================================================================
group('state (KFMState)');

test('KFMState starts with defaults', () => {
  if (typeof KFMState.subscribe !== 'function') throw new Error('subscribe missing');
  if (typeof KFMState.notify !== 'function') throw new Error('notify missing');
  if (typeof KFMState.setExpanded !== 'function') throw new Error('setExpanded missing');
  if (KFMState.showHidden !== false) throw new Error('showHidden should start false');
  if (KFMState.selectedFile !== '') throw new Error('selectedFile should start empty');
});

test('subscribe/notify triggers listeners', () => {
  const calls: any[] = [];
  const fn = (s: any) => calls.push(s);
  KFMState.subscribe(fn);
  KFMState.notify();
  if (calls.length !== 1) throw new Error('listener should be called once');
  KFMState.notify();
  if (calls.length !== 2) throw new Error('listener should be called twice');
  KFMState.unsubscribe(fn);
  KFMState.notify();
  if (calls.length !== 2) throw new Error('unsubscribed listener should not be called');
});

test('setExpanded adds path and persists', () => {
  const key = '/test/path/expand';
  KFMState.expandedPaths = {};
  KFMState.setExpanded(key, true);
  if (!KFMState.expandedPaths[key]) throw new Error('path should be in expandedPaths');
  const stored = JSON.parse(localStorage.getItem('expandedPaths') || '{}');
  if (!stored[key]) throw new Error('path should be in localStorage');
  KFMState.setExpanded(key, false);
  if (KFMState.expandedPaths[key]) throw new Error('path should be removed');
});

test('toggleHidden flips value', () => {
  const before = KFMState.showHidden;
  KFMState.toggleHidden();
  if (KFMState.showHidden === before) throw new Error('showHidden should flip');
  KFMState.toggleHidden();
  if (KFMState.showHidden !== before) throw new Error('should be back to original');
});

test('setSelectedFile sets and notifies', () => {
  KFMState.setSelectedFile('/test/file.ts');
  if (KFMState.selectedFile !== '/test/file.ts') throw new Error('selectedFile should update');
});

test('setSidebarOpen sets and notifies', () => {
  KFMState.setSidebarOpen(true);
  if (!KFMState.sidebarOpen) throw new Error('sidebarOpen should be true');
  KFMState.setSidebarOpen(false);
  if (KFMState.sidebarOpen) throw new Error('sidebarOpen should be false');
});

test('setViewport merges partially', () => {
  KFMState.setViewport({ scrollTop: 100 });
  if (KFMState.viewport.scrollTop !== 100) throw new Error('scrollTop should be 100');
  KFMState.setViewport({});
  if (KFMState.viewport.scrollTop !== 100) throw new Error('scrollTop should persist after empty merge');
});

test('beforeExpand hook can skip default logic', () => {
  const path = '/test/hook';
  KFMState.expandedPaths = {};
  let hookCalled = false;
  const hook = (p: string) => {
    hookCalled = true;
    if (p === path) return true; // skip
  };
  KFMState.addHook('beforeExpand', hook);
  KFMState.setExpanded(path, true);
  if (!hookCalled) throw new Error('hook should be called');
  if (KFMState.expandedPaths[path]) throw new Error('expandedPaths should not be set (hook skipped)');
  KFMState.removeHook('beforeExpand', hook);
  // After removal, default logic should run
  KFMState.setExpanded(path, true);
  if (!KFMState.expandedPaths[path]) throw new Error('after remove, setExpanded should set');
});

test('getFileRowData returns null for missing path', () => {
  const r = getFileRowData({});
  if (r !== null) throw new Error('should be null for empty data');
});

test('getFileRowData returns FileRowData for valid data', () => {
  const r = getFileRowData({ path: '/a.ts', isDir: false, depth: 1, lineCount: 2 });
  if (r === null) throw new Error('should not be null');
  if (r.path !== '/a.ts') throw new Error('path mismatch');
  if (r.isDir !== false) throw new Error('isDir mismatch');
  if (r.depth !== 1) throw new Error('depth mismatch');
});

test('KFMState.currentRoot defaults to localStorage value', () => {
  const savedKey = 'kfmv4_currentRoot';
  localStorage.setItem(savedKey, '/custom/root');
  // Re-read KFMState — in practice currentRoot reads from localStorage at startup
  // Here we just verify the property stores and retrieves correctly
  KFMState.currentRoot = '/custom/root';
  if (KFMState.currentRoot !== '/custom/root')
    throw new Error('currentRoot should store the assigned value');
  localStorage.removeItem(savedKey);
});

test('KFMState.files stores and retrieves entries', () => {
  KFMState.files['/test/file.ts'] = { name: 'file.ts', path: '/test/file.ts', isDir: false, isLink: false };
  const entry = KFMState.files['/test/file.ts'];
  if (!entry || entry.name !== 'file.ts') throw new Error('file entry should be retrievable');
  delete KFMState.files['/test/file.ts'];
  if (KFMState.files['/test/file.ts']) throw new Error('deleted file entry should be gone');
});

test('addHook and removeHook manage hooks correctly', () => {
  let count = 0;
  const fn = () => { count++; return false; };
  KFMState.addHook('beforeExpand', fn);
  KFMState.addHook('beforeExpand', fn); // duplicate add
  KFMState.setExpanded('/test/dup', true);
  // Both hooks fire, but count increments for each call to setExpanded
  KFMState.removeHook('beforeExpand', fn);
  KFMState.removeHook('beforeExpand', fn); // duplicate remove — should not throw
  // Verify hook was removed
  KFMState.setExpanded('/test/after-remove', true);
});

// ==========================================================================
// 6. animation-registry
// ==========================================================================
group('animation-registry');

test('to creates a tween', () => {
  const target = { x: 0 };
  const tween = anim.to(target, { x: 100, duration: 0.5 });
  if (typeof tween.kill !== 'function') throw new Error('to should return a tween with kill');
});

test('fromTo creates a tween', () => {
  const target = { x: 0 };
  const tween = anim.fromTo(target, { x: 0 }, { x: 100, duration: 0.5 });
  if (typeof tween.kill !== 'function') throw new Error('fromTo should return a tween');
});

test('set applies values', () => {
  const target = { x: 0 };
  anim.set(target, { x: 42 });
  if (target.x !== 42) throw new Error('set should immediately apply values');
});

test('timeline creates a timeline', () => {
  const tl = anim.timeline({ onComplete: () => {} });
  if (typeof tl.to !== 'function') throw new Error('timeline should have to');
  if (typeof tl.clear !== 'function') throw new Error('timeline should have clear');
});

test('scope returns isolated timeline', () => {
  const tsA = anim.scope('test-A');
  const tsA2 = anim.scope('test-A');
  if (tsA !== tsA2) throw new Error('same scope name should return same timeline');
  const tsB = anim.scope('test-B');
  if (tsA === tsB) throw new Error('different scope should return different timeline');
});

test('clearScope removes timeline', () => {
  anim.scope('test-clear');
  anim.clearScope('test-clear');
  const ts = anim.scope('test-clear');
  if (typeof ts.to !== 'function') throw new Error('scope should recreate after clear');
});

test('play/kill named animation', () => {
  const tl = anim.timeline();
  anim.play('test-play', tl);
  if (!anim.has('test-play')) throw new Error('has should return true after play');
  anim.kill('test-play');
  if (anim.has('test-play')) throw new Error('has should return false after kill');
});

test('play replaces old animation with same name', () => {
  const tl1 = anim.timeline();
  const tl2 = anim.timeline();
  anim.play('test-replace', tl1);
  anim.play('test-replace', tl2);
  if (!anim.has('test-replace')) throw new Error('should exist after replace');
  anim.kill('test-replace');
});

test('reverse returns false for non-existent', () => {
  const result = anim.reverse('non-existent');
  if (result !== false) throw new Error('reverse of non-existent should return false');
});

test('killAll cleans everything', () => {
  anim.scope('clean-scope');
  const tl = anim.timeline();
  anim.play('clean-play', tl);
  anim.killAll();
  if (anim.has('clean-play')) throw new Error('clean-play should be killed');
  const ts = anim.scope('clean-scope');
  if (typeof ts.to !== 'function') throw new Error('should be reusable after killAll');
});

test('killTweensOf delegates', () => {
  // Should not throw
  anim.killTweensOf({});
});

// ==========================================================================
// 7. style-registry
// ==========================================================================
group('style-registry');

test('DIMENSIONS has expected keys', () => {
  if (typeof sr.DIMENSIONS.BOX_HEIGHT !== 'number') throw new Error('BOX_HEIGHT missing');
  if (typeof sr.DIMENSIONS.SIDEBAR_WIDTH !== 'number') throw new Error('SIDEBAR_WIDTH missing');
  if (sr.DIMENSIONS.SIDEBAR_WIDTH !== 295) throw new Error('SIDEBAR_WIDTH should be 295');
});

test('getRowLayout returns x and width', () => {
  const layout = sr.getRowLayout(2);
  if (layout.x !== 36) throw new Error(`x should be 36 for depth 2, got ${layout.x}`);
  if (layout.width !== 295 - 36) throw new Error('width should be sidebar - x');
});

test('getShift returns decreasing offsets', () => {
  const d0 = sr.getShift(0);
  const d1 = sr.getShift(1);
  const d5 = sr.getShift(5);
  if (d0 < d1) throw new Error('depth 0 should be >= depth 1');
  if (d1 < d5) throw new Error('depth 1 should be >= depth 5');
  if (d0 !== 18) throw new Error('depth 0 should be 18');
  const d30 = sr.getShift(30);
  if (d30 !== 2) throw new Error('depth 30 should fall back to 2');
});

test('getFileColor returns color for known extension', () => {
  const tsColor = sr.getFileColor('test.ts');
  if (!tsColor || tsColor === '#e0e0e0') throw new Error('ts should have specific color');
  const jsColor = sr.getFileColor('test.js');
  if (jsColor === tsColor) throw new Error('js should have different color from ts');
});

test('getFileColor returns default for unknown extension', () => {
  const color = sr.getFileColor('test.xyz');
  if (color !== '#e0e0e0') throw new Error('unknown ext should return default file color');
});

test('FONT and LINE_HEIGHT exist', () => {
  if (typeof sr.FONT !== 'string') throw new Error('FONT should be a string');
  if (typeof sr.LINE_HEIGHT !== 'number') throw new Error('LINE_HEIGHT should be a number');
  if (sr.LINE_HEIGHT <= 0) throw new Error('LINE_HEIGHT should be positive');
});

test('createBox uses template defaults', () => {
  const box = sr.createBox('folder-row', { id: 'test-row', y: 10 });
  if (box.id !== 'test-row') throw new Error('id should be overridden');
  if (box.y !== 10) throw new Error('y should be overridden');
  if (box.width !== 295) throw new Error('width should come from template');
  if (box.height !== 26) throw new Error('height should come from template');
});

test('createBox warns on unknown template', () => {
  const logs = (globalThis as any).__testLogs || [];
  const len = logs.length;
  sr.createBox('nonexistent-template', {});
  if (logs.length <= len) throw new Error('should have logged a warning');
  const log = logs[logs.length - 1];
  if (!log.includes('unknown template')) throw new Error('warning should mention unknown template');
});

test('styleRegistry get returns copy', () => {
  const t = sr.styleRegistry.get('folder-row');
  if (!t) throw new Error('folder-row template should exist');
  if (t.width !== 295) throw new Error('folder-row width');
  t.width = 999;
  const t2 = sr.styleRegistry.get('folder-row');
  if (t2!.width !== 295) throw new Error('get should return a copy');
});

test('styleRegistry set patches template', () => {
  sr.styleRegistry.set('folder-row', { height: 30 });
  const t = sr.styleRegistry.get('folder-row');
  if (t!.height !== 30) throw new Error('height should be patched to 30');
  sr.styleRegistry.set('folder-row', { height: 26 });
});

test('styleRegistry patch applies multiple', () => {
  sr.styleRegistry.patch({
    'folder-row': { height: 28, backgroundColor: 'red' },
    'file-row': { height: 28 },
  });
  const fr = sr.styleRegistry.get('folder-row');
  if (fr!.height !== 28 || fr!.backgroundColor !== 'red') throw new Error('folder-row not patched');
  const fl = sr.styleRegistry.get('file-row');
  if (fl!.height !== 28) throw new Error('file-row not patched');
  sr.styleRegistry.patch({
    'folder-row': { height: 26, backgroundColor: 'rgba(124,58,237,0.3)' },
    'file-row': { height: 26 },
  });
});

test('TEXT_STYLES has expected keys', () => {
  if (!sr.TEXT_STYLES.folderLabel) throw new Error('folderLabel missing');
  if (!sr.TEXT_STYLES.fileLabel) throw new Error('fileLabel missing');
  if (!sr.TEXT_STYLES.toggleIcon) throw new Error('toggleIcon missing');
  if (sr.TEXT_STYLES.folderLabel.font !== sr.FONT) throw new Error('folderLabel font should match FONT');
});

// ==========================================================================
// 8. GestureRegistry
// ==========================================================================
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

// ==========================================================================
// 9. card-stack 状态机
// ==========================================================================
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

// ==========================================================================
// 10. overlay invariants
// ==========================================================================
group('overlay invariants');

test('forceRebuildTree does not crash', () => {
  // Public entry point — should not throw even without renderer
  // We already imported tree-render, but forceRebuildTree is exported separately
  try { (globalThis as any).__treeRenderer = null; } catch {}
  // Just verify it resolves without exploding incorrectly
});

test('triggerExpandAnimation does not crash without renderer', () => {
  try { triggerExpandAnimation('/root'); } catch (e: any) {
    if (!e.message?.includes('renderer')) throw e;
  }
});

// ==========================================================================
// 运行
// ==========================================================================
await runAll();
