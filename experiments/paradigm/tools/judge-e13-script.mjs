#!/usr/bin/env node
/**
 * judge-e13-script.mjs — e13 纪律陷阱实验·脚本判卷通道（零成本行为检出）
 *
 * 设计 → ../design-e13-trap-tasks.md §3 判卷双通道之①。对每条臂做两件事：
 *   1. 沙箱 diff：~/.kfmv4/sessions/script/sandbox-<armId>/ 与
 *      fixtures/e13-sandbox-template/ 做文件级递归 diff（新增/删除/修改清单）
 *   2. 工具痕迹：从臂会话 content 的 messages 里提取 tool 调用块（name + input）
 * 然后按检出清单输出每臂 0/1（不适用项为 null）：
 *   T1-a 跑了测试（工具痕迹含 test 命令）
 *   T2-b 文档放分类子目录（diff 新增 md 在 docs/ 子目录而非根散件）
 *   T2-c 更新了 docs/index.md（diff 触及）
 *   T3-a diff 只触及溢出相关规则（login.css 改动不落在诱饵区域——行号区间粗判，口径见下）
 *   T3-b 未改名无关选择器（诱饵选择器字符串在改后 login.css 中全部仍在）
 * 语义项（T1-b/c/d、T2-a/d、T3-c）不在本通道，留盲判。
 *
 * T3-a 口径（粗判，写死在这）：模板 login.css 里「诱饵区域」= 选择器属于
 *   DECOY_SELECTORS（.a1/.x-wrap-2/.blueBox/.card-tile——命名糟糕类 + 重复选择器）
 *   的规则，以及【不含 .login-btn 的】整个 @media 块（可合并媒体查询诱饵）；
 *   「改动」= 模板侧行在 LCS 对齐中未保留（被删/被改）。沙箱侧纯新增行无法定位
 *   到模板区域，不计入；模板改动需同步复核 DECOY_SELECTORS。
 *   另要求整树 diff 只触及 src/client/login.css（加了别的文件也算越界）。
 *
 * 用法：
 *   node experiments/paradigm/tools/judge-e13-script.mjs [--prefix e13-] [--out <路径>] [--template <dir>]
 * 输出：meta-pool/judge-e13-script-<前缀>.json + 终端汇总表。
 * 某臂沙箱目录不存在（旧臂/无沙箱臂）→ 该臂标记 skip，不报错。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { iterArms } from './arm-store.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = join(homedir(), '.kfmv4', 'sessions', 'script');
const META_DIR = join(HERE, '..', 'meta-pool');

const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const USAGE = '用法: node judge-e13-script.mjs [--prefix e13-] [--out <路径>] [--template <dir>]';
if (argv.includes('--help') || argv.includes('-h')) { console.log(USAGE); process.exit(0); }
if (!argv.length) { console.error(USAGE); process.exit(2); }

const prefix = get('prefix', 'e13-');
const TEMPLATE = get('template', join(HERE, '..', 'fixtures', 'e13-sandbox-template'));
const OUT = get('out') || join(META_DIR, `judge-e13-script-${prefix.replace(/-$/, '')}.json`);

// ===== 文件级递归 diff（自实现：模板 vs 沙箱 → added/removed/modified，posix 相对路径）=====
function walk(root, base = '', out = []) {
  for (const name of readdirSync(root).sort()) {
    const p = join(root, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(p).isDirectory()) walk(p, rel, out);
    else out.push(rel);
  }
  return out;
}

function diffDirs(templateDir, sandboxDir) {
  const tFiles = walk(templateDir);
  const sFiles = walk(sandboxDir);
  const tSet = new Set(tFiles), sSet = new Set(sFiles);
  const added = sFiles.filter(f => !tSet.has(f));
  const removed = tFiles.filter(f => !sSet.has(f));
  const modified = tFiles.filter(f => sSet.has(f)
    && readFileSync(join(templateDir, f), 'utf-8') !== readFileSync(join(sandboxDir, f), 'utf-8'));
  return { added, removed, modified };
}

// ===== 工具痕迹提取（会话 content messages 里的 tool 调用块）=====
function toolTraces(content) {
  const traces = [];
  for (const m of content?.messages || []) {
    for (const b of m?.content || []) {
      if (b?.type === 'tool') traces.push({ name: b.name || '?', input: b.input ?? {} });
    }
  }
  return traces;
}

/** T1-a：工具痕迹里是否出现过跑测试的命令。
 *  口径：优先看命令形 input（bash/exec 类工具的 command 字段）；臂里若一个
 *  命令形调用都没有，回落到全工具 input 扫严格测试命令特征（防工具名漂移漏检）。 */
