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
 *   - docs/active/STACK.md（R3：状态词 `✅`/`⏳`/`⚠️` 同行带日期——格式规范已有，
 *     本脚本抽查新近条目）
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
console.log('[check-state-freshness] R1 豁免登记表 schema');
const exLines = readFileSync(exPath, 'utf-8').split('\n');
let exCount = 0;
for (const line of exLines) {
  const m = /^\|\s*(EX-\d+)\s*\|\s*(SEM\d+)\s*\|\s*([^|]+?)\s*\|\s*(\S+?)\s*\|\s*([^|]*?)\s*\|/.exec(line);
  if (!m) continue;
  exCount++;
  const [id, , , type, reviewBy] = [m[1], m[2], m[3], m[4], m[5]];
  const hashM = /^\|\s*(EX-\d+)\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*([0-9a-f]{40})\s*\|/.exec(line);
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

// ---- R3 STACK：状态词同行带日期（抽查最近 20 条 ✅/⏳） ----
console.log('[check-state-freshness] R3 STACK 状态同行日期');
const stackLines = readFileSync(join(ROOT, 'docs/active/STACK.md'), 'utf-8').split('\n');
let r3checked = 0;
for (const line of stackLines) {
  // 只查「状态词 = 条目标题行首标记」——中缀 ✅（如「批 0 归拢 ✅」）是描述进度不是状态
  const statusAtStart = /^\s*—\s*(✅|⏳)|^\d+\.\s.*—\s*(✅|⏳)/.exec(line) || /^\s*(\d+)\.\s/.test(line) && /—\s*(✅|⏳)/.test(line);
  if (!statusAtStart) continue;
  if (/^\s*[>#]/.test(line)) continue; // 跳过引用/标题
  const hasDate = /\d{4}-\d{2}-\d{2}/.test(line);
  r3checked++;
  if (!hasDate) bad(`R3: STACK 状态词无日期 → 「${line.trim().slice(0, 50)}」`);
}
ok(`R3: 抽查 ${r3checked} 条状态行`);

// ---- 汇总 ----
console.log('---');
if (errors.length) {
  for (const e of errors) console.error(`  ❌ ${e}`);
  console.error(`[check-state-freshness] ${errors.length} 处违反状态新鲜度纪律，构建中断`);
  process.exit(1);
}
console.log('[check-state-freshness] OK — 状态类条目全部自带失效触发器');
