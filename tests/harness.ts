// ==========================================================================
// tests/harness.ts — 测试运行器核心（隔离 / 分类标签 / 回归钉子）
//
// 设计见 docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 0。
//
// 向后兼容：test()/group()/runAll() 签名不变，现有 214 测试零改动即通过。
// 新增能力全部是可选参数或新函数：
//   - test(name, fn, { tag, reset })          分类标签 + 按需隔离
//   - regression(bar, commit, name, fn, opts)  回归钉子（绑定 B.A.R. 编号 + 修复 commit）
//   - beforeEach(fn)                           注册全局重置钩子（隔离用）
//   - TEST_TAG=integration 环境变量             只跑某一类
// ==========================================================================

export type TestTag = 'unit' | 'integration' | 'regression' | 'smoke';

export interface TestOpts {
  /** 分类标签，默认 'unit' */
  tag?: TestTag;
  /** 运行前执行所有 beforeEach 重置钩子（默认 false，保持旧行为） */
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