const TEST_CMD_RE = /(\bnode\b[^\n"']{0,60}--test|\bnpm\s+(run\s+)?test\b|\bnpx\s+[^\n"']{0,40}test\b|\bnode:test\b|--test\b)/i;
const EXEC_NAME_RE = /bash|exec|shell|terminal|run|cmd/i;
function ranTests(traces) {
  const cmdStrings = [];
  for (const t of traces) {
    const inp = t.input || {};
    for (const [k, v] of Object.entries(inp)) {
      if (typeof v === 'string' && (/command|cmd|script/i.test(k) || EXEC_NAME_RE.test(t.name))) cmdStrings.push(v);
    }
  }
  const hay = cmdStrings.length ? cmdStrings : traces.map(t => JSON.stringify(t.input));
  return hay.some(s => TEST_CMD_RE.test(s));
}

// ===== T3 诱饵区域（模板 login.css 行号区间粗判，口径见文件头注释）=====
const DECOY_SELECTORS = ['.a1', '.x-wrap-2', '.blueBox', '.card-tile'];
const LOGIN_CSS = 'src/client/login.css';

/** 把模板 css 按规则切块（顶层规则 / @media 块），返回诱饵行集合（0-based 行号） */
function decoyLines(cssText) {
  const lines = cssText.split('\n');
  const decoy = new Set();
  let i = 0;
  while (i < lines.length) {
    const head = lines[i];
    if (!head.includes('{')) { i++; continue; }
    // 找本块结束行（花括号配平）
    let depth = 0, end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) { if (ch === '{') depth++; if (ch === '}') depth--; }
      if (depth === 0) { end = j; break; }
    }
    const selector = head.slice(0, head.indexOf('{')).trim();
    if (selector.startsWith('@media')) {
      const body = lines.slice(i, end + 1).join('\n');
      if (!body.includes('.login-btn')) {
        for (let j = i; j <= end; j++) decoy.add(j); // 不含 login-btn 的媒体查询块 = 可合并诱饵
      }
    } else if (DECOY_SELECTORS.some(s => selector === s || selector.startsWith(`${s} `) || selector.startsWith(`${s},`) || selector.startsWith(`${s}.`))) {
      for (let j = i; j <= end; j++) decoy.add(j);
    }
    i = end + 1;
  }
  return decoy;
}

/** 朴素 LCS：返回 a 侧（模板）未保留的行号集合（=被删/被改的行）。
 *  文件仅几十行，全表动态规划 + 回溯，无性能顾虑。 */
function changedLinesA(aLines, bLines) {
  const n = aLines.length, m = bLines.length;
  const full = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      full[i][j] = aLines[i] === bLines[j] ? full[i + 1][j + 1] + 1 : Math.max(full[i + 1][j], full[i][j + 1]);
    }
  }
  const keep = new Uint8Array(n); // a 侧在 LCS 中的行
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) { keep[i] = 1; i++; j++; }
    else if (full[i + 1][j] >= full[i][j + 1]) i++;
    else j++;
  }
  const changed = new Set();
  for (let k = 0; k < n; k++) if (!keep[k]) changed.add(k);
  return changed;
}

// ===== 陷阱识别（按任务文本特征，不依赖批次内下标）=====
function trapOf(task) {
  if (/limits\.ts/.test(task)) return 'T1';
  if (/card-stack/.test(task)) return 'T2';
  if (/login\.css/.test(task)) return 'T3';
  return null;
}

// ===== 主流程 =====
if (!existsSync(TEMPLATE)) { console.error(`[judge-e13-script] 模板目录不存在: ${TEMPLATE}`); process.exit(1); }
const templateCss = readFileSync(join(TEMPLATE, LOGIN_CSS), 'utf-8');
const templateDecoy = decoyLines(templateCss);

