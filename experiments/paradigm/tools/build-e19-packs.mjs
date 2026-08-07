#!/usr/bin/env node
/** build-e19-packs.mjs — e19 语料组装 + 同源嵌套切包（2026-08-07）
 *
 * 灵魂设计（design-roadmap e19 节）：32k ⊂ 128k ⊂ 256k ⊂ 512k 嵌套前缀，
 * 长度是唯一变量。语料 = 5 线 × 3 循环（论道/实战演示/反例边界）plugin-exam
 * 对话的 cleanHistory（~/.kfmv4/sessions/script/e19g-line{N}[-c2|-c3].exam-state.json），
 * 问/答轮按线序 1→5 拼接，切档在轮边界（不截断单轮）。
 * dup 对照 = corpus-32k 内容平铺到 512k 档（同族同起点，仅「新内容 vs
 * 重复」不同——分离纯占位成本与内容稀释）。
 *
 * 尺寸口径与 build-length-paradigms 一致：标称 k tok = wc -c / 3.2 / 1000，
 * 实测值须回填 occupancy.mjs 的 PACK_TOKENS_K（手工登记纪律）。
 *
 * 用法: node experiments/paradigm/tools/build-e19-packs.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SCRIPT_DIR = join(homedir(), '.kfmv4', 'sessions', 'script');
const PACK_DIR = join(homedir(), '.kfmv4', 'paradigms');
const DRY = process.argv.includes('--dry');
const LINES = [1, 2, 3, 4, 5].flatMap(n => [`e19g-line${n}`, `e19g-line${n}-c2`, `e19g-line${n}-c3`]);
const TARGETS_K = [32, 128, 256, 512]; // 标称档（k tok）
const CHARS_PER_TOK = 3.2;

function textOf(msg) {
  return (msg.content || []).filter(c => c && c.type === 'text').map(c => c.text).join('');
}

// ===== 组装语料（轮为单位）=====
const turns = [];
for (const id of LINES) {
  const stPath = join(SCRIPT_DIR, `${id}.exam-state.json`);
  if (!existsSync(stPath)) { console.error(`[缺线] ${stPath} 不存在，跳过`); continue; }
  const st = JSON.parse(readFileSync(stPath, 'utf-8'));
  let n = 0;
  for (const m of st.cleanHistory || []) {
    const t = textOf(m).trim();
    if (!t) continue;
    // 保险：若 clean 历史里混入包包裹，剥掉（正常不应出现）
    const clean = t.includes('〔范式包〕') ? t.split('————\n').slice(1).join('————\n') : t;
    turns.push({ role: m.role === 'ai' ? '答' : '问', text: clean });
    n++;
  }
  console.log(`[组装] ${id}: ${n} 轮（累计 ${turns.length}）`);
}
if (!turns.length) { console.error('语料为空，退出'); process.exit(1); }

// ===== 嵌套切档（轮边界）=====
const packs = {}; // name -> text
let acc = '', idx = 0;
for (const k of TARGETS_K) {
  const targetChars = k * 1000 * CHARS_PER_TOK;
  while (acc.length < targetChars && idx < turns.length) {
    const t = turns[idx++];
    acc += `\n\n${t.role}：${t.text}`;
  }
  packs[`meta-corpus-${k}k`] = acc.trim();
}
const exhausted = idx >= turns.length;
const measured = Object.fromEntries(Object.entries(packs).map(([n, t]) =>
  [n, +(t.length / CHARS_PER_TOK / 1000).toFixed(1)]));
console.log('[实测 k tok]', JSON.stringify(measured));
if (exhausted) console.error(`⚠️ 语料在 ${turns.length} 轮后耗尽——512k 档可能不足（实际 ${measured['meta-corpus-512k']}k）`);

// ===== dup 对照：corpus-32k 平铺到 512k 档 =====
const base = packs['meta-corpus-32k'];
const dupTarget = 512 * 1000 * CHARS_PER_TOK;
let dup = '';
while (dup.length < dupTarget) dup += (dup ? '\n\n——（重复段）——\n\n' : '') + base;
packs['meta-corpus-512k-dup'] = dup.slice(0, Math.ceil(dupTarget)).trim();
console.log(`[dup] meta-corpus-512k-dup 实测 ${(packs['meta-corpus-512k-dup'].length / CHARS_PER_TOK / 1000).toFixed(1)}k`);

// ===== 落盘 =====
for (const [name, text] of Object.entries(packs)) {
  const p = join(PACK_DIR, `${name}.md`);
  if (DRY) { console.log(`[dry] 将写 ${p}（${(text.length / 1000).toFixed(0)}k 字）`); continue; }
  writeFileSync(p, text);
  console.log(`[写出] ${p}（${(text.length / 1000).toFixed(0)}k 字）`);
}
console.log('\n下一步：把实测 k tok 手工登记进 occupancy.mjs PACK_TOKENS_K（登记纪律）');
