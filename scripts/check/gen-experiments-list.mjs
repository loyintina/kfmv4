#!/usr/bin/env node
/**
 * gen-experiments-list.mjs — 实验清单拼接器（活源头 = 文件系统 + 各线 index.md）
 *
 * experiments/README.md 的实验清单是「目录的事实呈现」——活源头是文件系统
 * （哪些目录有 index.md = 实验线）和各实验 index.md 首行（主题）。手写必漂移
 * （2026-08-03 behavior-injection 漏列教训）。本生成器拼接清单段，新增实验线
 * 而未同步 = check 中断（--check-only）。
 *
 * 用法：
 *   node scripts/check/gen-experiments-list.mjs             # 回写 README
 *   node scripts/check/gen-experiments-list.mjs --check-only  # 校验漂移
 * 支持 KFM_PROBE_ROOT 注入（check-probes 夹具）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.KFM_PROBE_ROOT || ROOT;
const EXP_ROOT = join(BASE, 'experiments');
const README = join(EXP_ROOT, 'README.md');

const MARK_START = '<!-- gen:experiments-list:start -->';
const MARK_END = '<!-- gen:experiments-list:end -->';

const checkOnly = process.argv.includes('--check-only');
const errors = [];

const lines = [MARK_START, '', '| 实验 | 主题 |', '|------|------|'];
if (existsSync(EXP_ROOT)) {
  const dirs = readdirSync(EXP_ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
  for (const d of dirs) {
    const idx = join(EXP_ROOT, d, 'index.md');
    if (!existsSync(idx)) continue; // 实验线 = 有 index.md 的目录（与 check-experiment-index 一致）
    const first = readFileSync(idx, 'utf-8').split('\n').find(l => l.startsWith('# ')) || '';
    const topic = first.replace(/^#\s*/, '').trim() || '（index.md 缺 # 标题行）';
    lines.push(`| [${d}/](${d}/) | ${topic} |`);
  }
} else {
  errors.push('experiments/ 目录不存在');
}
lines.push('', MARK_END);
const section = lines.join('\n');

if (!existsSync(README)) {
  console.error('[gen-experiments-list] experiments/README.md 不存在');
  process.exit(1);
}
const doc = readFileSync(README, 'utf-8');
const s = doc.indexOf(MARK_START);
let next;
if (s !== -1) {
  const e = doc.indexOf(MARK_END, s);
  next = doc.slice(0, s) + section + doc.slice(e + MARK_END.length);
} else {
  // 首次插入：替换「## 实验清单」段（从该标题到下一个 ## 或 EOF）
  const anchor = doc.indexOf('## 实验清单');
  if (anchor === -1) {
    errors.push('README 缺「## 实验清单」段');
    next = doc;
  } else {
    const nextSec = doc.indexOf('\n## ', anchor + 1);
    const end = nextSec === -1 ? doc.length : nextSec;
    next = doc.slice(0, anchor) + '## 实验清单\n\n' + section + '\n' + doc.slice(end);
  }
}

if (checkOnly) {
  if (next !== doc) errors.push('实验清单漂移（experiments/ 目录与 README 清单不一致）');
} else if (next !== doc) {
  writeFileSync(README, next, 'utf-8');
}

if (errors.length) {
  for (const e of errors) console.error(`[gen-experiments-list] ${e}`);
  console.error(`[gen-experiments-list] ${errors.length} 处问题` + (checkOnly ? '——跑 node scripts/check/gen-experiments-list.mjs 回写' : ''));
  process.exit(1);
}
console.log(`[gen-experiments-list] ${checkOnly ? 'OK — 实验清单与目录一致' : '已回写实验清单'}`);
