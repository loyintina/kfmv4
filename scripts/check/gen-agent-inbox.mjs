#!/usr/bin/env node
/**
 * gen-agent-inbox.mjs — 信箱台账投影生成器 + 归属行扫描器（2026-08-18 D3 落地，
 * agent-mailbox 研究线；上游 = nine-zero-phase2-contracts.md 契约 3「信封四字段 +
 * 归属行扫描器」+ experiments/agent-mailbox/design/d3-ledger-generation.md）。
 *
 * 活源头 = 信件文首引用块内的机读头七字段（人读即机读，单语法）：
 *   > 日期: YYYY-MM-DD      > 致: <线名或 all>     > 流型: 链条|征集|汇总|线程
 *   > 预期表态方: ...        > 收敛判据: ...        > 回: <台账「回哪条」列原文>
 *   > 状态: <台账「状态」列原文>
 * README 信件清单表格是机读头的生成投影——手写必漂移（2026-08-18 审计三型实锤），
 * 生成不漂移（与 experiments 清单 / code-inventory 同模式）。机读头解析规则与
 * check-agent-inbox.mjs 保持一致（两脚本各自内联，改动需同步）。
 *
 * 用法：
 *   node scripts/check/gen-agent-inbox.mjs               # 回写 README gen 区段
 *   node scripts/check/gen-agent-inbox.mjs --check-only  # 校验漂移（挂检查链）
 *   node scripts/check/gen-agent-inbox.mjs --for=kfm-na  # 归属行扫描：列该线欠账
 * 支持 KFM_PROBE_ROOT 注入（check-probes 夹具）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.KFM_PROBE_ROOT || ROOT;
const INBOX = join(BASE, 'docs', 'ledger', 'agent-inbox');
const README = join(INBOX, 'README.md');

const MARK_START = '<!-- gen:agent-inbox:start -->';
const MARK_END = '<!-- gen:agent-inbox:end -->';

const FIELDS = ['日期', '致', '流型', '预期表态方', '收敛判据', '回', '状态'];
const FIELD_RE = /^>\s*(日期|致|流型|预期表态方|收敛判据|回|状态)\s*[:：]\s*(.+?)\s*$/;

/** 解析一封信的机读头：只扫文首第一个引用块；同名字段取最后一次出现
 *  （存量信旧头注可能含全角「回：」「状态：」行，新机读头在块尾，后者为准）。
 *  check-agent-inbox.mjs 内联同一份逻辑——改动需两处同步。 */
function parseHeader(text) {
  const lines = text.split('\n');
  const start = lines.findIndex(l => l.startsWith('>'));
  if (start === -1) return null;
  let end = start;
  while (end + 1 < lines.length && lines[end + 1].startsWith('>')) end++;
  const header = {};
  for (let i = start; i <= end; i++) {
    const m = FIELD_RE.exec(lines[i]);
    if (m) header[m[1]] = m[2];
  }
  return header;
}

const args = process.argv.slice(2);
const checkOnly = args.includes('--check-only');
const forArg = args.find(a => a.startsWith('--for='));
const errors = [];

// ---------- 扫信 ----------
const letters = existsSync(INBOX)
  ? readdirSync(INBOX).filter(f => f.endsWith('.md') && f !== 'README.md').sort()
  : [];
const rows = [];
for (const f of letters) {
  const h = parseHeader(readFileSync(join(INBOX, f), 'utf-8'));
  const miss = !h ? FIELDS : FIELDS.filter(k => !(k in h));
  if (miss.length) {
    errors.push(`${f} 机读头缺字段：${miss.join('、')}——新信必填七字段（见 README 机读头 schema 条）`);
    continue;
  }
  rows.push({ file: f, ...h });
}
rows.sort((a, b) => a.日期.localeCompare(b.日期) || a.file.localeCompare(b.file));

// ---------- 归属行扫描器（契约 3 第一机械件：某线当前欠什么） ----------
if (forArg) {
  const line = forArg.slice('--for='.length);
  const debts = rows.filter(r => {
    const toks = r.致.split(/[，,、\s]+/).filter(Boolean);
    if (!toks.includes(line) && !toks.includes('all')) return false;
    return /^[^\p{L}\p{Script=Han}]*待/u.test(r.状态); // 剥 emoji/符号前缀后须以「待」开头
  });
  if (errors.length) {
    for (const e of errors) console.error(`[gen-agent-inbox] ${e}`);
    process.exit(1);
  }
  console.log(`[gen-agent-inbox] 归属行扫描：${line} 线当前欠账 ${debts.length} 封`);
  for (const d of debts) console.log(`  ${d.file} ｜ ${d.状态}`);
  process.exit(0);
}

// ---------- 拼表格 ----------
const lines = [MARK_START, '| 日期 | 信件 | 回哪条 | 状态 |', '|------|------|--------|------|'];
for (const r of rows) {
  lines.push(`| ${r.日期} | [\`${r.file}\`](${r.file}) | ${r.回} | ${r.状态} |`);
}
lines.push(MARK_END);
const section = lines.join('\n');

if (!existsSync(README)) {
  console.error('[gen-agent-inbox] docs/ledger/agent-inbox/README.md 不存在');
  process.exit(1);
}
const doc = readFileSync(README, 'utf-8');
const s = doc.indexOf(MARK_START);
if (s === -1) errors.push('README 缺 gen:agent-inbox 标记区段');
let next = doc;
if (s !== -1) {
  const e = doc.indexOf(MARK_END, s);
  if (e === -1) {
    errors.push('README gen:agent-inbox 标记区段缺 end');
  } else {
    next = doc.slice(0, s) + section + doc.slice(e + MARK_END.length);
  }
}

if (checkOnly) {
  if (next !== doc) errors.push('信件清单漂移（机读头与 README 台账不一致）');
} else if (next !== doc) {
  writeFileSync(README, next, 'utf-8');
}

// ---------- 投影回写：9.0 计数（公约②,2026-08-28 裁决归 na 代改） ----------
// 只准替换「N 封信」的数字,不动文件其他任何字节（防 gen 与人手编辑打架,
// 考题 test-gen-agent-inbox-projections.mjs 咬这一条）。check-only 模式下
// 投影漂移报错（与 README 台账漂移同待遇）。
const PROJECTIONS = [
  join(BASE, 'docs', 'active', 'nine-zero', '00-index.md'),
  join(BASE, 'docs', 'active', 'nine-zero', 'nine-zero-decision-index.md'),
];
for (const pj of PROJECTIONS) {
  if (!existsSync(pj)) continue;
  const orig = readFileSync(pj, 'utf-8');
  const nextP = orig.replace(/([0-9]+) 封信/g, `${rows.length} 封信`);
  if (nextP === orig) continue;
  if (checkOnly) {
    errors.push(`投影计数漂移:${pj.replace(BASE + '/', '')}——跑 node scripts/check/gen-agent-inbox.mjs 回写`);
  } else {
    writeFileSync(pj, nextP, 'utf-8');
  }
}

if (errors.length) {
  for (const e of errors) console.error(`[gen-agent-inbox] ${e}`);
  console.error(`[gen-agent-inbox] ${errors.length} 处问题` + (checkOnly ? '——跑 node scripts/check/gen-agent-inbox.mjs 回写' : ''));
  process.exit(1);
}
console.log(`[gen-agent-inbox] ${checkOnly ? `OK — ${rows.length} 封信台账投影与机读头一致` : `已回写信件清单（${rows.length} 封）`}`);
