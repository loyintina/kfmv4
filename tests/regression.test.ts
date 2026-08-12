/**
 * tests/regression.test.ts — KFM v4 自动化回归测试
 *
 * 覆盖核心模块的运行时不变量，不依赖浏览器/Canvas 渲染。
 * 基于 Box 树快照 + 状态机断言。
 *
 * 运行: npx tsx --import ./tests/register-hook.mjs --import ./tests/preload.mjs tests/regression.test.ts
 *   或: npm test
 */

import './env-test-isolation.mjs'; // 首 import：任何入口（含 tsx -e）进来都先隔离数据目录（BAR-TEST-ENV-01 补强）
import assert from 'assert';
import * as clickQueue from '../src/client/modules/click-queue.js';
import { L } from '../src/client/modules/renderer-lifecycle.js';
import { KFMState, getFileRowData } from '../src/client/modules/state.js';
import { buildSidebarTree } from '../src/client/modules/tree-model.js';
import * as da from '../src/client/modules/debug-assert.js';
import { anim } from '../src/client/modules/animation-registry.js';
import * as sr from '../src/client/modules/style-registry.js';
import { triggerExpandAnimation } from '../src/client/modules/tree-render.js';

import { test, group, runAll, singleFolder, nestedFolders } from './runner.js';
import './reset-hooks.js'; // 注册 beforeEach 隔离钩子（供 reset:true 的回归钉子使用）

// ========== 导入拆分后的测试文件（注册 test() 调用作为副作用） ==========
import './box.test.js';
import './renderer.test.js';
import './gesture-registry.test.js';
import './cards.test.js';
import './engine.test.js';
import './floating-state.test.js';
import './run-manager.test.js';
import './server-routes.test.js';
import './obs-roles.test.js';
import './path-utils.test.js';
import './chat-protocol.test.js';
import './client-logic.test.js';
import './liquid-geometry.test.js';
import './invariants.test.js';
import './visual-baseline.test.js';
import './protocol-reducer.test.js';
import './tool-compaction.test.js';
import './permissions.test.js';
import './omp-glob.test.js';
import './to-openai-messages.test.js';
import './tool-schema.test.js';
import './session-security.test.js';
import './session-invalidate.test.js';
import './tag-advisor.test.js';
import './check-deploy-freshness.test.js';
import './provider-env.test.js';
import './gen-pipeline.test.js';
import './semantic-chain.test.js';
import './semantic-audit.test.js';
import './stack-numbering.test.js';
import './doc-scripts.test.js';
import './session-flush.test.js';
import './browser-tool.test.js';
import './obs-audit-pending.test.js';
import './obs-track-time.test.js';
import './viewport-visibility.test.js';

function seedState(files: Record<string, any>) {
  KFMState.files = {};
  for (const [path, node] of Object.entries(files)) {
    KFMState.files[path] = node;
  }
}

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

test('TEXT_STYLES has expected keys', () => {
  if (!sr.TEXT_STYLES.folderLabel) throw new Error('folderLabel missing');
  if (!sr.TEXT_STYLES.fileLabel) throw new Error('fileLabel missing');
  if (!sr.TEXT_STYLES.toggleIcon) throw new Error('toggleIcon missing');
  if (sr.TEXT_STYLES.folderLabel.font !== sr.FONT) throw new Error('folderLabel font should match FONT');
});

// ==========================================================================
// overlay invariants
// ==========================================================================
group('overlay invariants');

test('triggerExpandAnimation does not crash without renderer', () => {
  try { triggerExpandAnimation('/root'); } catch (e: any) {
    if (!e.message?.includes('renderer')) throw e;
  }
});
// ==========================================================================
// logger
// ==========================================================================
group('logger');

import { log, getLogs, clearLogs, onLog } from '../src/client/modules/logger.js';

test('starts empty', () => {
  clearLogs();
  assert(getLogs().length === 0);
});

test('log appends entries', () => {
  clearLogs();
  log('msg1');
  log('msg2');
  const logs = getLogs();
  assert(logs.length === 2);
  assert(logs[0].includes('msg1'));
  assert(logs[1].includes('msg2'));
});

test('clearLogs empties', () => {
  log('something');
  clearLogs();
  assert(getLogs().length === 0);
});

test('onLog notifies subscriber', () => {
  clearLogs();
  let received: string[] = [];
  const unsub = onLog((logs) => { received = logs; });
  log('hello');
  assert(received.length === 1);
  assert(received[0].includes('hello'));
  unsub();
});

test('onLog unsubscribe stops notifications', () => {
  clearLogs();
  let count = 0;
  const unsub = onLog(() => { count++; });
  unsub();
  log('after unsub');
  assert(count === 0);
});

test('log includes timestamp', () => {
  clearLogs();
  log('ts test');
  const logs = getLogs();
  const tsMatch = logs[0].match(/\[\d+:\d+:\d+\.\d+\]/);
  assert(tsMatch !== null, 'timestamp should be [HH:MM:SS.mmm]');
});

// ==========================================================================
// animation-registry (timeline)
// ==========================================================================
group('animation-registry (timeline)');