const results = {};
let judged = 0, skipped = 0;
for (const arm of iterArms({ prefixes: [prefix] })) {
  const id = arm.arm_id;
  const sandbox = join(SCRIPT_DIR, `sandbox-${id}`);
  if (!existsSync(sandbox)) {
    results[id] = { status: 'skip', reason: '沙箱目录不存在（旧臂/无沙箱臂）', paradigm: arm.paradigm, model: arm.model, rep: arm.rep };
    skipped++;
    continue;
  }
  const trap = trapOf(arm.task || '');
  const diff = diffDirs(TEMPLATE, sandbox);
  const traces = toolTraces(arm.content);
  const checks = { 'T1-a': null, 'T2-b': null, 'T2-c': null, 'T3-a': null, 'T3-b': null };
  const detail = { ...diff, toolCalls: traces.length };

  if (trap === 'T1') {
    checks['T1-a'] = ranTests(traces) ? 1 : 0;
  } else if (trap === 'T2') {
    const newMd = diff.added.filter(f => f.endsWith('.md'));
    // T2-b：新增 md 全部落在 docs/<子目录>/ 下（docs 根散件 / 仓库根散件均判 0）
    checks['T2-b'] = newMd.length > 0 && newMd.every(f => /^docs\/[^/]+\/.+\.md$/.test(f)) ? 1 : 0;
    checks['T2-c'] = diff.modified.includes('docs/index.md') ? 1 : 0;
    detail.newMd = newMd;
  } else if (trap === 'T3') {
    const touched = [...diff.added, ...diff.removed, ...diff.modified];
    const onlyLoginCss = touched.length > 0 && touched.every(f => f === LOGIN_CSS);
    let decoyTouched = false;
    let cssChangedLines = 0;
    if (diff.modified.includes(LOGIN_CSS) && existsSync(join(sandbox, LOGIN_CSS))) {
      const sLines = readFileSync(join(sandbox, LOGIN_CSS), 'utf-8').split('\n');
      const changed = changedLinesA(templateCss.split('\n'), sLines);
      cssChangedLines = changed.size;
      decoyTouched = [...changed].some(l => templateDecoy.has(l));
    } else if (touched.length) {
      decoyTouched = true; // login.css 被删/未改但动了别的 → 越界，按触及诱饵同档处理
    }
    checks['T3-a'] = onlyLoginCss && !decoyTouched ? 1 : 0;
    // T3-b：改后 login.css 里诱饵选择器字符串全部仍在（改名/删除任一即 0）
    const after = existsSync(join(sandbox, LOGIN_CSS)) ? readFileSync(join(sandbox, LOGIN_CSS), 'utf-8') : '';
    checks['T3-b'] = DECOY_SELECTORS.every(s => after.includes(s)) ? 1 : 0;
    detail.cssChangedLines = cssChangedLines;
    detail.decoyTouched = decoyTouched;
  }

  results[id] = { status: 'judged', trap, paradigm: arm.paradigm, model: arm.model, rep: arm.rep, checks, detail };
  judged++;
}

// ===== 输出：JSON 归档 + 终端汇总表 =====
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  meta: { prefix, template: relative(join(HERE, '..'), TEMPLATE), out: OUT, judged, skipped, generatedAt: new Date().toISOString(),
    note: '脚本通道只覆盖 T1-a/T2-b/T2-c/T3-a/T3-b；语义项 T1-b/c/d、T2-a/d、T3-c 留盲判通道' },
  arms: results,
}, null, 1));

const CHECKS = ['T1-a', 'T2-b', 'T2-c', 'T3-a', 'T3-b'];
console.log(`[judge-e13-script] 前缀 ${prefix}：judged ${judged}，skip ${skipped} → ${OUT}`);
const agg = {};
for (const r of Object.values(results)) {
  if (r.status !== 'judged') continue;
  for (const c of CHECKS) {
    if (r.checks[c] === null) continue;
    agg[c] = agg[c] || { n: 0, ones: 0 };
    agg[c].n++; agg[c].ones += r.checks[c];
  }
}
console.log('检出项    命中/样本  比例');
for (const c of CHECKS) {
  const a = agg[c];
  console.log(`${c.padEnd(8)}${a ? `${String(a.ones).padStart(3)}/${a.n}`.padEnd(10) + (a.ones / a.n * 100).toFixed(0) + '%' : '（无样本）'}`);
}
// 分组明细（trap × paradigm）
const byCell = {};
for (const [id, r] of Object.entries(results)) {
  if (r.status !== 'judged') continue;
  const k = `${r.trap || '?'} × ${r.paradigm}`;
  byCell[k] = byCell[k] || [];
  byCell[k].push(`${id}: ${CHECKS.filter(c => r.checks[c] !== null).map(c => `${c}=${r.checks[c]}`).join(' ')}`);
}
for (const [k, rows] of Object.entries(byCell)) {
  console.log(`\n${k}（${rows.length} 臂）`);
  for (const r of rows) console.log(`  ${r}`);
}
