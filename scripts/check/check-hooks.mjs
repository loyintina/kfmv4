/**
 * check-hooks.mjs — git 钩子健康检查（v8.2 批 4）
 *
 * 钩子自身会得「快照病」：core.hooksPath 是本地配置不在仓库里——
 * 新机器 clone 后钩子静默失效，所有人以为有保护。本检查给钩子装探测器：
 *   1. git config core.hooksPath 必须指向 .githooks（未配置 = 钩子死了没人知道）
 *   2. .githooks/ 每个钩子必须可执行
 *   3. 薄壳完整性：钩子内引用的 scripts/check/＊.mjs 必须存在（禁止钩子重新实现逻辑）
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
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-hooks] ${errors} 处钩子不健康，构建中断。`);
  process.exit(1);
}
console.log(`[check-hooks] OK — hooksPath=${hooksPath}，${readdirSync(hooksDir).length} 个钩子可执行且引用有效`);
