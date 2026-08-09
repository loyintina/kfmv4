#!/usr/bin/env node
/**
 * check-doc-orphans.mjs — 文档可达性纪律（每份文档必须被引用，且去对地方）
 *
 * orientation 关键设计：「一份文档若没有任何工作流读/写它，它不该存在」。
 * 两层门：
 *   1. 孤儿门：docs/ 下每份 .md 的文件名必须作为独立词出现在引用面
 *      （docs 内互引 + CLAUDE/README + workflows + src + scripts + tests
 *      + .kfmv4 角色卡）
 *   2. MUST 门（去对地方）：特定类型的文档必须被「正规入口」引用——
 *      decisions 下的文档 → decisions/README.md 索引
 *      domains 下各域的 detail-*.md → 同域 contract.md 头注
 * 孤儿文档 = 无人知道它存在；MUST 缺失 = 存在但没挂进正规入口。
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
  ...walk(join(BASE, '.kfmv4', 'agents', 'roles')),
].map(read).join('\n');

const orphans = [];
const mustErrors = [];
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

  // MUST 门：类型 → 正规入口（rel 已去 .md 后缀）
  if (/^decisions\/.+$/.test(rel) && !rel.endsWith('README')) {
    const idx = read(join(DOCS, 'decisions', 'README.md'));
    if (!idx.includes(name)) mustErrors.push(`${base} 必须在 decisions/README.md 索引登记`);
  }
  const dm = rel.match(/^domains\/([\w-]+)\/detail-.+$/);
  if (dm) {
    const contract = read(join(DOCS, 'domains', dm[1], 'contract.md'));
    if (!contract.includes(name)) mustErrors.push(`${base} 必须在同域 ${dm[1]}/contract.md 头注登记（别的去哪找）`);
  }
}

if (mustErrors.length) {
  for (const e of mustErrors) console.error(`[check-doc-orphans] ${e}`);
  console.error('[check-doc-orphans] ⛳ DOC-FLOW-02：decisions 必须进 decisions/README.md 索引；detail 必须进同域契约头注——读 docs/guides/doc-maintenance.md §必挂引用点，走 workflows/doc-write.yaml 第 4 步');
}
if (orphans.length) {
  for (const o of orphans) {
    console.error(`[check-doc-orphans] 孤儿文档 ${o}——没有任何引用（orientation 纪律：文档不可孤悬）`);
  }
  console.error('[check-doc-orphans] ⛳ DOC-FLOW-01：新文档必须挂正规入口——读 docs/guides/doc-maintenance.md §必挂引用点，走 workflows/doc-write.yaml 第 4 步');
}
if (mustErrors.length || orphans.length) {
  const n = mustErrors.length + orphans.length;
  console.error(`[check-doc-orphans] ${n} 处可达性问题——补正规入口引用（索引/契约头注），或删除`);
  process.exit(1);
}
console.log(`[check-doc-orphans] OK — 全部 ${docsFiles.length} 份文档可去得且去对地方`);
