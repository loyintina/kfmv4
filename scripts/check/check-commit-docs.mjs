/**
 * check-commit-docs.mjs — commit-doc 耦合门（v8.2 批 2，**warning 模式**）
 *
 * 思想：代码提交后文档没跟上 = 文档腐化的源头。完全体（无 docs 更新即中断）
 * 精确率做不到 1（大量纯逻辑 fix 不需要动文档），故先 warning 模式收集数据，
 * 观察期后再决定是否升级阻断。
 *
 * 规则：HEAD 提交触及 src/ 但未触及 docs/ 且提交信息无 `docs:na` 豁免标记 → 警告。
 * 豁免：提交信息任意位置写 `docs:na`（声明「此改动无文档影响」）。
 *
 * 挂入 npm run check，**只警告不中断**（exit 0）。
 */

import { execSync } from 'child_process';

let files = [];
let message = '';
try {
  files = execSync('git show --name-only --format= HEAD', { encoding: 'utf-8' })
    .split('\n').map(s => s.trim()).filter(Boolean);
  message = execSync('git log -1 --format=%B', { encoding: 'utf-8' });
} catch {
  console.log('[check-commit-docs] git 不可用，跳过（warning 模式）');
  process.exit(0);
}

const touchedSrc = files.some(f => f.startsWith('src/'));
const touchedDocs = files.some(f => f.startsWith('docs/'));
const exempt = message.includes('docs:na');

if (touchedSrc && !touchedDocs && !exempt) {
  console.warn(`[check-commit-docs][WARN] HEAD 提交改了 src/ 但没动 docs/（${files.filter(f => f.startsWith('src/')).length} 个源文件）`);
  console.warn('[check-commit-docs][WARN] 若确认无文档影响，提交信息加 `docs:na` 豁免；否则补文档更新（契约/账本/栈）');
  console.warn('[check-commit-docs][WARN] warning 模式观察期：本警告不中断构建');
} else {
  console.log('[check-commit-docs] OK — HEAD 提交文档耦合正常' + (exempt ? '（docs:na 豁免）' : ''));
}
