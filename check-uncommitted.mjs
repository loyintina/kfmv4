/**
 * check-uncommitted.mjs — 未提交改动检查
 *
 * 心法 14：每次代码改动后立即提交。
 *
 * ≤ 3 个文件 → 提醒（退出 0，不阻断）
 * ≥ 4 个文件 → 阻断构建（退出 1，必须先 commit）
 *
 * 挂入 npm run check + build.mjs。
 */

import { execSync } from 'child_process';

const BLOCK_AT = 4; // ≥ 此值时阻断构建

try {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  if (!status) {
    console.log('[check-uncommitted] OK — 工作区干净');
    process.exit(0);
  }

  const lines = status.split('\n');
  const blocked = lines.length >= BLOCK_AT;
  const sample = lines.slice(0, 8);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ' + (blocked ? '🚫' : '⚠️') + ' 心法 14：有 ' + String(lines.length).padStart(3) + ' 个未提交的改动                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  未提交的改动在 git checkout 或会话中断时会永久丢失          ║');
  if (blocked) {
    console.log('║  ⛔ 超过 ' + (BLOCK_AT - 1) + ' 个文件，构建已中断。请先 git add -A && git commit      ║');
  } else {
    console.log('║  ⚠️  提醒：每次代码改动后立即 git add -A && git commit        ║');
  }
  console.log('╠══════════════════════════════════════════════════════════════╣');
  for (const line of sample) {
    console.log('║  ' + line.substring(0, 58).padEnd(58) + '║');
  }
  if (lines.length > 8) {
    console.log('║  ... 及另外 ' + (lines.length - 8) + ' 个文件                             ║');
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  process.exit(blocked ? 1 : 0);
} catch {
  console.log('[check-uncommitted] SKIP — git 不可用');
  process.exit(0);
}
