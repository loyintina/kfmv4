// aggregate-e13.mjs — 一次性汇总：合并 e13 脚本判卷 + LLM 盲判，出格均值表
// 用法: node experiments/paradigm/tools/aggregate-e13.mjs
import fs from 'node:fs';

const POOL = 'experiments/paradigm/meta-pool';
const script = JSON.parse(fs.readFileSync(`${POOL}/judge-e13-script-e13.json`, 'utf8'));
const llm = JSON.parse(fs.readFileSync(`${POOL}/judge-e13-llm.json`, 'utf8'));

// 语义键名归一化：T1-b / t1_b / t1b / T1_b → t1b
function normKey(k) {
  return k.toLowerCase().replace(/[-_]/g, '');
}
const SEMANTIC = { T1: ['t1b', 't1c', 't1d'], T2: ['t2d'], T3: ['t3c'] };

const scriptArms = script.arms || script;
const rows = [];
let semCoverage = { T1: { have: 0, total: 0 }, T2: { have: 0, total: 0 }, T3: { have: 0, total: 0 } };

for (const [armId, s] of Object.entries(scriptArms)) {
  const trap = s.trap;
  if (!trap || !armId.startsWith('e13-')) continue;
  const l = llm[armId];
  const row = { armId, trap, paradigm: s.paradigm, model: s.model, checks: s.checks };
  if (l && l.score) {
    const sc = {};
    for (const [k, v] of Object.entries(l.score)) sc[normKey(k)] = v;
    row.meta = sc.metadepth ?? null;
    row.dissect = sc.selfdissection ?? null;
    row.bound = sc.boundaryawareness ?? null;
    row.vis = sc.reasoningvisible ?? null;
    for (const key of SEMANTIC[trap]) {
      row[key] = typeof sc[key] === 'number' ? sc[key] : null;
    }
    semCoverage[trap].total++;
    if (SEMANTIC[trap].some(k => row[k] !== null)) semCoverage[trap].have++;
  }
  rows.push(row);
}

// 按 {trap × paradigm × model} 聚合
const cells = {};
for (const r of rows) {
  const key = `${r.trap}|${r.paradigm}|${r.model}`;
  (cells[key] ||= { trap: r.trap, paradigm: r.paradigm, model: r.model, n: 0, sums: {}, counts: {} });
  const c = cells[key];
  c.n++;
  const fields = ['meta', 'dissect', 'bound', 'vis', ...SEMANTIC[r.trap], ...Object.keys(r.checks || {})];
  for (const f of fields) {
    const v = f in (r.checks || {}) ? r.checks[f] : r[f];
    if (typeof v === 'number') {
      c.sums[f] = (c.sums[f] || 0) + v;
      c.counts[f] = (c.counts[f] || 0) + 1;
    }
  }
}

const out = { generated: new Date().toISOString(), semCoverage, cells: {} };
for (const [key, c] of Object.entries(cells)) {
  const means = {};
  for (const [f, sum] of Object.entries(c.sums)) means[f] = +(sum / c.counts[f]).toFixed(3);
  out.cells[key] = { trap: c.trap, paradigm: c.paradigm, model: c.model, n: c.n, means };
}

fs.writeFileSync(`${POOL}/aggregate-e13.json`, JSON.stringify(out, null, 2));
console.log('arms 总数:', rows.length, '(llm 有分的:', rows.filter(r => r.meta !== undefined && r.meta !== null).length, ')');
console.log('语义项覆盖:', JSON.stringify(semCoverage));
console.log('格子数:', Object.keys(out.cells).length);
console.log('写出', `${POOL}/aggregate-e13.json`);
