/**
 * sync-counts.mjs — 文档计数单一来源化（v8.2 批 1）
 *
 * 真相源（派生，禁止手填）：
 *   check 数 = scripts/check/check-*.mjs 文件数
 *   测试数 = tests/＊.ts 中 ^\s*(regression|test)\( 调用数
 *
 * 用法：
 *   node scripts/check/sync-counts.mjs              回写各文档计数（幂等）
 *   node scripts/check/sync-counts.mjs --check-only 只验证不回写（挂 check 链，未同步 = 中断）
 *
 * 回写/验证点（改锚点先改这里）：
 *   README.md                    「N 个 check-* 脚本」「N 个回归测试」
 *   CLAUDE.md                    「N 个 check-*.mjs」「N 个回归测试」
 *   docs/domains/infra/contract.md「check-*.mjs`（N 个）」
 *   docs/guides/testing.md       「N 个测试（单元/集成…）」
 * 注意：ledger/history.md 的历史计数（某版本当时的数）禁止同步。
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CHECK_ONLY = process.argv.includes('--check-only');

// ========== 派生真相 ==========

const checkCount = readdirSync(join(ROOT, 'scripts/check'))
  .filter(f => f.startsWith('check-') && f.endsWith('.mjs')).length;

let testCount = 0;
for (const f of readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.ts'))) {
  const content = readFileSync(join(ROOT, 'tests', f), 'utf-8');
  testCount += content.match(/^\s*(?:regression|test)\(/gm)?.length ?? 0;
}

console.log(`[sync-counts] 派生真相：${checkCount} 个 check 脚本，${testCount} 个测试`);

// ========== 回写/验证点 ==========

const TARGETS = [
  { file: 'README.md', subs: [
    [/(\d+) 个 check-\* 脚本/g, `${checkCount} 个 check-* 脚本`],
    [/(\d+) 个回归测试/g, `${testCount} 个回归测试`],
  ] },
  { file: 'CLAUDE.md', subs: [
    [/(\d+) 个 check-\*\.mjs/g, `${checkCount} 个 check-*.mjs`],
    [/(\d+) 个回归测试/g, `${testCount} 个回归测试`],
  ] },
  { file: 'docs/domains/infra/contract.md', subs: [
    [/check-\*\.mjs`（(\d+) 个）/g, `check-*.mjs\`（${checkCount} 个）`],
  ] },
  { file: 'docs/guides/testing.md', subs: [
    [/(\d+) 个测试（单元/g, `${testCount} 个测试（单元`],
  ] },
];

let drift = 0;
for (const { file, subs } of TARGETS) {
  const path = join(ROOT, file);
  const before = readFileSync(path, 'utf-8');
  let after = before;
  for (const [re, replacement] of subs) after = after.replace(re, replacement);
  if (after === before) continue;
  drift++;
  if (CHECK_ONLY) {
    console.error(`[sync-counts] ${file} 计数漂移（未同步）`);
  } else {
    writeFileSync(path, after);
    console.log(`[sync-counts] ${file} 已回写`);
  }
}

if (CHECK_ONLY) {
  if (drift > 0) {
    console.error(`\n[sync-counts] ${drift} 个文件计数漂移——跑 npm run sync-counts 回写`);
    process.exit(1);
  }
  console.log('[sync-counts] OK — 各文档计数与派生真相一致');
} else {
  console.log(drift === 0 ? '[sync-counts] OK — 无需回写，全部一致' : `[sync-counts] 回写 ${drift} 个文件`);
}
