#!/usr/bin/env node
/**
 * check-doc-orphans.mjs — 文档可达性纪律（每份文档必须被引用，且去对地方）
 *
 * orientation 关键设计：「一份文档若没有任何工作流读/写它，它不该存在」。
 * 三层门：
 *   1. 孤儿门：docs/ 下每份 .md 的文件名必须作为独立词出现在引用面
 *      （docs 内互引 + CLAUDE/README + workflows + src + scripts + tests
 *      + .kfmv4 角色卡）——注意此门判定宽松（表格提到文件名也算），
 *      只防"完全无人提及"。
 *   2. MUST 门（去对地方）：特定类型的文档必须被「正规入口」引用——
 *      decisions 下的文档 → decisions/README.md 索引
 *      domains 下各域的 detail-*.md → 同域 contract.md 头注
 *   3. 工作流消费门（2026-08-09 复盘补强，external-sources 案例）：
 *      规则/机制/SOP 类文档（active/ guides/ constraints/）必须被
 *      **意图-行为载体**消费——任一：被 workflows/*.yaml 引用（agent 工作流）、
 *      被 scripts/check/*.mjs 或 scripts/agent/*.mjs 引用（机器工作流）、
 *      被 CLAUDE.md/README.md 引用（入口引导）。仅被 docs 互引（如 onboarding
 *      表格提一句）不算——那是"引用可达但工作流不可达"的会腐烂文档
 *      （external-sources 实案：被 onboarding 引用糊弄过孤儿门）。
 * 孤儿文档 = 无人知道它存在；MUST 缺失 = 存在但没挂进正规入口；
 * 无工作流消费 = 存在、被提及，但做事时不会被引导到——会腐烂。
 *
 * 豁免：根 README.md / CLAUDE.md（项目入口，天然可达）；
 * decisions/README.md 由 orientation 引用（索引文件），不豁免；
 * decisions/ ledger/ archive/（状态/历史，被索引即可）与 domains/
 * （contract 经 pre-code-gate reads 可达，detail 经 MUST 门，code-map/
 * capability-map 等为生成/索引类）不做工作流消费要求。
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
const wfErrors = [];

// 工作流消费语料：workflows（agent 工作流）+ check/agent 脚本（机器工作流）+ 入口引导
const WF_CONSUMER_DIRS = ['active', 'guides', 'constraints'];
const consumptionCorpus = [
  ...walk(join(DOCS, 'workflows')),
  ...walk(join(BASE, 'scripts', 'check')),
  ...walk(join(BASE, 'scripts', 'agent')),
  join(BASE, 'CLAUDE.md'),
  join(BASE, 'README.md'),
].map(read).join('\n');

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

  // 工作流消费门：规则/机制/SOP 类必须被意图-行为载体消费
  const top = rel.split('/')[0];
  if (WF_CONSUMER_DIRS.includes(top)) {
    // constraints/detail-*：被 invariants.md 主文档引用（分册模式）或工作流消费，任一即过
    const constraintsDetail = /^constraints\/detail-.+$/.test(rel);
    if (constraintsDetail) {
      const inv = read(join(DOCS, 'constraints', 'invariants.md'));
      const byInvariants = inv.includes(name);
      const byWorkflow = nameRe.test(consumptionCorpus) || relRe.test(consumptionCorpus);
      if (!byInvariants && !byWorkflow) {
        wfErrors.push(`${base} constraints/detail-* 须被 invariants.md 主文档引用（分册）或被工作流消费（如 detail-cases 挂 diagnostics.yaml reads），二选一`);
      }
    } else {
      const consumed = nameRe.test(consumptionCorpus) || relRe.test(consumptionCorpus);
      if (!consumed) {
        wfErrors.push(`${base} 规则/机制类文档无工作流消费——需被 workflows/*.yaml reads、check/agent 脚本、或 CLAUDE/README 任一引用（仅 docs 互引不够）`);
      }
    }
  }
}

if (mustErrors.length) {
  for (const e of mustErrors) console.error(`[check-doc-orphans] ${e}`);
  console.error('[check-doc-orphans] ⛳ DOC-FLOW-02：decisions 必须进 decisions/README.md 索引；detail 必须进同域契约头注——读 docs/guides/doc-maintenance.md §必挂引用点，走 workflows/doc-write.yaml 第 4 步');
}
if (wfErrors.length) {
  for (const e of wfErrors) console.error(`[check-doc-orphans] ${e}`);
  console.error('[check-doc-orphans] ⛳ DOC-FLOW-12：规则/机制类文档必须工作流可达——挂进某个 workflow 的 reads、被 check/agent 脚本消费、或进 CLAUDE/README 入口；仅 docs 互引不算——读 docs/guides/doc-architecture.md §结构原则 #5（执法缝隙注记），走 workflows/doc-write.yaml 第 4 步');
}
if (orphans.length) {
  for (const o of orphans) {
    console.error(`[check-doc-orphans] 孤儿文档 ${o}——没有任何引用（orientation 纪律：文档不可孤悬）`);
  }
  console.error('[check-doc-orphans] ⛳ DOC-FLOW-01：新文档必须挂正规入口——读 docs/guides/doc-maintenance.md §必挂引用点，走 workflows/doc-write.yaml 第 4 步');
}
if (mustErrors.length || orphans.length || wfErrors.length) {
  const n = mustErrors.length + orphans.length + wfErrors.length;
  console.error(`[check-doc-orphans] ${n} 处可达性问题——补正规入口引用（索引/契约头注/工作流消费），或删除`);
  process.exit(1);
}
console.log(`[check-doc-orphans] OK — 全部 ${docsFiles.length} 份文档可去得且去对地方`);