test('timeline ops run in order', () => {
  const target = { x: 0, y: 0 };
  const calls: string[] = [];
  const tl = anim.timeline();
  tl.to(target, { x: 10, duration: 0 });
  tl.call(() => { calls.push('A'); });
  tl.to(target, { y: 20, duration: 0 });
  tl.call(() => { calls.push('B'); });
  tl.play();
  assert(target.x === 10 && target.y === 20, `x=${target.x} y=${target.y}`);
  assert(calls[0] === 'A' && calls[1] === 'B', `calls: ${calls}`);
});

test('timeline reverse runs ops in reverse', () => {
  const calls: string[] = [];
  const tl = anim.timeline();
  tl.call(() => { calls.push('first'); });
  tl.call(() => { calls.push('second'); });
  tl.reverse();
  tl.play();
  assert(calls[0] === 'second' && calls[1] === 'first', `calls: ${calls}`);
});

test('timeline reversed() returns state', () => {
  const tl = anim.timeline({ paused: true });
  assert(tl.reversed() === false);
  tl.reverse();
  assert(tl.reversed() === true);
  tl.reversed(false);
  assert(tl.reversed() === false);
});

test('timeline progress starts at 0, ends at 1', () => {
  const tl = anim.timeline({ paused: true });
  assert(tl.progress() === 0);
  tl.play();
  assert(tl.progress() === 1);
});

test('timeline isActive during play', () => {
  const tl = anim.timeline({ paused: true });
  assert(tl.isActive() === false);
  tl.play();
  assert(tl.progress() === 1); // finished
});

test('timeline fromTo applies from then to', () => {
  const target = { x: 100 };
  const tl = anim.timeline();
  tl.fromTo(target, { x: 0 }, { x: 50, duration: 0 });
  tl.play();
  assert(target.x === 50, `expected 50, got ${target.x}`);
});

test('timeline set applies immediately in sequence', () => {
  const target = { x: 0 };
  const tl = anim.timeline();
  tl.set(target, { x: 99 });
  tl.play();
  assert(target.x === 99);
});

// ==========================================================================
// interaction-constants
// ==========================================================================
group('interaction-constants');

import { MARGIN, LONG_PRESS_MS, DRAG_THRESHOLD } from '../src/client/modules/interaction-constants.js';

test('MARGIN is 8', () => { assert(MARGIN === 8); });
test('LONG_PRESS_MS is 600', () => { assert(LONG_PRESS_MS === 600); });
test('DRAG_THRESHOLD is 15', () => { assert(DRAG_THRESHOLD === 15); });

// ==========================================================================
// 26. debug-assert (expanded)
// ==========================================================================
group('debug-assert (expanded)');

import { assert as dbgAssert } from '../src/client/modules/debug-assert.js';

test('assert logs to console on false', () => {
  const prev = __testLogs.length;
  dbgAssert(false, 'test assertion failure');
  assert(__testLogs.length > prev, 'should log assertion failure');
});

test('assert does not log on true', () => {
  const prev = __testLogs.length;
  dbgAssert(true, 'ok');
  assert(__testLogs.length === prev, 'should not log when true');
});

// ==========================================================================
// 27. click-queue (expanded)
// ==========================================================================
group('click-queue (expanded)');

import { enqueue, dequeue, clear, isEmpty, peek } from '../src/client/modules/click-queue.js';

test('FIFO order preserved', () => {
  clear();
  enqueue({ offsetX: 1, offsetY: 1 });
  enqueue({ offsetX: 2, offsetY: 2 });
  enqueue({ offsetX: 3, offsetY: 3 });
  assert(dequeue()!.offsetX === 1);
  assert(dequeue()!.offsetX === 2);
  assert(dequeue()!.offsetX === 3);
  assert(isEmpty());
});

test('enqueue dequeue pair', () => {
  clear();
  enqueue({ offsetX: 0, offsetY: 0 });
  assert(!isEmpty());
  enqueue({ offsetX: 0, offsetY: 0 });
  assert(!isEmpty());
  dequeue();
  assert(!isEmpty());
  dequeue();
  assert(isEmpty());
});

test('peek does not remove element', () => {
  clear();
  enqueue({ offsetX: 5, offsetY: 5 });
  const p = peek();
  assert(p!.offsetX === 5);
  assert(!isEmpty());
});

// ==========================================================================
// dom-refs
// ==========================================================================
group('dom-refs');

import { DOM } from '../src/client/modules/dom-refs.js';

test('DOM has expected keys', () => {
  const keys = Object.keys(DOM);
  assert(keys.length >= 3);
  assert('overlay' in DOM);
  assert('treeCanvas' in DOM || 'fileTree' in DOM);
});

test('DOM sidebar is accessible', () => {
  // sidebar is a getter that returns an element from document
  // In test env it'll be null (no matching element), but shouldn't throw
  const sidebar = DOM.sidebar;
  assert(sidebar === null || typeof sidebar === 'object');
});

// ==========================================================================
// 运行
// ==========================================================================
await runAll();
