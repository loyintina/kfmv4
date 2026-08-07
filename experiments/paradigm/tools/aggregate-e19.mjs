// aggregate-e19.mjs — e19 拥挤区占用率专项汇总（2026-08-07）
// 预注册读数（design-roadmap-e14-e16.md e19 节）：
//   主终点 meta_depth × 占用率曲线形态（缓降 vs 断崖；
//   断崖定义：相邻档降幅 >2×前一档降幅且 MWU p<0.05）；
//   次级 dissect 同曲线；参考格 512k vs 512k-dup（占位成本 vs 内容稀释）。
// 占用率按 occupancy.mjs 口径（包标称 tok ÷ v4-flash 1M 窗口）。
// 幂等随判卷落地重跑。用法: node experiments/paradigm/tools/aggregate-e19.mjs
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

// pi 顺序与 spec paradigms 一致；occ = 占用率（标称 tok / 1024k 窗口）
const PARAS = ['meta-corpus-32k', 'meta-corpus-128k', 'meta-corpus-256k', 'meta-corpus-512k', 'meta-corpus-512k-dup'];
const OCC = { 'meta-corpus-32k': 0.03, 'meta-corpus-128k': 0.13, 'meta-corpus-256k': 0.26, 'meta-corpus-512k': 0.51, 'meta-corpus-512k-dup': 0.51 };
const DIMS = [['meta', 'meta_depth'], ['dissect', 'self_dissection'], ['bound', 'boundary_awareness'], ['vis', 'reasoning_visible']];

const judge = read('judge-e19.json');
const cells = {};
for (const p of PARAS) { cells[p] = {}; for (const [, s] of DIMS) cells[p][s] = []; }
for (const a of Object.values(judge)) {
  const p = PARAS[a.pi];
  if (!p) continue;
  for (const [, s] of DIMS) if (typeof a.score?.[s] === 'number') cells[p][s].push(a.score[s]);
}

const out = { generated: new Date().toISOString(), curve: {}, cliffTest: [], dupContrast: {} };
for (const [d, s] of DIMS) {
  out.curve[d] = PARAS.map(p => ({ pack: p, occ: OCC[p], n: cells[p][s].length, mean: mean(cells[p][s]) }));
}

// 断崖检验（主终点 meta_depth，相邻档）
for (const [d, s] of [['meta', 'meta_depth'], ['dissect', 'self_dissection']]) {
  const ladder = PARAS.slice(0, 4); // dup 不进梯度
  let prevDrop = null;
  for (let i = 1; i < ladder.length; i++) {
    const a = mean(cells[ladder[i - 1]][s]), b = mean(cells[ladder[i]][s]);
    const drop = a !== null && b !== null ? +(a - b).toFixed(2) : null;
    const r = mwu(cells[ladder[i - 1]][s], cells[ladder[i]][s]);
    const cliff = drop !== null && prevDrop !== null && drop > 2 * prevDrop && r.p !== null && r.p < 0.05;
    out.cliffTest.push({ dim: d, step: `${ladder[i - 1]}→${ladder[i]}`, drop, prevDrop, ...r, cliff: !!cliff });
    if (drop !== null && drop > 0) prevDrop = drop;
  }
}

// dup 对照（512k vs 512k-dup，占位成本 vs 内容稀释）
for (const [d, s] of DIMS) {
  const r = mwu(cells['meta-corpus-512k'][s], cells['meta-corpus-512k-dup'][s]);
  out.dupContrast[d] = { corpus: mean(cells['meta-corpus-512k'][s]), dup: mean(cells['meta-corpus-512k-dup'][s]), ...r };
}

fs.writeFileSync(`${POOL}/aggregate-e19.json`, JSON.stringify(out, null, 2));

console.log('=== e19 占用率曲线（v4-flash 1M 窗口，v2 均值）===');
for (const [d] of DIMS) {
  console.log(d.padEnd(8), out.curve[d].map(c => `${(c.occ * 100).toFixed(0)}%:${c.mean}(${c.n})`).join('  '));
}
console.log('--- 断崖检验（相邻档）---');
for (const c of out.cliffTest) console.log(`${c.dim} ${c.step}: 降幅=${c.drop}（前档降幅=${c.prevDrop}）p=${c.p} ${c.cliff ? '⛔断崖' : ''}`);
console.log('--- dup 对照（512k 同源 vs 平铺）---');
for (const [d, c] of Object.entries(out.dupContrast)) console.log(`${d}: corpus=${c.corpus} vs dup=${c.dup}  z=${c.z} p=${c.p}`);
console.log('写出', `${POOL}/aggregate-e19.json`);
