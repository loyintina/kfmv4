/**
 * check-doc-linerefs.mjs — 文档行号引用有效性检查（v8.3 语义审计机械化 M1）
 *
 * 靶向成因 G3（变更后引用面未同步）：文档写 `orb.ts:123`，代码演进后
 * 123 行已不存在——引用成为悬空指针（broken import 的行号版）。
 *
 * 规则：docs/domains/**.md 中形如 路径/文件名.扩展:行号 的引用——
 *   带 src/、scripts/ 前缀 → 按路径直查；裸文件名 → 按 src/+scripts/
 *    basename 索引解析（basename 不唯一则跳过，不误报）。
 *   文件/.basename 找不到 → 跳过（归 check-doc-symbols / check-code-doc-refs 管）。
 *   行号超出文件实际行数 → 中断。范围写法 :24-27 取首数核对。
 *   「符号名（file:line）」模式锚点（符号名紧跟中文括号/反引号包裹，如
 *   `renderTemplate（agent-runner.mjs:75）`）→ 另校验该行文本确实含该符号名——
 *   :32 存在但不含 renderTemplate 这类「行号在界但锚错位」漂移同样中断
 *   （2026-08-05 A 线升级：G3 错位拦截，从 LLM 抽样升级为构建期全量强制）。
 *
 * 历史叙述豁免：同行含「考古/历史/修复前/结案/漂移/曾/原/旧/引入/v7/v8.x/删除/批次」
 * 标记的行跳过——那些行号指向历史版本，本就允许悬空。
 * 确需豁免的活引用登记 WHITELIST（注释原因），豁免是最后手段。
 *
 * 挂 npm run check，失配 = 中断。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = resolve(process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url)));

// 豁免登记（注释原因）；格式 '相对文档路径:文档行号:引用串'
const WHITELIST = new Set([
  // 例：'ai-chat/code-map.md:102:orb.ts:779'  // 历史版本行号，叙事需要
]);

// 历史叙述标记：行号指向的是历史版本，不参与核对
const HISTORY_MARK = /考古|历史|修复前|结案|漂移|曾|原本|旧版|旧|引入|v7|v8\.0|v8\.1|v8\.2|删除|批次/;

const REF_RE = /([\w./-]+\.(?:ts|tsx|js|mjs|cjs|scss|css|html|json)):(\d+)(?:-\d+)?/g;

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

// ========== basename → 绝对路径 索引（src/ + scripts/ + package.json）==========

const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.scss', '.css', '.html', '.json'];
const baseIndex = new Map(); // basename → absPath | null（null = 不唯一）
function indexFile(abs) {
  const b = basename(abs);
  if (baseIndex.has(b)) baseIndex.set(b, null);
  else baseIndex.set(b, abs);
}
for (const ext of EXTS) {
  for (const f of walk(join(ROOT, 'src'), ext)) indexFile(f);
  for (const f of walk(join(ROOT, 'scripts'), ext)) indexFile(f);
}
if (existsSync(join(ROOT, 'package.json'))) indexFile(join(ROOT, 'package.json'));
if (existsSync(join(ROOT, 'build.mjs'))) indexFile(join(ROOT, 'build.mjs'));

function resolveRef(refPath) {
  if (refPath.startsWith('src/') || refPath.startsWith('scripts/') || refPath.startsWith('public/')) {
    const abs = join(ROOT, refPath);
    return existsSync(abs) ? abs : null;
  }
  const b = basename(refPath);
  return baseIndex.get(b) ?? undefined; // undefined = 未知，null = 歧义
}

// ========== 扫描 ==========

// 符号锚点前缀模式：仅反引号包裹的代码符号引用（`symbolName`（file:line））做行级校验
// ——反引号 = 显式「代码符号声明」（与 check-doc-symbols 同款契约），零误报。
// 直接模式（renderTemplate（file:line））不做符号校验：英文机制词（30s interval/
// switch/reject 等）贴中文括号会被误判为符号，契约推反引号写法，存量由探针兜底。
const SYM_ANCHOR_RE = /`([A-Za-z_$][A-Za-z0-9_$]*(?:\(\))?)`\s*（\s*$/;

let errors = 0;
let checked = 0;
const linesCache = new Map();

function linesOf(absPath) {
  if (!linesCache.has(absPath)) {
    linesCache.set(absPath, readFileSync(absPath, 'utf-8').split('\n'));
  }
  return linesCache.get(absPath);
}

const docDir = join(ROOT, DOCS_ROOT, 'domains');
for (const f of walk(docDir, '.md')) {
  const rel = f.replace(ROOT + '/', '').replace(DOCS_ROOT + '/domains/', '');
  const lines = readFileSync(f, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (HISTORY_MARK.test(line)) continue;
    for (const m of line.matchAll(REF_RE)) {
      const [, refPath, refLine] = m;
      const abs = resolveRef(refPath);
      if (abs == null) continue; // 未知或歧义：归符号/引用检查管
      checked++;
      const n = parseInt(refLine, 10);
      const key = `${rel}:${i + 1}:${refPath}:${n}`;
      if (WHITELIST.has(key)) continue;
      const targetLines = linesOf(abs);
      const max = targetLines.length;
      if (n > max) {
        console.error(
          `[check-doc-linerefs] domains/${rel}:${i + 1}: 引用 ${refPath}:${n} 超出文件实际行数（共 ${max} 行）——行号引用已悬空（G3 漂移；历史叙述请加标记或登记豁免）`
        );
        errors++;
        continue;
      }
      // 符号锚点行级校验：`` `符号名`（file:line）`` 模式 → 该行必须含符号名
      const symMatch = line.slice(0, m.index).match(SYM_ANCHOR_RE);
      const sym = symMatch ? symMatch[1].replace('()', '') : null;
      if (sym && !(targetLines[n - 1] || '').includes(sym)) {
        console.error(
          `[check-doc-linerefs] domains/${rel}:${i + 1}: 锚点错位——${refPath}:${n} 声称符号 ${sym}，该行实际不含（行内容：「${(targetLines[n - 1] || '').trim().slice(0, 60)}」）——G3 漂移（符号改名/移动后行号未同步；历史叙述请加标记或登记豁免）`
        );
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-doc-linerefs] ${errors} 处行号引用悬空，构建中断。`);
  process.exit(1);
}
console.log(`[check-doc-linerefs] OK — ${checked} 处行号引用全部在界内`);
