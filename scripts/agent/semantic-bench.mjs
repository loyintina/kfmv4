/**
 * semantic-bench.mjs — 变异基准跑分器（semantic-mutate 的下半件）
 *
 * 对沙盒副本跑受影响探针，拿 ground-truth.json 对分：
 * - 召回：L1/L2 变异（expect=report）是否被任一预期探针逮到（claim 文件+行 ±5 命中）
 * - 误报：L3 负例（expect=silent）是否被报 + 变异面之外的额外发现（疑似误报，留人工裁决）
 *
 * 用法：node scripts/agent/semantic-bench.mjs [--remutate] [--conc=N]（默认 3）
 * 不写 state、不进 check 链。改 prompt/换模型/开关思考后跑一次，分数入裁决记录。
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const SANDBOX = join(REPO, 'tmp/semantic-bench');

// 沙盒不存在时先物化（--remutate 强制重来）
const { MUTATIONS } = await import('./semantic-mutate.mjs');
if (process.argv.includes('--remutate') || !readGround()) {
  const { execSync } = await import('child_process');
  execSync(`node ${join(REPO, 'scripts/agent/semantic-mutate.mjs')}`, { stdio: 'inherit' });
}
function readGround() {
  try { return JSON.parse(readFileSync(join(SANDBOX, 'ground-truth.json'), 'utf-8')); } catch { return null; }
}
const ground = readGround();

// 关键：import 审计模块前设沙盒 ROOT——审计逻辑原样跑，读的全是副本
process.env.SEMANTIC_AUDIT_ROOT = SANDBOX;
const { taskFiles, buildPrompt, makeValidate, recheckRef } = await import('./semantic-audit.mjs');
const { TASKS } = await import('./semantic-audit.tasks.mjs');
const { runAgent } = await import('./agent-runner.mjs');

// 受影响探针 = 任一变异文件的预期任务并集
const affectedIds = [...new Set(ground.mutations.flatMap(m => m.tasks))];
const affected = TASKS.filter(t => affectedIds.includes(t.id));
console.log(`[bench] 变异 ${ground.mutations.length} 条（report ${ground.mutations.filter(m => m.expect === 'report').length} + NC ${ground.mutations.filter(m => m.expect === 'silent').length}）· 受影响探针 ${affected.length} 个`);

async function pool(items, n, worker) {
  const results = [];
  let idx = 0;
  async function run() { while (idx < items.length) { const i = idx++; results[i] = await worker(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  return results;
}

const CONC = parseInt((process.argv.find(a => a.startsWith('--conc=')) || '--conc=3').slice(7), 10);
// --dup=N：任务集复制 N 份——压测 provider 并发上限专用（成绩照常对分，命中会重复计）
const DUP = parseInt((process.argv.find(a => a.startsWith('--dup=')) || '--dup=1').slice(6), 10);
const worklist = DUP > 1 ? Array.from({ length: DUP }, () => affected).flat() : affected;
console.log(`[bench] 并发 ${CONC} · 任务 ${worklist.length} 个${DUP > 1 ? `（dup×${DUP} 压测模式）` : ''}`);

const t0 = Date.now();
const runs = await pool(worklist, CONC, async (task) => {
  const files = taskFiles(task);
  const result = await runAgent({
    system: '你是文档语义审计探针。只输出要求的 JSON，不要任何多余文字。',
    prompt: buildPrompt(task, files),
    validate: makeValidate(),
    maxTokens: 16000,
  });
  if (!result.ok) {
    console.log(`  ${task.id}: 失败——${result.errors.join('；').slice(0, 100)}`);
    return { task: task.id, ok: false, kept: [] };
  }
  const kept = result.data.findings.filter(f => recheckRef(f.claim, files) && recheckRef(f.against, files));
  // v5.2 教训（MID-2「报 1 保留 0」）：复核杀掉的可能是真发现的格式坏锚——
  // 掉落明细必须可见，否则无法区分「幻觉拦截立功」与「复核误杀真发现」
  const dropped = result.data.findings.filter(f => !kept.includes(f));
  for (const d of dropped) console.log(`    ⚠ 复核掉落：[${d.type}] ${d.claim}${d.against ? ` ↔ ${d.against}` : ''}— ${String(d.note).slice(0, 60)}`);
  console.log(`  ${task.id}: 报 ${result.data.findings.length} · 复核保留 ${kept.length}（${result.provider}）`);
  return { task: task.id, ok: true, kept };
});

// ========== 对分 ==========
// claim 归一化：提取 文件部分 + 行号（无行号按 0 处理，只比文件）
function parseClaim(claim) {
  const s = String(claim).replace(/[`*\s]/g, ' ').trim();
  const m = s.match(/^(.+?):(\d+)/);
  return { path: m ? m[1] : s.split(':')[0], line: m ? parseInt(m[2], 10) : 0 };
}
function hitMutation(f, m) {
  // 矛盾型发现可锚在任一侧（v5 轮教训：MID-2 被逮到但 claim 锚在矛盾另一侧，
  // 评分器只看 claim ±5 误判漏报）——claim/against 双锚点都试
  return [f.claim, f.against].some(ref => {
    if (!ref) return false;
    const c = parseClaim(ref);
    if (!c.path.endsWith(m.file) && !m.file.endsWith(c.path)) return false;
    if (c.line === 0) return true; // 文件级 claim 宽松命中
    return Math.abs(c.line - m.line) <= 5;
  });
}

const allFindings = runs.flatMap(r => r.kept.map(f => ({ ...f, probe: r.task })));
console.log(`\n========== 成绩单（${((Date.now() - t0) / 1000).toFixed(0)}s）==========`);

let recall = 0, reportTotal = 0, ncViolations = 0, ncTotal = 0;
const extras = [];
const claimed = new Set();
for (const m of ground.mutations) {
  const hits = allFindings.filter(f => hitMutation(f, m));
  hits.forEach(h => claimed.add(h));
  if (m.expect === 'report') {
    reportTotal++;
    const ok = hits.length > 0;
    if (ok) recall++;
    console.log(`${ok ? '✅' : '❌ 漏报'} ${m.id} [${m.level}/${m.sem}] ${m.file}:${m.line}${ok ? `（${hits[0].probe} 逮到）` : ''} — ${m.note}`);
  } else {
    ncTotal++;
    const bad = hits.length > 0;
    if (bad) ncViolations++;
    console.log(`${bad ? '⚠️ 误报' : '✅'} ${m.id} [${m.level}/NC] ${m.file}:${m.line} — ${m.note}`);
  }
}
for (const f of allFindings) {
  if (!claimed.has(f)) extras.push(f);
}
console.log(`\n召回：${recall}/${reportTotal} · NC 误报：${ncViolations}/${ncTotal} · 变异面之外额外发现：${extras.length} 条`);
for (const f of extras) console.log(`  ？ [${f.type}] ${f.claim}${f.against ? ` ↔ ${f.against}` : ''}（${f.probe}）— ${f.note.slice(0, 60)}`);
if (runs.some(r => !r.ok)) console.log('⚠️ 有探针失败，本轮分数仅供回顾，不进对照记录');
process.exit(0);
