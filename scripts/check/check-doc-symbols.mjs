/**
 * check-doc-symbols.mjs — 文档符号存在性检查（v8.2 批 1）
 *
 * 契约：docs/guides/doc-maintenance.md「各层 grammar」——
 *   domains/ 文档中反引号包裹的标识符 = 声明为代码符号引用，必须在 src/ 存在。
 *   叙述已删除的符号/概念名不要用反引号（去反引号转叙事）。
 *
 * 即「broken import 的文档版」：契约写着 foo() 而代码里已删 = 类型错误。
 * 抽样精确率（2026-07-29，136 候选）：误报仅 commit hash 一类，已排除。
 *
 * 豁免：确需引用不存在符号时登记 WHITELIST（注释原因）。挂 npm run check，失配 = 中断。
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// 豁免登记（注释原因）；优先去反引号转叙事，豁免是最后手段
const WHITELIST = new Set([
  // 例：'legacyFoo'  // 历史决策叙述需要，代码已删，决策文档保留原名
]);

const ID_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(\(\))?$/;
const HASH_RE = /^(?=.*\d)[0-9a-f]{7,10}$/;   // commit short hash

function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

// ========== 收集 domains/ 文档候选符号 ==========

const candidates = new Map();   // symbol → 首个出现文件
const docDir = join(ROOT, DOCS_ROOT, 'domains');
for (const f of walk(docDir, '.md')) {
  const content = readFileSync(f, 'utf-8');
  for (const m of content.matchAll(/`([^`\n]+)`/g)) {
    const token = m[1].trim();
    if (!ID_RE.test(token) || !/[a-z]/.test(token) || token.length < 4) continue;
    if (HASH_RE.test(token)) continue;
    const name = token.replace(/\(\)$/, '');
    if (!candidates.has(name)) candidates.set(name, f);
  }
}

// ========== src/ 语料 ==========

const srcBlob = walk(join(ROOT, 'src'), '.ts')
  .map(f => readFileSync(f, 'utf-8'))
  .join('\n');

// ========== 核对 ==========

let errors = 0;
for (const [name, f] of candidates) {
  if (WHITELIST.has(name)) continue;
  if (!srcBlob.includes(name)) {
    console.error(`[check-doc-symbols] ${f.replace(ROOT + '/', '')}: 符号 \`${name}\` 在 src/ 不存在（文档漂移；若叙述已删代码请去反引号转叙事）`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n[check-doc-symbols] ${errors} 个符号漂移，构建中断。`);
  process.exit(1);
}
console.log(`[check-doc-symbols] OK — ${candidates.size} 个文档符号全部在 src/ 存在`);
