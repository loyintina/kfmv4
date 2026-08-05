/**
 * tree-perf.ts — 文件树性能监控
 *
 * 埋点统计：
 * - rebuildTree 耗时
 * - Box 创建数量/最大深度
 * - Overlay 创建数量
 * - 动画耗时
 *
 * 数据可通过 window.__treePerf.getData() 获取，用于调试和优化验证。
 */

import { log } from './logger.js';

export interface PerfSnapshot {
  rebuildCount: number;
  rebuildTotalMs: number;
  rebuildAvgMs: number;
  rebuildMaxMs: number;
  boxCreateCount: number;
  overlayCreateCount: number;
  maxTreeDepth: number;
  animTotalMs: number;
  lastRebuildMs: number;
  timestamp: number;
}

interface PerfState {
  rebuildCount: number;
  rebuildTimes: number[];
  boxCreateCount: number;
  overlayCreateCount: number;
  maxTreeDepth: number;
  animTimes: number[];
}

const _state: PerfState = {
  rebuildCount: 0,
  rebuildTimes: [],
  boxCreateCount: 0,
  overlayCreateCount: 0,
  maxTreeDepth: 0,
  animTimes: [],
};

let _rebuildStart = 0;
let _animStart = 0;

/** 标记 rebuildTree 开始 */
export function markRebuildStart(): void {
  _rebuildStart = performance.now();
}

/** 标记 rebuildTree 结束，记录耗时 */
export function markRebuildEnd(boxCount: number, depth: number): void {
  const ms = performance.now() - _rebuildStart;
  _state.rebuildCount++;
  _state.rebuildTimes.push(ms);
  _state.boxCreateCount = boxCount;
  if (depth > _state.maxTreeDepth) _state.maxTreeDepth = depth;
  
  // 保留最近 100 次数据
  if (_state.rebuildTimes.length > 100) _state.rebuildTimes.shift();
  
  console.log(`[tree-perf] rebuildTree: ${ms.toFixed(2)}ms, boxes=${boxCount}, depth=${depth}`);
}

/** 记录 Box 创建（批量计数用） */
export function recordBoxCreate(count: number): void {
  _state.boxCreateCount += count;
}

/** 标记动画开始 */
export function markAnimStart(): void {
  _animStart = performance.now();
}

/** 标记动画结束，记录耗时 */
export function markAnimEnd(): void {
  const ms = performance.now() - _animStart;
  _state.animTimes.push(ms);
  if (_state.animTimes.length > 100) _state.animTimes.shift();
  console.log(`[tree-perf] animation: ${ms.toFixed(2)}ms`);
}

/** 记录 Overlay 创建 */
export function recordOverlayCreate(count: number): void {
  _state.overlayCreateCount += count;
  log(`[tree-perf] overlay create: +${count}, total=${_state.overlayCreateCount}`);
}

/** 重置所有统计数据 */
export function reset(): void {
  _state.rebuildCount = 0;
  _state.rebuildTimes = [];
  _state.boxCreateCount = 0;
  _state.overlayCreateCount = 0;
  _state.maxTreeDepth = 0;
  _state.animTimes = [];
  console.log('[tree-perf] reset');
}

/** 获取性能快照 */
export function getData(): PerfSnapshot {
  const times = _state.rebuildTimes;
  return {
    rebuildCount: _state.rebuildCount,
    rebuildTotalMs: times.reduce((a, b) => a + b, 0),
    rebuildAvgMs: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
    rebuildMaxMs: times.length > 0 ? Math.max(...times) : 0,
    boxCreateCount: _state.boxCreateCount,
    overlayCreateCount: _state.overlayCreateCount,
    maxTreeDepth: _state.maxTreeDepth,
    animTotalMs: _state.animTimes.reduce((a, b) => a + b, 0),
    lastRebuildMs: times.length > 0 ? times[times.length - 1] : 0,
    timestamp: Date.now(),
  };
}

/** 打印性能摘要到控制台 */
export function printSummary(): void {
  const data = getData();
  console.group('[tree-perf] Summary');
  console.log(`rebuildTree: count=${data.rebuildCount}, avg=${data.rebuildAvgMs.toFixed(2)}ms, max=${data.rebuildMaxMs.toFixed(2)}ms`);
  console.log(`Box 创建：${data.boxCreateCount}`);
  console.log(`Overlay 创建：${data.overlayCreateCount}`);
  console.log(`最大深度：${data.maxTreeDepth}`);
  console.log(`动画总耗时：${data.animTotalMs.toFixed(2)}ms`);
  console.groupEnd();
}

// 挂载到 window 供调试
declare global {
  interface Window {
    __treePerf: {
      getData: () => PerfSnapshot;
      reset: () => void;
      printSummary: () => void;
    };
  }
}

if (typeof window !== 'undefined') {
  window.__treePerf = { getData, reset, printSummary };
}
