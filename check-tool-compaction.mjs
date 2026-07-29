/**
 * check-tool-compaction.mjs — 工具 I/O 压缩器登记完整性校验（v8.1.0）
 *
 * 契约：docs/domains/ai-chat/detail-tool-compaction.md —— 「映射表、注册表、本文档三者同步
 * 是新增工具的 DoD」（禁令 5）。本脚本机械执行这条同步：
 *
 * 双向校验：
 *   1. src/server/ai/tools/index.ts 注册的工具必须在压缩器注册表
 *      （src/shared/tool-compaction/index.ts 的 COMPACTOR_REGISTRY）有登记条目
 *      ——豁免型工具（kfm-restart 等）也要登记，用 exempt 注明豁免依据（G2/G4）。
 *      未登记 = 该工具的上下文压缩行为无人思考过 → 报错，提示去读契约第四节决策树。
 *   2. 注册表里的每个条目必须对应一个真实注册的工具
 *      ——否则是死压缩器（工具已删/改名但压缩器残留）→ 报错。
 *
 * 工具名提取：tools/index.ts 通过 registerTool(xxxTool) 注册，name 字段在各
 * 工具文件里。脚本解析 index.ts 的 import 语句定位工具文件，再从文件里提取
 * name: '...'——只核对「已注册」的工具，未接线的工具文件不参与。
 *
 * --check-only：兼容参数（对齐 check-anim 等脚本在构建链中的调用形式），
 * 本脚本无可自动修复项，加不加行为一致。
 *
 * 挂入 npm run check / build.mjs（check-css-wiring 之后），违规 = 构建中断。
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;

void process.argv.includes('--check-only'); // 兼容参数，见文件头

let errors = 0;

function error(msg) {
  console.error(`[check-tool-compaction] ${msg}`);
  errors++;
}

/** 剥离 // 行注释与 块注释（防注释里提及的名字被误判） */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ========== 1. 提取注册工具名 ==========
// tools/index.ts → import 语句 → 工具文件 → name: '...'

const toolsIndexPath = join(ROOT, 'src/server/ai/tools/index.ts');
const toolsIndex = stripComments(readFileSync(toolsIndexPath, 'utf-8'));

const toolNames = new Map(); // 工具名 → 定义文件（报错定位用）
const IMPORT_RE = /import\s+\{[^}]*\}\s+from\s+'(\.\/[^']+)\.js'/g;
for (const m of toolsIndex.matchAll(IMPORT_RE)) {
  const toolFile = join(ROOT, 'src/server/ai/tools', m[1] + '.ts');
  if (!existsSync(toolFile)) {
    error(`❌ tools/index.ts import 了 ${m[1]}.js，但对应 .ts 文件不存在`);
    continue;
  }
  const src = stripComments(readFileSync(toolFile, 'utf-8'));
  const nameMatch = src.match(/\bname:\s*'([^']+)'/);
  if (!nameMatch) {
    error(`❌ ${m[1]}.ts 中找不到 name: '...' 字段，无法确定工具名`);
    continue;
  }
  toolNames.set(nameMatch[1], `src/server/ai/tools/${m[1]}.ts`);
}

if (toolNames.size === 0) {
  error('❌ 未能从 tools/index.ts 提取到任何工具名——提取逻辑失效，需人工核对');
}

// ========== 2. 提取压缩器注册表登记名 ==========
// COMPACTOR_REGISTRY 是扁平对象字面量，每个 key 独占一行、两空格缩进：
//   bash: {},
//   'kfm-restart': { exempt: '...' },

const registryPath = join(ROOT, 'src/shared/tool-compaction/index.ts');
const registrySrc = readFileSync(registryPath, 'utf-8');
const blockStart = registrySrc.indexOf('COMPACTOR_REGISTRY');
const blockEnd = registrySrc.indexOf('\n};', blockStart);
if (blockStart < 0 || blockEnd < 0) {
  error('❌ src/shared/tool-compaction/index.ts 中找不到 COMPACTOR_REGISTRY 定义');
}

const registered = new Map(); // 登记名 → 条目行（exempt 校验用）
if (blockStart >= 0 && blockEnd > blockStart) {
  const block = registrySrc.slice(blockStart, blockEnd);
  const KEY_RE = /^ {2}([\w]+|'[^']+')\s*:\s*\{(.*)$/gm;
  for (const m of block.matchAll(KEY_RE)) {
    const key = m[1].startsWith("'") ? m[1].slice(1, -1) : m[1];
    registered.set(key, m[2]);
  }
}

// ========== 3. 双向校验 ==========

// 方向 1：注册工具必须有登记条目（豁免型也要，exempt 注明依据）
for (const [name, file] of [...toolNames.entries()].sort()) {
  if (!registered.has(name)) {
    error(`❌ 工具 ${name}（${file}）在压缩器注册表无登记——其上下文压缩行为无人思考过；先读 docs/domains/ai-chat/detail-tool-compaction.md 第四节决策树，再在 COMPACTOR_REGISTRY 补条目（豁免型用 exempt 注明 G2/G4 依据）`);
  }
}

// 方向 2：登记条目必须对应真实工具（否则是死压缩器）
for (const name of [...registered.keys()].sort()) {
  if (!toolNames.has(name)) {
    error(`❌ 压缩器注册表登记了 ${name}，但 tools/index.ts 无此工具——死压缩器，删除条目或核对工具改名`);
  }
}

// 方向 3：exempt 条目必须注明通用规则依据（G2/G4 等），防空泛豁免
for (const [name, body] of [...registered.entries()].sort()) {
  if (body.includes('exempt:') && !/exempt:\s*'G\d/.test(body)) {
    error(`❌ 注册表条目 ${name} 标记了 exempt 但未注明通用规则依据（应以 G2/G4 等开头）`);
  }
}

// ========== 汇总 ==========

if (errors > 0) {
  console.error(`\n[check-tool-compaction] ${errors} 处登记失配，构建中断。`);
  process.exit(1);
}

console.log(`[check-tool-compaction] OK — ${toolNames.size} 个注册工具 ↔ ${registered.size} 条压缩器登记，双向核对完整`);
