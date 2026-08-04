#!/usr/bin/env node
/**
 * semantic-chain.mjs — 语义巡逻总 runner（腿三，STACK #3，2026-07-30 用户拍板）
 *
 * 职责：定时跑腿一探针集群 → 产出聚合成单结论 → 投信箱 → 走人。
 * 裁决与修复不归它管（自动化边界 = 检测；verdict 门控注意力不门控合并——
 * 永远 exit 0 含 ⚠️/💀，注意力信号不是构建失败）。
 *
 * verdict 家族：
 *   ✅ 干净       — 本轮 0 新发现（含全 SKIP 的「文档没动」情形，行内注明跑/跳数）
 *   ⚠️ N 条待裁决 — 新发现进 state，信箱行指向裁决流 workflows/semantic-audit.yaml
 *   💀 退化       — 腿一 exit 2（全部任务失败/provider 链挂了），本轮结论无效
 *   💀 崩溃/环境  — runner 自身异常（08-03 未定义变量事故生 BAR-SEMCHAIN-01）：崩溃也投
 *                   信箱——信箱是永远有输出的信道，沉默不允许（心跳 check 兜底）
 *
 * --with-bench：顺带跑变异基准（尺校准，invariants #32——尺要定期证明自己能报病），
 *   成绩单摘要行追加进信箱。基准全量有 API 成本，建议 cron 每周一次带此 flag。
 *
 * 信箱：docs/ledger/semantic-chain-inbox.md（append-only，一行一轮）。
 *   新会话 agent 读到 ⚠️ 行 → 进裁决流；未裁决发现下轮会重复出现——特性，
 *   注意力门控靠反复提醒兑现（已裁决的由腿一登记豁免抑制，不重复）。
 *
 * 用法：node scripts/agent/semantic-chain.mjs [--with-bench]
 * exit 0 = 巡逻完成（任何 verdict）；exit 2 = 脚本自身失败（崩溃/state 不可读——信箱已留痕）
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const REPO = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const STATE_PATH = join(REPO, 'docs/ledger/semantic-audit-state.json');
const INBOX_PATH = join(REPO, 'docs/ledger/semantic-chain-inbox.md');
const METRIC_PATH = join(homedir(), '.kfmv4', 'semantic-chain-metrics.jsonl'); // F5 记录层（2026-08-04）：巡逻耗时/成败账本，长期跑收集
let _inboxCount = 0;
function recordMetric(ok, fail) {
  try {
    appendFileSync(METRIC_PATH, JSON.stringify({ ts: new Date().toISOString(), ms: Date.now() - t0, ok, fail: fail || '', inboxLines: _inboxCount }) + '\n');
  } catch {}
}
const NODE = process.execPath;
const WITH_BENCH = process.argv.includes('--with-bench');

const INBOX_HEADER = `# 语义巡逻信箱（semantic-chain.mjs 自动写入，append-only）
> 这是什么：腿三巡逻的逐轮结论。agent 会话启动时读尾部——⚠️ 行进 workflows/semantic-audit.yaml 裁决流。
> 别的去哪找：发现明细 → semantic-audit-state.json；裁决记录 → semantic-provenance.md；巡逻脚本 → scripts/agent/semantic-chain.mjs。

`;

function inbox(line) {
  if (!existsSync(INBOX_PATH)) writeFileSync(INBOX_PATH, INBOX_HEADER);
  appendFileSync(INBOX_PATH, line + '\n');
  _inboxCount++;
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

const t0 = Date.now();
const now = new Date();
// 本地时间戳（toISOString 是 UTC，与 ledger 其他条目的本地口径不一致，2026-07-30 首跑教训）
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

let verdict;
let audit;
try {
  // ---- 腿一：探针集群（增量模式——文档没动则全 SKIP 零 API 调用，是每日巡逻的成本基础） ----
  console.log('[semantic-chain] 腿一巡逻开始');
  audit = run(['scripts/agent/semantic-audit.mjs'], 'audit');

  if (audit.code === 2) {
    verdict = `💀 退化——腿一全部任务失败（provider 链异常？），本轮结论无效，需人工看一眼`;
  } else {
    let state;
    try {
      state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    } catch (e) {
      throw new Error(`state 不可读：${e.message}`);
    }
    const last = state.runs?.[state.runs.length - 1];
    if (!last) throw new Error('state.runs 为空，腿一可能没跑成');
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
  // ---- 豁免新鲜度（2026-08-02：豁免不是永久静默——哈希失效 + review-by 到期） ----
  const exemptionStatus = checkExemptions();
  if (exemptionStatus) verdict += exemptionStatus;
  inbox(`- ${stamp} ${verdict}`);
  recordMetric(true);
} catch (e) {
  // 崩溃也投信箱：沉默不允许（08-03 未定义变量事故——runner 死了一天无人知晓，BAR-SEMCHAIN-01）
  inbox(`- ${stamp} 💀 崩溃——runner 异常：${e.message}。本轮无效，堆栈见 /var/log/semantic-chain.log，先修 runner 再谈裁决`);
  recordMetric(false, e.message);
  console.error(e);
  process.exit(2);
}

/** 豁免新鲜度检查：目标文件哈希变化 → 失效；临时豁免 review-by 到期 → 复核提醒 */
function checkExemptions() {
  const exPath = join(REPO, 'docs/ledger/semantic-exemptions.md');
  if (!existsSync(exPath)) return '';
  const lines = readFileSync(exPath, 'utf-8').split('\n');
  const today = new Date().toISOString().slice(0, 10);
  const due = [];
  const stale = [];
  const temp = [];
  let total = 0;
  for (const line of lines) {
    const m = /^\|\s*(EX-\d+)\s*\|[^|]*\|\s*([^|]+?)\s*\|[^|]*\|\s*([^|]*?)\s*\|[^|]*\|[^|]*\|\s*([0-9a-f]{40})/.exec(line);
    if (!m) continue;
    total++;
    const id = m[1];
    const targetFile = (m[2].split('（')[0].trim().split(':')[0] || '').trim();
    const reviewBy = m[3].trim();
    const regHash = m[4];
    if (reviewBy && reviewBy !== '—') {
      temp.push(id);
      if (reviewBy <= today) due.push(id);
    }
    if (targetFile && regHash) {
      try {
        const cur = createHash('sha1').update(readFileSync(join(REPO, targetFile))).digest('hex');
        if (cur !== regHash) stale.push(`${id}(${targetFile} 已变)`);
      } catch { stale.push(`${id}(${targetFile} 不可读)`); }
    }
  }
  if (!total) return '';
  const parts = [`豁免 ${total} 条（临时 ${temp.length}` + (due.length ? `，${due.length} 到期` : '') + '）'];
  if (due.length) parts.push(`⚠️ 复核到期：${due.join('/')}（走裁决流）`);
  if (stale.length) parts.push(`⚠️ 豁免失效（目标已变，将重新上报）：${stale.join('/')}`);
  return `；${parts.join('；')}`;
}

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
