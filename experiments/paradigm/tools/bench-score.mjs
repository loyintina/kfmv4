#!/usr/bin/env node
/**
 * bench-score.mjs — 面板通道标定对分器（paradigm 实验基建，2026-08-04）
 *
 * 读 ~/.kfmv4/sessions/script/bi-*.json（session-runner/batch-run 归档的会话），
 * 提取每臂 agent 最后输出的 JSON findings，与变异基准 ground-truth 对分：
 *   - 召回：L1/L2 变异（expect=report）是否被逮到（claim/against 文件+行 ±5 命中）
 *   - NC 违规：L3 负例（expect=silent）是否被报
 *   - extras：变异面之外的额外发现（疑似误报，留人工裁决）
 * 对分逻辑与 semantic-bench.mjs 同源（parseClaim/hitMutation 照抄——bench 模块
 * 顶层即执行实验，不可 import）。
 *
 * 已机械化变异（M03/M05/M13 → check-doc-scripts 构建即拦）不计 LLM 召回——
 * 考卷重划分：flash 只考机械层覆盖不了的形态（见 STACK #18）。
 *
 * 用法：
 *   node experiments/paradigm/tools/bench-score.mjs [--arm bi-xxx,bi-yyy] [--all]
 *   默认扫 script/ 目录全部 bi-*.json；--arm 指定子集（逗号分隔，断点对分用）
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const SCRIPT = join(homedir(), '.kfmv4', 'sessions', 'script');
const GROUND = join(REPO, 'tmp', 'semantic-bench', 'ground-truth.json');

// 已机械化变异（2026-08-04 收割，check-doc-scripts 三通道）——LLM 考卷移除
const MECHANIZED = new Set(['M03', 'M05', 'M13']);

// ========== 读取 ground truth ==========
if (!existsSync(GROUND)) {
  console.error('[bench-score] 无 ground-truth——先跑 node scripts/agent/semantic-mutate.mjs 物化沙盒');
  process.exit(2);
}
const ground = JSON.parse(readFileSync(GROUND, 'utf-8'));
const mutations = ground.mutations.filter(m => !MECHANIZED.has(m.id));
console.log(`[bench-score] ground-truth ${ground.mutations.length} 条（已机械化 ${ground.mutations.filter(m => MECHANIZED.has(m.id)).length} 条移出考卷）→ 考 ${mutations.length} 条`);

// ========== 收集会话文件 ==========
const argv = process.argv.slice(2);
const armArg = (argv.find(a => a.startsWith('--arm=')) || '').slice(6);
const files = armArg
  ? armArg.split(',').map(id => join(SCRIPT, `${id}.json`))
  : readdirSync(SCRIPT).filter(f => f.endsWith('.json')).map(f => join(SCRIPT, f));
const arms = files.filter(f => existsSync(f));
console.log(`[bench-score] 会话 ${arms.length} 个${armArg ? '（--arm 指定）' : '（扫 script/ 全部）'}`);

// ========== 提取 agent 输出的 findings JSON ==========
/** 面板会话最后一条 ai 消息的 text 块——输出 JSON 契约在此 */
function extractFindings(file) {
  const o = JSON.parse(readFileSync(file, 'utf-8'));
  const aiTexts = (o.messages || [])
    .filter(m => m.role === 'ai')
    .map(m => (m.content || []).filter(b => b?.type === 'text').map(b => b.text || '').join(''))
    .filter(t => t);
  if (!aiTexts.length) return { ok: false, reason: '无 ai 消息', findings: [] };
  const text = aiTexts[aiTexts.length - 1];
  // 找最后一个 ```json 代码块
  const blocks = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
  const candidate = blocks.length ? blocks[blocks.length - 1][1] : text;
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, reason: '无 JSON 对象', findings: [] };
  try {
    const data = JSON.parse(m[0]);
    const findings = Array.isArray(data.findings) ? data.findings : [];
    return { ok: true, reason: `${findings.length} 条`, findings };
  } catch (e) {
    return { ok: false, reason: `JSON 解析失败: ${String(e).slice(0, 40)}`, findings: [] };
  }
}

// ========== 对分（与 semantic-bench.mjs 同源） ==========
function parseClaim(claim) {
  const s = String(claim).replace(/[`*\s]/g, ' ').trim();
  const mm = s.match(/^(.+?):(\d+)/);
  return { path: mm ? mm[1] : s.split(':')[0], line: mm ? parseInt(mm[2], 10) : 0 };
}
function hitMutation(f, m) {
  return [f.claim, f.against].some(ref => {
    if (!ref) return false;
    const c = parseClaim(ref);
    if (!c.path.endsWith(m.file) && !m.file.endsWith(c.path)) return false;
    if (c.line === 0) return true;
    return Math.abs(c.line - m.line) <= 5;
  });
}

// ========== 汇总 ==========
const perArm = arms.map(f => {
  const id = f.split('/').pop().replace('.json', '');
  const { ok, reason, findings } = extractFindings(f);
  const hits = mutations.filter(m => findings.some(fn => hitMutation(fn, m)));
  const ncViol = mutations.filter(m => m.expect === 'silent' && findings.some(fn => hitMutation(fn, m)));
  const extras = findings.filter(fn => !mutations.some(m => hitMutation(fn, m)));
  return { id, ok, reason, report: findings.length, hits: hits.map(m => m.id), ncViol: ncViol.map(m => m.id), extras: extras.length };
});

let totalHits = new Set();
let totalNc = new Set();
let jsonOk = 0;
for (const a of perArm) {
  if (a.ok) jsonOk++;
  a.hits.forEach(h => totalHits.add(h));
  a.ncViol.forEach(n => totalNc.add(n));
  console.log(`  ${a.id}: ${a.ok ? 'JSON ✅' : `格式失败（${a.reason}）`} · 报 ${a.report} · 逮变异 ${a.hits.length} [${a.hits.join(',')}]${a.ncViol.length ? ` · NC 违规 [${a.ncViol.join(',')}]` : ''}${a.extras ? ` · 面外 ${a.extras}` : ''}`);
}

const reportM = mutations.filter(m => m.expect === 'report');
const ncM = mutations.filter(m => m.expect === 'silent');
const recall = totalHits.size / reportM.length;
console.log(`\n========== 成绩单（${arms.length} 臂并集）==========`);
console.log(`召回 ${totalHits.size}/${reportM.length} = ${(recall * 100).toFixed(0)}%  逮到: [${[...totalHits].join(',')}]`);
console.log(`NC 违规 ${totalNc.size}/${ncM.length}  误报面外发现合计 ${perArm.reduce((s, a) => s + a.extras, 0)}`);
console.log(`格式纪律：${jsonOk}/${arms.length} 臂输出合法 JSON（契约执行率）`);
