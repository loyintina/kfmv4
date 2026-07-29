/**
 * check-active-stack.mjs — 工作栈与 active/ 目录健康检查（v8.2 新增）
 *
 * 检查项：
 *   1. active/STACK.md 引用的文件全部存在（栈项指向的目标不能是空气）
 *   2. active/ 下每个 .md 都被 STACK.md 或 CLAUDE.md 引用（防孤儿文件——
 *      active/ 是临时工位，没人引用的文件说明完成态没结算）
 *
 * 挂入 npm run check，失败 → 构建中断。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
let errors = 0;
function error(msg) {
  console.error(`[check-active-stack] ${msg}`);
  errors++;
}

const activeDir = join(ROOT, DOCS_ROOT, 'active');
const stackPath = join(activeDir, 'STACK.md');
const stack = readFileSync(stackPath, 'utf-8');
const claude = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf-8');

// ========== 1. STACK.md 引用存在性 ==========

// 引用形态：[vision.md]（active 内相对）或 domains/... 等 DOCS_ROOT 相对路径
const refRe = /\[([\w.-]+\.md)\]|((?:domains|guides|constraints|ledger|decisions|workflows|active)\/[\w./-]+\.(?:md|yaml))/g;
let m;
const refs = new Set();
while ((m = refRe.exec(stack)) !== null) {
  const target = m[1]
    ? join(activeDir, m[1])
    : [join(ROOT, DOCS_ROOT, m[2]), join(ROOT, m[2]), join(ROOT, 'docs', m[2])].find(c => existsSync(c)) || join(ROOT, DOCS_ROOT, m[2]);
  const label = m[1] || m[2];
  if (refs.has(label)) continue;
  refs.add(label);
  if (!existsSync(target)) {
    error(`STACK.md 引用 "${label}" 不存在（栈项指向了不存在的文件）`);
  }
}

// ========== 2. active/ 孤儿检查 ==========

for (const f of readdirSync(activeDir).filter(f => f.endsWith('.md'))) {
  if (f === 'STACK.md') continue;
  if (!stack.includes(f) && !claude.includes(`active/${f}`)) {
    error(`active/${f} 既未被 STACK.md 引用也未被 CLAUDE.md 路由表引用（孤儿文件——完成态未结算？）`);
  }
}

if (errors > 0) {
  console.error(`\n[check-active-stack] 检查失败，构建中断。`);
  process.exit(1);
}
console.log(`[check-active-stack] OK — STACK ${refs.size} 条引用有效，active/ 无孤儿`);
