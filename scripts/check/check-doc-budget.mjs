/**
 * check-doc-budget.mjs — 加载类文档预算线机械执行（v8.2 批 1）
 *
 * 契约：docs/guides/doc-maintenance.md「加载类文件预算线」节——
 *   CLAUDE.md（每会话注入）≤ 60 行；domains/＊/contract.md（pre-code-gate 每域加载）≤ 150 行。
 * 超线 = 路由/契约膨胀信号，须做密度改写（不为压缩而压缩）。
 * 挂入 npm run check，超线 = 构建中断。
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));

// 预算线（契约：doc-maintenance.md「加载类文件预算线」，改线先改契约）
const BUDGETS = [
  { file: 'CLAUDE.md', max: 60 },
];

const domainsDir = join(ROOT, DOCS_ROOT, 'domains');
for (const d of readdirSync(domainsDir, { withFileTypes: true })) {
  if (d.isDirectory()) BUDGETS.push({ file: `${DOCS_ROOT}/domains/${d.name}/contract.md`, max: 150 });
}

let errors = 0;
for (const { file, max } of BUDGETS) {
  const lines = readFileSync(join(ROOT, file), 'utf-8').split('\n').length;
  if (lines > max) {
    console.error(`[check-doc-budget] ${file}: ${lines} 行 > 预算线 ${max}（加载类文档膨胀，须密度改写）`);
    errors++;
  } else {
    console.log(`[check-doc-budget] ${file}: ${lines}/${max} ✅`);
  }
}

if (errors > 0) {
  console.error(`\n[check-doc-budget] ${errors} 个文件超预算线，构建中断。`);
  console.error('[check-doc-budget] ⛳ DOC-FLOW-07：加载类文档有注意力预算（150 行）——读 docs/guides/doc-architecture.md §读/存分区，走 workflows/doc-write.yaml 第 1 步');
  process.exit(1);
}
console.log('[check-doc-budget] OK — 全部加载类文档在预算线内');
