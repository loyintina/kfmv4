/**
 * KFM v4 — 行数统计自动同步
 *
 * 递归扫描 src/client/modules/ 下所有 .ts 文件的真实行数，
 * 同步写入 HANDBOOK.md §七「客户端模块完整审计表」。
 *
 * 挂入 npm run check：每次构建前自动刷新，确保文档行数 = 代码实际行数。
 *
 * v2: 递归扫描 — modules/renderers/ 子目录可见
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { extname, basename, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;
const MODULES_DIR = 'src/client/modules';
const HANDBOOK_PATH = 'docs/HANDBOOK.md';

// ——— 1. 递归统计真实行数 ———

function countAllModules() {
  const counts = {};
  function walk(dir) {
    const entries = readdirSync(join(ROOT, dir));
    for (const name of entries) {
      const full = join(ROOT, dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(join(dir, name));
      } else if (name.endsWith('.ts')) {
        const rel = join(dir, name).slice(MODULES_DIR.length + 1); // e.g. "renderers/math-diagram.ts"
        const lines = readFileSync(full, 'utf-8').split('\n').length;
        counts[rel] = lines;
      }
    }
  }
  walk(MODULES_DIR);
  return counts;
}

// ——— 2. 更新 HANDBOOK ———

function updateHandbook(counts) {
  const content = readFileSync(join(ROOT, HANDBOOK_PATH), 'utf-8');
  const lines = content.split('\n');

  // 定位表格：从 "### 客户端模块完整审计表" 到下一个 "### "
  let tableStart = -1;
  let tableEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('### 客户端模块完整审计表')) tableStart = i;
    if (tableStart >= 0 && lines[i].startsWith('### ') && i > tableStart) {
      tableEnd = i;
      break;
    }
  }
  if (tableStart < 0 || tableEnd < 0) {
    console.error('[check-linecount] 未找到模块审计表，请检查 HANDBOOK 格式');
    process.exit(1);
  }

  let changed = false;
  let total = 0;
  const remaining = new Set(Object.keys(counts));

  for (let i = tableStart; i < tableEnd; i++) {
    const m = lines[i].match(/^\| `((?:[^`]+\/)?[^`]+\.ts)` \| (\d+) \|/);
    if (!m) continue;
    const name = m[1];
    const oldCount = parseInt(m[2], 10);
    const realCount = counts[name];
    if (realCount === undefined) {
      console.warn(`[check-linecount] ⚠️ 文件 ${name} 在表格中但不存在于 modules/ 下`);
      continue;
    }
    remaining.delete(name);
    if (oldCount !== realCount) {
      lines[i] = lines[i].replace(`| ${oldCount} |`, `| ${realCount} |`);
      changed = true;
    }
    total += realCount;
  }

  // 更新合计行
  const totalRe = /^\| \*\*合计\*\* \| \*\*(\d+)\*\* \|/;
  for (let i = tableStart; i < tableEnd; i++) {
    const m = lines[i].match(totalRe);
    if (m) {
      const oldTotal = parseInt(m[1], 10);
      if (oldTotal !== total) {
        lines[i] = lines[i].replace(`| **${oldTotal}** |`, `| **${total}** |`);
        changed = true;
      }
      break;
    }
  }

  // 错误：未在表格中的模块（硬阻断，不再是警告）
  let hasError = false;
  if (remaining.size > 0) {
    console.error(`[check-linecount] ❌ 以下文件在 modules/ 下但未在表格中：`);
    for (const name of remaining) {
      console.error(`  - ${name} (${counts[name]} 行) — 请将以上模块添加到 HANDBOOK §七 客户端模块完整审计表`);
    }
    console.error(`[check-linecount] 新增模块必须同步更新 HANDBOOK §七 审计表，否则构建中断。`);
    hasError = true;
  }

  if (changed) {
    writeFileSync(join(ROOT, HANDBOOK_PATH), lines.join('\n'));
    console.log(`[check-linecount] 行数表已更新，合计 ${total} 行`);
  } else {
    console.log('[check-linecount] HANDBOOK.md 行数表已是最新');
  }

  if (hasError) {
    process.exit(1);
  }
}

// ——— 3. 入口 ———

const counts = countAllModules();
updateHandbook(counts);
