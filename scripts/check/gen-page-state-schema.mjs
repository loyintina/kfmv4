#!/usr/bin/env node
/**
 * gen-page-state-schema.mjs — 眼睛格式说明「代码注册的事实段」拼接器
 *
 * page-state-schema.md 是手写说明 + 自动拼接段：
 *   自动段 = 「代码注册的事实」——从 page-state.ts 的 PAGE_STATE_TEXTS 注册表
 *   （原代码注册）与 ui-registry.ts 内容类型联合提取，拼接生成。
 *   手写段 = 格式规律/示例/使用注意（生成器不碰）。
 *
 * 机制（用户定稿）：像拼动态文件一样拼文档——描述性文本注册在代码里，
 * 新增描述而文档没有 → check 中断（--check-only 漂移报红，提示跑生成器）。
 *
 * 用法：
 *   node scripts/check/gen-page-state-schema.mjs            # 回写文档
 *   node scripts/check/gen-page-state-schema.mjs --check-only  # 校验漂移
 * 支持 KFM_PROBE_ROOT 注入（check-probes 夹具）。
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.KFM_PROBE_ROOT || ROOT;
const PAGE_STATE_TS = join(BASE, 'src', 'server', 'ai', 'page-state.ts');
const UI_REGISTRY_TS = join(BASE, 'src', 'client', 'modules', 'ui-registry.ts');
const SCHEMA_MD = join(BASE, 'src', 'server', 'prompts', 'dynamic', 'page-state-schema.md');

const MARK_START = '<!-- gen:page-state-facts:start -->';
const MARK_END = '<!-- gen:page-state-facts:end -->';

/** 提取 PAGE_STATE_TEXTS 注册表：{ 键: '值' }，值保留 \n 转义原样 */
function extractRegistry(src) {
  const m = src.match(/PAGE_STATE_TEXTS\s*=\s*\{([\s\S]*?)\}\s*as const;/);
  if (!m) return null;
  const entries = [];
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*(\w+):\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    if (kv) entries.push({ key: kv[1], value: kv[2] });
  }
  return entries;
}

/** 提取 ui-registry 内容类型联合 */
function extractContentTypes(src) {
  const line = src.split('\n').find(l => l.includes("type: 'file-tree'"));
  if (!line) return null;
  return [...line.matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
}

function buildFactsSection(registry, types) {
  const lines = [];
  lines.push(MARK_START);
  lines.push('');
  lines.push('### 代码注册的事实段（自动生成，勿手改）');
  lines.push('');
  lines.push('> 本段由 `gen-page-state-schema.mjs` 从 `PAGE_STATE_TEXTS`（page-state.ts）');
  lines.push('> 与 ui-registry 内容类型联合拼接生成。**新增/修改模板文本后必须跑');
  lines.push('> 生成器回写**，否则 check 链中断（代码有而文档没有 = 漂移）。');
  lines.push('');
  lines.push('固定常量（`PAGE_STATE_TEXTS`）：');
  lines.push('');
  for (const { key, value } of registry) {
    lines.push(`- \`${key}\`：\`${value}\``);
  }
  lines.push('');
  lines.push('内容类型枚举（ui-registry.ts 类型联合）：');
  lines.push('');
  for (const t of types) {
    lines.push(`- \`${t}\``);
  }
  lines.push('');
  lines.push(MARK_END);
  return lines.join('\n');
}

const checkOnly = process.argv.includes('--check-only');
const src = readFileSync(PAGE_STATE_TS, 'utf-8');
const ui = readFileSync(UI_REGISTRY_TS, 'utf-8');
const doc = readFileSync(SCHEMA_MD, 'utf-8');

const registry = extractRegistry(src);
const types = extractContentTypes(ui);
if (!registry) {
  console.error('[gen-page-state-schema] page-state.ts 未找到 PAGE_STATE_TEXTS 注册表');
  process.exit(1);
}
if (!types) {
  console.error('[gen-page-state-schema] ui-registry.ts 未找到内容类型联合（type: \'file-tree\' ...）');
  process.exit(1);
}

const facts = buildFactsSection(registry, types);
const startIdx = doc.indexOf(MARK_START);
const endIdx = doc.indexOf(MARK_END);
if (startIdx === -1 || endIdx === -1) {
  console.error(`[gen-page-state-schema] 文档缺少生成标记 ${MARK_START} … ${MARK_END}`);
  process.exit(1);
}
const next = doc.slice(0, startIdx) + facts + doc.slice(endIdx + MARK_END.length);

if (checkOnly) {
  if (next !== doc) {
    console.error('[gen-page-state-schema] 事实段漂移——代码注册的文本与文档不一致');
    console.error('[gen-page-state-schema] 跑 node scripts/check/gen-page-state-schema.mjs 回写');
    process.exit(1);
  }
  console.log('[gen-page-state-schema] OK — 事实段与代码注册一致');
} else {
  writeFileSync(SCHEMA_MD, next, 'utf-8');
  console.log(`[gen-page-state-schema] 已回写事实段（${registry.length} 常量 + ${types.length} 类型）`);
}
