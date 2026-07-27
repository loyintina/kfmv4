/**
 * check-desc-freshness.mjs — 模块描述新鲜度检查
 *
 * HANDBOOK §七 审计表中每个模块都有描述文字。
 * 如果模块代码已经改了 N 次但 HANDBOOK 未同步更新，描述很可能已过时。
 *
 * 原理：比较模块文件的 git 提交次数 vs HANDBOOK.md 的最后提交。
 * 阈值：模块在 HANDBOOK 最后一次提交之后有 ≥5 次代码提交 → 硬阻断。
 *
 * 挂入 npm run check。
 */

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const THRESHOLD = 5;

let errors = 0;

// 1. 获取 HANDBOOK.md 最后一次提交的日期
let handbookLastCommit;
try {
  handbookLastCommit = execFileSync(
    'git', ['log', '-1', '--format=%ci', '--', 'docs/HANDBOOK.md'],
    { cwd: ROOT, encoding: 'utf-8' }
  ).trim();
} catch (e) {
  console.error(`[check-desc-freshness] ERROR — git 不可用: ${e.message}`);
  process.exit(1);
}

if (!handbookLastCommit) {
  console.error('[check-desc-freshness] ERROR — HANDBOOK.md 没有 git 提交记录');
  process.exit(1);
}

const handbookDate = handbookLastCommit.slice(0, 10);

// 2. 解析 §七 审计表中的模块文件列表
const handbook = readFileSync(join(ROOT, 'docs/HANDBOOK.md'), 'utf-8');
const tblStart = handbook.indexOf('### 客户端模块完整审计表');
const tblEnd = handbook.indexOf('### ', tblStart + 10);
const tblSection = (tblStart >= 0 && tblEnd > 0) ? handbook.slice(tblStart, tblEnd) : '';

const rowRe = /^\| `([^`]+\.ts)` \|/gm;
const modules = [];
let m;
while ((m = rowRe.exec(tblSection)) !== null) {
  let name = m[1];
  name = name.replace(/^(?:\.\.\/)?src\/client\/modules\//, '');
  // 解析实际文件路径
  let filePath;
  if (name.startsWith('../src/')) {
    filePath = name.slice(3); // "src/shared/..." or "src/server/..."
  } else {
    filePath = `src/client/modules/${name}`;
  }
  modules.push({ name, filePath });
}

if (modules.length === 0) {
  console.error('[check-desc-freshness] ERROR — 审计表中未找到任何模块条目');
  process.exit(1);
}

// 3. 对每个模块，统计 HANDBOOK 最后提交之后的代码提交次数
const stale = [];
for (const { name, filePath } of modules) {
  let count;
  try {
    const out = execFileSync(
      'git', ['log', `--after=${handbookDate}T23:59:59`, '--oneline', '--', filePath],
      { cwd: ROOT, encoding: 'utf-8' }
    ).trim();
    count = out ? out.split('\n').length : 0;
  } catch {
    continue; // 文件可能已删除，check-linecount 会捕获
  }
  if (count >= THRESHOLD) {
    stale.push({ name, filePath, count });
  }
}

// 4. 输出结果
if (stale.length > 0) {
  console.error(`[check-desc-freshness] ❌ ${stale.length} 个模块描述可能已过时（HANDBOOK 最后更新: ${handbookDate}）：`);
  for (const { name, count } of stale) {
    console.error(`  - ${name}: 此后有 ${count} 次代码提交（阈值 ${THRESHOLD}）`);
  }
  console.error(`[check-desc-freshness] 请更新 HANDBOOK §七 对应行的描述列，并更新 frontmatter last_reviewed。`);
  errors += stale.length;
}

if (errors > 0) {
  process.exit(1);
}

console.log(`[check-desc-freshness] OK — ${modules.length} 个模块描述均在新鲜度阈值内（HANDBOOK 最后更新: ${handbookDate}）`);
