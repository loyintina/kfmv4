/**
 * check-fix-tests.mjs — fix-tests 耦合门（心法 24「修 bug 补钉纪律」机械化收编）
 * MODE: hard-fail
 *
 * 思想：修 bug 不带回归钉 = 同一个 bug 会回来第二次（testing.md「写钉子的纪律」、
 * bugs.md 登记表的存在理由）。纪律靠自觉 → 自觉不可靠 → 机械化（discipline-mechanize.yaml SOP）。
 *
 * 规则：提交信息首行是 fix: / fix(范围): 且未触及 tests/ 且提交信息无豁免标记 → 中断。
 * 豁免：提交信息**独立一行**写 `tests:na`（声明「此修复无需/无法补钉」，如纯配置、文案、
 *   构建脚本修复）——独立行语法与 docs:na 同款，防 prose 字面串误认。
 *
 * 双模式（与 check-commit-docs.mjs 同构，两个执法点）：
 *   默认       构建链兜底：检查 HEAD 提交
 *   --staged   commit-msg 钩子：检查暂存区 + 正在撰写的提交信息（犯罪现场拦截）
 *              用法：node check-fix-tests.mjs --staged <msgFile>
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const stagedIdx = process.argv.indexOf('--staged');
const STAGED = stagedIdx !== -1;

let files = [];
let message = '';
let label = 'HEAD 提交';
try {
  if (STAGED) {
    files = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
      .split('\n').map(s => s.trim()).filter(Boolean);
    message = readFileSync(process.argv[stagedIdx + 1], 'utf-8');
    label = '本次提交（暂存区）';
  } else {
    files = execSync('git show --name-only --format= HEAD', { encoding: 'utf-8' })
      .split('\n').map(s => s.trim()).filter(Boolean);
    message = execSync('git log -1 --format=%B', { encoding: 'utf-8' });
  }
} catch {
  console.log('[check-fix-tests] git 不可用，跳过');
  process.exit(0);
}

const firstLine = (message.split('\n')[0] || '').trim();
const isFix = /^fix(\([^)]*\))?:/.test(firstLine);
const touchedTests = files.some(f => f.startsWith('tests/'));
const exempt = /^tests:na\s*$/m.test(message);

if (isFix && !touchedTests && !exempt) {
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  🚫 心法 24：fix 提交未带回归钉                                ');
  console.error('╠══════════════════════════════════════════════════════════════╣');
  console.error(`║  ${label}：${firstLine}`);
  console.error('║  修 bug 不补钉 = 同一个 bug 会回来第二次。                    ');
  console.error('║  ⛔ 请在 tests/ 补回归钉后重新提交；                           ');
  console.error('║     确认无需补钉（纯配置/文案/构建修复等），提交信息独立一行    ');
  console.error('║     写 tests:na 豁免。                                        ');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  process.exit(1);
}

console.log(`[check-fix-tests] OK — ${label}${isFix ? (touchedTests ? '（fix 带钉）' : '（tests:na 豁免）') : '（非 fix 提交）'}`);
