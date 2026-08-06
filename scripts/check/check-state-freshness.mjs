/**
 * check-state-freshness.mjs — 状态类条目新鲜度硬标准（2026-08-02 立）
 *
 * 纪律（doc-maintenance §文档活性纪律）：**状态类条目必须自带失效触发器
 * （哈希/日期/构建门/巡逻），否则禁止落盘**——没有失效触发器的状态条目 = 永久静默。
 * 本脚本是这条纪律的硬标准：违反即构建中断。
 *
 * 载体现状（登记制：新状态类载体必须在此登记，未登记 = 无门 = 禁止）：
 *   - docs/ledger/semantic-exemptions.md（R1：哈希 + 临时必带 review-by）
 *   - docs/ledger/bugs.md（R2：无钉条目「✅ 修复/待钉/兜底」必带复核日）
 *   - docs/active/stack.yaml（R3：created 日期字段在场——yaml 化后 schema 由
 *     check-stack-status R0 把关，本规则退化为在场确认）
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const exPath = join(ROOT, 'docs/ledger/semantic-exemptions.md');
const bugsPath = join(ROOT, 'docs/ledger/bugs.md');

const errors = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => errors.push(m);

// ---- R1 豁免表：每行必带 40hex 哈希；临时必带 review-by（YYYY-MM-DD） ----
// 列序：id | 核心码 | 目标 | 关键词 | 类型 | review-by | 理由 | 登记 | 哈希
console.log('[check-state-freshness] R1 豁免登记表 schema');
const exLines = readFileSync(exPath, 'utf-8').split('\n');
let exCount = 0;
for (const line of exLines) {
  const m = /^\|\s*(EX-\d+)\s*\|\s*(SEM\d+)\s*\|\s*([^|]+?)\s*\|\s*[^|]*?\s*\|\s*(\S+?)\s*\|\s*([^|]*?)\s*\|/.exec(line);
  if (!m) continue;
  exCount++;
  const id = m[1];
  const type = m[4];
  const reviewBy = m[5];
  const hashM = /^\|\s*(EX-\d+)\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*([0-9a-f]{40})\s*\|/.exec(line);
  if (!hashM) bad(`R1 ${id}: 缺目标哈希（必须 40hex）`);
  else ok(`${id}: 哈希在`);
  if (type === '临时') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewBy)) bad(`R1 ${id}: 临时豁免必带 review-by（YYYY-MM-DD），实际「${reviewBy}」`);
    else ok(`${id}: 临时 review-by=${reviewBy}`);
  }
}
if (exCount === 0) bad('R1: 豁免登记表无条目（表损坏或格式变了）');
else ok(`R1: ${exCount} 条豁免 schema 完整`);

// ---- R2 bugs.md：无钉条目（✅ 修复/待钉/兜底）必带复核日 YYYY-MM-DD ----
console.log('[check-state-freshness] R2 bugs.md 无钉条目复核日');
const bugsLines = readFileSync(bugsPath, 'utf-8').split('\n');
let noNail = 0;
for (const line of bugsLines) {
  if (!line.startsWith('| BAR-')) continue;
  // 状态列含 修复/待钉/兜底 且 处置列无测试文件（= 无钉）
  const statusM = /^\| (BAR-[\w-]+) \| [^|]* \| [^|]* \| [^|]* \| (✅ 已钉|✅ 修复|待钉|兜底)[^|]* \|/.exec(line);
  if (!statusM) continue;
  const id = statusM[1];
  const status = statusM[2];
  if (status.startsWith('✅ 已钉')) continue; // 有钉，测试守护
  noNail++;
  if (!/复核日\s*\d{4}-\d{2}-\d{2}/.test(line)) bad(`R2 ${id}: 无钉条目（${status}）必带「复核日 YYYY-MM-DD」`);
  else ok(`${id}: 复核日`);
}
if (noNail === 0) ok('R2: 无钉条目 0 条');
else console.log(`  R2: ${noNail} 条无钉条目`);

// ---- R3 STACK：状态日期在场（yaml 化后 = created 字段必填且合法，check-stack-status R0 已机械把关；本规则退化为在场确认） ----
console.log('[check-state-freshness] R3 STACK 状态日期（yaml created 字段）');
const stackYaml = readFileSync(join(ROOT, 'docs/active/stack.yaml'), 'utf-8');
const createdLines = stackYaml.split('\n').filter(l => /^\s+created: '\d{4}-\d{2}-\d{2}'$/.test(l));
if (createdLines.length === 0) bad('R3: stack.yaml 无 created 日期行（schema 面坏了——check-stack-status R0 应已拦截）');
ok(`R3: ${createdLines.length} 条 created 日期行在场（必填+格式由 check-stack-status R0 把关）`);

// ---- 汇总 ----
console.log('---');
if (errors.length) {
  for (const e of errors) console.error(`  ❌ ${e}`);
  console.error(`[check-state-freshness] ${errors.length} 处违反状态新鲜度纪律，构建中断`);
  console.error('[check-state-freshness] ⛳ MECH-FLOW-07：状态词必须带时点标注——读 docs/guides/doc-maintenance.md §时点标注，走 workflows/doc-write.yaml 第 3 步或 state-sync.yaml');
  process.exit(1);
}
console.log('[check-state-freshness] OK — 状态类条目全部自带失效触发器');
