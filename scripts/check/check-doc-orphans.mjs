#!/usr/bin/env node
/**
 * check-doc-orphans.mjs — 文档可达性纪律（每份文档必须被引用）
 *
 * orientation 关键设计：「一份文档若没有任何工作流读/写它，它不该存在」。
 * 本脚本机械执行：docs/ 下每份 .md 的文件名（不含 .md 后缀）必须作为独立词
 * 出现在引用面（docs 内互引 + CLAUDE/README + workflows + src + scripts +
 * tests + .kfmv4 角色卡）。孤儿文档 = 无人知道它存在 = 去不到的设施。
 *
 * 豁免：根 README.md / CLAUDE.md（项目入口，天然可达）；
 * decisions/README.md 由 orientation 引用（索引文件），不豁免。
 *
 * 支持 KFM_PROBE_ROOT 注入（check-probes 夹具）。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.KFM_PROBE_ROOT || ROOT;
const DOCS = join(BASE, 'docs');

/** 豁免：入口文件（天然可达） */
const EXEMPT = new Set(['README.md', 'CLAUDE.md']);
/** 通用 basename：无法用短名区分（如 README 多处存在），只认相对路径引用 */
const GENERIC_NAMES = new Set(['README']);

function walk(d) {
  const out = [];
  if (!existsSync(d)) return out;
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(md|yaml|ts|mjs|json)$/.test(f)) out.push(p);
  }
  return out;
}

function read(p) {
  try { return readFileSync(p, 'utf-8'); } catch { return ''; }
}

const docsFiles = walk(DOCS).filter(f => f.endsWith('.md'));
const corpus = [
  ...docsFiles,
  join(BASE, 'CLAUDE.md'),
  join(BASE, 'README.md'),
  ...walk(join(DOCS, 'workflows')),
  ...walk(join(BASE, 'src')),
  ...walk(join(BASE, 'scripts')),
  ...walk(join(BASE, 'tests')),
  ...walk(join(BASE, '.kfmv4', 'roles')),
].map(read).join('\n');

const orphans = [];
for (const f of docsFiles) {
  const base = join('docs', f.slice(DOCS.length + 1)).replace(/\\/g, '/');
  if (EXEMPT.has(base)) continue;
  const name = f.split('/').pop().replace(/\.md$/, '');
  const rel = base.replace(/\.md$/, '').replace(/^docs\//, '');
  // 引用判定：相对路径（decisions/xxx）或短名（xxx）都算；通用名只认相对路径
  const relRe = new RegExp(`(?<![\\w.-])${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
  const nameRe = new RegExp(`(?<![\\w.-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
  const reachable = relRe.test(corpus) || (!GENERIC_NAMES.has(name) && nameRe.test(corpus));
  if (!reachable) orphans.push(base);
}

if (orphans.length) {
  for (const o of orphans) {
    console.error(`[check-doc-orphans] 孤儿文档 ${o}——没有任何引用（orientation 纪律：文档不可孤悬）`);
  }
  console.error(`[check-doc-orphans] ${orphans.length} 份文档无引用——要么补引用（索引/契约/工作流），要么删除`);
  process.exit(1);
}
console.log(`[check-doc-orphans] OK — 全部 ${docsFiles.length} 份文档可去得（有引用）`);
