/**
 * check-doc-coverage.mjs — 文档覆盖强制约束（v8.2 重写：HANDBOOK 审计表 → 域契约/细节文档）
 *
 * 规则：src/ 下每个 .ts 文件必须「有文档家」——其文件名（或所在目录路径）出现在
 * 某个 domains/{域}/contract.md 或 detail-*.md 中。新增代码文件而不更新文档 → 构建中断。
 *
 * 检查项：
 *   1. src/ 下每个 .ts 的文件名或祖先目录（如 engine/v2/）在域文档中出现
 *   2. src/server/ 下每个 .ts 必须有文件头部注释
 *   3. README.md 中的 check 脚本计数与实际一致
 *
 * 挂入 npm run check，遗漏 → 构建中断。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));

let hasError = false;
function error(msg) {
  console.error(`[check-doc-coverage] ${msg}`);
  hasError = true;
}

function collectTsFiles(dir) {
  const results = [];
  function walk(d) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) results.push(full);
    }
  }
  walk(dir);
  return results;
}

// ========== 0. 域文档并集文本 ==========

const domainDocs = [];
function walkMd(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkMd(full);
    else if (entry.name === 'contract.md' || entry.name.startsWith('detail-')) domainDocs.push(full);
  }
}
walkMd(join(ROOT, DOCS_ROOT, 'domains'));
const docText = domainDocs.map(f => readFileSync(f, 'utf-8')).join('\n');

// ========== 1. src/**/*.ts 覆盖 ==========

console.log('[check-doc-coverage] 检查 src/ 文件文档覆盖...');
let uncovered = 0;
for (const fp of collectTsFiles(join(ROOT, 'src'))) {
  const rel = relative(ROOT, fp);
  const base = rel.split('/').pop();
  // 祖先目录候选：src/client/engine/v2/box.ts → engine/v2/、engine/
  const parts = rel.split('/').slice(0, -1); // 去掉文件名
  const dirCandidates = [];
  for (let i = 1; i < parts.length; i++) dirCandidates.push(parts.slice(i).join('/') + '/');
  const covered =
    docText.includes(base) || dirCandidates.some(d => docText.includes(d));
  if (!covered) {
    error(`${rel} 未在任何域 contract/detail 中出现（补文件清单，或为其目录建立条目）`);
    uncovered++;
  }
}
if (uncovered > 0) console.error(`[check-doc-coverage] ${uncovered} 个文件无文档覆盖`);

// ========== 2. 服务端文件头部注释 ==========

console.log('[check-doc-coverage] 检查服务端文件头部注释...');
for (const fp of collectTsFiles(join(ROOT, 'src', 'server'))) {
  const first = readFileSync(fp, 'utf-8').trim().split('\n')[0] || '';
  if (!first.match(/^\s*(\/\*|\/\/|\/\*\*)/)) {
    error(`${fp.split('/').pop()} 缺少文件头部注释。请在文件顶部添加职责说明。`);
  }
}

// ========== 3. README 计数 ==========

console.log('[check-doc-coverage] 检查检查脚本计数...');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf-8');
const rm = readme.match(/(\d+)\s*个\s*check/);
if (rm) {
  const claimed = parseInt(rm[1], 10);
  const actual = readdirSync(SCRIPT_DIR).filter(e => e.startsWith('check-') && e.endsWith('.mjs')).length;
  if (claimed !== actual) {
    error(`README.md 声称 "${claimed} 个 check-* 脚本"，实际有 ${actual} 个`);
  }
}

// ========== 汇总 ==========

if (hasError) {
  console.error(`\n[check-doc-coverage] 文档覆盖检查失败，构建中断。`);
  console.error(`  新增代码文件后请同步对应域 contract 文件清单（或 detail），或为 server 文件添加头部注释。`);
  process.exit(1);
}

console.log('[check-doc-coverage] OK — 所有代码文件均有文档覆盖');
