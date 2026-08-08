/**
 * check-as-any.mjs — 类型逃逸检查（as any / as unknown as）
 *
 * 捕获两类逃逸：
 *   - `as any`         —— 关闭类型检查
 *   - `as unknown as`  —— 更强的双重断言，绕过结构兼容检查
 *
 * 豁免机制（弃用旧的「文件:行号」白名单——行号随代码移动必然过期，
 * 审计 2026-07-21 发现旧白名单 6 条里 4 条已失效）：
 *
 *   1. 行内标记 `// escape-ok: 理由`：在逃逸所在行尾加此注释即豁免。
 *      标记随代码移动，永不过期，且理由就在现场，无需外部表。
 *   2. vendored 目录：src/server/ai/tools/omp/ 是移植的 OMP 工具代码
 *      （浏览器/CDP 库边界断言合理），整目录豁免。
 *
 * 注释行内的 "as any" 字样（如文档、历史说明）不计为逃逸。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const SRC_DIR = 'src';

// vendored：移植的 OMP 工具，库边界断言合理，整目录豁免
// generated：机械生成物（scripts-catalog 等）——其内容源自各脚本头部注释
// （如 check-as-any 自己的描述串 "as any / as unknown as" 会在 JSON 字符串里
// 字面命中本检查的 ESCAPE_RE 造成假阳性，2026-08-08 实案）；审计点是生成器而非产物
const VENDORED_PREFIXES = ['src/server/ai/tools/omp/', 'src/client/generated/'];

// 两类逃逸
const ESCAPE_RE = /\bas\s+unknown\s+as\b|\bas\s+any\b/;
// 行内豁免标记
const OK_RE = /\/\/\s*escape-ok/;
// 注释行（整行是注释——行首为 // 或 * 或 /*）：其中的 "as any" 字样不算逃逸
const COMMENT_LINE_RE = /^\s*(\/\/|\*|\/\*)/;

function isVendored(rel) {
  const norm = rel.split('\\').join('/');
  return VENDORED_PREFIXES.some(p => norm.startsWith(p));
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      yield* walk(full);
    } else if (extname(name) === '.ts') {
      yield full;
    }
  }
}

let errors = 0;
let exempted = 0;
for (const file of walk(SRC_DIR)) {
  const rel = relative('.', file).split('\\').join('/');
  if (isVendored(rel)) continue;
  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!ESCAPE_RE.test(line)) continue;
    if (COMMENT_LINE_RE.test(line)) continue; // 注释里提到不算
    if (OK_RE.test(line)) { exempted++; continue; }
    console.error(`[check-as-any] 未标记的类型逃逸: ${rel}:${i + 1}`);
    console.error(`    ${line.trim()}`);
    console.error(`    → 若确需逃逸，在该行尾加 "// escape-ok: <理由>"`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n[check-as-any] ${errors} 处未标记的类型逃逸，构建中断。`);
  process.exit(1);
} else {
  console.log(`[check-as-any] OK — ${exempted} 处已用 escape-ok 标记豁免，无未标记逃逸`);
}
