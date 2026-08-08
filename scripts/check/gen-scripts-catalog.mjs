#!/usr/bin/env node
/**
 * gen-scripts-catalog.mjs — 脚本目录卡生成器（活源头 = 文件系统 + 脚本头部 + 登记 manifest）
 *
 * 面板的「脚本卡」数据来自 src/client/generated/scripts-catalog.ts（随包构建）。
 * 手写清单必漂移——本生成器扫描全部脚本目录，三层数据源合并：
 *   1. 存在性：文件系统（哪些脚本真实存在）
 *   2. 描述：脚本头部注释首行「name.ext — 描述」惯例
 *   3. 权限/提示词/效果：scripts/scripts-catalog.manifest.json 人工登记
 *      （检查器/生成器/范式考古三类有 categoryDefaults 兜底，其余必须逐脚本登记）
 *
 * 机械门（--check-only，挂入 chain.mjs）：
 *   - 新脚本缺头部描述 或 无默认类的脚本缺 manifest 登记 → 中断
 *   - manifest 里有已删除脚本的陈旧登记 → 中断
 *   - 生成物与现状漂移（改了脚本没重跑生成器）→ 中断
 *
 * 用法：
 *   node scripts/check/gen-scripts-catalog.mjs              # 回写生成物
 *   node scripts/check/gen-scripts-catalog.mjs --check-only # 校验（chain 挂这个）
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MANIFEST = join(ROOT, 'scripts', 'scripts-catalog.manifest.json');
const OUT = join(ROOT, 'src', 'client', 'generated', 'scripts-catalog.ts');

const checkOnly = process.argv.includes('--check-only');

/** 扫描目录 → 分类（顺序即卡片分类顺序） */
const SCAN_DIRS = [
  { dir: 'scripts/agent', category: 'agent 负载', exts: ['.mjs'] },
  { dir: 'experiments/paradigm/tools', category: '范式实验工具', exts: ['.mjs', '.py'], depth: 1 },
  { dir: 'experiments/paradigm/tools/legacy', category: '范式考古', exts: ['.mjs', '.py', '.sh'] },
  { dir: 'experiments/coldstart/tools', category: '冷启动工具', exts: ['.mjs'] },
  { dir: 'experiments/docprobe/tools', category: '文档抽测工具', exts: ['.mjs'] },
  { dir: 'scripts/check', category: '__split__', exts: ['.mjs'], depth: 1 }, // 按前缀拆三类
  { dir: 'scripts', category: '运维', exts: ['.sh', '.cjs'], depth: 1 },
];

/** scripts/check/ 内按文件名前缀拆分类 */
function splitCheckCategory(name) {
  if (name.startsWith('check-')) return '检查器';
  if (name.startsWith('gen-')) return '生成器';
  if (name === 'chain.mjs') return '检查器';
  return '构建链基建'; // docs-root-const / docs-status / domain-src / sync-counts
}

const CATEGORY_ORDER = [
  'agent 负载', '范式实验工具', '范式考古', '冷启动工具', '文档抽测工具',
  '检查器', '生成器', '构建链基建', '运维',
];

// ---------- 收集脚本文件 ----------
const files = []; // { path, category }
for (const spec of SCAN_DIRS) {
  const abs = join(ROOT, spec.dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs, { withFileTypes: true })) {
    if (!f.isFile()) continue;
    if (!spec.exts.some(e => f.name.endsWith(e))) continue;
    const rel = relative(ROOT, join(abs, f.name));
    const cat = spec.category === '__split__' ? splitCheckCategory(f.name) : spec.category;
    files.push({ path: rel, category: cat, name: f.name });
  }
}
files.sort((a, b) => a.path.localeCompare(b.path));

// ---------- 头部描述提取 ----------
/** 从脚本头部注释提取「name.ext — 描述」惯例的描述段 */
function extractDesc(path) {
  const head = readFileSync(join(ROOT, path), 'utf-8').slice(0, 4000);
  const base = path.split('/').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = head.match(new RegExp(`${base}\\s*[—-]\\s*([^\\n*]+)`));
  return m ? m[1].trim() : null;
}

// ---------- manifest ----------
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'));
const defaults = manifest.categoryDefaults || {};
const entries = manifest.scripts || {};

const errors = [];
const catalog = [];

for (const f of files) {
  const entry = entries[f.path] || {};
  const def = defaults[f.category] || {};
  const description = extractDesc(f.path) || entry.desc || null;
  const permission = entry.permission || def.permission || null;
  const prompt = entry.prompt || def.prompt || null;
  const effect = entry.effect || def.effect || description;

  if (!description) errors.push(`${f.path}：缺头部描述（首行「${f.name} — 描述」惯例）`);
  if (!permission) errors.push(`${f.path}：manifest 缺 permission 登记（${f.category} 类无默认值）`);
  if (!prompt) errors.push(`${f.path}：manifest 缺 prompt 登记（${f.category} 类无默认值）`);

  catalog.push({
    name: f.name, file: f.path, category: f.category,
    description: description || '', permission: permission || '',
    prompt: prompt || '', effect: effect || '',
  });
}

// 陈旧登记：manifest 指向不存在的脚本
for (const p of Object.keys(entries)) {
  if (!existsSync(join(ROOT, p))) errors.push(`manifest 陈旧登记：${p} 已不存在，请删除该条`);
}

// ---------- 生成 ----------
const categories = CATEGORY_ORDER.filter(c => catalog.some(e => e.category === c));
const ts = `/**
 * scripts-catalog.ts — 脚本目录（脚本卡数据源）
 *
 * ⚠️ 本文件由 scripts/check/gen-scripts-catalog.mjs 生成，禁止手改。
 * 改脚本/加脚本后跑：node scripts/check/gen-scripts-catalog.mjs
 * 登记字段在 scripts/scripts-catalog.manifest.json。
 */

export interface ScriptCatalogEntry {
  name: string;
  file: string;
  category: string;
  description: string;
  permission: string;
  prompt: string;
  effect: string;
}

export const SCRIPTS_CATALOG: ScriptCatalogEntry[] = ${JSON.stringify(catalog, null, 2)};

export const SCRIPT_CATEGORIES: string[] = ${JSON.stringify(categories)};
`;

if (errors.length > 0) {
  console.error('[gen-scripts-catalog] FAIL — 脚本目录登记不完整：');
  for (const e of errors) console.error('  ✗ ' + e);
  console.error('[gen-scripts-catalog] 修复：补脚本头部描述 或 在 scripts/scripts-catalog.manifest.json 补登记后重跑本生成器');
  process.exit(1);
}

if (checkOnly) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf-8') : '';
  if (cur !== ts) {
    console.error('[gen-scripts-catalog] FAIL — 生成物漂移：脚本/登记有改动但未重跑生成器');
    console.error('[gen-scripts-catalog] 修复：node scripts/check/gen-scripts-catalog.mjs');
    process.exit(1);
  }
  console.log(`[gen-scripts-catalog] OK — ${catalog.length} 个脚本 / ${categories.length} 类，生成物无漂移`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, ts);
  console.log(`[gen-scripts-catalog] 已回写 ${relative(ROOT, OUT)} — ${catalog.length} 个脚本 / ${categories.length} 类`);
}
process.exit(0);
