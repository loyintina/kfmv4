/**
 * check-bar-ledger.mjs — BAR 账本 ↔ 回归钉子交叉检查（v8.2 批 1）
 *
 * 契约：docs/guides/doc-maintenance.md「各层 grammar」bugs.md 节。
 *
 * 双向核对（doc-as-code：tests 是真相，bugs.md 是投影，机械对齐）：
 *   1. tests/ 每个 regression('BAR-xxx') 必须在 ledger 登记
 *      （精确 id / 父级剥单子字母 / 范围行覆盖）
 *   2. ledger 每个 ✅ 已钉 行必须有钉（同上；或括注「钉见 BAR-xxx」跨行声明）
 *   3. grammar：BAR id 全表唯一、状态列枚举前缀合法
 *
 * 挂入 npm run check，失配 = 构建中断。
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));

let errors = 0;
function error(msg) {
  console.error(`[check-bar-ledger] ${msg}`);
  errors++;
}

// ========== 1. 收集 tests/ 钉子 ==========

const nails = new Set();
for (const f of readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.ts'))) {
  const content = readFileSync(join(ROOT, 'tests', f), 'utf-8');
  for (const m of content.matchAll(/regression\('([^']+)'/g)) {
    nails.add(m[1]);
  }
}
console.log(`[check-bar-ledger] tests/ 钉子 ${nails.size} 个`);

// ========== 2. 解析 ledger 表行 ==========

const STATUS_PREFIXES = ['✅ 已钉', '✅ 修复', '待钉', '兜底', '跳过'];
const ID_RE = /^BAR-[A-Z0-9]+(-[A-Za-z0-9-]+)*$/;
const NUM_RANGE_RE = /^(BAR-[A-Z]+-)(\d+)…(\d+)$/;   // BAR-SEC-01…06
const LETTER_RANGE_RE = /^(BAR-\d+)([a-z])-([a-z])$/; // BAR-103a-c

const ledgerPath = join(ROOT, DOCS_ROOT, 'ledger', 'bugs.md');
const lines = readFileSync(ledgerPath, 'utf-8').split('\n');

const rows = [];       // { id, status, line }
const seenIds = new Set();
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.startsWith('| BAR-')) continue;
  const parts = line.split('|').map(s => s.trim());
  const id = parts[1].replace(/`/g, '');
  const status = parts[5] || '';
  rows.push({ id, status, line: i + 1 });

  const isRange = NUM_RANGE_RE.test(id) || LETTER_RANGE_RE.test(id);
  if (!isRange && !ID_RE.test(id)) {
    error(`bugs.md:${i + 1} BAR 编号格式非法：${id}`);
  }
  if (seenIds.has(id)) {
    error(`bugs.md:${i + 1} BAR 编号重复登记：${id}`);
  }
  seenIds.add(id);
  if (!STATUS_PREFIXES.some(p => status.startsWith(p))) {
    error(`bugs.md:${i + 1} 状态列非法（须以 ${STATUS_PREFIXES.join('/')} 开头）：${id} → "${status.slice(0, 30)}…"`);
  }
}
console.log(`[check-bar-ledger] ledger 登记 ${rows.length} 行`);

// ========== 3. 范围行展开 ==========

function expandRow(id) {
  const num = id.match(NUM_RANGE_RE);
  if (num) {
    const [, prefix, a, b] = num;
    const width = a.length;
    const out = [];
    for (let n = parseInt(a, 10); n <= parseInt(b, 10); n++) {
      out.push(prefix + String(n).padStart(width, '0'));
    }
    return out;
  }
  const letter = id.match(LETTER_RANGE_RE);
  if (letter) {
    const [, prefix, a, b] = letter;
    const out = [];
    for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) {
      out.push(prefix + String.fromCharCode(c));
    }
    return out;
  }
  return [id];
}

const covered = new Set();   // ledger 覆盖的全部钉 id（含范围展开）
for (const r of rows) for (const id of expandRow(r.id)) covered.add(id);

function stripLetter(nail) {
  // BAR-103a → BAR-103；BAR-ORB-SEG-01a → BAR-ORB-SEG-01（仅剥数字后的单子字母）
  const m = nail.match(/^(.+\d)[a-z]$/);
  return m ? m[1] : nail;
}

// ========== 4. 正向：钉子 → 必须登记 ==========

for (const n of nails) {
  if (!covered.has(n) && !covered.has(stripLetter(n))) {
    error(`钉子 ${n} 在 tests/ 存在但 ledger 未登记（有钉未登记 = 账本漂移）`);
  }
}

// ========== 5. 反向：✅ 已钉行 → 必须有钉 ==========

for (const r of rows) {
  if (!r.status.startsWith('✅ 已钉')) continue;
  const seeAlso = r.status.match(/钉见 (BAR-[A-Z0-9-]+)/);
  if (seeAlso) {
    if (!nails.has(seeAlso[1])) {
      error(`bugs.md:${r.line} ${r.id} 声明「钉见 ${seeAlso[1]}」但该钉不存在`);
    }
    continue;
  }
  const hasNail = [...nails].some(n => {
    if (expandRow(r.id).includes(n)) return true;      // 钉在本行（范围）内
    return stripLetter(n) === r.id;                    // 钉是本行的子字母钉
  });
  if (!hasNail) {
    error(`bugs.md:${r.line} ${r.id} 登记「✅ 已钉」但 tests/ 找不到对应钉子（假已钉；若一钉多 bug 用「钉见 BAR-xxx」声明）`);
  }
}

// ========== 汇总 ==========

if (errors > 0) {
  console.error(`\n[check-bar-ledger] ${errors} errors，构建中断。`);
  console.error('[check-bar-ledger] ⛳ TEST-FLOW-02：BAR 钉必须登记 ledger——读 docs/ledger/bugs.md §登记纪律，走 workflows/bug-fix.yaml 登记步骤');
  process.exit(1);
}
console.log(`[check-bar-ledger] OK — ${nails.size} 钉 ↔ ${rows.length} 行登记，双向对齐`);
