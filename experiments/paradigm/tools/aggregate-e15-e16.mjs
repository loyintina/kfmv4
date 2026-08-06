// aggregate-e15-e16.mjs — e15（注入位置）+ e16（结构 S5/S6）汇总分析（2026-08-07 晨）
// e15：位置分辨靠哈希重算——batch-run 把 position 折进臂哈希（task|paradigm|model|position），
//   臂 id 后缀与三档哈希比对即归属；first-user 档复用 e14b meta 格（pi=1）。
// e16：脚本判卷归档带 paradigm 语义列直读；v2 四维 + t2d 从 judge-e16.json。
// 幂等：数据落地多少分析多少。用法: node experiments/paradigm/tools/aggregate-e15-e16.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const POOL = 'experiments/paradigm/meta-pool';
const read = (f) => JSON.parse(fs.readFileSync(`${POOL}/${f}`, 'utf8'));
const norm = (k) => k.toLowerCase().replace(/[-_]/g, '');
const mean = (arr) => arr.length ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) : null;

function mwu(x, y) {
  const all = [...x.map(v => ({ v, g: 0 })), ...y.map(v => ({ v, g: 1 }))].sort((a, b) => a.v - b.v);
  const ranks = [];
  for (let i = 0; i < all.length; i++) {
    let j = i; while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const avg = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j;
  }
  let r0 = 0;
  all.forEach((e, i) => { if (e.g === 0) r0 += ranks[i]; });
  const n0 = x.length, n1 = y.length;
  const u0 = r0 - n0 * (n0 + 1) / 2;
  const mu = n0 * n1 / 2, sigma = Math.sqrt(n0 * n1 * (n0 + n1 + 1) / 12);
  const z = (u0 - mu) / sigma;
  const phi = 0.5 * (1 + Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
  return { z: +z.toFixed(2), p: +Math.min(1, 2 * (1 - phi)).toFixed(3) };
}
function fisher(a, b, c, d) {
  const n = a + b + c + d;
  const logC = (n, k) => { let s = 0; for (let i = 0; i < k; i++) s += Math.log(n - i) - Math.log(i + 1); return s; };
  const p = (a, b, c, d) => Math.exp(logC(a + b, a) + logC(c + d, c) - logC(n, a + c));
  const p0 = p(a, b, c, d);
  let sum = 0;
  const r1 = a + b, c1 = a + c;
  for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(r1, c1); x++) {
    const pp = p(x, r1 - x, c1 - x, n - r1 - c1 + x);
    if (pp <= p0 * 1.0001) sum += pp;
  }
  return Math.min(1, sum);
}

const DIMS = [['meta', 'meta_depth'], ['dissect', 'self_dissection'], ['bound', 'boundary_awareness'], ['vis', 'reasoning_visible']];
const out = { generated: new Date().toISOString(), e15: null, e16: null };

// ================= e15 注入位置 =================
{
  const task = fs.readFileSync('experiments/paradigm/scenarios/e8-task.txt', 'utf8').trim();
  const models = ['Qwen/Qwen3.6-35B-A3B', 'Qwen/Qwen3.5-27B', 'Pro/deepseek-ai/DeepSeek-V3', 'Pro/MiniMaxAI/MiniMax-M2.5'];
  const hashOf = (model, pos) => createHash('md5').update(`${task}|metacognition|${model}|${pos}`).digest('hex').slice(0, 6);
  const posByHash = {};
  for (const m of models) for (const pos of ['system', 'pre-task-user']) posByHash[hashOf(m, pos)] = pos;

  const judge15 = read('judge-e15.json');
  const cells = { 'system': {}, 'pre-task-user': {}, 'first-user(e14b复用)': {} };
  for (const c of Object.values(cells)) for (const [d] of DIMS) c[d] = [];
  let unmatched = [];
  for (const [id, a] of Object.entries(judge15)) {
    const suffix = id.split('-').pop();
    const pos = posByHash[suffix];
    if (!pos) { unmatched.push(id); continue; }
    const sc = a.score || {};
    for (const [d, src] of DIMS) if (typeof sc[src] === 'number') cells[pos][d].push(sc[src]);
  }
  // first-user 档 = e14b 的 meta 格（pi=1）
  const judge14b = read('judge-e14b.json');
  for (const a of Object.values(judge14b)) {
    if (a.pi !== 1) continue;
    const sc = a.score || {};
    for (const [d, src] of DIMS) if (typeof sc[src] === 'number') cells['first-user(e14b复用)'][d].push(sc[src]);
  }
  out.e15 = { unmatched: unmatched.length, cells: {}, contrasts: [] };
  for (const [pos, c] of Object.entries(cells)) {
    out.e15.cells[pos] = Object.fromEntries(DIMS.map(([d]) => [d, { n: c[d].length, mean: mean(c[d]) }]));
  }
  // 关键对照：first-user vs system / first-user vs pre-task-user
  const raw = (pos, d) => {
    const arr = [];
    if (pos === 'first-user(e14b复用)') {
      for (const a of Object.values(judge14b)) { if (a.pi === 1 && typeof a.score?.[DIMS.find(x => x[0] === d)[1]] === 'number') arr.push(a.score[DIMS.find(x => x[0] === d)[1]]); }
    } else {
      for (const [id, a] of Object.entries(judge15)) {
        if (posByHash[id.split('-').pop()] !== pos) continue;
        const v = a.score?.[DIMS.find(x => x[0] === d)[1]];
        if (typeof v === 'number') arr.push(v);
      }
    }
    return arr;
  };
  for (const pos of ['system', 'pre-task-user']) {
    for (const [d] of DIMS) {
      const r = mwu(raw('first-user(e14b复用)', d), raw(pos, d));
      out.e15.contrasts.push({ label: `${d}: first-user vs ${pos}`, ...r });
    }
  }
}

