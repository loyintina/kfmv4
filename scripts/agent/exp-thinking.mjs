/**
 * exp-thinking.mjs — 思考开/关对照实验（2026-07-30 用户拍板：拿数据说话）
 *
 * 同一审计任务跑两臂：
 *   A 控制臂 = 默认（思考开，推理型负载现状）
 *   B 实验臂 = params { thinking: { type: 'disabled' } }
 * 测：wall 延迟、尝试次数、报/留/拦、发现内容差异。
 * 顺序交替（task1 AB、task2 BA…）消 warm-up 偏差。
 *
 * 用法：node scripts/agent/exp-thinking.mjs [--tasks=id1,id2,...]
 * 不写 state、不进 check 链——纯实验脚本，产出是 stdout 数据表。
 */

import { runAgent } from './agent-runner.mjs';
import { taskFiles, buildPrompt, makeValidate, recheckRef } from './semantic-audit.mjs';
import { TASKS } from './semantic-audit.tasks.mjs';

const DEFAULT_TASKS = [
  'readme-vs-maps',            // 小组内（四轮报 1）
  'doc-maintenance-vs-pipeline', // 中组内（四轮报 2）
  'contract-vs-map-canvas-tree', // 域对（四轮报 1 = 已登记漂移重复）
  'inter-workflows-infra',     // 最大组间（三轮双端 60s 超时受害者）
];

const argTasks = (process.argv.slice(2).find(a => a.startsWith('--tasks=')) || '').slice(8);
const selected = argTasks ? argTasks.split(',') : DEFAULT_TASKS;

const SYSTEM = '你是文档语义审计探针。只输出要求的 JSON，不要任何多余文字。';
const ARM_B_PARAMS = { thinking: { type: 'disabled' } };

async function runArm(task, files, arm) {
  const t0 = Date.now();
  const result = await runAgent({
    system: SYSTEM,
    prompt: buildPrompt(task, files),
    validate: makeValidate(),
    maxTokens: 16000,
    ...(arm === 'B' ? { params: ARM_B_PARAMS } : {}),
  });
  const ms = Date.now() - t0;
  if (!result.ok) return { arm, ms, ok: false, errors: result.errors };
  const kept = result.data.findings.filter(f => recheckRef(f.claim, files) && recheckRef(f.against, files));
  return {
    arm, ms, ok: true,
    provider: result.provider, attempts: result.attempts,
    reported: result.data.findings.length, kept: kept.length,
    findings: kept.map(f => `[${f.type}] ${f.claim}${f.against ? ' ↔ ' + f.against : ''} — ${f.note}`),
  };
}

console.log(`[exp-thinking] ${selected.length} 任务 × 2 臂（A=思考开 B=思考关），顺序交替`);
const all = [];
for (let i = 0; i < selected.length; i++) {
  const task = TASKS.find(t => t.id === selected[i]);
  if (!task) { console.error(`  跳过未知任务 ${selected[i]}`); continue; }
  const files = taskFiles(task);
  const order = i % 2 === 0 ? ['A', 'B'] : ['B', 'A'];
  const row = { task: task.id, promptKB: Math.round(buildPrompt(task, files).length / 1024) };
  for (const arm of order) {
    const r = await runArm(task, files, arm);
    row[arm] = r;
    console.log(`  ${task.id} [${arm}] ${r.ok ? `${(r.ms / 1000).toFixed(1)}s · 报${r.reported} 留${r.kept} · ${r.provider} · ${r.attempts}次` : `失败（${(r.ms / 1000).toFixed(1)}s）：${r.errors.join('；').slice(0, 120)}`}`);
  }
  all.push(row);
}

console.log('\n========== 对照表 ==========');
for (const row of all) {
  const a = row.A, b = row.B;
  console.log(`\n■ ${row.task}（prompt ~${row.promptKB}KB）`);
  for (const [label, r] of [['A 思考开', a], ['B 思考关', b]]) {
    if (!r) continue;
    console.log(`  ${label}: ${r.ok ? `${(r.ms / 1000).toFixed(1)}s · 报${r.reported} 留${r.kept}` : '失败'}`);
    if (r.ok) for (const f of r.findings) console.log(`      ${f}`);
  }
  if (a?.ok && b?.ok) {
    const speedup = (a.ms / b.ms).toFixed(1);
    console.log(`  → 提速 ${speedup}×`);
  }
}
