/**
 * KFM v4 — 机械层代码清单生成器（代码测绘·机械层）
 *
 * 契约：docs/active/semantic-compiler-seed.md / 代码测绘方案——
 *   code-map.md（语义层，agent 测绘）的对比基准必须有一份可再生成的机械层清单：
 *   文件、行数、导出符号。脚本生成 = 不存在「写错」，随时可重跑校准。
 *
 * 域归属映射来自 scripts/check/domain-src.mjs（单一真相源）。
 * 未登记桶：存在但不在任何域映射里的代码文件 —— 域登记漂移信号。
 *
 * 用法：
 *   node scripts/check/gen-code-inventory.mjs              # 重写 docs/domains/code-inventory.md
 *   node scripts/check/gen-code-inventory.mjs --check-only # 只验证不重写（挂 check 链，漂移 = 中断）
 *   比对时剔除第 2 行基准头（commit/日期是挥发字段，内容漂移才算漂移）。
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { DOMAIN_SRC } from './domain-src.mjs';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = resolve(process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const CHECK_ONLY = process.argv.includes('--check-only');
const CODE_EXT = /\.(ts|tsx|js|mjs)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (CODE_EXT.test(e.name)) out.push(relative(ROOT, full));
  }
  return out;
}

// 展开 DOMAIN_SRC：文件直接收，目录前缀递归收
const domainFiles = new Map(); // domain -> Set<file>
const fileDomain = new Map();  // file -> domain
for (const [domain, paths] of Object.entries(DOMAIN_SRC)) {
  const set = new Set();
  for (const p of paths) {
    const abs = join(ROOT, p);
    if (p.endsWith('/')) {
      for (const f of walk(abs)) set.add(f);
    } else if (existsSync(abs) && statSync(abs).isFile()) {
      // 显式登记的文件不限扩展名——声明即意图（deploy.sh/package.json 曾被 CODE_EXT
      // 静默丢弃 → 契约清单与 code-map 实况脱节，2026-08-03 裁决流修复）；
      // 目录递归仍按代码扩展名过滤
      set.add(p);
    }
  }
  domainFiles.set(domain, set);
  for (const f of set) fileDomain.set(f, domain);
}

// 未登记桶：src/ 下不在任何域的代码文件
const unregistered = walk(join(ROOT, 'src')).filter(f => !fileDomain.has(f));

// ========== 跨域 import 边 ==========
// 机械解析 import/export-from/动态 import 的相对路径，解析到域内文件后按域配对。
// 多行 import 的 from 行由 FROM_RE 兜底。npm/绝对路径不解析。
const IMPORT_RE = /^\s*(?:import|export)\s.*?['"](\.[^'"]+)['"]/;
const FROM_RE = /\bfrom\s+['"](\.[^'"]+)['"]/;
const DYN_RE = /\bimport\(\s*['"](\.[^'"]+)['"]/;

function resolveSpec(fromFile, spec) {
  const fromDir = fromFile.split('/').slice(0, -1).join('/');
  const base = join(fromDir, spec).replace(/\\/g, '/');
  const candidates = [base, base + '.ts', base + '.tsx', base + '.js', base + '.mjs',
    base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.mjs'), base + '/index.ts'];
  for (const c of candidates) if (fileDomain.has(c)) return c;
  return null;
}

const edges = new Map(); // 'domA|domB' -> Set('fileA → fileB')
for (const [file, domA] of fileDomain) {
  const content = readFileSync(join(ROOT, file), 'utf-8');
  for (const line of content.split('\n')) {
    const m = line.match(IMPORT_RE) || line.match(FROM_RE) || line.match(DYN_RE);
    if (!m) continue;
    const target = resolveSpec(file, m[1]);
    if (!target) continue;
    const domB = fileDomain.get(target);
    if (domB === domA) continue;
    if (!edges.has(`${domA}|${domB}`)) edges.set(`${domA}|${domB}`, new Set());
    edges.get(`${domA}|${domB}`).add(`${file} → ${target}`);
  }
}

const EXPORT_RE = /^export\s+(?:async\s+)?(?:function|class|const|let|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const EXPORT_BRACE_RE = /^export\s*\{([^}]+)\}/;

function fileInfo(file) {
  const content = readFileSync(join(ROOT, file), 'utf-8');
  const lines = content.split('\n');
  const exports = [];
  for (const line of lines) {
    const m = line.match(EXPORT_RE);
    if (m) { exports.push(m[1]); continue; }
    const b = line.match(EXPORT_BRACE_RE);
    if (b) {
      for (const part of b[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) exports.push(name);
      }
    }
  }
  return { loc: lines.length, exports };
}

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch { /* 非 git 环境 */ }

