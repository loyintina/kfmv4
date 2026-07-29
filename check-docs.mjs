/**
 * check-docs.mjs — 文档质量自动化检查（v8.2 重写：scope 切到 DOCS_ROOT，废弃 frontmatter 规则）
 *
 * 检查项：
 *   1. {DOCS_ROOT}/** + 根 CLAUDE.md/README.md/AGENTS.md 中 [text](path) 内部链接与 #锚点 是否有效
 *   2. 反引号路径 `path/to/file.ext` 是否有效（含空格的命令行除外）
 *   3. 单篇 > 2000 行报错阻断（职责边界膨胀信号）
 *
 * 新体系无 frontmatter（路由头即元数据），旧 archive status 规则随 archive 注销废弃。
 * 挂入 npm run check，失败 → 构建中断。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

let errors = 0;
function error(msg) {
  console.error(`[ERROR] ${msg}`);
  errors++;
}

// ============================================================
// 1. 内部链接有效性检查
// ============================================================
function verifyPath(filePath, rawHref) {
  const [href, anchor] = rawHref.split('#');
  if (!href && !anchor) return;
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) return;

  let resolvedPath = null;

  if (href) {
    if (href.startsWith('./') || href.startsWith('../')) {
      resolvedPath = path.resolve(path.dirname(filePath), href);
      if (!fs.existsSync(resolvedPath)) {
        error(`Broken ref in ${path.relative(ROOT, filePath)}: "${rawHref}" → ${path.relative(ROOT, resolvedPath)} (not found)`);
        return;
      }
    } else {
      // 基准：文档所在目录 → DOCS_ROOT → 项目根
      const fromRoot = path.resolve(ROOT, href);
      const fromDocs = path.resolve(ROOT, DOCS_ROOT, href);
      const fromDoc = path.resolve(path.dirname(filePath), href);
      resolvedPath = fs.existsSync(fromRoot) ? fromRoot
        : fs.existsSync(fromDocs) ? fromDocs
        : fs.existsSync(fromDoc) ? fromDoc : null;
      if (!resolvedPath) {
        error(`Broken ref in ${path.relative(ROOT, filePath)}: "${rawHref}" → ${path.relative(ROOT, fromRoot)} (not found)`);
        return;
      }
    }
  } else {
    resolvedPath = filePath;
  }

  if (anchor && resolvedPath && resolvedPath.endsWith('.md') && fs.existsSync(resolvedPath)) {
    const targetContent = fs.readFileSync(resolvedPath, 'utf-8');
    const headings = targetContent.match(/^#{1,6}\s+.+$/gm) || [];
    const slugify = (h) => h.replace(/^#{1,6}\s+/, '').toLowerCase().replace(/[^\w\u4e00-\u9fff\s-]/g, '').replace(/\s+/g, '-');
    const slugs = headings.map(slugify);
    if (!slugs.includes(anchor)) {
      error(`Broken anchor in ${path.relative(ROOT, filePath)}: "${rawHref}" → #${anchor} not found in ${path.relative(ROOT, resolvedPath)}`);
    }
  }
}

function checkInternalLinks(filePath, content) {
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRe.exec(content)) !== null) {
    verifyPath(filePath, match[2]);
  }

  const backtickRe = /`([^`\n]+\.[a-z]{2,5})`/g;
  // 只校验「全路径」：首段是已知根（src/ docs/ newdoc/ 等）或根级文件。
  // 模块速写（routes/files.ts、engine/v2/renderer.ts 这类域内简写）不校验。
  const KNOWN_ROOTS = new Set([
    'src', 'docs', 'newdoc', 'tests', 'public',
    'workflows', 'domains', 'constraints', 'guides', 'ledger', 'active', 'decisions',
  ]);
  const ROOT_FILES = new Set(['build.mjs', 'package.json', 'README.md', 'CLAUDE.md', 'tsconfig.json']);
  while ((match = backtickRe.exec(content)) !== null) {
    const raw = match[1];
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.includes('@')) continue;
    if (raw.includes(' ')) continue;  // CLI 命令（如 git show 考古钩），非文件路径
    if (!raw.includes('/')) continue;
    if (raw.includes('*') || raw.includes('{')) continue;  // glob/占位符
    const first = raw.split('/')[0];
    if (!KNOWN_ROOTS.has(first) && !first.startsWith('check-') && !ROOT_FILES.has(raw)) continue;
    verifyPath(filePath, raw);
  }
}

// ============================================================
// 2. 篇幅检查
// ============================================================
const MAX_DOC_LINES = 2000;
function checkFileSize(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;
  if (lines > MAX_DOC_LINES) {
    error(`${path.relative(ROOT, filePath)}: ${lines} lines (超过 ${MAX_DOC_LINES} 行上限，需拆分或缩减)`);
  }
  return content;
}

// ============================================================
// Main
// ============================================================
const docFiles = [];
function walkDir(dir) {
  if (!fs.existsSync(dir)) {
    error(`必需目录 ${path.relative(ROOT, dir)} 不存在，文档结构异常`);
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(fullPath);
    else if (entry.name.endsWith('.md')) docFiles.push(fullPath);
  }
}
walkDir(path.join(ROOT, DOCS_ROOT));
// 根入口文件同样纳入链接/路径校验
for (const f of ['CLAUDE.md', 'README.md', 'AGENTS.md']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) docFiles.push(p);
}

console.log(`[check-docs] Scanning ${docFiles.length} .md files (${DOCS_ROOT}/ + 根入口)...\n`);

for (const filePath of docFiles) {
  const content = checkFileSize(filePath);
  checkInternalLinks(filePath, content);
}

console.log('');
if (errors > 0) {
  console.log(`[check-docs] ${errors} errors，构建中断。`);
  process.exit(1);
}
console.log('[check-docs] All checks passed ✅');
