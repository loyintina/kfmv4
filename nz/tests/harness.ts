// ==========================================================================
// tests/harness.ts — 测试运行器核心（隔离 / 分类标签 / 回归钉子）
//
// 移植自 kfmv4 tests/harness.ts（8.7.2 测试基建移植）。逻辑原样，
// 仅两处 nz 环境适配：
//   1. nz tsconfig 无 node 类型（lib 仅 DOM），顶部 declare process 最小接口；
//   2. nz 不引 node:assert（同因），附统一 assert helper，考题一律用它。
// ==========================================================================

declare const process: {
  env?: { TEST_TAG?: string };
  exit(code: number): never;
};

/** 断言：cond 不成立即抛错（nz 考题统一断言入口） */
export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

export type TestTag = 'unit' | 'integration' | 'regression' | 'smoke';

export interface TestOpts {
  /** 分类标签，默认 'unit' */
  tag?: TestTag;
  /** 运行前执行所有 beforeEach 重置钩子（默认 false） */
  reset?: boolean;
}

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
  group: string;
  tag: TestTag;
  reset: boolean;
  /** 回归钉子元数据 */
  bar?: string;
  commit?: string;
}

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];
const _tests: TestCase[] = [];
const _beforeEach: Array<() => void> = [];
let _currentGroup = '';

/** 只跑此标签（来自 TEST_TAG 环境变量），未设则全跑 */
const _tagFilter = (typeof process !== 'undefined' && process.env?.TEST_TAG) || '';

/** 注册一个测试。opts 可选，缺省保持旧行为（tag='unit'，不重置）。 */
export function test(name: string, fn: () => void | Promise<void>, opts?: TestOpts): void {
  _tests.push({
    name,
    fn,
    group: _currentGroup,
    tag: opts?.tag ?? 'unit',
    reset: opts?.reset ?? false,
  });
}

/**
 * 回归钉子：绑定 B.A.R. 编号 + 修复 commit，钉住一个真实出过的 bug。
 * 挂了能一眼定位复发的历史 bug。默认标签 'regression'、默认开启隔离。
 *
 * 用法：regression('BAR-101', 'a5bf0c4', '生成结束后 __end__ 必发', () => { ... });
 */
export function regression(
  bar: string,
  commit: string,
  name: string,
  fn: () => void | Promise<void>,
  opts?: TestOpts,
): void {
  _tests.push({
    name: `${bar} (${commit}): ${name}`,
    fn,
    group: _currentGroup,
    tag: opts?.tag ?? 'regression',
    reset: opts?.reset ?? true,
    bar,
    commit,
  });
}

export function group(name: string): void {
  _currentGroup = name;
  console.log(`\n--- ${name} ---`);
}

/** 注册全局重置钩子：reset:true 的测试运行前会依次执行，清理跨测试共享状态。 */
export function beforeEach(fn: () => void): void {
  _beforeEach.push(fn);
}

function _runResets(): void {
  for (const fn of _beforeEach) {
    try { fn(); } catch (e) {
      console.error('[harness] beforeEach reset failed:', (e as Error).message);
    }
  }
}

export async function runAll(): Promise<void> {
  for (const t of _tests) {
    if (_tagFilter && t.tag !== _tagFilter) { skipped++; continue; }
    if (t.reset) _runResets();
    try {
      await t.fn();
      passed++;
    } catch (e: any) {
      failed++;
      failures.push(`FAIL [${t.tag}] ${t.name}: ${e.message}`);
    }
  }
  console.log();
  for (const f of failures) console.error(f);
  const tagNote = _tagFilter ? ` (filter: ${_tagFilter}, ${skipped} skipped)` : '';
  console.log(`\n${passed} passed, ${failed} failed${tagNote}`);
  process.exit(failed > 0 ? 1 : 0);
}
