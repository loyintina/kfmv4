#!/usr/bin/env node
/**
 * exp-probe-decompose.mjs — 探针分解实验：抽取器(no-think) + 判断器(think)
 *
 * 假设（用户动议 2026-08-02）：语义推断分「灵魂和肉」——大探针拆成
 * 机械抽取层（无思考，快）+ 判断内核（思考，输入=抽取出的断言而非全文）。
 * 速度杠杆是 prompt 体量而非思考本身：判断器只面对小输入，可能又快又不丢召回。
 *
 * 对照：大 prompt 思考探针 = 8/16 · 1446s（report 12 基线）。
 * 实验：抽取器抽断言（no-think，读全文）→ 判断器（think，只读断言清单）→ 评分。
 * 判定：召回是否保住 8/16 附近 + 耗时。
 *
 * 复用：tmp/semantic-bench 沙盒（已物化变异，不 --remutate）+ bench 评分逻辑。
 */
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const SANDBOX = join(REPO, 'tmp', 'semantic-bench');
const groundPath = join(SANDBOX, 'ground-truth.json');
if (!existsSync(groundPath)) {
  console.error('[decompose] 沙盒不存在——先跑 node scripts/agent/semantic-bench.mjs --remutate 物化');
  process.exit(1);
}
const ground = JSON.parse(readFileSync(groundPath, 'utf-8'));

// 沙盒 ROOT：审计模块读的必须是变异副本
process.env.SEMANTIC_AUDIT_ROOT = SANDBOX;
const { taskFiles, makeValidate, recheckRef, recheckQuote } = await import('./semantic-audit.mjs');
const { TASKS } = await import('./semantic-audit.tasks.mjs');
const { runAgent, extractJson } = await import('./agent-runner.mjs');

const affectedIds = [...new Set(ground.mutations.flatMap(m => m.tasks))];
const affected = TASKS.filter(t => affectedIds.includes(t.id));
const CONC = parseInt((process.argv.find(a => a.startsWith('--conc=')) || '--conc=4').slice(7), 10);
console.log(`[decompose] 变异 ${ground.mutations.length} 条 · 探针 ${affected.length} 个（抽取器 no-think + 判断器 think）`);

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
const runs = await pool(affected, CONC, async (task) => {
  const files = taskFiles(task);
  // ---- 抽取器（no-think，读全文，输出断言清单） ----
  const extRes = await runAgent({
    system: '你是文档断言抽取器。只输出 JSON，不要任何多余文字。',
    prompt: [
      `【审计问题】${task.question}`,
      `【任务】从以下文档中抽取所有**事实断言**（数字/状态词/引用/命名），每条带 file:line 与原文 quote（≤15字）。`,
      `输出契约：{"claims":[{"text":"断言描述","file":"路径","line":123,"quote":"原文片段"}]} 上限 30 条。`,
      '【文档】\n' + files.map(f => `--- ${f} ---\n${readFileSync(f, 'utf-8').slice(0, 4000)}`).join('\n'),
    ].join('\n'),
    validate: (t) => { const j = extractJson(t); return j && Array.isArray(j.claims) ? j : null; },
    maxTokens: 8000,
    params: { response_format: undefined, thinking: { type: 'disabled' } },
    timeoutMs: 180_000,
  });
  if (!extRes.ok) return { task: task.id, ok: false, kept: [], errors: extRes.errors };
  const claims = extRes.data.claims.slice(0, 30).map(c => `${c.file}:${c.line}「${(c.quote || c.text || '').slice(0, 30)}」`);
  // ---- 判断器（think，输入=断言清单小文本） ----
  const judgeRes = await runAgent({
    system: '你是文档语义审计探针。只输出要求的 JSON，不要任何多余文字。',
    prompt: [
      `【审计问题】${task.question}`,
      `【病灶类型】${task.sem.map(s => `- ${s}`).join('\n')}`,
      `【输出契约】{"findings":[{"type":"SEM001","claim":"出错文档路径:行号","against":"基准出处路径:行号 或 null","quote":"原文片段（≤15字）","note":"50字内冲突说明"}]} 无发现 {"findings":[]}。上限 10 条，拿不准的不报。`,
      '【文档断言清单（抽取器输出，非全文）】\n' + (claims.length ? claims.map((c, i) => `${i + 1}. ${c}`).join('\n') : '（无断言）'),
    ].join('\n'),
    validate: makeValidate(),
    maxTokens: 16000,
    params: { response_format: undefined },
    timeoutMs: 300_000,
  });
  if (!judgeRes.ok) return { task: task.id, ok: false, kept: [], errors: judgeRes.errors };
  const kept = judgeRes.data.findings.filter(f => recheckRef(f.claim, files) && recheckRef(f.against, files) && recheckQuote(f, files));
  console.log(`  ${task.id}: 抽取 ${claims.length} 断言 → 报 ${judgeRes.data.findings.length} · 保留 ${kept.length}（${judgeRes.provider}）`);
  return { task: task.id, ok: true, kept };
});

// ---- 评分（复用 bench 逻辑） ----
const allFindings = runs.flatMap(r => r.kept.map(f => ({ ...f, probe: r.task })));
console.log(`\n========== 成绩单（分解管线 ${((Date.now() - t0) / 1000).toFixed(0)}s）==========`);
let recall = 0, reportTotal = 0, ncViolations = 0, ncTotal = 0;
const extras = [], claimed = new Set();
for (const m of ground.mutations) {
  const hits = allFindings.filter(f => hitMutation(f, m));
  hits.forEach(h => claimed.add(h));
  if (m.expect === 'report') {
    reportTotal++;
    const ok = hits.length > 0;
    if (ok) recall++;
    console.log(`${ok ? '✅' : '❌ 漏报'} ${m.id} [${m.level}/${m.sem}] ${m.file}:${m.line}${ok ? `（${hits[0].probe} 逮到）` : ''} — ${m.note.slice(0, 50)}`);
  } else {
    ncTotal++;
    const bad = hits.length > 0;
    if (bad) ncViolations++;
    console.log(`${bad ? '⚠️ 误报' : '✅'} ${m.id} [NC] ${m.file}:${m.line}`);
  }
}
for (const f of allFindings) if (!claimed.has(f)) extras.push(f);
console.log(`\n召回（并集）：${recall}/${reportTotal} · NC 误报：${ncViolations}/${ncTotal} · 额外发现：${extras.length} 条`);
console.log(`对照：大 prompt 思考探针 = 8/16 · 1446s（report 12）`);
