#!/usr/bin/env node
/**
 * semantic-chain.mjs — 语义巡逻总 runner（腿三，STACK #3，2026-07-30 用户拍板）
 *
 * 职责：定时跑腿一探针集群 → 产出聚合成单结论 → 投信箱 → 走人。
 * 裁决与修复不归它管（自动化边界 = 检测；verdict 门控注意力不门控合并——
 * 永远 exit 0 含 ⚠️/💀，注意力信号不是构建失败）。
 *
 * 三态 verdict：
 *   ✅ 干净       — 本轮 0 新发现（含全 SKIP 的「文档没动」情形，行内注明跑/跳数）
 *   ⚠️ N 条待裁决 — 新发现进 state，信箱行指向裁决流 workflows/semantic-audit.yaml
 *   💀 退化       — 腿一 exit 2（全部任务失败/provider 链挂了），本轮结论无效
 *
 * --with-bench：顺带跑变异基准（尺校准，invariants #32——尺要定期证明自己能报病），
 *   成绩单摘要行追加进信箱。基准全量有 API 成本，建议 cron 每周一次带此 flag。
 *
 * 信箱：docs/ledger/semantic-chain-inbox.md（append-only，一行一轮）。
 *   新会话 agent 读到 ⚠️ 行 → 进裁决流；未裁决发现下轮会重复出现——特性，
 *   注意力门控靠反复提醒兑现（已裁决的由腿一登记豁免抑制，不重复）。
 *
 * 用法：node scripts/agent/semantic-chain.mjs [--with-bench]
 * exit 0 = 巡逻完成（任何 verdict）；exit 2 = 脚本自身环境失败（state 不可读等）
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const STATE_PATH = join(REPO, 'docs/ledger/semantic-audit-state.json');
const INBOX_PATH = join(REPO, 'docs/ledger/semantic-chain-inbox.md');
const NODE = process.execPath;
const WITH_BENCH = process.argv.includes('--with-bench');

const INBOX_HEADER = `# 语义巡逻信箱（semantic-chain.mjs 自动写入，append-only）
> 这是什么：腿三巡逻的逐轮结论。agent 会话启动时读尾部——⚠️ 行进 workflows/semantic-audit.yaml 裁决流。
> 别的去哪找：发现明细 → semantic-audit-state.json；裁决记录 → semantic-provenance.md；巡逻脚本 → scripts/agent/semantic-chain.mjs。

`;

function inbox(line) {
  if (!existsSync(INBOX_PATH)) writeFileSync(INBOX_PATH, INBOX_HEADER);
  appendFileSync(INBOX_PATH, line + '\n');
  console.log(`[semantic-chain] 信箱 ← ${line}`);
}

function run(cmdArgs, label) {
  try {
    const out = execFileSync(NODE, cmdArgs, { cwd: REPO, encoding: 'utf-8', stdio: ['ignore', 'inherit', 'inherit'] });
    return { code: 0, out: out || '' };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '').toString() };
  }
}

const now = new Date();
// 本地时间戳（toISOString 是 UTC，与 ledger 其他条目的本地口径不一致，2026-07-30 首跑教训）
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

// ---- 腿一：探针集群（增量模式——文档没动则全 SKIP 零 API 调用，是每日巡逻的成本基础） ----
console.log('[semantic-chain] 腿一巡逻开始');
const audit = run(['scripts/agent/semantic-audit.mjs'], 'audit');

let verdict;
if (audit.code === 2) {
  verdict = `💀 退化——腿一全部任务失败（provider 链异常？），本轮结论无效，需人工看一眼`;
} else {
  let state;
  try {
    state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch (e) {
    console.error(`[semantic-chain] state 不可读：${e.message}`);
    process.exit(2);
  }
  const last = state.runs?.[state.runs.length - 1];
  if (!last) {
    console.error('[semantic-chain] state.runs 为空，腿一可能没跑成');
    process.exit(2);
  }
  // 全量未裁决数 = 各任务 keptFindings 之和（重跑刷新、跳过保留）——增量模式下
  // 只看本轮会把未裁决发现吞掉；修复（哈希变→重跑→消失）或豁免登记（prompt 抑制）才消除
  const pending = [];
  for (const [taskId, t] of Object.entries(state.tasks || {})) {
    for (const f of t.keptFindings || []) pending.push({ task: taskId, ...f });
  }
  const seenKeys = new Set();
  const pendingDedup = pending.filter((f) => {
    const k = `${f.type}|${f.claim}|${f.against}`;
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });
  const n = pendingDedup.length;
  const newThisRun = last.kept ?? 0;
  // 按码分布（喂结晶回路：同码复发计数——变体级 ≥3 → 机械化候选，≥2 且 SEM900 → 变体提案）
  const byCode = new Map();
  for (const f of pendingDedup) byCode.set(f.type || 'SEM900', (byCode.get(f.type || 'SEM900') || 0) + 1);
  const codeDist = [...byCode.entries()].sort((a, b) => b[1] - a[1]).map(([c, n2]) => `${c}×${n2}`).join(' ');
  const mechCandidates = [...byCode.entries()].filter(([, n2]) => n2 >= 3).map(([c]) => c);
  const variantCandidates = [...byCode.entries()].filter(([c, n2]) => c === 'SEM900' && n2 >= 2).map(([, n2]) => `${n2} 条`);
  verdict = n === 0
    ? `✅ 干净（跑 ${last.ran} 跳 ${last.skipped}，幻觉拦截 ${last.dropped}）`
    : `⚠️ ${n} 条待裁决（${codeDist}；本轮新增 ${newThisRun}，跑 ${last.ran} 跳 ${last.skipped}，幻觉拦截 ${last.dropped}）→ 明细见 semantic-audit-state.json 各任务 keptFindings，裁决流 workflows/semantic-audit.yaml`;
  if (mechCandidates.length) verdict += `；机械化候选（≥3 次）：${mechCandidates.join('/')}`;
  if (variantCandidates.length) verdict += `；变体提案候选（SEM900×${variantCandidates[0]}，走裁决流）`;
}
inbox(`- ${stamp} ${verdict}`);

// ---- 变异基准（可选，尺校准） ----
if (WITH_BENCH && audit.code !== 2) {
  console.log('[semantic-chain] 变异基准校准开始');
  try {
    const out = execFileSync(NODE, ['scripts/agent/semantic-bench.mjs', '--conc=10'], {
      cwd: REPO, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'],
    });
    const scoreLine = out.split('\n').find((l) => l.includes('召回（并集）'));
    inbox(`- ${stamp} 📏 基准校准：${scoreLine ? scoreLine.trim() : '成绩单行未捕获，见 /var/log/semantic-chain.log'}`);
  } catch (e) {
    inbox(`- ${stamp} 📏 基准校准失败（exit ${e.status ?? '?'}）——尺的状态不明，需人工看一眼`);
  }
}

console.log(`[semantic-chain] 巡逻完成：${verdict}`);
process.exit(0);
