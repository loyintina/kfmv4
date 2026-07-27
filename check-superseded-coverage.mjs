/**
 * check-superseded-coverage.mjs — superseded_by 内容覆盖校验
 *
 * 历史教训（2026-06-02）：批量标记 19 份文档 superseded_by: HANDBOOK.md，
 * 但 HANDBOOK 从未真正覆盖这些内容。导致诊断知识不可达，debug 耗时 15 轮。
 *
 * 本检查：对每个标记了 superseded_by 的归档文档，提取其标题关键词，
 * 验证目标文档中至少提及了部分关键词。完全不提及 → 硬阻断。
 *
 * 挂入 npm run check。
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative, resolve, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;
const ARCHIVE_DIR = join(ROOT, 'docs/archive');

// 停用词：标题中这些词不作为覆盖判据
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'for', 'to', 'with',
  'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8',
  'kfm', 'spec', 'doc', 'docs', 'md',
  '设计', '文档', '方案', '记录', '说明', '规范', '系统', '模块',
  '的', '与', '及', '从', '到', '在', '中', '上', '下',
  // 过于泛化的双字词
  '项目', '文件', '内容', '相关', '更新', '管理', '工具', '功能',
]);

let errors = 0;
let checked = 0;

function extractTitleKeywords(content, filePath) {
  // 优先取第一个 # 标题
  const h1 = content.match(/^#\s+(.+)$/m);
  const title = h1 ? h1[1] : basename(filePath, '.md').replace(/-/g, ' ');

  const cleaned = title.toLowerCase().replace(/[#*_`\[\]()（）]/g, ' ');

  // 1. 按空格/标点分词（适用于英文和已分隔的中文）
  const words = cleaned
    .split(/[\s\-—/|,，、：:；;。·]+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  // 2. 对连续 CJK 片段提取 2-char bigrams（中文无空格，需主动切分）
  const cjkSegments = cleaned.match(/[\u4e00-\u9fff]{3,}/g) || [];
  for (const seg of cjkSegments) {
    for (let i = 0; i < seg.length - 1; i++) {
      const bigram = seg.slice(i, i + 2);
      if (!STOP_WORDS.has(bigram)) words.push(bigram);
    }
  }

  return [...new Set(words)];
}

function walkArchive(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkArchive(full));
    } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      results.push(full);
    }
  }
  return results;
}

const archiveFiles = walkArchive(ARCHIVE_DIR);

for (const filePath of archiveFiles) {
  const content = readFileSync(filePath, 'utf-8');
  const relPath = relative(ROOT, filePath);

  // 解析 frontmatter
  if (!content.startsWith('---')) continue;
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) continue;

  const fm = content.slice(3, endIdx);
  const statusMatch = fm.match(/status:\s*(\S+)/);
  const supersededByMatch = fm.match(/superseded_by:\s*(.+)/);

  if (!statusMatch || statusMatch[1] !== 'superseded') continue;
  if (!supersededByMatch) continue;

  const target = supersededByMatch[1].trim().replace(/`/g, '');

  // 解析目标文件路径
  const targetFromRel = resolve(join(filePath, '..'), target);
  const targetFromRoot = resolve(ROOT, target);
  const targetPath = existsSync(targetFromRel) ? targetFromRel
    : existsSync(targetFromRoot) ? targetFromRoot : null;

  if (!targetPath) continue; // check-docs.mjs 已捕获不存在的目标

  const targetContent = readFileSync(targetPath, 'utf-8').toLowerCase();
  const keywords = extractTitleKeywords(content, filePath);

  if (keywords.length === 0) continue;

  // 检查目标文档中提及了多少关键词
  const mentioned = keywords.filter(kw => targetContent.includes(kw));
  const ratio = mentioned.length / keywords.length;

  checked++;

  // 如果没有任何关键词被提及 → 覆盖失败
  if (mentioned.length === 0) {
    console.error(`[check-superseded-coverage] ❌ ${relPath}`);
    console.error(`  superseded_by: ${target}`);
    console.error(`  标题关键词: ${keywords.join(', ')}`);
    console.error(`  目标文档中未提及任何关键词 — 覆盖声明不可信`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n[check-superseded-coverage] ${errors} 个 superseded_by 声明未通过覆盖校验。`);
  console.error(`  请将归档文档的核心内容合并到目标文档，或修正 superseded_by 指向。`);
  process.exit(1);
}

console.log(`[check-superseded-coverage] OK — ${checked} 个 superseded 声明均通过内容覆盖校验`);
