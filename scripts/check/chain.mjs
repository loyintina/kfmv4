/**
 * chain.mjs — check 链唯一出处（v8.3 编译方向升档）
 *
 * 消灭 infra code-map 漂移 1（check 链双份手写拷贝必然漂移）：
 *   package.json "check" 与 build.mjs 不再各自维护检查清单，统一委托本文件。
 *   新增 check = 在 STEPS 加一行——check-checks 机检每个 check-*.mjs 都在链上、
 *   链上每个步骤指向的脚本都存在、build.mjs 不得回潮手写单个 check。
 *
 * 用法：
 *   node scripts/check/chain.mjs                  # 全链硬失败（npm run check）
 *   node scripts/check/chain.mjs --soft=<名>      # 指定步骤降级为提醒（仅 build.mjs 用于 check-uncommitted）
 */

import { spawnSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';

/** check 失败账本（错误码结晶数据源，8.5 观测）：每次构建中断记一条 */
const FAIL_LOG = join(homedir(), '.kfmv4', 'check-failures.jsonl');
function recordFailure(cmd, output) {
  try {
    mkdirSync(dirname(FAIL_LOG), { recursive: true });
    const m = output.match(/⛳\s*([A-Z]+-FLOW-\d+)/);
    const check = cmd.split('/').pop().split(' ')[0];
    appendFileSync(FAIL_LOG, JSON.stringify({
      ts: new Date().toISOString(),
      code: m ? m[1] : null,
      check,
      step: cmd.slice(0, 100),
      msg: output.trim().split('\n').filter(Boolean).pop()?.slice(0, 120) || '',
    }) + '\n');
  } catch { /* 账本不可写不阻断 */ }
}

/** 检查链耗时账本（观测台：构建/检查耗时，成功失败都记） */
const METRIC_LOG = join(homedir(), '.kfmv4', 'build-metrics.jsonl');
function recordCheckMetric(ms, ok) {
  try {
    appendFileSync(METRIC_LOG, JSON.stringify({ ts: new Date().toISOString(), phase: 'check', ms, ok }) + '\n');
  } catch { /* 账本不可写不阻断 */ }
}

export const STEPS = [
  'node scripts/check/check-uncommitted.mjs',
  'node scripts/check/check-deploy-freshness.mjs',
  'node scripts/check/check-versions.mjs',
  'node scripts/check/check-checks.mjs',
  'node scripts/check/check-doc-coverage.mjs',
  'node scripts/check/check-code-map-coverage.mjs',
  'node scripts/check/check-agent-script-docs.mjs',
  'node scripts/check/check-experiment-registry.mjs',
  'npx sass --no-source-map public/css/:public/css/',
  'node scripts/check/check-css-wiring.mjs',
  'node scripts/check/check-tool-compaction.mjs --check-only',
  'node scripts/check/check-anim.mjs --check-only',
  'node scripts/check/check-as-any.mjs --check-only',
  'node scripts/check/check-card-meta.mjs',
  'node scripts/check/check-registry.mjs --check-only',
  'node scripts/check/check-zindex.mjs',
  'node scripts/check/check-console.mjs',
  'node scripts/check/check-secrets.mjs',
  'node scripts/check/check-state-freshness.mjs',
  'node scripts/check/check-mutation-anchors.mjs',
  'node scripts/check/check-docs.mjs',
  'node scripts/check/check-consistency.mjs',
  'node scripts/check/check-active-stack.mjs',
  'node scripts/check/check-stack-status.mjs',
  'node scripts/check/check-inbox-heartbeat.mjs',
  'node scripts/check/check-code-doc-refs.mjs',
  'node scripts/check/check-workflow-integrity.mjs',
  'node scripts/check/check-cards.mjs',
  'node scripts/check/check-contract-freshness.mjs',
  'node scripts/check/check-test-patterns.mjs',
  'node scripts/check/check-bar-ledger.mjs',
  'node scripts/check/check-ledger-commits.mjs',
  'node scripts/check/check-doc-budget.mjs',
  'node scripts/check/check-doc-symbols.mjs',
  'node scripts/check/check-doc-scripts.mjs',
  'node scripts/check/check-doc-linerefs.mjs',
  'node scripts/check/check-doc-schema.mjs',
  'node scripts/check/check-commit-docs.mjs',
  'node scripts/check/check-fix-tests.mjs',
  'node scripts/check/check-hooks.mjs',
  'node scripts/check/gen-page-state-schema.mjs --check-only',
  'node scripts/check/gen-tool-docs.mjs --check-only',
  'node scripts/check/gen-permission-map.mjs --check-only',
  'node scripts/check/gen-rules-map.mjs --check-only',
  'node scripts/check/gen-experiments-list.mjs --check-only',
  'node scripts/check/gen-scripts-catalog.mjs --check-only',
  'node scripts/check/check-doc-orphans.mjs',
  'node scripts/check/check-probes.mjs',
  'node scripts/check/check-release-radar.mjs',
  'node scripts/check/check-experiment-index.mjs',
  'node scripts/check/sync-counts.mjs --check-only',
  'node scripts/check/gen-code-inventory.mjs --check-only',
  'node scripts/check/gen-contract-lists.mjs --check-only',
  'node scripts/check/gen-route-table.mjs --check-only',
  'npm test',
  'npx tsc --noEmit',
];

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const t0 = Date.now();
  const soft = process.argv.slice(2)
    .filter(a => a.startsWith('--soft='))
    .map(a => a.slice('--soft='.length));
  for (const cmd of STEPS) {
    const isSoft = soft.some(s => cmd.includes(s));
    // spawnSync 捕获输出（解析错误码记失败账本），再原样转发保持可见
    const r = spawnSync(cmd, [], { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status !== 0) {
      if (isSoft) {
        console.error(`[chain] ${cmd} 失败但已按 --soft 降级为提醒`);
        continue;
      }
      recordFailure(cmd, `${r.stdout || ''}${r.stderr || ''}`);
      recordCheckMetric(Date.now() - t0, false);
      console.error(`\n[chain] 步骤失败即中断：${cmd}`);
      process.exit(r.status ?? 1);
    }
  }
  recordCheckMetric(Date.now() - t0, true);
  console.log('[chain] OK — 全部步骤通过');
}
