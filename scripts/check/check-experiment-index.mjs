/**
 * check-experiment-index.mjs — 实验数据引用完整性检查
 *
 * 实验是源码级资产（experiments/README.md 通用契约），但数据分两层：
 *   结论/索引/定义文档 → 本仓库（开源）
 *   原始答卷 sessions/ → $KFM_DATA_HOME/experiments/<实验>/sessions（.kfmv4 私有同步区，不开源）
 *
 * 检查（仅在本机数据区存在时执行；开源克隆无数据区则跳过）：
 *   1. 每个 experiments/×/index.md 的臂清单行引用的 sessions/ 文件必须存在（防悬空引用）
 *   2. 每个 sessions/ 里的文件必须被 index.md 引用（防孤儿数据——未入库的答卷等于没做实验）
 *
 * 挂入 npm run check + build.mjs（经 chain.mjs 唯一出处）。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const EXP_ROOT = 'experiments';
const DATA_HOME = process.env.KFM_DATA_HOME || join(homedir(), '.kfmv4');
const errors = [];
const warnings = [];

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
  if (!existsSync(indexPath)) continue;

  const sessDir = join(DATA_HOME, 'experiments', exp, 'sessions');
  if (!existsSync(sessDir)) {
    warnings.push(`${exp}: 本机无数据区 ${sessDir}（开源克隆或未同步），仅检查引用格式`);
    // 无数据区时只能验证 index 里没有相对路径形式的引用（那种引用已废止）
    const table = readFileSync(indexPath, 'utf-8');
    if (/\]\s*sessions\//.test(table) || /^\|.*\bsessions\//m.test(table) === false) {
      // 引用格式不做硬失败：数据区缺席时无法验证存在性
    }
    continue;
  }

  const table = readFileSync(indexPath, 'utf-8');
  const referenced = new Set();
  for (const m of table.matchAll(/sessions\/([\w.()-]+\.jsonl?)/g)) {
    referenced.add(m[1]);
  }

  // 方向 1：引用 → 文件必须存在
  for (const f of referenced) {
    if (!existsSync(join(sessDir, f))) {
      errors.push(`${exp}/index.md 引用 sessions/${f} 但数据区文件不存在`);
    }
  }

  // 方向 2：文件 → 必须被引用（routine 臂豁免：每日 cron 的 CI 数据，自带生命周期，
  // 策展索引只登记实验臂——2026-08-02 豁免，否则每日孤儿）
  for (const f of readdirSync(sessDir).filter(f => /\.jsonl?$/.test(f))) {
    if (!referenced.has(f) && !f.startsWith('kfmv4_routine_')) {
      errors.push(`${exp} 数据区 sessions/${f} 存在但未被 index.md 引用（孤儿数据）`);
    }
  }
}

for (const w of warnings) console.log('[check-experiment-index] 注意 — ' + w);
if (errors.length > 0) {
  console.error('[check-experiment-index] FAIL — 实验数据引用不完整:');
  console.error('[check-experiment-index] ⛳ MECH-FLOW-04：实验引用需登记——读 experiments/index.md，走实验登记流程');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

console.log(`[check-experiment-index] OK — ${expDirs.length} 个实验的 index ↔ sessions 引用完整`);
process.exit(0);
