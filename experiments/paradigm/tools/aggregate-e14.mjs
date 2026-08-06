// aggregate-e14.mjs — e14 组合挂载（H3）汇总分析（2026-08-07 凌晨，夜间链配套）
// 读数：e14a（陷阱 T1）= 脚本项 T1-a + 语义项 t1b/t1c/t1d + v2 四维；
//       e14b（讨论 e8）= v2 四维。
// 核心对照（H3 叠加/协同/稀释）：
//   e14a: 无 vs bd（e13 复核：bd 在 T1 方向性更差是否再现）/ bd vs bd+meta（稀释?）
//   e14b: 无 vs meta（meta 主场增益）/ meta vs bd+meta（稀释?）
// 幂等：数据落地到什么程度就分析到什么程度，可随夜间链反复重跑。
// 用法: node experiments/paradigm/tools/aggregate-e14.mjs
import fs from 'node:fs';

const POOL = 'experiments/paradigm/meta-pool';
const read = (f) => JSON.parse(fs.readFileSync(`${POOL}/${f}`, 'utf8'));
const norm = (k) => k.toLowerCase().replace(/[-_]/g, '');

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

const mean = (arr) => arr.length ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) : null;
const PARADIGMS = ['无', 'behavior-discipline', 'metacognition', 'e14-bd-meta'];
const SHORT = { '无': '无包', 'behavior-discipline': 'bd', 'metacognition': 'meta', 'e14-bd-meta': 'bd+meta' };

// ---- 数据装载 ----
const scriptFile = fs.existsSync(`${POOL}/judge-e13-script-e14a.json`) ? read('judge-e13-script-e14a.json') : null;
const llmA = fs.existsSync(`${POOL}/judge-e14a.json`) ? read('judge-e14a.json') : null;
const llmB = fs.existsSync(`${POOL}/judge-e14b.json`) ? read('judge-e14b.json') : null;

// 臂 → paradigm 映射（脚本判卷归档带 paradigm 列；llm 归档带 pi——但 pi 是批次内下标，
// 语义列以臂 id  join 脚本归档为准；e14b 无脚本归档，pi → PARADIGMS[pi] 映射，
// 因 spec paradigms 顺序固定「无,bd,meta,bd+meta」，与 batch-run 下标生成序一致）
const paraOf = {};
if (scriptFile) for (const [id, a] of Object.entries(scriptFile.arms)) paraOf[id] = a.paradigm;

const out = { generated: new Date().toISOString(), e14a: null, e14b: null };

// ---- e14a：陷阱 T1 ----
if (llmA && scriptFile) {
  const cells = {};
  for (const p of PARADIGMS) cells[p] = { t1a: [], t1b: [], t1c: [], t1d: [], meta: [], dissect: [], bound: [], vis: [] };
  let semCov = [0, 0];
  for (const [id, a] of Object.entries(llmA)) {
    const p = paraOf[id];
    if (!p || !cells[p]) continue;
    const sc = {};
    for (const [k, v] of Object.entries(a.score || {})) sc[norm(k)] = v;
    const c = cells[p];
    for (const [dst, src] of [['meta', 'metadepth'], ['dissect', 'selfdissection'], ['bound', 'boundaryawareness'], ['vis', 'reasoningvisible']]) {
      if (typeof sc[src] === 'number') c[dst].push(sc[src]);
    }
    let hasSem = false;
    for (const k of ['t1b', 't1c', 't1d']) {
      if (typeof sc[k] === 'number') { c[k].push(sc[k]); hasSem = true; }
    }
    semCov[1]++;
    if (hasSem) semCov[0]++;
  }
  for (const [id, a] of Object.entries(scriptFile.arms)) {
    if (cells[a.paradigm] && typeof a.checks?.['T1-a'] === 'number') cells[a.paradigm].t1a.push(a.checks['T1-a']);
  }
  out.e14a = { semCoverage: `${semCov[0]}/${semCov[1]}`, cells: {} };
  for (const p of PARADIGMS) {
    const c = cells[p];
    out.e14a.cells[SHORT[p]] = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { n: v.length, mean: mean(v), sum: v.reduce((s, x) => s + x, 0) }]));
  }
}

// ---- e14b：讨论 e8（v2 四维） ----
if (llmB) {
  const cells = {};
  for (const p of PARADIGMS) cells[p] = { meta: [], dissect: [], bound: [], vis: [] };
  for (const [id, a] of Object.entries(llmB)) {
    if (typeof a.pi !== 'number') continue;
    const p = PARADIGMS[a.pi];
    if (!p) continue;
    const sc = a.score || {};
    for (const [dst, src] of [['meta', 'meta_depth'], ['dissect', 'self_dissection'], ['bound', 'boundary_awareness'], ['vis', 'reasoning_visible']]) {
      if (typeof sc[src] === 'number') cells[p][dst].push(sc[src]);
    }
  }
  out.e14b = { cells: {} };
  for (const p of PARADIGMS) {
    out.e14b.cells[SHORT[p]] = Object.fromEntries(Object.entries(cells[p]).map(([k, v]) => [k, { n: v.length, mean: mean(v) }]));
  }
}

// ---- H3 关键对照（含检验，直接可引） ----
out.contrasts = [];
const addFisher = (label, x1, x0, y1, y0) => out.contrasts.push({ label, a: `${x1}/${x1 + x0}`, b: `${y1}/${y1 + y0}`, p: +fisher(x1, x0, y1, y0).toFixed(3) });
if (out.e14a) {
  const C = out.e14a.cells;
  for (const k of ['t1b', 't1c']) {
    addFisher(`e14a ${k}: 无包 vs bd`, C['无包'][k].sum, C['无包'][k].n - C['无包'][k].sum, C['bd'][k].sum, C['bd'][k].n - C['bd'][k].sum);
    addFisher(`e14a ${k}: bd vs bd+meta（稀释?）`, C['bd'][k].sum, C['bd'][k].n - C['bd'][k].sum, C['bd+meta'][k].sum, C['bd+meta'][k].n - C['bd+meta'][k].sum);
  }
}
fs.writeFileSync(`${POOL}/aggregate-e14.json`, JSON.stringify(out, null, 2));

// ---- 控制台摘要 ----
console.log('e14a 语义覆盖:', out.e14a?.semCoverage ?? '(数据未齐)');
if (out.e14a) {
  console.log('--- e14a（T1 陷阱）格均值 ---');
  for (const p of Object.values(SHORT)) {
    const c = out.e14a.cells[p];
    console.log(`${p.padEnd(8)} t1b=${c.t1b.mean}(${c.t1b.n}) t1c=${c.t1c.mean}(${c.t1c.n}) meta=${c.meta.mean} vis=${c.vis.mean}`);
  }
}
if (out.e14b) {
  console.log('--- e14b（e8 讨论）格均值 ---');
  for (const p of Object.values(SHORT)) {
    const c = out.e14b.cells[p];
    console.log(`${p.padEnd(8)} meta=${c.meta.mean}(${c.meta.n}) dissect=${c.dissect.mean} bound=${c.bound.mean} vis=${c.vis.mean}`);
  }
}
for (const c of out.contrasts) console.log(`对照 ${c.label}: ${c.a} vs ${c.b} p=${c.p}`);
console.log('写出', `${POOL}/aggregate-e14.json`);
