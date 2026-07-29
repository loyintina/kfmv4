/**
 * KFM v4 — 版本号一致性检查（v8.2 适配：HANDBOOK 锚点 → README + ledger/history）
 *
 * 从 package.json 读取权威版本号，检查：
 *  1. git tag "v{version}" 是否存在（防止忘打 tag）
 *  2. README.md / CLAUDE.md 中「最后更新/当前版本」行的版本号一致
 *  3. {DOCS_ROOT}/ledger/history.md 版本线含当前版本条目
 *
 * （旧检查 2「HANDBOOK last_reviewed 新鲜度」由 check-contract-freshness 取代。）
 * 挂入 npm run check，不一致 = 构建中断。
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { DOCS_ROOT } from './docs-root-const.mjs';

const PKG = JSON.parse(readFileSync('package.json', 'utf-8'));
const authVersion = PKG.version;

let errors = 0;

// ========== 检查 1: git tag 是否存在 ==========
try {
  const tags = execSync('git tag -l "v' + authVersion + '"', { encoding: 'utf-8' }).trim();
  if (!tags) {
    console.error(`[VERSION TAG MISSING] git tag v${authVersion} 不存在`);
    console.error(`  创建: git tag v${authVersion} HEAD`);
    errors++;
  } else {
    console.log(`[check-versions] git tag v${authVersion} ✅`);
  }
} catch (e) {
  console.error(`[check-versions] git tag 检查失败: ${e.message}`);
  errors++;
}

// ========== 检查 2: 文档中的版本号标记 ==========

const DOCS = ['CLAUDE.md', 'README.md'];
let markerChecks = 0;

for (const docPath of DOCS) {
  let content;
  try {
    content = readFileSync(docPath, 'utf-8');
  } catch {
    console.error(`[check-versions] ERROR — 必需文档 ${docPath} 不存在`);
    errors++;
    continue;
  }

  for (const line of content.split('\n')) {
    if (!/最后更新|当前版本/.test(line)) continue;
    const match = line.match(/\bv(\d+\.\d+\.\d+)\b/);
    if (!match) continue;
    const foundVersion = match[1];
    markerChecks++;
    if (foundVersion !== authVersion) {
      console.error(`[VERSION MISMATCH] ${docPath}`);
      console.error(`  line: ${line.trim()}`);
      console.error(`  found: v${foundVersion}, expected: v${authVersion}`);
      errors++;
    }
  }
}

// ========== 检查 3: history.md 版本线含当前版本 ==========

const historyPath = `${DOCS_ROOT}/ledger/history.md`;
let history;
try {
  history = readFileSync(historyPath, 'utf-8');
} catch {
  console.error(`[check-versions] ERROR — ${historyPath} 不存在，构建中断`);
  process.exit(1);
}
const versionLine = history.split('\n').find(l => l.startsWith(`- v${authVersion} `));
if (!versionLine) {
  console.error(`[VERSION HISTORY MISSING] ${historyPath} 版本线缺少 v${authVersion} 条目`);
  errors++;
} else {
  markerChecks++;
}

if (errors > 0) {
  console.error(`\n[check-versions] ${errors} error(s) — BLOCKED`);
  process.exit(1);
}

console.log(`[check-versions] OK (git tag ✅, ${markerChecks} marker(s) = v${authVersion})`);
