/**
 * KFM v4 — 行数统计自动同步
 *
 * 扫描 src/client/modules/ 下所有 .ts 文件的真实行数，
 * 同步写入 HANDBOOK.md §七「客户端模块完整审计表」。
 *
 * 挂入 npm run check：每次构建前自动刷新，确保文档行数 = 代码实际行数。
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { extname, basename } from 'path';

const MODULES_DIR = 'src/client/modules';
const HANDBOOK_PATH = 'docs/HANDBOOK.md';

// ——— 1. 统计真实行数 ———

function countAllModules() {
  const entries = readdirSync(MODULES_DIR);
  const counts = {};
  for (const name of entries) {
    if (extname(name) !== '.ts') continue;
    const content = readFileSync(`${MODULES_DIR}/${name}`, 'utf-8');
    const n = (content.match(/\n/g) || []).length;   // wc -l 语义
    counts[`\`${name}\``] = n;
  }
  return counts;
}

// ——— 2. 更新 HANDBOOK ———

function updateHandbook(counts) {
  const content = readFileSync(HANDBOOK_PATH, 'utf-8');
  const lines = content.split('\n');

  // 定位表格：从 "### 客户端模块完整审计表" 到下一个 "### "
  let tableStart = -1;
  let tableEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('### 客户端模块完整审计表')) {
      tableStart = i;
    } else if (tableStart >= 0 && lines[i].startsWith('### ') && i > tableStart + 1) {
      tableEnd = i;
      break;
    }
  }
  if (tableStart < 0 || tableEnd < 0) {
    console.error('[check-linecount] 在 HANDBOOK.md 中找不到客户端模块完整审计表');
    process.exit(1);
  }

  let changed = false;
  let total = 0;

  for (let i = tableStart; i < tableEnd; i++) {
    const line = lines[i];
    // 匹配表格行：| `filename.ts` | N | ... |
    const m = line.match(/^\|\s+`([^`]+\.ts)`\s+\|\s+(\d+)\s+\|/);
    if (!m) continue;
    const moduleKey = `\`${m[1]}\``;
    const oldCount = parseInt(m[2], 10);
    const newCount = counts[moduleKey];
    if (newCount === undefined) {
      console.warn(`[check-linecount] 表格中的模块 ${m[1]} 在 ${MODULES_DIR} 中不存在`);
      continue;
    }
    total += newCount;
    if (oldCount !== newCount) {
      // 替换该行中第一个出现的旧数字（在第二个管道符之前）
      lines[i] = line.replace(/^(\|\s+`[^`]+`\s+\|)\s*\d+/, `$1 ${newCount}`);
      changed = true;
    }
    // 从 counts 中消费掉这个模块，防止残留
    delete counts[moduleKey];
  }

  // 更新合计行
  for (let i = tableStart; i < tableEnd; i++) {
    if (lines[i].includes('**合计**')) {
      lines[i] = lines[i].replace(/\|\s*\*\*\d+\*\*\s*\|/, `| **${total}** |`);
      break;
    }
  }

  // 检查是否有新模块未被表格覆盖
  const remaining = Object.keys(counts);
  if (remaining.length > 0) {
    console.warn(`[check-linecount] 以下模块在 ${MODULES_DIR} 中但未在 HANDBOOK 表格中：`);
    for (const key of remaining) {
      console.warn(`  ${key.replace(/`/g, '')} (${counts[key]} 行)`);
    }
  }

  if (changed) {
    writeFileSync(HANDBOOK_PATH, lines.join('\n'), 'utf-8');
    console.log('[check-linecount] HANDBOOK.md 行数表已自动更新');
  } else {
    console.log('[check-linecount] HANDBOOK.md 行数表已是最新');
  }
}

// ——— 3. 入口 ———

const counts = countAllModules();
updateHandbook(counts);
