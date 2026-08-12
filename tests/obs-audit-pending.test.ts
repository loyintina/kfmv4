// ==========================================================================
// tests/obs-audit-pending.test.ts — 信箱 pending 口径钉子（BAR-EYES-PENDING-01）
//
// 2026-08-13 事故：eyes.ts 的 pending 读 inbox warn 行数——inbox 是 append-only
// 巡逻历史（warn 行 = 历史累计轮次，从不删除），把它的条数当「待裁决」会把历史
// 记录数当成当前未办件数（实测：inbox warn 21 条，audit-state keptFindings 总量
// 0——面板显示 21 是口径错误）。修复：pending 真相源改为 audit-state keptFindings
// 总量（collectAuditPending）。钉子用活断言：返回值必须等于手工累加结果，与
// keptFindings 实际值解耦；revert（改回 inbox warn 数）会红。
// ==========================================================================

import assert from 'assert';
import { readFileSync } from 'fs';
import { group, regression } from './runner.js';
import { collectAuditPending } from '../src/server/routes/obs.js';

// 活断言基准：手工读 audit-state，累加各任务 keptFindings 长度
function manualPending(): number {
  const j = JSON.parse(readFileSync('docs/ledger/semantic-audit-state.json', 'utf-8')) as { tasks?: Record<string, { keptFindings?: unknown[] }> };
  if (!j?.tasks) return 0;
  return Object.values(j.tasks).reduce((n, t) => n + (Array.isArray(t?.keptFindings) ? t.keptFindings.length : 0), 0);
}

group('obs-audit-pending — 信箱待裁决口径（BAR-EYES-PENDING-01）');

regression('BAR-EYES-PENDING-01a', 'obs', 'collectAuditPending = audit-state keptFindings 手工累加（活断言）', () => {
  assert.strictEqual(collectAuditPending(), manualPending());
});

regression('BAR-EYES-PENDING-01b', 'obs', 'pending 不数 inbox warn 行（换源后两数可分离）', () => {
  // 若 audit-state 为空而 inbox 有历史 warn 行，两者必然不同——正是本 bug 的形态。
  // 用「collectAuditPending 必须与手工累加一致」保证实现忠实于真相源，而不是
  // 顺着 inbox 行数；此断言在 keptFindings 非空时依然成立（活断言，不硬编码 0/21）。
  const pending = collectAuditPending();
  assert.strictEqual(pending, manualPending(), '必须永远等于 audit-state 手工累加，与 inbox 行数无关');
  assert(pending >= 0, 'pending 不能为负');
});
