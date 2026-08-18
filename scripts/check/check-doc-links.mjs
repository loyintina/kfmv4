/**
 * check-doc-links.mjs — 文档内相对/绝对路径存活检查（2026-08-18 立，九零审计催生）
 *
 * 问题：2026-08-18 九零文档体系审计抓到 3 处断链（目录迁移后少一级 `../`：
 *   nine-zero-preface.md:3 ×2、nine-zero-semantic-map-cordis-side.md:8），
 *   check-doc-orphans 的覆盖语法不含 markdown 链接与反引号路径——机检盲区。
 *   文档里的路径引用是读者/agent 的导航绳，断了无人知晓。
 *
 * 检查：扫 docs/**\/*.md 两类路径引用——
 *   (a) markdown 链接目标 [x](path)：跳过 http(s)://、# 锚点、mailto:；
 *   (b) 反引号包裹、看起来像路径的字符串（以 / 或 ../ 或 ./ 开头且含 /）。
 *   相对路径按所在 md 文件目录解析，绝对路径直接查；不存在即报红
 *   （带 文件:行号 + 无法解析的目标）。
 *
 * 收窄原则（零误报优先）：
 *   - 只查以 .md/.yaml/.yml/.mjs/.html/.json 结尾的文件路径；目录引用
 *     （以 / 结尾）仅对 markdown 链接启用——反引号里的 `/ai/` 之类是
 *     HTTP 路由不是文件系统路径（bugs.md BAR-BUILD-02 误报实证）；
 *   - 含 $(变量)/通配/占位符（$ * { } < > ~ %）的一律跳过；
 *   - docs/ledger/agent-inbox/ 信件正文跳过（只追加不删改纪律 = 正文里的
 *     历史路径化石不可修，如迁移前的 /root/kfmv4/docs/active/nine-zero-preface.md），
 *     该目录台账 README.md 仍全量扫（另有 check-agent-inbox 双向对账）。
 *
 * 枚举型检查（每次全量重扫 docs），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const DOCS = join(ROOT, 'docs');

let errors = 0;
function error(msg) {
  console.error(`[check-doc-links] ${msg}`);
  errors++;
}

// 只查这些扩展名的文件路径（收窄误报：示例路径/变量/通配不进检查面）
const CHECK_EXT_RE = /\.(md|yaml|yml|mjs|html|json)$/;
// 占位符/变量/通配特征——出现即跳过（示例模板不是真实引用）
const PLACEHOLDER_RE = /[$*{}<>~^%]/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (name.endsWith('.md')) yield full;
  }
}

/** 目标是否值得检查：剥锚点后有白名单扩展名；目录引用（/ 结尾）仅 markdown 链接启用 */
function checkable(target, { allowDir }) {
  if (!target || PLACEHOLDER_RE.test(target)) return null;
  const clean = target.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean.endsWith('/')) return allowDir ? clean : null;
  if (CHECK_EXT_RE.test(clean)) return clean;
  return null;
}

function checkTarget(mdFile, lineNo, raw, opts) {
  const clean = checkable(raw, opts);
  if (!clean) return;
  const abs = isAbsolute(clean) ? clean : resolve(dirname(mdFile), clean);
  if (!existsSync(abs)) {
    error(`${relative(ROOT, mdFile)}:${lineNo} 断链：${raw}（解析到 ${abs}，不存在）`);
  }
}

const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)[^)]*\)/g;
const BACKTICK_RE = /`([^`\s]+)`/g;
const INBOX_DIR = join(DOCS, 'ledger', 'agent-inbox');

let scanned = 0;
let checked = 0;
for (const mdFile of walk(DOCS)) {
  // 信件正文跳过（append-only 不可修）；台账 README 照扫
  if (dirname(mdFile) === INBOX_DIR && mdFile.endsWith('.md') && !mdFile.endsWith('README.md')) continue;
  scanned++;
  const lines = readFileSync(mdFile, 'utf-8').split('\n');
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    // (a) markdown 链接目标——跳过外部协议与纯锚点
    for (const m of line.matchAll(MD_LINK_RE)) {
      const target = m[1];
      if (/^(https?:\/\/|#|mailto:)/i.test(target)) continue;
      checked++;
      checkTarget(mdFile, lineNo, target, { allowDir: true });
    }
    // (b) 反引号包裹的路径样字符串（以 / ../ ./ 开头且含 /，须白名单扩展名）
    for (const m of line.matchAll(BACKTICK_RE)) {
      const s = m[1];
      if (!(/^(\/|\.\.\/|\.\/)/.test(s) && s.includes('/'))) continue;
      checked++;
      checkTarget(mdFile, lineNo, s, { allowDir: false });
    }
  });
}

if (errors > 0) {
  console.error(`\n⛳ DOC-FLOW-13 共 ${errors} 处断链——目录迁移/改名后引用未同步；按 文件:行号 逐条修（修不动就删引用），读 docs/guides/doc-maintenance.md`);
  console.error('[check-doc-links] 路径存活检查失败，构建中断。');
  process.exit(1);
}
console.log(`[check-doc-links] OK — ${scanned} 份文档、${checked} 处路径引用全部存活`);
