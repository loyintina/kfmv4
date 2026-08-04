/**
 * check-stack-status.mjs — STACK 条目状态词矛盾检查（2026-07-30，SEM005 机械化移民）
 *
 * 出身：语义审计三轮变异基准（v4/v5/v5.1）+ 一轮活树审计，stack-vs-ledger 探针
 * 四次连续零响应，M06/MID-3（状态词摘除/翻转）3/3 稳定漏报——LLM 探针对
 * 「条目状态 vs 条目详情」矛盾结构性失明。按结晶回路（同一错误反复 → 移民
 * 确定区），矛盾型状态失同步收归机械层：确定、零成本、进 check 链。
 *
 * 检查项（宁紧勿宽，先保证零误报）：
 *   R1 头行矛盾：条目头行同时含完成词（✅/完成/结案/结算/已闭环）与
 *      活跃词（进行中/启动中/未结案）——如「✅ 完成（进行中）」
 *   R2 头活跃+详情完成：头行含活跃词，详情行含完成词——MID-3 家族
 *     （标「进行中」但下行全是「65 份结算/✅ 落地」完成语气）
 *
 * 明确不覆盖（诚实边界）：M06 家族「已闭环但忘了标注」——缺失型无法机械判定
 * （无标记 ≠ 完成，开放条目本来就没标记），仍归语义层/人工。
 *
 * 枚举型检查（每次全量重扫 STACK.md），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
let errors = 0;
function error(msg) {
  console.error(`[check-stack-status] ${msg}`);
  errors++;
}

const DONE_RE = /✅|完成|结案|结算|已闭环/;
const ACTIVE_RE = /进行中|启动中|未结案/;

const stack = readFileSync(join(ROOT, DOCS_ROOT, 'active', 'STACK.md'), 'utf-8');
const lines = stack.split('\n');

// 条目切分：头行 = /^\d+\.\s/，详情行 = 到下一个头行之前的缩进行。
// 研究参考区（R1/R2/… 独立命名空间）不参与主列表检查——2026-08-04 F3：
// 旧切分会吞掉该区条目，与主列表撞号产生引用歧义。
let head = null; // { n, line, text, details: [] }
const entries = [];
for (let i = 0; i < lines.length; i++) {
  if (/^## 研究参考/.test(lines[i])) break;
  const m = lines[i].match(/^(\d+)\.\s/);
  if (m) {
    head = { n: m[1], line: i + 1, text: lines[i], details: [] };
    entries.push(head);
  } else if (head) {
    head.details.push({ line: i + 1, text: lines[i] });
  }
}

// R3 编号纪律（2026-08-04 F3 机械化）：主列表编号 = 物理顺序 1..N 严格连续——
// 插入序编号曾造成 1,2,3,8..16,4..7 乱序 + 研究参考区与主列表撞号（引用歧义）
const seen = new Set();
entries.forEach((e, i) => {
  if (seen.has(e.n)) error(`条目编号 ${e.n} 重复（STACK.md:${e.line}）——主列表撞号`);
  seen.add(e.n);
  if (Number(e.n) !== i + 1) {
    error(`条目编号断裂：第 ${i + 1} 个条目编号为 ${e.n}（STACK.md:${e.line}）——主列表须 1..N 严格连续，新条目追加到末尾`);
  }
});

for (const e of entries) {
  const headDone = DONE_RE.test(e.text);
  const headActive = ACTIVE_RE.test(e.text);
  if (headDone && headActive) {
    error(`条目 ${e.n}（STACK.md:${e.line}）头行状态词矛盾：同时含完成词与活跃词——${e.text.trim().slice(0, 50)}`);
  }
  if (headActive) {
    const bad = e.details.find(d => DONE_RE.test(d.text));
    if (bad) {
      error(`条目 ${e.n}（STACK.md:${e.line}）头行标活跃但详情行 ${bad.line} 含完成词——状态词矛盾（头活跃+详情完成）：${bad.text.trim().slice(0, 50)}`);
    }
  }
}

// R4 bug 入口强制通道（2026-08-04 F2 机械化）：主列表条目详情含 bug 状态描述
// （bug/缺陷 + 已修复/待修复/未修复/活 bug 等状态）必须带 BAR 编号——
// 「bug 挂 STACK 散文不登记 BAR = 修完无人追」的责任真空（面板无响应现场）
const BUG_RE = /bug|缺陷|串档|注入|穿越|无响应/;
const BUG_STATUS_RE = /已修复|待修复|未修复|活 bug|待裁决|P0|已闭环/;
for (const e of entries) {
  const rows = [e.text, ...e.details.map(d => d.text)];
  const hasBar = rows.some(r => /BAR-/.test(r) || /bugs\.md/.test(r)); // 条目级：任一 BAR/bugs.md 引用即过（跨行）
  if (hasBar) continue;
  for (const row of rows) {
    if (BUG_RE.test(row) && BUG_STATUS_RE.test(row)) {
      error(`条目 ${e.n}（STACK.md 行 ${e.line}）bug 状态描述未带 BAR 编号（F2 入口门）——bug 必须登记 ledger/bugs.md：${row.trim().slice(0, 60)}`);
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-stack-status] ${errors} 处状态词矛盾，构建中断。`);
  console.error('[check-stack-status] ⛳ MECH-FLOW-09：STACK 状态词矛盾——读 docs/active/STACK.md §状态词，走 workflows/state-sync.yaml');
  process.exit(1);
}
console.log(`[check-stack-status] OK — ${entries.length} 个栈条目状态词无矛盾`);
