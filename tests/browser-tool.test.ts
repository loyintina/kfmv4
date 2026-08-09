// ==========================================================================
// tests/browser-tool.test.ts — tab-worker 入口探测回归钉子
//
// BAR-107 (2026-08-10)：生产构建下 browser 工具永远「Tab worker init timed
// out after 30000ms」。根因链：
//   1. spawnTabWorker 硬编码 new NodeWorker('.../tab-worker-entry.ts')
//   2. dist 构建从不打包 worker 入口 → dist 里没有 tab-worker-entry.*
//   3. new NodeWorker 指向不存在的文件不抛同步错（异步 error 事件）
//   4. supervisor 初始化阶段没监听 error → 干等 ready → 30s 超时
//
// 修复：build.mjs 单独打包 tab-worker-entry.js + tab-supervisor 改为
// resolveTabWorkerEntry 探测（.js 优先 / .ts 兜底 / 都没有返回 null → 抛错
// 降级 inline）。本测试钉住 resolveTabWorkerEntry 的三种输入行为。
// ==========================================================================

import assert from 'assert';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { group, regression, test } from './runner.js';
import { resolveTabWorkerEntry } from '../src/server/ai/tools/omp/browser/tab-supervisor.js';

group('browser 工具 — tab-worker 入口探测');

// 临时目录夹具：建一个带指定文件的目录，测完清理
function makeDir(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'kfmv4-browser-test-'));
  for (const f of files) writeFileSync(join(dir, f), '// fixture');
  return dir;
}

regression('BAR-107a', 'fix-head', '只有 .js（生产构建产物）→ 返回 .js 路径', () => {
  const dir = makeDir(['tab-worker-entry.js']);
  try {
    const got = resolveTabWorkerEntry(dir);
    assert(got?.endsWith('tab-worker-entry.js'), `应命中 .js，得 ${got}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

regression('BAR-107b', 'fix-head', '只有 .ts（源码模式）→ 返回 .ts 路径', () => {
  const dir = makeDir(['tab-worker-entry.ts']);
  try {
    const got = resolveTabWorkerEntry(dir);
    assert(got?.endsWith('tab-worker-entry.ts'), `应命中 .ts，得 ${got}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

regression('BAR-107c', 'fix-head', '都没有 → 返回 null（调用方降级 inline，不再干等 30s）', () => {
  const dir = makeDir(['unrelated.js']);
  try {
    assert.strictEqual(resolveTabWorkerEntry(dir), null, '入口缺失必须返回 null');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('真实源码目录（src/.../omp/browser）→ 命中 .ts 入口', () => {
  // 仓库内真实源码目录应存在 tab-worker-entry.ts（源码模式路径）
  const srcDir = join(process.cwd(), 'src', 'server', 'ai', 'tools', 'omp', 'browser');
  const got = resolveTabWorkerEntry(srcDir);
  assert(got?.endsWith('tab-worker-entry.ts'), `源码目录应命中 .ts，得 ${got}`);
});
