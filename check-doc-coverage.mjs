/**
 * check-doc-coverage.mjs — 文档覆盖强制约束
 *
 * 确保所有代码文件都有对应的文档条目。新增代码文件而不更新文档 → 构建中断。
 *
 * 检查项：
 *   1. src/client/modules/ 下每个 .ts 文件必须在 HANDBOOK §7 审计表中
 *   2. src/client/modules/renderers/ 下每个 .ts 文件同上
 *   3. src/server/ 下每个 .ts 文件必须有文件头部注释
 *   4. README.md 中的 check 脚本计数与实际一致
 *
 * 挂入 npm run check，遗漏 → 构建中断。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;

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
      if (st.isDirectory()) { walk(full); }
      else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) { results.push(full); }
    }
  }
  walk(dir);
  return results;
}

// ========== 1. 客户端模块 HANDBOOK 覆盖 ==========

console.log('[check-doc-coverage] 检查客户端模块文档覆盖...');

const handbook = readFileSync(join(ROOT, 'docs', 'HANDBOOK.md'), 'utf-8');
const tblStart = handbook.indexOf('### 客户端模块完整审计表');
const tblEnd = handbook.indexOf('### 死代码检查', tblStart);
const tblSection = (tblStart >= 0 && tblEnd > 0) ? handbook.slice(tblStart, tblEnd) : '';

const tableFiles = new Set();
const rowRe = /^\| `([^`]+\.ts)` \|/gm;
let m;
while ((m = rowRe.exec(tblSection)) !== null) {
  let p = m[1];
  // 允许 ../src/client/modules/ 前缀（完整路径引用）
  p = p.replace(/^(?:\.\.\/)?src\/client\/modules\//, '');
  tableFiles.add(p);
}
const modDir = join(ROOT, 'src', 'client', 'modules');
let undocumented = 0;
for (const fp of collectTsFiles(modDir)) {
  const rel = fp.slice(modDir.length + 1);
  if (!tableFiles.has(rel)) {
    error(`${rel} 在 src/client/modules/ 下但未在 HANDBOOK §7 审计表中。请添加表格条目。`);
    undocumented++;
  }
}
if (undocumented > 0) console.error(`[check-doc-coverage] ${undocumented} 个文件无文档覆盖`);

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
  const actual = readdirSync(ROOT).filter(e => e.startsWith('check-') && e.endsWith('.mjs')).length;
  if (claimed !== actual) {
    error(`README.md 声称 "${claimed} 个 check-* 脚本"，实际有 ${actual} 个`);
  }
}

// ========== 汇总 ==========

if (hasError) {
  console.error(`\n[check-doc-coverage] 文档覆盖检查失败，构建中断。`);
  console.error(`  新增代码文件后请同步更新 HANDBOOK §七 审计表，或为 server 文件添加头部注释。`);
  process.exit(1);
}

console.log('[check-doc-coverage] OK — 所有代码文件均有文档覆盖');
