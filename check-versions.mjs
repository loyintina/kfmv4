/**
 * KFM v4 — 版本号一致性检查
 *
 * 从 package.json 读取权威版本号，检查：
 *  1. git tag "v{version}" 是否存在（防止忘打 tag）
 *  2. 各文档中"最后更新/当前版本"标记的行是否一致
 *  3. 版本历史表中 **vX.Y.Z** 的粗体标记行是否含当前版本
 *  4. WORKBENCH_SPEC 状态表中的 ✅ vX.Y.Z 标记是否更新
 *
 * 挂入 npm run check，不一致 = 构建中断。
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

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

const DOCS = [
  'CLAUDE.md',
  'docs/HANDBOOK.md',
  'docs/VISION_AND_ROADMAP.md',
  'docs/KFM_V4_INVARIANTS.md',
  'docs/design/WORKBENCH_SPEC.md',
];

let markerChecks = 0;

for (const docPath of DOCS) {
  let content;
  try {
    content = readFileSync(docPath, 'utf-8');
  } catch {
    continue;
  }

  const lines = content.split('\n');

  // 2a) "最后更新"或"当前版本"行中的版本号
  for (const line of lines) {
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

  // 2b) 版本历史表中的粗体标记 **vX.Y.Z** 含当前版本
  //     只检查 docs/HANDBOOK.md（版本历史表所在文件）
  if (docPath === 'docs/HANDBOOK.md') {
    const boldVersions = lines
      .map(l => l.match(/\*\*v(\d+\.\d+\.\d+)\*\*/))
      .filter(Boolean)
      .map(m => m[1]);
    const hasCurrent = boldVersions.includes(authVersion);
    if (!hasCurrent) {
      console.error(`[VERSION TABLE MISSING] HANDBOOK.md 版本历史表缺少 v${authVersion} 条目`);
      console.error(`  当前版本历史表中的粗体版本: ${boldVersions.join(', ')}`);
      errors++;
    }
    markerChecks++;
  }

  // 2c) WORKBENCH_SPEC 状态表中的 ✅ vX.Y.Z
  if (docPath === 'docs/design/WORKBENCH_SPEC.md') {
    const statusVersions = lines
      .map(l => l.match(/✅\s*v(\d+\.\d+\.\d+)/))
      .filter(Boolean)
      .map(m => m[1]);
    const hasCurrent = statusVersions.includes(authVersion);
    if (!hasCurrent) {
      console.error(`[STATUS TABLE MISSING] WORKBENCH_SPEC.md 状态表缺少 v${authVersion} 标记`);
      console.error(`  当前状态表中的版本: ${statusVersions.join(', ')}`);
      errors++;
    }
    markerChecks++;
  }
}

if (errors > 0) {
  console.error(`\n[check-versions] ${errors} error(s) — BLOCKED`);
  process.exit(1);
}

console.log(`[check-versions] OK (git tag ✅, ${markerChecks} marker(s) = v${authVersion})`);
