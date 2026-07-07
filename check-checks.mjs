/**
 * check-checks.mjs — 检查脚本集成完整性验证
 *
 * 验证所有 check-*.mjs 脚本（自身除外）是否在 npm 构建管线中有合理覆盖：
 *   1. 在 package.json "check" 命令中被引用
 *   2. 在 package.json "build" 命令中被引用
 *   3. 新增的、需要构建时运行的检查是否也接入了 build.mjs
 *
 * 挂入 npm run check，遗漏 = 构建中断。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;

let hasError = false;

function error(msg) {
  console.error(`[check-checks] ${msg}`);
  hasError = true;
}

// ========== 1. 收集所有 check-*.mjs 脚本 ==========

const checkScripts = [];
for (const entry of readdirSync(ROOT)) {
  const full = join(ROOT, entry);
  const st = statSync(full, { throwIfNoEntry: false });
  if (st && st.isFile() && entry.startsWith('check-') && entry.endsWith('.mjs') && entry !== 'check-checks.mjs') {
    checkScripts.push(entry);
  }
}

checkScripts.sort();
console.log(`[check-checks] 发现 ${checkScripts.length} 个检查脚本: ${checkScripts.join(', ')}`);

// ========== 2. 验证 package.json 覆盖 ==========

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const checkScript = pkg.scripts.check || '';
const buildScript = pkg.scripts.build || '';

for (const script of checkScripts) {
  // 在 npm script 中用脚本名或去掉后缀的名字引用
  const inCheck = checkScript.includes(script) || checkScript.includes(script.replace('.mjs', ''));
  const inBuild = buildScript.includes(script) || buildScript.includes(script.replace('.mjs', ''));

  if (!inCheck) {
    error(`${script} 未在 package.json "check" 命令中找到。请添加。`);
  }
  if (!inBuild) {
    error(`${script} 未在 package.json "build" 命令中找到。所有检查脚本必须在构建时也运行。`);
  }
}

// ========== 3. 验证 build.mjs 覆盖 ==========

const buildMjsPath = join(ROOT, 'build.mjs');
if (existsSync(buildMjsPath)) {
  const buildMjs = readFileSync(buildMjsPath, 'utf-8');

  // build.mjs 只需包含新增的、有构建阶段特殊意义的检查
  // 已在 npm build 脚本中运行的 check 不需要重复在 build.mjs 中
  // 但新增的 check（如 check-card-meta.mjs 和 check-cards.mjs）需要被 build.mjs 引用
  // 以确认它们在 esbuild bundle 阶段之前执行
  const expectedInBuildMjs = ['check-card-meta.mjs', 'check-cards.mjs'];
  for (const script of expectedInBuildMjs) {
    if (checkScripts.includes(script) && !buildMjs.includes(script)) {
      error(`${script} 应接入 build.mjs（需要在构建产物生成前执行类型检查），但未找到引用`);
    }
  }
} else {
  error('build.mjs 不存在，无法验证构建管线覆盖');
}

// ========== 4. 验证 README.md 中的 check 脚本计数 ==========

const readme = readFileSync(join(ROOT, 'README.md'), 'utf-8');
const readmeMatch = readme.match(/(\d+)\s*个\s*check/);
if (readmeMatch) {
  const readmeCount = parseInt(readmeMatch[1], 10);
  // 含自身，所以显示 count = checkScripts.length + 1
  const actualDisplayCount = checkScripts.length + 1;
  if (readmeCount !== actualDisplayCount) {
    error(`README.md 声称 "${readmeCount} 个 check-* 脚本"，实际有 ${actualDisplayCount} 个（${checkScripts.length} 个检查 + check-checks.mjs 自身）`);
  }
}

// ========== 汇总 ==========

if (hasError) {
  console.error(`\n[check-checks] 集成检查失败，构建中断。`);
  process.exit(1);
}

console.log(`[check-checks] OK — 全部 ${checkScripts.length} 个检查脚本已正确集成到 check/build 管线中`);
