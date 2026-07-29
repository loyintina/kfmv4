/**
 * check-consistency.mjs — 入口路由表一致性（v8.2 重写：文档树 → CLAUDE.md 路由表）
 *
 * 检查项：
 *   1. 根 CLAUDE.md 路由表引用的 workflows/*.yaml、active/*.md 全部存在
 *   2. 反向：workflows/ 下每个 .yaml 都被 CLAUDE.md 路由表引用（防孤儿工作流）
 *
 * 挂入 npm run check，不一致 → 构建中断。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let errors = 0;
function error(msg) {
  console.error(`[check-consistency] ${msg}`);
  errors++;
}

const claudePath = join(ROOT, 'CLAUDE.md');
const claude = readFileSync(claudePath, 'utf-8');

// ========== 1. 正向：路由表引用 → 文件存在 ==========

const refRe = /(?:workflows|active|constraints|guides|domains|decisions|ledger)\/[\w./-]+\.(?:yaml|md)/g;
const refs = new Set(claude.match(refRe) || []);
for (const ref of refs) {
  if (!existsSync(join(ROOT, DOCS_ROOT, ref))) {
    error(`CLAUDE.md 路由表引用 "${ref}" 在 ${DOCS_ROOT}/ 下不存在`);
  }
}

// ========== 2. 反向：workflows/*.yaml → 被路由表引用 ==========

const wfDir = join(ROOT, DOCS_ROOT, 'workflows');
for (const f of readdirSync(wfDir).filter(f => f.endsWith('.yaml'))) {
  if (!claude.includes(`workflows/${f}`)) {
    error(`workflows/${f} 存在但 CLAUDE.md 路由表未列出（孤儿工作流）`);
  }
}

if (errors > 0) {
  console.error(`\n[check-consistency] 路由表一致性检查失败，构建中断。`);
  process.exit(1);
}
console.log(`[check-consistency] OK — 路由表 ${refs.size} 条引用有效，workflows 无孤儿`);
