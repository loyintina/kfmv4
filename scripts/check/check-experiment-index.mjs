/**
 * check-experiment-index.mjs — 实验数据引用完整性检查
 *
 * 实验是源码级资产（experiments/README.md 通用契约）：
 *   1. 每个 experiments/×/index.md 的臂清单行引用的 sessions/ 文件必须存在（防悬空引用）
 *   2. 每个 sessions/ 里的文件必须被 index.md 引用（防孤儿数据——未入库的答卷等于没做实验）
 *
 * 挂入 npm run check + build.mjs（经 chain.mjs 唯一出处）。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const EXP_ROOT = 'experiments';
const errors = [];

let expDirs;
try {
  expDirs = readdirSync(EXP_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
} catch {
  console.log('[check-experiment-index] OK — 无 experiments/ 目录，跳过');
  process.exit(0);
}

for (const exp of expDirs) {
  const indexPath = join(EXP_ROOT, exp, 'index.md');
  const sessDir = join(EXP_ROOT, exp, 'sessions');
  if (!existsSync(indexPath)) continue;

  const table = readFileSync(indexPath, 'utf-8');
  const referenced = new Set();
  for (const m of table.matchAll(/sessions\/([\w.()-]+\.jsonl?)/g)) {
    referenced.add(m[1]);
  }

  // 方向 1：引用 → 文件必须存在
  for (const f of referenced) {
    if (!existsSync(join(sessDir, f))) {
      errors.push(`${exp}/index.md 引用 sessions/${f} 但文件不存在`);
    }
  }

  // 方向 2：文件 → 必须被引用
  if (existsSync(sessDir)) {
    for (const f of readdirSync(sessDir).filter(f => /\.jsonl?$/.test(f))) {
      if (!referenced.has(f)) {
        errors.push(`${exp}/sessions/${f} 存在但未被 index.md 引用（孤儿数据）`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('[check-experiment-index] FAIL — 实验数据引用不完整:');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

const total = expDirs.length;
console.log(`[check-experiment-index] OK — ${total} 个实验的 index ↔ sessions 引用完整`);
process.exit(0);
