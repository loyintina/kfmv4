// ==========================================================================
// tests/runner.ts — 测试运行器入口（再导出 + 测试数据夹具）
//
// 与 kfmv4 同构：考题文件一律从本文件 import，不直接碰 harness.ts。
// 夹具随需要追加（kfmv4 的 TestFileNode 等文件树夹具 8.9 时随迁）。
// ==========================================================================

export { test, group, runAll, regression, beforeEach, assert } from './harness.ts';
export type { TestTag, TestOpts } from './harness.ts';
