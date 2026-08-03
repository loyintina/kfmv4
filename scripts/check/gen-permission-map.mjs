#!/usr/bin/env node
/**
 * gen-permission-map.mjs — 权限风险表拼接器（原代码注册驱动）
 *
 * TOOL_RISK（permissions.ts）是工具→RiskClass 映射的唯一活源头，infra 契约
 * BAR-PERM-01 要求「加新工具必须在此登记」——本生成器把它变成机械门：
 *   1. 拼接：生成「工具→RiskClass 精确映射表」进 harness-permission-engine.md
 *   2. 双向校验：注册工具缺 TOOL_RISK 登记 / TOOL_RISK 有未注册幽灵工具 → check 红
 *
 * 用法：
 *   node scripts/check/gen-permission-map.mjs             # 回写
 *   node scripts/check/gen-permission-map.mjs --check-only  # 校验
 * 支持 KFM_PROBE_ROOT 注入（check-probes 夹具）。
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.KFM_PROBE_ROOT || ROOT;
const PERMISSIONS_TS = join(BASE, 'src', 'server', 'ai', 'permissions.ts');
const DOC = join(BASE, 'docs', 'active', 'harness-permission-engine.md');

const MARK_START = '<!-- gen:perm-map:start -->';
const MARK_END = '<!-- gen:perm-map:end -->';

/** 提取 TOOL_RISK 注册表 */
function extractToolRisk(src) {
  const m = src.match(/TOOL_RISK\s*:\s*Record<string, RiskClass>\s*=\s*\{([\s\S]*?)\};/);
  if (!m) return null;
  const entries = [];
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*'?([\w-]+)'?\s*:\s*'(\w+)',?\s*(?:\/\/.*)?$/);
    if (kv) entries.push({ tool: kv[1], risk: kv[2] });
  }
  return entries;
}

/** 用 tsx 导出注册工具集 */
function dumpToolNames() {
  const script = `
    import { getAllTools } from './src/server/ai/tools/index.ts';
    process.stdout.write(JSON.stringify(getAllTools().map(t => t.name)));
  `;
  const out = execFileSync('npx', ['tsx', '-e', script], {
    cwd: BASE, encoding: 'utf-8', timeout: 60_000,
  });
  return JSON.parse(out);
}

const RISK_DESC = {
  read: '只读，无副作用',
  write_local: '写本地，路径可控',
  exec: '执行命令，副作用面大',
  external: '外部副作用，审批/无人拒绝',
};

const checkOnly = process.argv.includes('--check-only');
const src = readFileSync(PERMISSIONS_TS, 'utf-8');
const doc = readFileSync(DOC, 'utf-8');
const riskMap = extractToolRisk(src);
if (!riskMap) {
  console.error('[gen-permission-map] permissions.ts 未找到 TOOL_RISK 注册表');
  process.exit(1);
}

const toolNames = dumpToolNames();
const errors = [];

// 双向校验：工具缺登记 / 幽灵登记
for (const t of toolNames) {
  if (!riskMap.some(r => r.tool === t)) errors.push(`工具 ${t} 未在 TOOL_RISK 登记 RiskClass（BAR-PERM-01）`);
  console.error('[gen-permission-map] ⛳ DOC-FLOW-05：新工具必须登记 RiskClass——读 docs/active/harness-permission-engine.md §映射，走 workflows/doc-write.yaml 第 2 步');
}
for (const r of riskMap) {
  if (!toolNames.includes(r.tool)) errors.push(`TOOL_RISK 幽灵登记 ${r.tool}（代码未注册该工具）`);
  if (!RISK_DESC[r.risk]) errors.push(`TOOL_RISK 未知风险类 ${r.risk}`);
}

// 拼接映射表（按 RiskClass 分组）
const section = [MARK_START, '', '### 工具 → RiskClass 精确映射（自动生成，勿手改）', '',
  '> 由 `gen-permission-map.mjs` 从 permissions.ts 的 TOOL_RISK 拼接。',
  '> 新工具必须登记 RiskClass（BAR-PERM-01）；未登记 = check 中断。', '',
  '| 工具 | RiskClass | 语义 |',
  '|------|-----------|------|'];
const groups = {};
for (const r of riskMap) (groups[r.risk] = groups[r.risk] || []).push(r.tool);
for (const risk of ['read', 'write_local', 'exec', 'external']) {
  const tools = (groups[risk] || []).sort();
  if (!tools.length) {
    section.push(`| — | ${risk} | ${RISK_DESC[risk] || ''} |`);
    continue;
  }
  for (const t of tools) {
    section.push(`| ${t} | ${risk} | ${RISK_DESC[risk] || ''} |`);
  }
}
section.push('', MARK_END);
const sectionText = section.join('\n');

const s = doc.indexOf(MARK_START);
let next;
if (s !== -1) {
  const e = doc.indexOf(MARK_END, s);
  next = doc.slice(0, s) + sectionText + doc.slice(e + MARK_END.length);
} else {
  // 首次插入：第 2 节 RiskClass 表后（## 3. 前）
  const anchor = doc.indexOf('\n## 3. ');
  const pos = anchor === -1 ? doc.length : anchor;
  next = doc.slice(0, pos) + '\n' + sectionText + '\n' + doc.slice(pos);
}

if (checkOnly) {
  if (next !== doc) errors.push('权限映射段漂移（TOOL_RISK 与文档不一致）');
} else if (next !== doc) {
  writeFileSync(DOC, next, 'utf-8');
}

if (errors.length) {
  for (const e of errors) console.error(`[gen-permission-map] ${e}`);
  console.error(`[gen-permission-map] ${errors.length} 处问题` + (checkOnly ? '——跑 node scripts/check/gen-permission-map.mjs 回写' : ''));
  process.exit(1);
}
console.log(`[gen-permission-map] ${checkOnly ? 'OK — 权限映射与 TOOL_RISK 一致' : `已回写（${riskMap.length} 条映射）`}`);
