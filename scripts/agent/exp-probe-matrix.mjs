#!/usr/bin/env node
/**
 * exp-probe-matrix.mjs — 探针能力矩阵（19 探针 × 16 变异）
 *
 * 目的（2026-08-02）：给编译升档画「哪些魂可以变肉」的精确地图——
 * 每探针的盲区类型（它该逮的没逮到）→ 能机械化的（计数/状态类零盲）vs
 * 纯判断内核（永远盲）；全局盲区（无探针能逮的变异）→ 需要新探针或
 * 判定「该类型超出当前能力」。全部 19 探针全跑（思考 ON，真实模式）。
 *
 * 复用：tmp/semantic-bench 沙盒 + bench 评分逻辑。输出按探针聚合。
 */
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const SANDBOX = join(REPO, 'tmp', 'semantic-bench');
const groundPath = join(SANDBOX, 'ground-truth.json');
if (!existsSync(groundPath)) { console.error('沙盒不存在——先 --remutate'); process.exit(1); }
const ground = JSON.parse(readFileSync(groundPath, 'utf-8'));

process.env.SEMANTIC_AUDIT_ROOT = SANDBOX;
const { taskFiles, buildPrompt, makeValidate, recheckRef, recheckQuote } = await import('./semantic-audit.mjs');
const { TASKS } = await import('./semantic-audit.tasks.mjs');
const { runAgent } = await import('./agent-runner.mjs');

const CONC = parseInt((process.argv.find(a => a.startsWith('--conc=')) || '--conc=8').slice(7), 10);
console.log(`[matrix] ${TASKS.length} 探针全跑 × 变异 ${ground.mutations.length} 条（思考 ON）`);

async function pool(items, n, worker) {
  const results = [];
  let idx = 0;
  async function run() { while (idx < items.length) { const i = idx++; results[i] = await worker(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  return results;
}

function hitMutation(f, m) {
  const claimLine = parseInt(String(f.claim || '').split(':').pop(), 10);
  const againstLine = parseInt(String(f.against || '').split(':').pop(), 10);
  if (f.claim && f.claim.includes(m.file) && !isNaN(claimLine) && Math.abs(claimLine - m.line) <= 5) return true;
  if (f.against && f.against.includes(m.file) && !isNaN(againstLine) && Math.abs(againstLine - m.line) <= 5) return true;
  return false;
}

const t0 = Date.now();
const runs = await pool(TASKS, CONC, async (task) => {
  const files = taskFiles(task);
  const result = await runAgent({
    system: '你是文档语义审计探针。只输出要求的 JSON，不要任何多余文字。',
    prompt: buildPrompt(task, files),
    validate: makeValidate(),
    maxTokens: 16000,
    params: { response_format: undefined },
    timeoutMs: 300_000,
  });
  if (!result.ok) { console.log(`  ${task.id}: 失败——${result.errors.join('；').slice(0, 80)}`); return { task: task.id, ok: false, kept: [] }; }
  const kept = result.data.findings.filter(f => recheckRef(f.claim, files) && recheckRef(f.against, files) && recheckQuote(f, files));
  console.log(`  ${task.id}: 报 ${result.data.findings.length} · 保留 ${kept.length}（${result.provider}）`);
  return { task: task.id, ok: true, kept };
});

// ---- 每探针聚合 ----
console.log(`\n========== 探针能力矩阵（${((Date.now() - t0) / 1000).toFixed(0)}s）==========`);
const probeStats = [];
for (const r of runs) {
  const assigned = ground.mutations.filter(m => m.tasks.includes(r.task) && m.expect === 'report');
  const caught = assigned.filter(m => r.kept.some(f => hitMutation(f, m)));
  const nc = ground.mutations.filter(m => m.expect === 'silent' && r.kept.some(f => hitMutation(f, m))).length;
  const extras = r.kept.filter(f => !ground.mutations.some(m => hitMutation(f, m))).length;
  probeStats.push({ task: r.task, ok: r.ok, recall: assigned.length ? caught.length / assigned.length : null, hit: caught.length, assigned: assigned.length, nc, extras });
}
console.log('| 探针 | 该逮/逮住 | 召回 | NC误报 | 额外 |');
for (const p of probeStats.sort((a, b) => (a.recall ?? -1) - (b.recall ?? -1))) {
  console.log(`| ${p.task} | ${p.hit}/${p.assigned} | ${p.recall === null ? '—' : p.recall} | ${p.nc} | ${p.extras} |`);
}

// ---- 全局盲区（无探针逮住的变异） ----
console.log('\n--- 全局盲区（无任何探针逮住）---');
let blind = 0;
for (const m of ground.mutations.filter(m => m.expect === 'report')) {
  const hits = runs.flatMap(r => r.kept).filter(f => hitMutation(f, m));
  if (!hits.length) { blind++; console.log(`  ${m.id} [${m.level}/${m.sem}] ${m.file}:${m.line} — ${m.note.slice(0, 50)}`); }
}
console.log(`\n全局召回：${(ground.mutations.filter(m => m.expect === 'report').length - blind)}/${ground.mutations.filter(m => m.expect === 'report').length} · 盲区 ${blind} 条`);
