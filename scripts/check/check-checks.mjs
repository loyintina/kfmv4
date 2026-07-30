/**
 * check-checks.mjs — 检查脚本集成完整性验证（v8.3 单源化后重写）
 *
 * check 链唯一出处 = scripts/check/chain.mjs 的 STEPS。本检查执法：
 *   1. 每个 check-*.mjs（自身除外）必须出现在 chain.mjs STEPS（漏挂 = 中断）
 *   2. STEPS 每个步骤引用的脚本文件必须存在（改名失联 = 中断）
 *   3. package.json "check" 必须委托 chain.mjs（禁止回潮手写链）
 *   4. build.mjs 必须引用 chain.mjs 且不得出现任何单个 check-*.mjs（防双份拷贝回潮）
 *   5. README/CLAUDE 的 check 计数声明与实际一致
 *
 * 挂入 check 链（chain.mjs STEPS 第 3 步），失配 = 中断。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = resolve(process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const SCRIPT_DIR = join(ROOT, 'scripts', 'check');

let hasError = false;

function error(msg) {
  console.error(`[check-checks] ${msg}`);
  hasError = true;
}

// ========== 1. 收集所有 check-*.mjs 脚本 ==========

const checkScripts = [];
for (const entry of readdirSync(SCRIPT_DIR)) {
  const full = join(SCRIPT_DIR, entry);
  const st = statSync(full, { throwIfNoEntry: false });
  if (st && st.isFile() && entry.startsWith('check-') && entry.endsWith('.mjs') && entry !== 'check-checks.mjs') {
    checkScripts.push(entry);
  }
}

checkScripts.sort();
console.log(`[check-checks] 发现 ${checkScripts.length} 个检查脚本: ${checkScripts.join(', ')}`);

// ========== 2. 读取唯一出处 chain.mjs STEPS ==========

const chainPath = join(SCRIPT_DIR, 'chain.mjs');
if (!existsSync(chainPath)) {
  error('scripts/check/chain.mjs 不存在——check 链唯一出处丢失');
}
const { STEPS } = existsSync(chainPath)
  ? await import(pathToFileURL(chainPath).href)
  : { STEPS: [] };

// 2a. 每个 check-*.mjs 必须在链上
for (const script of checkScripts) {
  if (!STEPS.some(step => step.includes(script))) {
    error(`${script} 未挂入 chain.mjs STEPS——新检查必须登记唯一出处，否则永不执行`);
  }
}

// 2b. 链上每个步骤引用的脚本必须存在
for (const step of STEPS) {
  for (const m of step.matchAll(/(scripts\/[\w./-]+\.(?:mjs|js|cjs))/g)) {
    if (!existsSync(join(ROOT, m[1]))) {
      error(`chain.mjs 步骤 "${step}" 引用的 ${m[1]} 不存在（脚本改名/删除后链未同步）`);
    }
  }
}

// ========== 3. package.json 必须委托 chain.mjs ==========

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const checkCmd = (pkg.scripts.check || '').trim();
if (checkCmd !== 'node scripts/check/chain.mjs') {
  error(`package.json "check" 未委托 chain.mjs（当前："${checkCmd.slice(0, 60)}…"）——禁止回潮手写链`);
}

// ========== 4. build.mjs 必须委托且不得回潮 ==========

const buildMjsPath = join(ROOT, 'build.mjs');
if (!existsSync(buildMjsPath)) {
  error('build.mjs 不存在，无法验证构建管线覆盖');
} else {
  const buildMjs = readFileSync(buildMjsPath, 'utf-8');
  if (!buildMjs.includes('scripts/check/chain.mjs')) {
    error('build.mjs 未引用 scripts/check/chain.mjs——构建链必须委托唯一出处');
  }
  for (const script of checkScripts) {
    if (buildMjs.includes(script)) {
      error(`build.mjs 出现单个 ${script} 引用——双份拷贝回潮（infra 漂移 1 的复活），必须走 chain.mjs`);
    }
  }
}

// ========== 5. 验证 README.md / CLAUDE.md 中的 check 脚本计数 ==========

const readmePath = join(ROOT, 'README.md');
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf-8');
  const readmeMatch = readme.match(/(\d+)\s*个\s*check/);
  if (readmeMatch) {
    const readmeCount = parseInt(readmeMatch[1], 10);
    // 含自身，所以显示 count = checkScripts.length + 1
    const actualDisplayCount = checkScripts.length + 1;
    if (readmeCount !== actualDisplayCount) {
      error(`README.md 声称 "${readmeCount} 个 check-* 脚本"，实际有 ${actualDisplayCount} 个（${checkScripts.length} 个检查 + check-checks.mjs 自身）`);
    }
  }
}

const claudePath = join(ROOT, 'CLAUDE.md');
if (existsSync(claudePath)) {
  const claudeContent = readFileSync(claudePath, 'utf-8');
  const claudeMatch = claudeContent.match(/(\d+)\s*个\s*check-\*\.mjs/g);
  if (claudeMatch) {
    for (const claim of claudeMatch) {
      const claudeCount = parseInt(claim.match(/\d+/)[0], 10);
      const actualDisplayCount = checkScripts.length + 1;
      if (claudeCount !== actualDisplayCount) {
        error(`CLAUDE.md 声称 "${claim}"，实际有 ${actualDisplayCount} 个（${checkScripts.length} 个检查 + check-checks.mjs 自身）`);
      }
    }
  }
}

// ========== 汇总 ==========

if (hasError) {
  console.error(`\n[check-checks] 集成检查失败，构建中断。`);
  process.exit(1);
}

console.log(`[check-checks] OK — ${checkScripts.length} 个检查脚本全部挂入唯一出处 chain.mjs`);
