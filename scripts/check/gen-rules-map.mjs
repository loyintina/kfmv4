#!/usr/bin/env node
/**
 * gen-rules-map.mjs — 规则登记表拼接器（原代码注册驱动）
 *
 * 条件规则在 src/server/ai/rules/*.md 的 frontmatter 注册（alwaysApply /
 * description / condition / scope），rule-engine.ts 运行时读取。本生成器
 * 把规则集拼成登记表进 detail-rules.md；新规则自动出现，frontmatter 缺
 * 必需键（description）或文档漂移 = check 中断。
 *
 * 用法：
 *   node scripts/check/gen-rules-map.mjs             # 回写
 *   node scripts/check/gen-rules-map.mjs --check-only  # 校验
 * 支持 KFM_PROBE_ROOT 注入（check-probes 夹具）。
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.KFM_PROBE_ROOT || ROOT;
const RULES_DIR = join(BASE, 'src', 'server', 'ai', 'rules');
const DOC = join(BASE, 'docs', 'domains', 'ai-chat', 'detail-rules.md');

const MARK_START = '<!-- gen:rules-map:start -->';
const MARK_END = '<!-- gen:rules-map:end -->';

/** 解析规则 frontmatter：--- 块内的 key: value */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return meta;
}

const checkOnly = process.argv.includes('--check-only');
const errors = [];
const rules = [];

for (const f of readdirSync(RULES_DIR).filter(f => f.endsWith('.md')).sort()) {
  const raw = readFileSync(join(RULES_DIR, f), 'utf-8');
  const meta = parseFrontmatter(raw);
  const name = f.replace(/\.md$/, '');
  if (!meta) {
    errors.push(`规则 ${f} 缺 frontmatter（--- 块）`);
    continue;
  }
  if (!meta.description) {
    errors.push(`规则 ${f} 缺 frontmatter 必需键 description`);
  }
  rules.push({
    name,
    alwaysApply: meta.alwaysApply === 'true',
    description: meta.description || '',
    condition: meta.condition || '—',
    scope: meta.scope || '—',
  });
}

// 拼接登记表
const section = [MARK_START, '', '## 规则登记表（自动生成，勿手改）', '',
  '> 由 `gen-rules-map.mjs` 从 `src/server/ai/rules/*.md` frontmatter 拼接。',
  '> 新增规则 = 新建 .md 并写 frontmatter（description 必需）；未同步 = check 中断。', '',
  '| 规则 | alwaysApply | 触发条件 | 作用域 |',
  '|------|:---:|---------|--------|'];
for (const r of rules) {
  const cond = r.alwaysApply ? '—' : `\`${r.condition}\``;
  const scope = r.alwaysApply ? '—' : r.scope;
  section.push(`| \`${r.name}\` | ${r.alwaysApply ? '✅' : ''} | ${cond} | ${scope} |`);
}
section.push('', MARK_END);
const sectionText = section.join('\n');

const doc = readFileSync(DOC, 'utf-8');
const s = doc.indexOf(MARK_START);
let next;
if (s !== -1) {
  const e = doc.indexOf(MARK_END, s);
  next = doc.slice(0, s) + sectionText + doc.slice(e + MARK_END.length);
} else {
  const anchor = doc.indexOf('\n## ');
  const pos = anchor === -1 ? doc.length : anchor;
  next = doc.slice(0, pos) + '\n' + sectionText + '\n' + doc.slice(pos);
}

if (checkOnly) {
  if (next !== doc) errors.push('规则登记段漂移（rules 集与文档不一致）');
} else if (next !== doc) {
  writeFileSync(DOC, next, 'utf-8');
}

if (errors.length) {
  for (const e of errors) console.error(`[gen-rules-map] ${e}`);
  console.error(`[gen-rules-map] ${errors.length} 处问题` + (checkOnly ? '——跑 node scripts/check/gen-rules-map.mjs 回写' : ''));
  process.exit(1);
}
console.log(`[gen-rules-map] ${checkOnly ? 'OK — 规则登记表与 rules 集一致' : `已回写（${rules.length} 条规则）`}`);
