/**
 * check-stack-status.mjs — 工作栈 schema + 编号纪律 + bug 入口门（yaml 化二代）
 *
 * 一代（2026-07-30，SEM005 机械化移民）：STACK.md 散文状态词矛盾检查（R1 头行矛盾 /
 * R2 头活跃+详情完成）——LLM 探针对「条目状态 vs 条目详情」矛盾结构性失明的机械收编。
 * 二代（2026-08-06 用户拍板）：废 STACK.md → stack.yaml 单一出处，状态从散文标记升级为
 * 字段——R1/R2 整个矛盾类从构造上消失（「无标记黑户」同葬：2026-08-01 前 7 条旧格式
 * 无标记条目迁移时逐条裁决）。散文矛盾类退役，MID-3/M06 变异锚点同步迁 yaml 版。
 *
 * 检查项（宁紧勿宽，先保证零误报）：
 *   R0 schema：每条目必填 id(int) / title / status∈{done,todo,hold} / created(YYYY-MM-DD)
 *      / note；research 区 id = R\d+ 独立命名空间
 *   R3 编号纪律（2026-08-04 F3 机械化，保留）：主列表 id = 物理顺序 1..N 严格连续——
 *      插入序编号曾造成乱序 + 研究参考区撞号（引用歧义）
 *   R4 bug 入口强制通道（2026-08-04 F2 机械化，保留）：条目文本含 bug 状态描述
 *      （bug/缺陷 + 已修复/待修复/未修复 等）必须带 BAR 编号——
 *      「bug 挂 STACK 散文不登记 BAR = 修完无人追」的责任真空
 *
 * 明确不覆盖（诚实边界）：「已闭环但忘了改 status」缺失型无法机械判定，仍归语义层/人工
 * （与一代 M06 边界同义——字段化消灭了矛盾型，不消灭遗忘型）。
 *
 * 枚举型检查（每次全量重扫 stack.yaml），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { DOCS_ROOT } from './docs-root-const.mjs';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
let errors = 0;
function error(msg) {
  console.error(`[check-stack-status] ${msg}`);
  errors++;
}

const STACK_PATH = join(ROOT, DOCS_ROOT, 'active', 'stack.yaml');
let doc;
try {
  doc = yaml.load(readFileSync(STACK_PATH, 'utf-8'));
} catch (e) {
  error(`stack.yaml 解析失败：${String(e.message || e).slice(0, 120)}`);
  console.error('[check-stack-status] ⛳ MECH-FLOW-09：STACK schema 违例——读 docs/active/stack.yaml 头注规范，走 workflows/state-sync.yaml');
  process.exit(1);
}

const entries = Array.isArray(doc?.entries) ? doc.entries : [];
const research = Array.isArray(doc?.research) ? doc.research : [];
if (!entries.length) error('stack.yaml 无 entries（空工作栈 = 解析面坏了）');

// ---- R0 schema ----
const STATUS = new Set(['done', 'todo', 'hold']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
for (const e of entries) {
  const at = `条目 ${e?.id ?? '?'}`;
  if (!Number.isInteger(e?.id)) error(`${at} id 缺失或非整数`);
  if (typeof e?.title !== 'string' || !e.title.trim()) error(`${at} title 缺失或为空`);
  if (!STATUS.has(e?.status)) error(`${at} status 非法：${JSON.stringify(e?.status)}（枚举 done/todo/hold）`);
  if (!DATE_RE.test(String(e?.created ?? ''))) error(`${at} created 缺失或非法：${JSON.stringify(e?.created)}（YYYY-MM-DD）`);
  if (typeof e?.note !== 'string' || !e.note.trim()) error(`${at} note 缺失（面板列表直接渲染的注记行）`);
}
for (const r of research) {
  if (!/^R\d+$/.test(String(r?.id ?? ''))) error(`研究参考区条目 id 非法：${JSON.stringify(r?.id)}（R 独立命名空间 R1/R2/…）`);
}

// ---- R3 编号纪律 ----
const seen = new Set();
entries.forEach((e, i) => {
  if (seen.has(e.id)) error(`条目编号 ${e.id} 重复——主列表撞号`);
  seen.add(e.id);
  if (e.id !== i + 1) {
    error(`条目编号断裂：第 ${i + 1} 个条目 id 为 ${e.id}——主列表须 1..N 严格连续，新条目追加到末尾`);
  }
});

// ---- R4 bug 入口门 ----
const BUG_RE = /bug|缺陷|串档|注入|穿越|无响应/;
const BUG_STATUS_RE = /已修复|待修复|未修复|活 bug|待裁决|P0|已闭环/;
for (const e of entries) {
  const rows = [e.title, e.note, e.detail].filter(s => typeof s === 'string');
  if (rows.some(r => /BAR-/.test(r) || /bugs\.md/.test(r))) continue; // 条目级任一 BAR/bugs.md 引用即过
  for (const row of rows) {
    if (BUG_RE.test(row) && BUG_STATUS_RE.test(row)) {
      error(`条目 ${e.id} bug 状态描述未带 BAR 编号（F2 入口门）——bug 必须登记 ledger/bugs.md：${row.trim().slice(0, 60)}`);
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-stack-status] ${errors} 处违例，构建中断。`);
  console.error('[check-stack-status] ⛳ MECH-FLOW-09：STACK schema/编号/bug 入口违例——读 docs/active/stack.yaml 头注规范，走 workflows/state-sync.yaml');
  process.exit(1);
}
console.log(`[check-stack-status] OK — ${entries.length} 个栈条目 schema/编号/bug 入口合规（研究参考区 ${research.length} 条）`);
