// aggregate-e17.mjs — e17 复盘质量线专项汇总（2026-08-07，确认性实验）
// 预注册主终点：self_dissection，S6 vs 无包，MWU（design-roadmap-e14-e16.md e17 节）。
// 次级：S6 vs bd（纯复盘 vs bd 复盘节）；三级：meta_depth / vis；参考：e14b meta 格（跨时）。
// 幂等随跑数/判卷落地重跑。用法: node experiments/paradigm/tools/aggregate-e17.mjs
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
  const u0 = r0 - n0 * (n0 + 1) / 2;
  const mu = n0 * n1 / 2, sigma = Math.sqrt(n0 * n1 * (n0 + n1 + 1) / 12);
  const z = (u0 - mu) / sigma;
  const phi = 0.5 * (1 + Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)));
  return { z: +z.toFixed(2), p: +Math.min(1, 2 * (1 - phi)).toFixed(3) };
}

const PARAS = ['无', 'behavior-discipline', 'e16-s6-retro']; // 与 e17 spec paradigms 顺序一致（pi 下标）
const SHORT = { '无': '无包', 'behavior-discipline': 'bd', 'e16-s6-retro': 'S6复盘' };
const DIMS = [['meta', 'meta_depth'], ['dissect', 'self_dissection'], ['bound', 'boundary_awareness'], ['vis', 'reasoning_visible']];

const judge = read('judge-e17.json');
const cells = {};
for (const p of PARAS) { cells[p] = {}; for (const [d] of DIMS) cells[p][d] = []; }
for (const a of Object.values(judge)) {
  const p = PARAS[a.pi];
  if (!p) continue;
  for (const [d, src] of DIMS) if (typeof a.score?.[src] === 'number') cells[p][d].push(a.score[src]);
}
// 参考：e14b meta 格（跨时基线，只作参考不进检验）
const ref = {};
try {
  const judge14b = read('judge-e14b.json');
  for (const [d, src] of DIMS) ref[d] = [];
  for (const a of Object.values(judge14b)) {
    if (a.pi !== 2) continue; // e14b pi=2 = metacognition
    for (const [d, src] of DIMS) if (typeof a.score?.[src] === 'number') ref[d].push(a.score[src]);
  }
} catch {}

const out = { generated: new Date().toISOString(), cells: {}, refE14bMeta: {}, contrasts: [] };
for (const p of PARAS) {
  out.cells[SHORT[p]] = Object.fromEntries(DIMS.map(([d]) => [d, { n: cells[p][d].length, mean: mean(cells[p][d]) }]));
}
for (const [d] of DIMS) out.refE14bMeta[d] = { n: ref[d]?.length || 0, mean: mean(ref[d] || []) };

// 预注册对照
const R = (pa, pb, d) => {
  const r = mwu(cells[pa][d], cells[pb][d]);
  out.contrasts.push({ label: `${d}: ${SHORT[pa]} vs ${SHORT[pb]}`, a: mean(cells[pa][d]), b: mean(cells[pb][d]), ...r });
};
R('无', 'e16-s6-retro', 'dissect'); // 主终点
R('behavior-discipline', 'e16-s6-retro', 'dissect'); // 次级
for (const d of ['meta', 'vis']) R('无', 'e16-s6-retro', d); // 三级
R('无', 'behavior-discipline', 'dissect'); // e14b 冠军复核（同期）

fs.writeFileSync(`${POOL}/aggregate-e17.json`, JSON.stringify(out, null, 2));
console.log('=== e17 复盘质量线（e8 任务，v2 均值）===');
for (const p of Object.values(SHORT)) {
  const c = out.cells[p];
  console.log(p.padEnd(8), DIMS.map(([d]) => `${d}=${c[d].mean}(${c[d].n})`).join(' '));
}
console.log('参考 e14b meta 格（跨时）:', DIMS.map(([d]) => `${d}=${out.refE14bMeta[d].mean}`).join(' '));
console.log('--- 预注册对照 ---');
for (const c of out.contrasts) console.log(`${c.label}: ${c.a} vs ${c.b}  z=${c.z} p=${c.p}`);
console.log('写出', `${POOL}/aggregate-e17.json`);
