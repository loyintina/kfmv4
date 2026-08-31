#!/usr/bin/env node
/**
 * scripts/verify-wide-table.mjs — 壳 WIDE_RANGES ⇄ rio-vt 核宽度对拍
 * （2026-08-31 光标右移半格案：⚡ U+26A1 核判 2 格、壳走自然文本 1 格，
 *  其后整行左移 1 格。宽字符表单源 = 核，本脚本是对拍尺）
 *
 * 扫面：全 BMP（0x80-D7FF/E000-FFFF）+ 1F000-1FAFF 逐字符，
 * 20000-3FFFD 每 0x400 抽点（CJK 扩展区连续宽，全扫太贵）。
 * 判据：核推进格数 === (isWide(cp) ? 2 : 1)，零不一致才绿。
 *
 * 跑法：node scripts/verify-wide-table.mjs（nz 目录下；核 wasm 用
 * public/term-core/ 已构建产物——rio-vt 换版后先 build.mjs 再跑本尺）。
 */
import { readFileSync } from 'node:fs';
import init, { TermCore } from '../public/term-core/kfm_term_core.js';

// 从 shell.ts 源里抽 WIDE_RANGES 字面量（单源，不复制表）
const src = readFileSync(new URL('../src/client/term/shell.ts', import.meta.url), 'utf8');
const m = src.match(/const WIDE_RANGES[^=]*= \[([\s\S]*?)\n\];/);
if (!m) { console.error('❌ 未能从 shell.ts 抽取 WIDE_RANGES'); process.exit(1); }
const WIDE_RANGES = eval(`[${m[1]}]`);

const isWide = (cp) => {
  let lo = 0, hi = WIDE_RANGES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = WIDE_RANGES[mid];
    if (cp < a) hi = mid - 1;
    else if (cp > b) lo = mid + 1;
    else return true;
  }
  return false;
};

await init({ module_or_path: readFileSync(new URL('../public/term-core/kfm_term_core_bg.wasm', import.meta.url)) });
const enc = new TextEncoder();

const cps = [];
for (let c = 0x80; c <= 0xd7ff; c++) cps.push(c);
for (let c = 0xe000; c <= 0xffff; c++) cps.push(c);
for (let c = 0x1f000; c <= 0x1faff; c++) cps.push(c);
for (let c = 0x20000; c <= 0x3fffd; c += 0x400) cps.push(c);

const coreW = (ch) => {
  const t = new TermCore(80, 24, 0);
  t.feed(enc.encode('A' + ch + 'B'));
  const w = t.cursor() - 2; // A/B 各 1 格
  t.free();
  return w;
};

const fmt = (cp) => cp.toString(16).toUpperCase().padStart(4, '0');
const bad = [];
for (const cp of cps) {
  const w = coreW(String.fromCodePoint(cp));
  if ((w === 2) !== isWide(cp)) bad.push(`${fmt(cp)}:核${w}/壳${isWide(cp) ? 2 : 1}`);
}

if (bad.length === 0) {
  console.log(`✅ 壳核宽度零不一致（${cps.length} 码点，WIDE_RANGES ${WIDE_RANGES.length} 区间）`);
} else {
  console.log(`❌ ${bad.length} 不一致：`);
  console.log(bad.join(' '));
  process.exit(1);
}
