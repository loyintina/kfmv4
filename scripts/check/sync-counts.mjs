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
 *   scripts/agent/semantic-mutate.mjs 变异锚点 find 串内数字（只写 find，
 *     replace 是故意错数不得动——BAR-SYNCCOUNTS-02）
 *   docs/domains/infra/contract.md 检查管线节：头部脚本数 + <!-- chain:auto --> 区块
 *     （链枚举从 chain.mjs STEPS 派生重新生成，含顺序）
 * 注意：ledger/history.md 的历史计数（某版本当时的数）禁止同步。
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const CHECK_ONLY = process.argv.includes('--check-only');

// ========== 派生真相 ==========

const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version; // 版本号单一出处（P1a 2026-08-02）
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
    [/KFM v4（咖啡猫）v[\d.]+/, `KFM v4（咖啡猫）v${VERSION}`],
    [/\*\*v[\d.]+\*\*/, `**v${VERSION}**`],
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
  // 变异锚点 find 串自动追平（BAR-SYNCCOUNTS-02）：锚点 find 嵌着本脚本管理的
  // 数字，此前每加钉/加 check 就打断部署（M01/M11 三度人工迁移）。
  // 铁律：只写 find 行——replace 是故意写错的数（变异物料本体），碰了即毁卷。
  { file: 'scripts/agent/semantic-mutate.mjs', subs: [
    [/find: '([^']*)'/g, (_m, s) => `find: '${s
      .replace(/(\d+) 个 check-\* 脚本/g, `${checkCount} 个 check-* 脚本`)
      .replace(/(\d+) 个回归测试/g, `${testCount} 个回归测试`)
      .replace(/(\d+) 个测试（单元/g, `${testCount} 个测试（单元`)
      .replace(/(\d+) 个 check-\*\.mjs/g, `${checkCount} 个 check-*.mjs`)}'`],
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

// ========== 检查管线链枚举生成区（infra contract） ==========
// 真相源 = scripts/check/chain.mjs 的 STEPS（check 链唯一出处）

{
  const { STEPS } = await import('./chain.mjs');
  const names = STEPS.map(step => {
    const m = step.match(/check-([\w-]+)\.mjs/);
    if (m) return m[1];
    if (step.includes('sass')) return 'sass';
    if (step.includes('sync-counts')) return 'sync-counts';
    if (step.includes('gen-code-inventory')) return 'gen-code-inventory';
    const g = step.match(/gen-([\w-]+)\.mjs/);
    if (g) return 'gen-' + g[1]; // gen-* --check-only 也是链步——静默丢弃 = 枚举失真（裁决流发现，2026-08-03）
    if (step === 'npm test') return 'npm test';
    if (step.includes('tsc')) return 'tsc';
    return null;
  }).filter(Boolean);

  // 渲染：首位带注，其余短名，贪心换行 ≤100 字符
  const parts = names.map((n, i) =>
    i === 0 ? '`check-' + n + '`（>3 未提交即中断，首位）' : n);
  const lines = [];
  let cur = '';
  for (const p of parts) {
    if (cur && (cur + ' → ' + p).length > 100) { lines.push(cur + ' →'); cur = p; }
    else cur = cur ? cur + ' → ' + p : p;
  }
  lines.push(cur);
  // 末行收尾：tsc 后加句号
  lines[lines.length - 1] = lines[lines.length - 1] + '。';
  const block = '<!-- chain:auto 由 sync-counts 生成，禁止手改 -->\n'
    + lines.join('\n') + '\n<!-- /chain:auto -->';

  const file = 'docs/domains/infra/contract.md';
  const path = join(ROOT, file);
  const before = readFileSync(path, 'utf-8');
  let after = before.replace(
    /(## 检查管线（npm run check，)(\d+)( 脚本，顺序固定）)/,
    `$1${checkCount}$3`);
  if (/<!-- chain:auto[\s\S]*?<!-- \/chain:auto -->/.test(after)) {
    after = after.replace(/<!-- chain:auto[\s\S]*?<!-- \/chain:auto -->/, block);
  } else {
    console.error(`[sync-counts] ${file} 缺少 <!-- chain:auto --> 生成区标记`);
    process.exit(1);
  }
  if (after !== before) {
    if (CHECK_ONLY) {
      console.error(`[sync-counts] ${file} 检查管线链漂移（未同步）`);
      process.exit(1);
    }
    writeFileSync(path, after);
    console.log(`[sync-counts] ${file} 检查管线链已回写（${names.length} 步）`);
  }
}

if (CHECK_ONLY) {
  if (drift > 0) {
    console.error(`\n[sync-counts] ${drift} 个文件计数漂移——跑 bash scripts/regenerate.sh 回写（或 --commit 一次提交）`);
    process.exit(1);
  }
  console.log('[sync-counts] OK — 各文档计数与派生真相一致');
} else {
  console.log(drift === 0 ? '[sync-counts] OK — 无需回写，全部一致' : `[sync-counts] 回写 ${drift} 个文件`);
}
