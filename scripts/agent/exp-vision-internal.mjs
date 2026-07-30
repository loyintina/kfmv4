/**
 * exp-vision-internal.mjs — vision 探针四臂对照实验（2026-07-30 用户拍板）
 *
 * 背景：MID-4（vision 决策翻转）四轮基准连败，vision-internal 首秀报 0。
 * 候选根因：① 系统性保守（宁缺勿滥条款给「拿不准」台阶）② 思考被掐
 * （exp-thinking 已证默认思考开，基本排除）③ 任务形式错配（开放判断 vs 闭卷核对）。
 *
 * 四臂（单探针 vision-internal × 全量变异沙盒，vision.md 含 M07+MID-4）：
 *   A 基线 = 现状 prompt
 *   C 去保守 = 删「拿不准的不报（宁缺勿滥）」，换「疑似也报，复核把关」
 *   E 脚手架 = 追加「先列决策断言清单，再逐条核对」两步工作方式（测任务形式）
 *   F 叠加 = C + E
 *
 * 判读：A=0 且 C/E/F 破零 → 对应根因坐实；全零 → 根因三升级（上断言提取对账）。
 * 不写 state、不进 check 链——纯实验脚本，产出是 stdout 数据表。
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const SANDBOX = join(REPO, 'tmp/semantic-bench');

execSync(`node ${join(REPO, 'scripts/agent/semantic-mutate.mjs')}`, { stdio: 'inherit' });
const ground = JSON.parse(readFileSync(join(SANDBOX, 'ground-truth.json'), 'utf-8'));
const targets = ground.mutations.filter(m => ['M07', 'MID-4'].includes(m.id));

process.env.SEMANTIC_AUDIT_ROOT = SANDBOX;
const { taskFiles, buildPrompt, makeValidate, recheckRef, recheckQuote } = await import('./semantic-audit.mjs');
const { TASKS } = await import('./semantic-audit.tasks.mjs');
const { runAgent } = await import('./agent-runner.mjs');

const task = TASKS.find(t => t.id === 'vision-internal');
const files = taskFiles(task);
const prompt0 = buildPrompt(task, files);

// 保守条款置换（防 prompt 漂移：锚串必须命中，否则实验臂=基线臂而不知）
const CONSERVATIVE = '无发现输出 {"findings":[]}。上限 10 条，拿不准的不报（宁缺勿滥——幻觉发现会死在机械复核环节）。';
const LIBERAL = '无发现输出 {"findings":[]}。上限 10 条；疑似矛盾也应报告——机械复核会杀掉幻觉引用，漏报的代价大于误报。';
if (!prompt0.includes(CONSERVATIVE)) throw new Error('[exp] 保守条款锚串未命中——buildPrompt 已演进，先同步本脚本');

const SCAFFOLD = '\n\n【工作方式】在内心分两步完成（输出仍只有 JSON）：第一步，逐节列出文中所有决策记录与方向断言（每条一行：位置 + 断言内容）；第二步，逐条核对它是否与文中其他位置的断言矛盾。只把核对结果为矛盾的写进 findings。';

const ARMS = {
  A: prompt0,
  C: prompt0.replace(CONSERVATIVE, LIBERAL),
  E: prompt0 + SCAFFOLD,
  F: prompt0.replace(CONSERVATIVE, LIBERAL) + SCAFFOLD,
};

function parseClaim(claim) {
  const s = String(claim).replace(/[`*\s]/g, ' ').trim();
  const m = s.match(/^(.+?):(\d+)/);
  return { path: m ? m[1] : s.split(':')[0], line: m ? parseInt(m[2], 10) : 0 };
}
function hit(f, m) {
  return [f.claim, f.against].some(ref => {
    if (!ref) return false;
    const c = parseClaim(ref);
    if (!c.path.endsWith(m.file) && !m.file.endsWith(c.path)) return false;
    return c.line === 0 || Math.abs(c.line - m.line) <= 5;
  });
}

const SAMPLES = parseInt((process.argv.find(a => a.startsWith('--samples=')) || '--samples=1').slice(10), 10);

console.log(`[exp-vision-internal] 探针 vision-internal × 4 臂 × ${SAMPLES} 样本（目标：M07@${targets[0].line} / MID-4@${targets[1].line}）`);
const jobs = Object.entries(ARMS).flatMap(([arm, prompt]) =>
  Array.from({ length: SAMPLES }, (_, s) => ({ arm, prompt, sample: s + 1 })));

async function pool(items, n, worker) {
  const results = [];
  let idx = 0;
  async function run() { while (idx < items.length) { const i = idx++; results[i] = await worker(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  return results;
}

const results = await pool(jobs, 20, async ({ arm, prompt, sample }) => {
  const t0 = Date.now();
  const result = await runAgent({
    system: '你是文档语义审计探针。只输出要求的 JSON，不要任何多余文字。',
    prompt, validate: makeValidate(), maxTokens: 16000,
  });
  const ms = Date.now() - t0;
  if (!result.ok) return { arm, sample, ms, ok: false, errors: result.errors };
  const kept = result.data.findings.filter(f => recheckRef(f.claim, files) && recheckRef(f.against, files) && recheckQuote(f, files));
  return { arm, sample, ms, ok: true, provider: result.provider, reported: result.data.findings.length, keptCount: kept.length,
    kept, hits: targets.map(t => `${t.id}:${kept.some(f => hit(f, t)) ? '✅' : '❌'}`).join(' ') };
});

for (const r of results) {
  console.log(`  ${r.arm}#${r.sample}: ${r.ok ? `${(r.ms / 1000).toFixed(1)}s · 报${r.reported} 留${r.keptCount} · ${r.hits}` : `失败（${(r.ms / 1000).toFixed(1)}s）${r.errors.join('；').slice(0, 100)}`}`);
}

console.log('\n========== 四臂聚合表 ==========');
for (const arm of Object.keys(ARMS)) {
  const rs = results.filter(r => r.arm === arm && r.ok);
  if (!rs.length) { console.log(`■ ${arm}: 全失败`); continue; }
  const hitAgg = targets.map(t => `${t.id} ${rs.filter(r => r.kept.some(f => hit(f, t))).length}/${rs.length}`).join(' · ');
  const union = new Map();
  for (const r of rs) for (const f of r.kept) union.set(`${f.type}|${f.claim}|${f.against}`, f);
  const ms = rs.map(r => r.ms);
  console.log(`\n■ ${arm}（n=${rs.length} · ${(Math.min(...ms) / 1000).toFixed(0)}-${(Math.max(...ms) / 1000).toFixed(0)}s · 平均报${(rs.reduce((a, r) => a + r.reported, 0) / rs.length).toFixed(1)} 留${(rs.reduce((a, r) => a + r.keptCount, 0) / rs.length).toFixed(1)}）命中率 ${hitAgg}`);
  for (const f of union.values()) console.log(`    ∪ [${f.type}] ${f.claim}${f.against ? ' ↔ ' + f.against : ''} — ${f.note}`);
}
