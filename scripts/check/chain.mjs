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

import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

export const STEPS = [
  'node scripts/check/check-uncommitted.mjs',
  'node scripts/check/check-versions.mjs',
  'node scripts/check/check-checks.mjs',
  'node scripts/check/check-doc-coverage.mjs',
  'npx sass --no-source-map public/css/:public/css/',
  'node scripts/check/check-css-wiring.mjs',
  'node scripts/check/check-tool-compaction.mjs --check-only',
  'node scripts/check/check-anim.mjs --check-only',
  'node scripts/check/check-as-any.mjs --check-only',
  'node scripts/check/check-card-meta.mjs',
  'node scripts/check/check-registry.mjs --check-only',
  'node scripts/check/check-zindex.mjs',
  'node scripts/check/check-console.mjs',
  'node scripts/check/check-docs.mjs',
  'node scripts/check/check-consistency.mjs',
  'node scripts/check/check-active-stack.mjs',
  'node scripts/check/check-stack-status.mjs',
  'node scripts/check/check-code-doc-refs.mjs',
  'node scripts/check/check-workflow-integrity.mjs',
  'node scripts/check/check-cards.mjs',
  'node scripts/check/check-contract-freshness.mjs',
  'node scripts/check/check-test-patterns.mjs',
  'node scripts/check/check-bar-ledger.mjs',
  'node scripts/check/check-ledger-commits.mjs',
  'node scripts/check/check-doc-budget.mjs',
  'node scripts/check/check-doc-symbols.mjs',
  'node scripts/check/check-doc-linerefs.mjs',
  'node scripts/check/check-doc-schema.mjs',
  'node scripts/check/check-commit-docs.mjs',
  'node scripts/check/check-hooks.mjs',
  'node scripts/check/check-probes.mjs',
  'node scripts/check/check-release-radar.mjs',
  'node scripts/check/sync-counts.mjs --check-only',
  'node scripts/check/gen-code-inventory.mjs --check-only',
  'npm test',
  'npx tsc --noEmit',
];

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const soft = process.argv.slice(2)
    .filter(a => a.startsWith('--soft='))
    .map(a => a.slice('--soft='.length));
  for (const cmd of STEPS) {
    const isSoft = soft.some(s => cmd.includes(s));
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
      if (isSoft) {
        console.error(`[chain] ${cmd} 失败但已按 --soft 降级为提醒`);
        continue;
      }
      console.error(`\n[chain] 步骤失败即中断：${cmd}`);
      process.exit(e.status ?? 1);
    }
  }
  console.log('[chain] OK — 全部步骤通过');
}
