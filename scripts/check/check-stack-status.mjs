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

// 条目切分：头行 = /^\d+\.\s/，详情行 = 到下一个头行之前的缩进行
let head = null; // { n, line, text, details: [] }
const entries = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(\d+)\.\s/);
  if (m) {
    head = { n: m[1], line: i + 1, text: lines[i], details: [] };
    entries.push(head);
  } else if (head) {
    head.details.push({ line: i + 1, text: lines[i] });
  }
}

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

if (errors > 0) {
  console.error(`\n[check-stack-status] ${errors} 处状态词矛盾，构建中断。`);
  console.error('[check-stack-status] ⛳ MECH-FLOW-09：STACK 状态词矛盾——读 docs/active/STACK.md §状态词，走 workflows/state-sync.yaml');
  process.exit(1);
}
console.log(`[check-stack-status] OK — ${entries.length} 个栈条目状态词无矛盾`);
