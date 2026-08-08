#!/usr/bin/env node
/**
 * gen-capability-map.mjs — 功能总目录生成器（俗名↔关键词↔路径↔一句话，产品/运维/研究统一视图）
 *
 * 背景（2026-08-08 docprobe wave1+T0 双发现）：
 *   ① wave1：可达性决定因素是「命名可 grep 性」——文件树题 50% 臂未达
 *     （俗名「文件树」与路径「canvas-tree」无字符串桥），失败 → 幻觉 15 条；
 *   ② T0：裸启动 agent 的真正前门是 README/vision，「agent 负载/部署发布」
 *     等运维面 3/4 臂同漏——总目录缺一层统一视图。
 *   项目的自指性（产品自己运维自己）决定：产品与运维在发现层不该是两套东西。
 *
 * 数据源三层（同 gen-scripts-catalog 惯例）：
 *   1. 覆盖性：DOMAIN_SRC 六域每域 ≥1 行（机械门，缺域 = 中断）
 *   2. 登记：scripts/capability-map.manifest.json 人工登记行
 *      （name 俗名 / keywords 关键词 / path 主入口 / domain 域 / kind 产品|运维|研究 / desc 一句话）
 *   3. 关键词桥（核心机械门）：每个 keyword 必须能在该行 path 文件
 *      或 docs/domains/<domain>/*.md 里 grep 到——俗名↔路径的字符串桥由构造保证，
 *      不是约定（wave1 文件树断桥的直接对策；缺桥 = 中断并指认补桥位置）。
 *
 * 用法：
 *   node scripts/check/gen-capability-map.mjs              # 回写 docs/domains/capability-map.md
 *   node scripts/check/gen-capability-map.mjs --check-only # 校验（chain 挂这个）
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOMAIN_SRC } from './domain-src.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MANIFEST = join(ROOT, 'scripts', 'capability-map.manifest.json');
const OUT = join(ROOT, 'docs', 'domains', 'capability-map.md');
const checkOnly = process.argv.includes('--check-only');

const KIND_ORDER = ['产品', '运维', '研究'];
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const rows = manifest.capabilities || [];

const errors = [];

// ---------- 门 1：域覆盖（DOMAIN_SRC 每域 ≥1 行） ----------
for (const domain of Object.keys(DOMAIN_SRC)) {
  if (!rows.some((r) => r.domain === domain)) {
    errors.push(`域「${domain}」无任何功能登记行——manifest 至少补一行`);
  }
}

// ---------- 门 2：字段与路径存在 ----------
for (const r of rows) {
  for (const f of ['name', 'keywords', 'path', 'kind', 'desc']) {
    if (!r[f] || (Array.isArray(r[f]) && !r[f].length)) errors.push(`${r.name || '?'}：缺字段 ${f}`);
  }
  if (r.kind && !KIND_ORDER.includes(r.kind)) errors.push(`${r.name}：kind 须为 ${KIND_ORDER.join('/')}`);
  if (r.path && !existsSync(join(ROOT, r.path))) errors.push(`${r.name}：path 不存在 ${r.path}`);
}

// ---------- 门 3：关键词桥（俗名必须 grep 可达） ----------
const domainDocCache = new Map();
function searchText(r) {
  const parts = [];
  if (r.path && existsSync(join(ROOT, r.path))) parts.push(readFileSync(join(ROOT, r.path), 'utf8'));
  if (r.domain) {
    if (!domainDocCache.has(r.domain)) {
      const dir = join(ROOT, 'docs', 'domains', r.domain);
      const text = existsSync(dir)
        ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
        : '';
      domainDocCache.set(r.domain, text);
    }
    parts.push(domainDocCache.get(r.domain));
  }
  return parts.join('\n').toLowerCase();
}
for (const r of rows) {
  if (!Array.isArray(r.keywords)) continue;
  const hay = searchText(r);
  for (const k of r.keywords) {
    if (!hay.includes(String(k).toLowerCase())) {
      errors.push(`${r.name}：关键词「${k}」在 ${r.path}${r.domain ? ` 与 docs/domains/${r.domain}/` : ''} 均 grep 不到——` +
        `俗名↔路径断桥（wave1 文件树事故同型）。请在该域文档显式互注此关键词`);
    }
  }
}

// ---------- 生成 ----------
const head = `<!-- 机械生成：node scripts/check/gen-capability-map.mjs —— 请勿手改 -->
<!-- 登记源：scripts/capability-map.manifest.json · 生成于 ${new Date().toISOString().slice(0, 10)} -->

# 功能总目录（capability map）

> 这是什么：项目全部功能的一行式总目录——俗名 / 关键词 / 主入口 / 一句话。
> 产品与运维不分局（项目自指：产品自己运维自己，docprobe T0 盲区整改）。
> 给「想知道有什么」的读者（人或裸启动 agent）；「知道要干什么该去哪」→ CLAUDE.md 路由表。
> 机械门：DOMAIN_SRC 每域 ≥1 行；每个关键词必须在主入口或域文档 grep 可达（俗名↔路径桥）。
`;
const lines = [head];
for (const kind of KIND_ORDER) {
  const group = rows.filter((r) => r.kind === kind);
  if (!group.length) continue;
  lines.push(`\n## ${kind}（${group.length}）\n`);
  lines.push('| 功能 | 关键词 | 主入口 | 域 | 一句话 |');
  lines.push('|------|--------|--------|-----|--------|');
  for (const r of group) {
    lines.push(`| ${r.name} | ${r.keywords.map((k) => `\`${k}\``).join(' ')} | ${r.path} | ${r.domain || '—'} | ${r.desc} |`);
  }
}
const output = lines.join('\n') + '\n';

if (errors.length) {
  for (const e of errors) console.error(`[gen-capability-map] ${e}`);
  process.exit(1);
}

const stripDate = (s) => s.replace(/生成于 \d{4}-\d{2}-\d{2}/, '生成于 <DATE>');
if (checkOnly) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (stripDate(cur) !== stripDate(output)) {
    console.error('[gen-capability-map] 生成物漂移——请跑 node scripts/check/gen-capability-map.mjs 回写');
    process.exit(1);
  }
  console.log(`[gen-capability-map] OK — ${rows.length} 行 / ${KIND_ORDER.length} 类，生成物无漂移`);
} else {
  writeFileSync(OUT, output);
  console.log(`[gen-capability-map] 已回写 docs/domains/capability-map.md — ${rows.length} 行 / ${KIND_ORDER.length} 类`);
}
