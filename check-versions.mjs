/**
 * KFM v4 — 版本号一致性检查
 *
 * 从 package.json 读取权威版本号，检查各文档中主动标记为"当前版本"
 * 的行是否与 package.json 一致。不一致则中断构建。
 *
 * 规则：
 *  - package.json "version" = 唯一权威来源
 *  - 只检查包含"最后更新"或"当前版本"关键字的行中的版本号
 *  - 历史陈述中的版本号（如"v5.0.0 被删除"）不检查
 *  - 挂入 npm run check，不一致 = 构建中断
 */

import { readFileSync } from 'fs';

const PKG = JSON.parse(readFileSync('package.json', 'utf-8'));
const authVersion = PKG.version;

const DOCS = [
  'CLAUDE.md',
  'docs/HANDBOOK.md',
  'docs/VISION_AND_ROADMAP.md',
  'docs/KFM_V4_INVARIANTS.md',
];

let errors = 0;
let checks = 0;

for (const docPath of DOCS) {
  let content;
  try {
    content = readFileSync(docPath, 'utf-8');
  } catch {
    continue;
  }

  const lines = content.split('\n');
  for (const line of lines) {
    // 只检查主动标记版本号的行：包含"最后更新"或"当前版本"
    if (!/最后更新|当前版本/.test(line)) continue;
    
    const match = line.match(/\bv(\d+\.\d+\.\d+)\b/);
    if (!match) continue;
    
    const foundVersion = match[1];
    checks++;
    
    if (foundVersion !== authVersion) {
      console.error(`[VERSION MISMATCH] ${docPath}`);
      console.error(`  line: ${line.trim()}`);
      console.error(`  found: v${foundVersion}, expected: v${authVersion}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-versions] ${errors} version mismatch(es) — BLOCKED`);
  process.exit(1);
}

if (checks === 0) {
  console.log(`[check-versions] no version-marker lines found. Skipped.`);
} else {
  console.log(`[check-versions] OK (${checks} version marker(s) = v${authVersion})`);
}