// ================= e16 结构 S5/S6 =================
{
  const script16 = read('judge-e13-script-e16.json');
  const PARAS = ['无', 'behavior-discipline', 'e16-s5-contrast', 'e16-s6-retro'];
  const SHORT = { '无': '无包', 'behavior-discipline': 'S2(bd)', 'e16-s5-contrast': 'S5对比对', 'e16-s6-retro': 'S6复盘' };
  const cells = {};
  for (const p of PARAS) cells[p] = { t2b: [], t2c: [] };
  for (const a of Object.values(script16.arms)) {
    if (!cells[a.paradigm]) continue;
    if (typeof a.checks?.['T2-b'] === 'number') cells[a.paradigm]['t2b'].push(a.checks['T2-b']);
    if (typeof a.checks?.['T2-c'] === 'number') cells[a.paradigm]['t2c'].push(a.checks['T2-c']);
  }
  // v2 四维 + t2d（judge-e16.json，pi → PARAS 下标：spec paradigms 顺序与 PARAS 一致）
  const judge16 = read('judge-e16.json');
  for (const p of PARAS) for (const [d] of DIMS) cells[p][d] = [];
  for (const p of PARAS) cells[p]['t2d'] = [];
  for (const a of Object.values(judge16)) {
    const p = PARAS[a.pi];
    if (!p) continue;
    const sc = {};
    for (const [k, v] of Object.entries(a.score || {})) sc[norm(k)] = v;
    for (const [d, src] of DIMS) if (typeof sc[src.replace(/_/g, '')] === 'number') cells[p][d].push(sc[src.replace(/_/g, '')]);
    if (typeof sc['t2d'] === 'number') cells[p]['t2d'].push(sc['t2d']);
  }
  out.e16 = { cells: {}, contrasts: [] };
  for (const p of PARAS) {
    out.e16.cells[SHORT[p]] = Object.fromEntries(Object.entries(cells[p]).map(([k, v]) => [k, { n: v.length, mean: mean(v), sum: v.reduce((s, x) => s + x, 0) }]));
  }
  // 关键对照：T2-b —— 无包 vs S2（e13 锚点复核）/ S2 vs S5 / S2 vs S6
  const C = out.e16.cells;
  for (const [label, pa, pb] of [['无包 vs S2(bd)（e13 锚点复核）', '无包', 'S2(bd)'], ['S2 vs S5对比对', 'S2(bd)', 'S5对比对'], ['S2 vs S6复盘', 'S2(bd)', 'S6复盘'], ['S5 vs S6', 'S5对比对', 'S6复盘']]) {
    out.e16.contrasts.push({ label: `T2-b ${label}`, a: `${C[pa].t2b.sum}/${C[pa].t2b.n}`, b: `${C[pb].t2b.sum}/${C[pb].t2b.n}`, p: +fisher(C[pa].t2b.sum, C[pa].t2b.n - C[pa].t2b.sum, C[pb].t2b.sum, C[pb].t2b.n - C[pb].t2b.sum).toFixed(3) });
  }
}

fs.writeFileSync(`${POOL}/aggregate-e15-e16.json`, JSON.stringify(out, null, 2));

console.log('=== e15 注入位置（e8 任务 × meta 包，v2 均值）===');
for (const [pos, c] of Object.entries(out.e15.cells)) console.log(pos.padEnd(20), DIMS.map(([d]) => `${d}=${c[d].mean}(${c[d].n})`).join(' '));
if (out.e15.unmatched) console.log('⚠ 哈希未匹配臂:', out.e15.unmatched);
for (const c of out.e15.contrasts.filter((_, i) => i % 4 < 4)) console.log(`  ${c.label} z=${c.z} p=${c.p}`);
console.log('=== e16 结构（T2 陷阱，T2-b 为主读数）===');
for (const [p, c] of Object.entries(out.e16.cells)) console.log(p.padEnd(10), `t2b=${c.t2b.sum}/${c.t2b.n} t2d=${c.t2d.sum}/${c.t2d.n} meta=${c.meta.mean} vis=${c.vis.mean}`);
for (const c of out.e16.contrasts) console.log(`  ${c.label}: ${c.a} vs ${c.b} p=${c.p}`);
console.log('写出', `${POOL}/aggregate-e15-e16.json`);
