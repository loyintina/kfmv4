/**
 * check-doc-scripts.mjs — 文档脚本/源码引用存在性检查（2026-08-04，SEM001 机械化收割）
 *
 * 出身：语义审计变异基准 SEM001 家族（stale-claim：文档断言的行为被实现直接反驳）。
 *   M03（`check-*` 名 ghost——check-desc-freshness 已死仍被引用，workflows/ 面）、
 *   M05（scripts/ 路径拼错——tag-adviser.mjs）、M13（幽灵文件名——bundle.mjs）
 *   三形态长期依赖 LLM 探针（读 code-map 才可逮）——按结晶回路（变体 ≥3 → 移民
 *   确定区），引用存在性收归机械层：确定、零成本、进 check 链。
 *   同行先例：check-stack-status.mjs（SEM005 移民）。
 *
 * 检查项（宁紧勿宽，先保证零误报；基线实测见 2026-08-04 收割轮）：
 *   P 反引号完整路径引用：`(src|scripts|tests|experiments|build.mjs|dist)/…x.(ts|mjs|cjs)`
 *     相对仓库根必须存在（M05 家族）。行号后缀 `file.ts:123` 剥除。
 *   Z 反引号纯文件名引用：`xxx.(mjs|ts|cjs)`（无路径分隔符）在 src/scripts/tests/根
 *     全树 basename 必须存在（M13 家族）。
 *   C 裸 `check-*` 名引用（仅 docs/workflows/ 面）：workflow 卡引用的 check-xxx 必须是
 *     现役脚本 scripts/check/check-xxx.mjs（M03 家族）。
 *
 * 明确不覆盖（诚实边界）：
 *   - 裸 check-* 名在 workflows/ 之外（active/guides/domains 讨论未来 check 是内容需要，
 *     实测 check-e2e/check-btns/check-superseded-coverage 均为规划/历史，非漂移）
 *   - 非反引号的路径引用（文档规范：代码/脚本引用必须用反引号，裸散文引用不算声明）
 *   - 探针夹具内的示例名（tests/probes/ 假树由 check-probes 管理，不在此面）
 *
 * 枚举型检查（每次全量重扫），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
let errors = 0;
function error(msg) {
  console.error(`[check-doc-scripts] ${msg}`);
  errors++;
}

// Z 通道豁免：模式名/教学示例（反引号包裹但非真文件引用）
const WHITELIST = new Set(['.card.ts', 'hello.card.ts']);

// ---------- 强制面文档收集（豁免 ledger/decisions/archive 历史档案） ----------
const EXEMPT_DIRS = new Set(['ledger', 'decisions', 'archive']);
function walk(dir, ext, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}
const docFiles = [];
const docsDir = join(ROOT, DOCS_ROOT);
for (const e of readdirSync(docsDir, { withFileTypes: true })) {
  if (EXEMPT_DIRS.has(e.name)) continue;
  if (e.isDirectory()) {
    docFiles.push(...walk(join(docsDir, e.name), '.md'), ...walk(join(docsDir, e.name), '.yaml'));
  } else if (e.name.endsWith('.md') || e.name.endsWith('.yaml')) {
    docFiles.push(join(docsDir, e.name));
  }
}
docFiles.push(join(ROOT, 'README.md'), join(ROOT, 'CLAUDE.md'));

// ---------- 语料：全树 basename（src/scripts/tests/根） ----------
function collectBasenames(dirs, exts) {
  const out = new Set();
  for (const d of dirs) {
    for (const ext of exts) {
      for (const f of walk(join(ROOT, d), ext)) out.add(f.split('/').pop());
    }
  }
  return out;
}
const allNames = new Set([
  ...collectBasenames(['src'], ['.ts']),
  ...collectBasenames(['scripts'], ['.mjs', '.cjs']),
  ...collectBasenames(['tests'], ['.mjs', '.ts']),
]);
for (const f of readdirSync(ROOT)) {
  if (/\.(mjs|cjs|ts)$/.test(f)) allNames.add(f);
}

// ---------- P/Z 通道：逐行扫描（保留行号） ----------
const PATH_REF_RE = /`((?:src|scripts|tests|experiments|build\.mjs|dist)\/[^\s`"()]+\.(?:ts|mjs|cjs))`/g;
const NAME_REF_RE = /`([a-zA-Z0-9_.-]+\.(?:mjs|ts|cjs))`/g;

function stripLineSuffix(ref) {
  return ref.replace(/\.(ts|mjs|cjs):\d+.*$/, '.$1');
}

for (const f of docFiles) {
  if (!statSync(f, { throwIfNoEntry: false })?.isFile()) continue;
  const lines = readFileSync(f, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    // P：完整路径引用（反引号内）——matchAll：一行可多个引用（gen 生成区单行数百反引号）
    for (const pm of line.matchAll(PATH_REF_RE)) {
      const ref = stripLineSuffix(pm[1]);
      if (!statSync(join(ROOT, ref), { throwIfNoEntry: false })?.isFile()) {
        error(`${f.replace(ROOT + '/', '')}:${lineNo} 引用路径不存在：\`${pm[1]}\`（文档漂移；脚本已删/改名请同步引用）`);
      }
    }
    // Z：纯文件名引用（反引号内，无路径分隔符）
    for (const zm of line.matchAll(NAME_REF_RE)) {
      if (WHITELIST.has(zm[1])) continue;
      const ref = stripLineSuffix(zm[1]);
      if (!allNames.has(ref)) {
        error(`${f.replace(ROOT + '/', '')}:${lineNo} 引用文件不存在：\`${zm[1]}\`（文档漂移；脚本已删/改名请同步引用）`);
      }
    }
  });
}

// ---------- C 通道：docs/workflows/*.yaml 裸 check-* 名（挖掉反引号后） ----------
const checkScripts = new Set(
  walk(join(ROOT, 'scripts', 'check'), '.mjs').map(f => f.split('/').pop())
);
const CHECK_NAME_RE = /\b(check-[a-z0-9][a-z0-9-]*)\b/g;
for (const f of walk(join(docsDir, 'workflows'), '.yaml')) {
  const lines = readFileSync(f, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    const stripped = line.replace(/`[^`\n]+`/g, ''); // 反引号内由 P/Z/A 通道管
    for (const m of stripped.matchAll(CHECK_NAME_RE)) {
      if (!checkScripts.has(m[1] + '.mjs')) {
        error(`${f.replace(ROOT + '/', '')}:${i + 1} 引用 check 脚本不存在：${m[1]}（workflow 引用的 check 必须是 scripts/check/ 现役脚本）`);
      }
    }
  });
}

if (errors > 0) {
  console.error(`\n[check-doc-scripts] ${errors} 处脚本引用漂移，构建中断。`);
  console.error('[check-doc-scripts] ⛳ MECH-FLOW-10：文档脚本引用漂移——同步引用或登记豁免，走 workflows/semantic-audit.yaml 裁决流');
  process.exit(1);
}
console.log(`[check-doc-scripts] OK — 文档脚本/源码引用全部存在（${docFiles.length} 个文档面文件）`);
