/**
 * check-hooks.mjs — git 钩子健康检查（v8.2 批 4）
 *
 * 钩子自身会得「快照病」：core.hooksPath 是本地配置不在仓库里——
 * 新机器 clone 后钩子静默失效，所有人以为有保护。本检查给钩子装探测器：
 *   1. git config core.hooksPath 必须指向 .githooks（未配置 = 钩子死了没人知道）
 *   2. .githooks/ 每个钩子必须可执行
 *   3. 薄壳完整性：钩子内引用的 scripts/check/＊.mjs 必须存在（禁止钩子重新实现逻辑）
 *   4. 模式对账：被接线脚本头部声明 MODE: hard-fail|warning；壳注释的模式词
 *      必须与之一致（commit-msg 壳 exit 0 吞码事故：脚本升 hard fail、壳留 warning 语义）
 *
 * 挂入 npm run check，失配 = 构建中断。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

let errors = 0;
function error(msg) {
  console.error(`[check-hooks] ${msg}`);
  errors++;
}

// ========== 1. hooksPath 配置 ==========

let hooksPath = '';
try {
  hooksPath = execSync('git config core.hooksPath', { encoding: 'utf-8' }).trim();
} catch { /* 未配置 */ }
if (hooksPath !== '.githooks') {
  error(`core.hooksPath 未配置为 .githooks（当前：${hooksPath || '空'}）——钩子静默失效！修复：git config core.hooksPath .githooks`);
}

// ========== 2 + 3. 钩子文件健康 ==========

const hooksDir = join(ROOT, '.githooks');
for (const f of readdirSync(hooksDir)) {
  const p = join(hooksDir, f);
  const st = statSync(p);
  if (!st.isFile()) continue;

  if (!(st.mode & 0o111)) {
    error(`.githooks/${f} 不可执行——修复：chmod +x .githooks/${f}`);
  }

  const content = readFileSync(p, 'utf-8');
  for (const m of content.matchAll(/(scripts\/check\/[\w.-]+\.mjs)/g)) {
    if (!existsSync(join(ROOT, m[1]))) {
      error(`.githooks/${f} 引用 ${m[1]} 不存在（钩子烂尾）`);
      continue;
    }
    // ========== 4. 模式对账（2026-07-30：commit-msg 壳写死 exit 0 事故——
    // 脚本升 hard fail，壳注释还是 warning 时代语义，拦截虚掩一天多才被发现）==========
    // 规则：被接线脚本头部必须机器可读声明 MODE: hard-fail|warning；
    // 壳注释若声称模式（含「不阻断/warning/硬失败/阻断/中断」词），必须与脚本 MODE 一致
    const scriptHead = readFileSync(join(ROOT, m[1]), 'utf-8').slice(0, 3000);
    const modeM = scriptHead.match(/MODE:\s*(hard-fail|warning)/);
    if (!modeM) {
      error(`${m[1]} 被 .githooks/${f} 接线但头部未声明 MODE: hard-fail|warning（模式对账无锚）`);
      continue;
    }
    const scriptMode = modeM[1];
    let shellMode = null;
    if (/不阻断|永不阻断|warning 模式|warning/i.test(content)) shellMode = 'warning';
    else if (/hard[- ]?fail|硬失败|阻断|中断/i.test(content)) shellMode = 'hard-fail';
    if (shellMode && shellMode !== scriptMode) {
      error(`.githooks/${f} 注释声称 ${shellMode}，但 ${m[1]} 声明 MODE: ${scriptMode}——壳语义与脚本不一致（exit 0 吞码事故同款）`);
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-hooks] ${errors} 处钩子不健康，构建中断。`);
  process.exit(1);
}
console.log(`[check-hooks] OK — hooksPath=${hooksPath}，${readdirSync(hooksDir).length} 个钩子可执行且引用有效`);