const out = [];
out.push('<!-- 机械生成：node scripts/check/gen-code-inventory.mjs —— 请勿手改 -->');
out.push(`<!-- 基准 commit ${commit} · 生成于 ${new Date().toISOString().slice(0, 10)} -->`);
out.push('');
out.push('# 代码清单（机械层）');
out.push('');
out.push('> 这是什么：全量代码文件的域归属、行数、导出符号，脚本生成可重跑。');
out.push('> 语义层现状 → 各域 code-map.md；域契约（应然）→ 各域 contract.md。');
out.push('');

let totalLoc = 0, totalFiles = 0;
for (const [domain, files] of domainFiles) {
  const rows = [...files].map(f => ({ file: f, ...fileInfo(f) })).sort((a, b) => b.loc - a.loc);
  const domLoc = rows.reduce((s, r) => s + r.loc, 0);
  totalLoc += domLoc; totalFiles += rows.length;
  out.push(`## ${domain}（${rows.length} 文件 · ${domLoc} 行）`);
  out.push('');
  out.push('| 文件 | 行数 | 导出符号 |');
  out.push('|------|-----:|----------|');
  for (const r of rows) {
    out.push(`| ${r.file} | ${r.loc} | ${r.exports.join(', ') || '—'} |`);
  }
  out.push('');
}

if (unregistered.length > 0) {
  out.push(`## ⚠ 未登记（${unregistered.length} 文件——不在 domain-src.mjs 任何域内）`);
  out.push('');
  for (const f of unregistered) out.push(`- ${f}（${fileInfo(f).loc} 行）`);
  out.push('');
}

out.push('## 跨域 import 边（机械生成）');
out.push('');
out.push('> 语义层解读 → cross-domain.md；域内依赖 → 各域 code-map.md。');
out.push('');
for (const [key, set] of [...edges.entries()].sort()) {
  const [a, b] = key.split('|');
  out.push(`### ${a} → ${b}（${set.size} 边）`);
  out.push('');
  for (const e of [...set].sort()) out.push(`- ${e}`);
  out.push('');
}

out.push(`---`);
out.push(`合计 ${totalFiles} 文件 · ${totalLoc} 行 · 跨域边 ${[...edges.values()].reduce((s, e) => s + e.size, 0)} 条`);

const outFile = join(ROOT, DOCS_ROOT, 'domains', 'code-inventory.md');
const generated = out.join('\n') + '\n';

if (CHECK_ONLY) {
  // 剔除第 2 行基准头（commit/日期是挥发字段）再比对
  const stripHeader = s => s.split('\n').filter((_, i) => i !== 1).join('\n');
  const existing = existsSync(outFile) ? readFileSync(outFile, 'utf-8') : '';
  if (stripHeader(existing) !== stripHeader(generated)) {
    console.error('[gen-code-inventory] code-inventory.md 与代码现实漂移（未重新生成）——跑 node scripts/check/gen-code-inventory.mjs 回写');
    process.exit(1);
  }
  console.log(`[gen-code-inventory] OK — code-inventory.md 与代码现实一致（${totalFiles} 文件 · ${totalLoc} 行）`);
} else {
  writeFileSync(outFile, generated);
  console.log(`[gen-code-inventory] ${DOCS_ROOT}/domains/code-inventory.md 已生成：${totalFiles} 文件 · ${totalLoc} 行` +
    (unregistered.length ? ` · ⚠ 未登记 ${unregistered.length}` : ''));
}
