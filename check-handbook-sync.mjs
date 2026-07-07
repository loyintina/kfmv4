/**
 * check-handbook-sync.mjs — HANDBOOK 同步状态检查
 *
 * 检查 HANDBOOK.md §二「当前会话状态」是否与 git 提交历史同步。
 * 原理：比对 frontmatter 中 last_reviewed 日期与最近 src/tests 提交日期。
 * 如果最近有源码改动但 HANDBOOK 未更新，打印显式提醒。
 *
 * 这不是阻断性检查（exit 0），但提醒足够显眼，
 * 确保执行检查的 AI 在输出中看到并采取行动。
 *
 * 挂入 npm run check，在构建管线末尾运行。
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;

const handbookPath = join(ROOT, 'docs/HANDBOOK.md');

// ========== 1. 读取 HANDBOOK frontmatter ==========

let content;
try {
  content = readFileSync(handbookPath, 'utf-8');
} catch {
  console.log('[check-handbook-sync] SKIP — docs/HANDBOOK.md 不存在');
  process.exit(0);
}

const frontMatch = content.match(/^---\n([\s\S]*?)\n---/);
if (!frontMatch) {
  console.log('[check-handbook-sync] SKIP — HANDBOOK.md 缺少 YAML frontmatter');
  process.exit(0);
}

const frontmatter = {};
for (const line of frontMatch[1].split('\n')) {
  const idx = line.indexOf(':');
  if (idx > 0) {
    frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}

const lastReviewed = frontmatter.last_reviewed;
if (!lastReviewed) {
  console.log('[check-handbook-sync] SKIP — frontmatter 缺少 last_reviewed');
  process.exit(0);
}

// ========== 2. 检查 git 提交历史 ==========

// 找到最近一个修改了 src/ 或 tests/ 的提交（排除 HANDBOOK.md 自身更新）
let latestSrcCommit;
try {
  latestSrcCommit = execSync(
    `git log -1 --format="%ci %s" -- 'src/' 'tests/' -- ':!docs/HANDBOOK.md'`,
    { cwd: ROOT, encoding: 'utf-8' }
  ).trim();
} catch {
  console.log('[check-handbook-sync] SKIP — git 不可用或非 git 仓库');
  process.exit(0);
}

if (!latestSrcCommit) {
  console.log('[check-handbook-sync] OK — 没有 src/tests 提交记录');
  process.exit(0);
}

// 解析提交日期（格式: "2026-07-07 12:34:56 +0800 commit message"）
const datePart = latestSrcCommit.slice(0, 10); // "2026-07-07"
const reviewedDate = new Date(lastReviewed + 'T00:00:00');
const commitDate = new Date(datePart + 'T00:00:00');

// 如果最近源码提交日期 > last_reviewed → 需要更新
if (commitDate <= reviewedDate) {
  console.log('[check-handbook-sync] OK — HANDBOOK.md 与 git 提交同步');
  process.exit(0);
}

// ========== 3. 有未同步提交 → 打印提醒 ==========

// 获取自 reviewedDate 后的 src/tests 提交概览
let commitsSince;
try {
  commitsSince = execSync(
    `git log --after="${lastReviewed}T23:59:59" --oneline -- 'src/' 'tests/' -- ':!docs/HANDBOOK.md'`,
    { cwd: ROOT, encoding: 'utf-8' }
  ).trim();
} catch {
  commitsSince = '';
}

const lines = commitsSince ? commitsSince.split('\n') : [];
const sample = lines.slice(0, 8);

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  ⚠️  HANDBOOK.md §二「当前会话状态」可能已过期             ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  last_reviewed: ${lastReviewed.padEnd(43)}║`);
console.log(`║  近期 src/tests 提交: ${latestSrcCommit.slice(0, 60).padEnd(34)}║`);
console.log(`║  此后有 ${String(lines.length).padStart(3)} 个 src/tests 相关提交                        ║`);
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║  最近提交:                                                   ║');
for (const line of sample) {
  const short = line.length > 66 ? line.slice(0, 63) + '...' : line;
  console.log(`║  ${short.padEnd(66)}║`);
}
if (lines.length > 8) {
  console.log(`║  ... 及另外 ${lines.length - 8} 个提交                          ║`);
}
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║  → 请在当前任务完成后更新 HANDBOOK.md：                      ║');
console.log('║  1. §二「当前会话状态」— 添加新完成项                       ║');
console.log('║  2. frontmatter last_reviewed  → 设为当前日期               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

process.exit(0);
