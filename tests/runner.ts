// ==========================================================================
// tests/runner.ts — 测试运行器入口
//
// 核心逻辑已迁移到 harness.ts（隔离/分类标签/回归钉子，见
// docs/design/REGRESSION_TESTING_SYSTEM.md 步骤 0）。本文件保持向后兼容的
// 再导出 + 测试数据夹具，现有 import 路径不变。
// ==========================================================================

export { test, group, runAll, regression, beforeEach } from './harness.js';
export type { TestTag, TestOpts } from './harness.js';

// ========== 测试数据 ==========

export interface TestFileNode {
  name: string; path: string; isDir: boolean;
  isLink?: boolean; children?: TestFileNode[];
}

export const singleFolder: TestFileNode[] = [
  { name: 'src', path: './src', isDir: true, children: [
    { name: 'index.ts', path: './src/index.ts', isDir: false },
  ]},
];

export const nestedFolders: TestFileNode[] = [
  { name: 'src', path: './src', isDir: true, children: [
    { name: 'lib', path: './src/lib', isDir: true, children: [
      { name: 'util.ts', path: './src/lib/util.ts', isDir: false },
    ]},
  ]},
  { name: 'README.md', path: './README.md', isDir: false },
];
