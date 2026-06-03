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
// 3. Frontmatter 完整性校验
// ============================================================

const VALID_STATUSES = new Set(['active', 'draft', 'superseded', 'completed', 'relocated', 'proposal']);

function checkFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(ROOT, filePath);

  // 没有 frontmatter → 跳过（非规范性文档）
  if (!content.startsWith('---')) {
    // archive 下的文档必须有 frontmatter
    if (relPath.startsWith('docs/archive')) {
      error(`${relPath}: 归档文件缺少 status frontmatter（必须以 --- 开头）`);
    }
    return;
  }

  // 解析 frontmatter
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) {
    error(`${relPath}: frontmatter 未闭合（缺少结尾 ---）`);
    return;
  }

  const fm = content.slice(3, endIdx).trim();
  const lines = fm.split('\n');
  const fields = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    fields[key] = value;
  }
  // status 字段必须存在且有效
  if (!fields.status) {
    error(`${relPath}: frontmatter 缺少 status 字段（应为 active / draft / superseded 之一）`);
  } else if (!VALID_STATUSES.has(fields.status)) {
    error(`${relPath}: status 值 "${fields.status}" 无效（应为 active / draft / superseded 之一）`);
  }

  // superseded 状态的文档必须有 superseded_by
  if (fields.status === 'superseded') {
    if (!fields.superseded_by) {
      error(`${relPath}: status 为 superseded 但缺少 superseded_by 字段`);
    } else {
      // 验证 superseded_by 指向的文件存在，支持两种路径格式：
      // 1. 文件相对路径（如 ../HANDBOOK.md）
      // 2. 项目根相对路径（如 docs/HANDBOOK.md）
      const supersedesTarget = fields.superseded_by.replace(/`/g, '');
      const targetPathRel = path.resolve(path.dirname(filePath), supersedesTarget);
      const targetPathRoot = path.resolve(ROOT, supersedesTarget);
      if (!fs.existsSync(targetPathRel) && !fs.existsSync(targetPathRoot)) {
        error(`${relPath}: superseded_by "${fields.superseded_by}" 指向的文件不存在`);
      }
    }
  }

  // 有 superseded_by 但 status 不是 superseded → warning
  if (fields.superseded_by && fields.status && fields.status !== 'superseded') {
    warn(`${relPath}: 有 superseded_by 但 status="${fields.status}"（应为 superseded）`);
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
  checkFrontmatter(filePath);
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
