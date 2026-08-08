#!/usr/bin/env node
// judge-trace.mjs — docprobe 机械判卷轨：轨迹 × 地面真相 → 三维指标
//
// 用法：
//   node experiments/docprobe/tools/judge-trace.mjs \
//     --session /root/.kfmv4/sessions/script/<id>.json \
//     --truth   /root/.kfmv4/experiments/docprobe/truth/<topic>.md
//
// 输出（stdout JSON）：
//   reachable      可达率：必中命中/必中总数 + 命中明细（含加分）
//   pathCompliance 路径合规：首个必中命中前是否读过 CLAUDE.md（指引牌起效）
//   cost           到达成本：首个必中命中前的工具调用数 / 总调用数 / 墙钟秒 / token
//
// 判定口径（与 design/design-docprobe.md §六一致，改口径 = 改设计文档并记修订）：
//   - 命中 = read 类工具调用的 input.path 归一化后以真相登记路径结尾
//     （剥掉 `:行-行` 后缀；grep/glob 不计命中，只计入成本）
//   - 合规 = 首个必中命中的调用序号之前，存在对 CLAUDE.md 的 read
//   - 成本 = 首个必中命中**之前**的工具调用数（不含命中这一次）

import { readFileSync } from 'node:fs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

const sessionPath = arg('session');
const truthPath = arg('truth');
if (!sessionPath || !truthPath) {
  console.error('need --session <archive.json> --truth <truth.md>');
  process.exit(2);
}

// ---------- 解析地面真相 ----------
const truth = readFileSync(truthPath, 'utf8');
const sec = truth.match(/## 应达文档集[\s\S]*?(?=\n## |$)/);
if (!sec) { console.error('truth 缺「## 应达文档集」节'); process.exit(2); }

const required = [];
const bonus = [];
let bucket = null;
for (const line of sec[0].split('\n')) {
  if (/必中/.test(line)) { bucket = required; continue; }
  if (/加分/.test(line)) { bucket = bonus; continue; }
  const m = line.match(/`([^`]+\.(?:md|mjs|ts|yaml|json))`/);
  if (m && bucket) bucket.push(m[1]);
}
if (!required.length) { console.error('truth 应达文档集必中为空'); process.exit(2); }

// ---------- 解析轨迹 ----------
const archive = JSON.parse(readFileSync(sessionPath, 'utf8'));
const norm = (p) => String(p || '').replace(/:\d+(-\d+)?$/, '').replace(/^\.\//, '');
// truth 文档路径允许 glob（如 docs/domains/*/contract.md 表「任一个域契约」）——
// 字面 endsWith 会把真实命中误判未中（w1 域契约题全臂误判事故）
const docMatcher = (docPath) => {
  if (!docPath.includes('*')) return (t) => t.endsWith(docPath);
  const re = new RegExp(docPath.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
  return (t) => re.test(t);
};
const requiredM = required.map((d) => ({ doc: d, match: docMatcher(d) }));
const bonusM = bonus.map((d) => ({ doc: d, match: docMatcher(d) }));
const resultText = (c) => {
  const r = c.result;
  if (typeof r === 'string') return r;
  if (Array.isArray(r)) return r.map((b) => b?.text || '').join('\n');
  return '';
};
const calls = [];
for (const msg of archive.messages || []) {
  for (const c of msg.content || []) {
    if (c.type === 'tool') {
      calls.push({
        name: c.name,
        target: norm(c.input?.path || c.input?.pattern || ''),
        ts: msg.ts || null,
        // 读监狱/写监狱扼点拒绝（result 含「沙箱限制」）——逃逸尝试 ≠ 到达，
        // 矩阵判卷须区分「试图越界被拦」与「真的读到了」
        refused: resultText(c).includes('沙箱限制'),
      });
    }
  }
}

const touches = (call, match) =>
  call.name === 'read' && !call.refused && match(call.target.replace(/\\/g, '/'));

// ---------- 指标 ----------
const hitDetail = [];
let firstRequiredIdx = -1;
for (const { doc, match } of requiredM) {
  const idx = calls.findIndex((c) => touches(c, match));
  hitDetail.push({ doc, kind: 'required', hit: idx >= 0, callIndex: idx >= 0 ? idx : null });
  if (idx >= 0 && (firstRequiredIdx < 0 || idx < firstRequiredIdx)) firstRequiredIdx = idx;
}
for (const { doc, match } of bonusM) {
  const idx = calls.findIndex((c) => touches(c, match));
  hitDetail.push({ doc, kind: 'bonus', hit: idx >= 0, callIndex: idx >= 0 ? idx : null });
}

const claudeIdx = calls.findIndex((c) => touches(c, docMatcher('CLAUDE.md')));
const compliant = firstRequiredIdx >= 0 && claudeIdx >= 0 && claudeIdx < firstRequiredIdx;

const tsList = calls.map((c) => c.ts).filter(Boolean).map((t) => Date.parse(t));
const wallSec = tsList.length >= 2 ? (Math.max(...tsList) - Math.min(...tsList)) / 1000 : null;

const out = {
  session: archive.id || sessionPath,
  model: archive.modelId || null,
  truth: truthPath,
  reachable: {
    requiredHit: hitDetail.filter((h) => h.kind === 'required' && h.hit).length,
    requiredTotal: required.length,
    bonusHit: hitDetail.filter((h) => h.kind === 'bonus' && h.hit).length,
    bonusTotal: bonus.length,
    detail: hitDetail,
  },
  pathCompliance: {
    claudeReadIndex: claudeIdx >= 0 ? claudeIdx : null,
    firstRequiredHitIndex: firstRequiredIdx >= 0 ? firstRequiredIdx : null,
    compliant,
    note: compliant
      ? 'CLAUDE.md 路由起效'
      : firstRequiredIdx < 0
        ? '未到达，合规不适用'
        : claudeIdx < 0
          ? '裸 grep/glob 撞中，指引牌失效'
          : '先撞中后补读 CLAUDE.md，指引牌未起效',
  },
  cost: {
    callsBeforeFirstHit: firstRequiredIdx >= 0 ? firstRequiredIdx : null,
    totalCalls: calls.length,
    escapeAttempts: calls.filter((c) => c.refused).length,
    wallSec,
    fullTokenCount: archive.fullTokenCount ?? null,
  },
  callSequence: calls.map((c, i) => `${i}:${c.name}(${c.target})${c.refused ? '[拒]' : ''}`),
};

console.log(JSON.stringify(out, null, 2));
