/**
 * docs-status.mjs — 文档系统健康仪表盘（v8.2 批 3，非阻断观测）
 *
 * 定位：第三梯队——不进 check 阻断链（阻断职责归各 check-*），
 * 给压缩轮/审计/语义编译试点提供输入。用法：npm run docs:status
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const linesOf = f => readFileSync(f, 'utf-8').split('\n').length;

// ========== 层分布 ==========

console.log('== 层分布（文件数 / 总行数） ==');
for (const layer of ['constraints', 'domains', 'guides', 'ledger', 'workflows', 'active', 'decisions']) {
  const dir = join(ROOT, DOCS_ROOT, layer);
  let files = [];
  try { files = walk(dir).filter(f => f.endsWith('.md') || f.endsWith('.yaml')); } catch { continue; }
  const lines = files.reduce((s, f) => s + linesOf(f), 0);
  console.log(`  ${layer.padEnd(12)} ${String(files.length).padStart(2)} 文件 / ${lines} 行`);
}

// ========== 预算水位 ==========

console.log('\n== 预算水位（加载类文档） ==');
const budgets = [{ file: 'CLAUDE.md', max: 60 }];
for (const d of readdirSync(join(ROOT, DOCS_ROOT, 'domains'), { withFileTypes: true })) {
  if (d.isDirectory()) budgets.push({ file: `${DOCS_ROOT}/domains/${d.name}/contract.md`, max: 150 });
}
for (const { file, max } of budgets) {
  const n = linesOf(join(ROOT, file));
  const pct = Math.round((n / max) * 100);
  const bar = '█'.repeat(Math.round(pct / 10)).padEnd(10, '░');
  console.log(`  ${file.replace(DOCS_ROOT + '/domains/', '').padEnd(36)} ${String(n).padStart(3)}/${max} ${bar} ${pct}%${pct >= 90 ? ' ⚠️ 逼近线' : ''}`);
}

// ========== 账本 ==========

console.log('\n== BAR 账本 ==');
const bugs = readFileSync(join(ROOT, DOCS_ROOT, 'ledger', 'bugs.md'), 'utf-8');
const rows = bugs.split('\n').filter(l => l.startsWith('| BAR-'));
const dist = {};
for (const r of rows) {
  const status = (r.split('|')[5] || '').trim();
  const key = ['✅ 已钉', '✅ 修复', '待钉', '兜底', '跳过'].find(p => status.startsWith(p)) || '其他';
  dist[key] = (dist[key] || 0) + 1;
}
let nails = 0;
for (const f of readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.ts'))) {
  nails += (readFileSync(join(ROOT, 'tests', f), 'utf-8').match(/regression\('/g) || []).length;
}
console.log(`  ${rows.length} 行登记 / ${nails} 个回归钉；状态分布：${Object.entries(dist).map(([k, v]) => `${k} ${v}`).join(' / ')}`);

// ========== 管线 ==========

console.log('\n== 管线 ==');
const checks = readdirSync(join(ROOT, 'scripts/check')).filter(f => f.startsWith('check-') && f.endsWith('.mjs')).length;
const wfs = readdirSync(join(ROOT, DOCS_ROOT, 'workflows')).filter(f => f.endsWith('.yaml')).length;
console.log(`  ${checks} 个 check 脚本 / ${wfs} 张工作流卡`);
console.log('  阻断链健康状况见 npm run check；本报告不重复（失效探测器各司其职）');

console.log('\n[docs:status] 报告完。用途：压缩轮输入 / 审计起点 / 语义编译试点基线。');
