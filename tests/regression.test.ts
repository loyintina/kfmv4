/**
 * tests/regression.test.ts — KFM v4 自动化回归测试
 *
 * 基于 Box 树快照 + 状态机断言，不依赖浏览器/Canvas。
 * 覆盖 BUG_FIXING_PHILOSOPHY.md 中定义的关键不变量。
 *
 * 运行: npx tsx tests/regression.test.ts
 */

// ========== 极简测试运行器 ==========
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e: any) {
    failed++;
    failures.push(`FAIL ${name}: ${e.message}`);
  }
}

function summary(): void {
  console.log(`\n${passed} passed, ${failed} failed`);
  for (const f of failures) console.error(f);
  process.exit(failed > 0 ? 1 : 0);
}

// ========== 测试数据 ==========
interface TestFileNode {
  name: string; path: string; isDir: boolean;
  isLink?: boolean; children?: TestFileNode[];
}

const singleFolder: TestFileNode[] = [
  { name: 'src', path: '/root/src', isDir: true, children: [
    { name: 'index.ts', path: '/root/src/index.ts', isDir: false },
  ]},
];

const nestedFolders: TestFileNode[] = [
  { name: 'src', path: '/root/src', isDir: true, children: [
    { name: 'lib', path: '/root/src/lib', isDir: true, children: [
      { name: 'util.ts', path: '/root/src/lib/util.ts', isDir: false },
    ]},
  ]},
  { name: 'README.md', path: '/root/README.md', isDir: false },
];

// ========== 测试 1: click-queue ==========
console.log('\n--- click-queue ---');
import * as clickQueue from '../src/client/modules/click-queue.js';

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

// ========== 测试 2: renderer-lifecycle 状态机 ==========
console.log('\n--- state machine ---');
import { L } from '../src/client/modules/renderer-lifecycle.js';

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

test('animatingPath setter defaults to expand (backward compat)', () => {
  L.animatingPath = '/root/test';
  if (L.animatingDir !== 'expand') throw new Error('setter should default to expand');
  L.endOp();
});

// ========== 测试 3: debug-assert ==========
console.log('\n--- debug-assert ---');
import * as da from '../src/client/modules/debug-assert.js';

test('assert passes on true', () => {
  da.assert(true, 'should not fire');
});

test('assert style — ensure functions exist', () => {
  if (typeof da.assert !== 'function') throw new Error('assert not a function');
  if (typeof da.warn !== 'function') throw new Error('warn not a function');
});

summary();
