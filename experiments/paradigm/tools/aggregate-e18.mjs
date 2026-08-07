// aggregate-e18.mjs — e18 v4-flash 专项汇总（2026-08-07）
// 预注册读数（design-roadmap-e14-e16.md e18 节）：
//   e18a 主终点 self_dissection（S6 vs 无）；e18b 主终点 T2-d（bd vs 无）；
//   e18c 主终点 meta_depth 随包长趋势（8k 锚点取 e18a meta 格）。
// 单模型（deepseek-v4-flash），跨模型比较纪律不适用；判官=被测同模型，
// 自判偏差实测 Δ=+0.19/12（results-judge-bias.md），结果文档须标注。
// 幂等随判卷落地重跑。用法: node experiments/paradigm/tools/aggregate-e18.mjs
import fs from 'node:fs';

const POOL = 'experiments/paradigm/meta-pool';
const read = (f) => JSON.parse(fs.readFileSync(`${POOL}/${f}`, 'utf8'));
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
  if (!n0 || !n1) return { z: null, p: null };
  const u0 = r0 - n0 * (n0 + 1) / 2;
  const mu = n0 * n1 / 2, sigma = Math.sqrt(n0 * n1 * (n0 + n1 + 1) / 12);
  const z = (u0 - mu) / sigma;
  const phi = 0.5 * (1 + Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
  return { z: +z.toFixed(2), p: +Math.min(1, 2 * (1 - phi)).toFixed(3) };
}

const DIMS = [['meta', 'meta_depth'], ['dissect', 'self_dissection'], ['bound', 'boundary_awareness'], ['vis', 'reasoning_visible']];

function cellsByPi(judge, paras, extraKeys = []) {
  const cells = {};
  const keys = [...DIMS.map(([, s]) => s), ...extraKeys];
  for (const p of paras) { cells[p] = {}; for (const k of keys) cells[p][k] = []; }
  for (const a of Object.values(judge)) {
    const p = paras[a.pi];
    if (!p) continue;
    for (const k of keys) if (typeof a.score?.[k] === 'number') cells[p][k].push(a.score[k]);
  }
  return cells;
}

const out = { generated: new Date().toISOString(), e18a: { cells: {}, contrasts: [] }, e18b: { cells: {}, contrasts: [] }, e18c: { trend: [] } };

// ---- e18a：e8 讨论 × {无, bd, meta, S6} ----
const A_PARAS = ['无', 'behavior-discipline', 'metacognition', 'e16-s6-retro'];
const A_SHORT = { '无': '无包', 'behavior-discipline': 'bd', 'metacognition': 'meta', 'e16-s6-retro': 'S6复盘' };
try {
  const a = cellsByPi(read('judge-e18a.json'), A_PARAS);
  for (const p of A_PARAS) {
    out.e18a.cells[A_SHORT[p]] = Object.fromEntries(DIMS.map(([d, s]) => [d, { n: a[p][s].length, mean: mean(a[p][s]) }]));
  }
  const RA = (pa, pb, d) => {
    const src = DIMS.find(([x]) => x === d)[1];
    const r = mwu(a[pa][src], a[pb][src]);
    out.e18a.contrasts.push({ label: `${d}: ${A_SHORT[pa]} vs ${A_SHORT[pb]}`, a: mean(a[pa][src]), b: mean(a[pb][src]), ...r });
  };
  RA('无', 'e16-s6-retro', 'dissect');   // 预注册主终点
  RA('无', 'behavior-discipline', 'dissect');
  RA('无', 'metacognition', 'meta');
  RA('无', 'metacognition', 'dissect');
  RA('behavior-discipline', 'metacognition', 'meta');
} catch { out.e18a.error = 'judge-e18a.json 未就绪'; }

// ---- e18b：T2 陷阱 × {无, bd}，主终点 T2-d ----
const B_PARAS = ['无', 'behavior-discipline'];
const B_SHORT = { '无': '无包', 'behavior-discipline': 'bd' };
try {
  const b = cellsByPi(read('judge-e18b.json'), B_PARAS, ['T2-d']);
  for (const p of B_PARAS) {
    out.e18b.cells[B_SHORT[p]] = { 'T2-d': { n: b[p]['T2-d'].length, mean: mean(b[p]['T2-d']) } };
  }
  const r = mwu(b['无']['T2-d'], b['behavior-discipline']['T2-d']);
  out.e18b.contrasts.push({ label: 'T2-d: 无包 vs bd', a: mean(b['无']['T2-d']), b: mean(b['behavior-discipline']['T2-d']), ...r });
} catch { out.e18b.error = 'judge-e18b.json 未就绪'; }

// ---- e18c：长度梯度 meta_depth 趋势（8k 锚点取 e18a meta 格）----
const C_PARAS = ['metacognition-32k', 'metacognition-64k', 'metacognition-96k'];
const C_LEN = { 'metacognition': 8.1, 'metacognition-32k': 30.1, 'metacognition-64k': 64.5, 'metacognition-96k': 89.8 };
try {
  const c = cellsByPi(read('judge-e18c.json'), C_PARAS);
  const anchor = out.e18a.cells?.meta?.meta;
  if (anchor && anchor.n) out.e18c.trend.push({ pack: 'metacognition(8k锚,e18a)', k: C_LEN['metacognition'], n: anchor.n, meta: anchor.mean });
  for (const p of C_PARAS) {
    const arr = c[p]['meta_depth'];
    out.e18c.trend.push({ pack: p, k: C_LEN[p], n: arr.length, meta: mean(arr) });
  }
} catch { out.e18c.error = 'judge-e18c.json 未就绪'; }

fs.writeFileSync(`${POOL}/aggregate-e18.json`, JSON.stringify(out, null, 2));

console.log('=== e18a（v4-flash，e8 任务，v2 均值）===');
for (const [p, c] of Object.entries(out.e18a.cells)) {
  console.log(p.padEnd(8), DIMS.map(([d]) => `${d}=${c[d].mean}(${c[d].n})`).join(' '));
}
for (const c of out.e18a.contrasts) console.log(`  ${c.label}: ${c.a} vs ${c.b}  z=${c.z} p=${c.p}`);
console.log('=== e18b（T2 陷阱，T2-d）===');
for (const [p, c] of Object.entries(out.e18b.cells)) console.log(p.padEnd(8), `T2-d=${c['T2-d'].mean}(${c['T2-d'].n})`);
for (const c of out.e18b.contrasts) console.log(`  ${c.label}: ${c.a} vs ${c.b}  z=${c.z} p=${c.p}`);
console.log('=== e18c（长度梯度 meta_depth 趋势）===');
for (const t of out.e18c.trend) console.log(`  ${t.pack} (${t.k}k): meta=${t.meta} (n=${t.n})`);
console.log('写出', `${POOL}/aggregate-e18.json`);
