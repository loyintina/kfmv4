/**
 * check-docs.mjs — 文档质量自动化检查
 *
 * 挂入 npm run check 管线，与 check-anim.mjs / check-as-any.mjs 并列。
 *
 * 检查项：
 *   1. 所有 docs/*.md 中 [text](path) 的内部链接是否有效
 *   2. 单篇 > 500 行的 .md 文件提出 warning
 *   3. docs/archive/ 下所有文件是否有 status frontmatter
 *   4. CLAUDE.md 中引用的文档是否实际存在
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`[ERROR] ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`[WARN]  ${msg}`);
  warnings++;
}

// ============================================================
// 1. 内部链接有效性检查
// ============================================================
function checkInternalLinks(filePath, content) {
  // 匹配 Markdown 链接 [text](path) 和图片 ![alt](path)
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRe.exec(content)) !== null) {
    const href = match[2];
    // 只检查相对路径（内部链接），跳过 http:// https:// # 锚点
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#') || href.startsWith('mailto:')) continue;
    // 处理锚点后缀
    const targetPath = href.split('#')[0];
    if (!targetPath) continue;
    // 解析相对路径
    const absPath = path.resolve(path.dirname(filePath), targetPath);
    if (!fs.existsSync(absPath)) {
      error(`Broken link in ${path.relative(ROOT, filePath)}: "${href}" → ${path.relative(ROOT, absPath)} (not found)`);
    }
  }
}

// ============================================================
// 2. 篇幅检查
// ============================================================
function checkFileSize(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;
  if (lines > 500) {
    warn(`${path.relative(ROOT, filePath)}: ${lines} lines (recommend splitting or adding TL;DR)`);
  }
  return content;
}

// ============================================================
// Main
// ============================================================

// Collect all .md files in docs/
const docFiles = [];
function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.md')) {
      docFiles.push(fullPath);
    }
  }
}
walkDir(path.join(ROOT, 'docs'));
// Also check CLAUDE.md
docFiles.push(path.join(ROOT, 'CLAUDE.md'));

console.log(`[check-docs] Scanning ${docFiles.length} .md files...\n`);

for (const filePath of docFiles) {
  const relPath = path.relative(ROOT, filePath);
  const content = checkFileSize(filePath);
  checkInternalLinks(filePath, content);

  // 3. 归档文件 status frontmatter 检查
  if (relPath.startsWith('docs/archive')) {
    if (!content.startsWith('---')) {
      error(`${relPath}: missing status frontmatter (must start with ---)`);
    }
  }
}

// 4. CLAUDE.md 中引用的文档存在性检查
const claudeContent = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8');
const refRe = /`docs\/[^`]+`/g;
let refMatch;
while ((refMatch = refRe.exec(claudeContent)) !== null) {
  const ref = refMatch[0].replace(/`/g, '');
  const refPath = path.join(ROOT, ref);
  if (!fs.existsSync(refPath)) {
    error(`CLAUDE.md references ${ref} but file does not exist`);
  }
}

// Summary
console.log('');
if (errors > 0 || warnings > 0) {
  console.log(`[check-docs] ${errors} errors, ${warnings} warnings`);
} else {
  console.log('[check-docs] All checks passed ✅');
}
process.exit(errors > 0 ? 1 : 0);
