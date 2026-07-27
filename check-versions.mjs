/**
 * KFM v4 — 版本号一致性检查
 *
 * 从 package.json 读取权威版本号，检查：
 *  1. git tag "v{version}" 是否存在（防止忘打 tag）
 *  2. HANDBOOK.md 的 last_reviewed 新鲜度（最新提交是否超过 last_reviewed）
 *  3. 各文档中"最后更新/当前版本"标记的行是否一致
 *  4. 版本历史表中 **vX.Y.Z** 的粗体标记行是否含当前版本
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

// ========== 检查 2: HANDBOOK last_reviewed 新鲜度 ==========

const handbookContent = (() => {
  try { return readFileSync('docs/HANDBOOK.md', 'utf-8'); } catch {
    console.error('[check-versions] ERROR — docs/HANDBOOK.md 不存在，构建中断');
    process.exit(1);
  }
})();

const frontMatch = handbookContent.match(/^---\n([\s\S]*?)\n---/);
if (frontMatch) {
  const frontFields = {};
  for (const line of frontMatch[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) frontFields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  const lastReviewed = frontFields.last_reviewed;
  if (lastReviewed) {
    try {
      const latestCommit = execSync(
        `git log -1 --format="%ci" -- 'src/' 'tests/' 'docs/' '*.mjs' -- ':!docs/HANDBOOK.md'`,
        { encoding: 'utf-8' }
      ).trim();
      if (latestCommit) {
        const commitDate = new Date(latestCommit.slice(0, 10) + 'T00:00:00');
        const reviewDate = new Date(lastReviewed + 'T00:00:00');
        if (commitDate > reviewDate) {
          console.error(`[HANDBOOK OUTDATED] docs/HANDBOOK.md frontmatter last_reviewed=${lastReviewed}`);
          console.error(`  最新提交日期: ${latestCommit.slice(0, 10)}`);
          console.error(`  请更新 last_reviewed 并同步 §二「当前会话状态」`);
          errors++;
        }
      }
    } catch (e) {
      console.error(`[check-versions] ERROR — git 不可用: ${e.message}`);
      errors++;
    }
  }
}

// ========== 检查 3: 文档中的版本号标记 ==========

const DOCS = [
  'CLAUDE.md',
  'docs/HANDBOOK.md',
  'docs/DIAGNOSTICS.md',
  'docs/design/VISION_AND_ROADMAP.md',
  'docs/KFM_V4_INVARIANTS.md',
  'README.md',
];

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

  const lines = content.split('\n');

  // 3a) "最后更新"或"当前版本"行中的版本号
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

  // 3b) 版本历史表中的粗体标记 **vX.Y.Z** 含当前版本
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

}

if (errors > 0) {
  console.error(`\n[check-versions] ${errors} error(s) — BLOCKED`);
  process.exit(1);
}

console.log(`[check-versions] OK (git tag ✅, ${markerChecks} marker(s) = v${authVersion})`);
