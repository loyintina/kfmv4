/**
 * check-commit-docs.mjs — commit-doc 耦合门（v8.2 批 2 立项，**2026-07-30 定级 hard fail**）
 * MODE: hard-fail
 *
 * 思想：代码提交后文档没跟上 = 文档腐化的源头。
 * 定级依据（观察期 v8.2.0..2026-07-30 数据 + 用户拍板）：
 * - src/ 口径 13/13 全合规——规范已内化，升级零误伤
 * - scripts/ 口径 34 提交 3 例漏同步（tag-advisor 调参轮、域映射登记）——
 *   真实腐化恰好在 src/ 之外（60s 超时漂移同款机制），故口径扩 src/ + scripts/
 * - infra 契约陷阱 1「warning 对 agent 等于不存在」——warning 模式必须升 hard fail 或删除
 *
 * 规则：提交触及 src/ 或 scripts/ 但未触及 docs/ 且提交信息无豁免标记 → 中断。
 * 豁免：提交信息**独立一行**写 `docs:na`（声明「此改动无文档影响」）——
 *   独立行语法（2026-07-30 收紧）：防止正文讨论该标记时 prose 字面串误认豁免。
 *
 * 双模式（同一逻辑，两个执法点，构建链为最终权威）：
 *   默认       构建链兜底：检查 HEAD 提交
 *   --staged   commit-msg 钩子：检查暂存区 + 正在撰写的提交信息（犯罪现场拦截）
 *              用法：node check-commit-docs.mjs --staged <msgFile>
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
  console.log('[check-commit-docs] git 不可用，跳过');
  process.exit(0);
}

const touchedSrc = files.some(f => f.startsWith('src/') || f.startsWith('scripts/'));
const touchedDocs = files.some(f => f.startsWith('docs/'));
// 独立行豁免（防 prose 字面串误认）
const exempt = /^docs:na\s*$/m.test(message);

if (touchedSrc && !touchedDocs && !exempt) {
  console.error(`[check-commit-docs] ${label}改了 src//scripts/ 但没动 docs/（${files.filter(f => f.startsWith('src/') || f.startsWith('scripts/')).length} 个代码文件）`);
  console.error('[check-commit-docs] 若确认无文档影响，提交信息独立一行写 `docs:na` 豁免；否则补文档更新（契约/账本/栈）');
  process.exit(1);
} else {
  console.log(`[check-commit-docs] OK — ${label}文档耦合正常` + (exempt ? '（docs:na 豁免）' : ''));
}
