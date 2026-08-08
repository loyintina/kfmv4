#!/usr/bin/env node
// probe-capability.mjs — 落成门探头（docprobe 终局形态 v1）
//
// 用途：capability-map 登记行 → 现场生成地面真相（不落 truth 文件进仓）→
//   跑 N 臂（默认 4，DS v4-flash，readRoot 监狱协议）→ judge-trace 机械判 →
//   写 docs/ledger/probe-state.json 账本 + 臂归档入私有区 + 回写 index.md 自动区块。
//
// 判定口径（与 design/design-docprobe.md §八「落成门」一致，改口径 = 改设计文档并记修订）：
//   - 单臂「到达」= read 类调用命中应达文档集**任一**路径
//     （主入口 path，或有 domain 时 docs/domains/<domain>/*.md glob——judge-trace
//       required 数组是 AND 计数，本脚本从其 JSON 输出的 detail 自算「任一」）
//   - 行「通过」= 到达臂数 >= threshold（默认 4 中 2）
//
// 用法：
//   node experiments/docprobe/tools/probe-capability.mjs --capability 守视（browser-relay）
//   node experiments/docprobe/tools/probe-capability.mjs --all
//   可选：--arms 4 --threshold 2 --provider deepseek --model deepseek-v4-flash --dry-run

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runSession } from '/root/kfmv4/experiments/paradigm/tools/session-runner.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DATA_HOME = process.env.KFM_DATA_HOME || join(homedir(), '.kfmv4');
const MANIFEST = join(REPO_ROOT, 'scripts', 'capability-map.manifest.json');
const STATE_FILE = join(REPO_ROOT, 'docs', 'ledger', 'probe-state.json');
const INDEX_MD = join(REPO_ROOT, 'experiments', 'docprobe', 'index.md');
const JUDGE_TRACE = join(REPO_ROOT, 'experiments', 'docprobe', 'tools', 'judge-trace.mjs');
const SESS_DIR = join(DATA_HOME, 'experiments', 'docprobe', 'sessions');

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const gets = (k) => {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === `--${k}`) out.push(argv[i + 1]);
  return out;
};
const get = (k) => gets(k)[0];
const ALL = argv.includes('--all');
const DRY = argv.includes('--dry-run');
const ARMS = Number(get('arms') || 4);
const THRESHOLD = Number(get('threshold') || 2);
const PROVIDER = get('provider') || 'deepseek';
const MODEL = get('model') || 'deepseek-v4-flash';
const ROLE = 'kfm-dev';

if (!ALL && gets('capability').length === 0) {
  console.error('用法: --capability <名>（可多次）| --all [--arms N] [--threshold N] [--dry-run]');
  process.exit(2);
}

// ---------- manifest ----------
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const wanted = gets('capability');
const rows = manifest.capabilities.filter((c) => ALL || wanted.includes(c.name));
if (wanted.length && rows.length !== wanted.length) {
  const found = new Set(rows.map((r) => r.name));
  console.error('manifest 无此行: ' + wanted.filter((w) => !found.has(w)).join(' / '));
  process.exit(2);
}
if (!rows.length) { console.error('无可探测行'); process.exit(2); }

// ---------- 真相现场生成 ----------
function genTruth(cap) {
  const required = [`- \`${cap.path}\``];
  if (cap.domain) required.push(`- \`docs/domains/${cap.domain}/*.md\``);
  const bonus = cap.domain ? [`- \`docs/domains/${cap.domain}/code-map.md\``] : [];
  return `# 落成门探头地面真相（自动生成，一次性）：${cap.name}

## 冻结题目

\`\`\`
kfmv4 有一个${cap.name}，你觉得它如何？
\`\`\`

## 应达文档集

必中（任一命中即达）：
${required.join('\n')}
${bonus.length ? `\n加分：\n${bonus.join('\n')}` : ''}

## 理解要点

（机械轨不判——落成门 v1 只测可达，理解准确度留定期波次盲判轨）

## 幻觉陷阱

（机械轨不判）
`;
}

// ---------- probe-state 账本 ----------
function loadState() {
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  return {
    $comment: '落成门探头账本（probe-capability.mjs 自动维护，勿手改）。判定：单臂 read 命中应达文档集任一路径=到达；arms 中 >= threshold 到达=通过。check-probe-state.mjs 消费：每个 capability 行须 pass=true 且 probedAt 新于 manifest 最后改动。',
    model: MODEL, provider: PROVIDER, arms: ARMS, threshold: THRESHOLD,
    capabilities: {},
  };
}

function saveState(state) {
  // 按 manifest 顺序重排 capabilities（未知 key 排尾），保持 diff 可读
  const order = manifest.capabilities.map((c) => c.name);
  const sorted = {};
  for (const name of order) if (state.capabilities[name]) sorted[name] = state.capabilities[name];
  for (const k of Object.keys(state.capabilities)) if (!sorted[k]) sorted[k] = state.capabilities[k];
  state.capabilities = sorted;
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// ---------- index.md 自动区块（check-experiment-index 双向机检要求每臂有登记行）----------
function rewriteIndexBlock(state) {
  if (!existsSync(INDEX_MD)) return;
  const BEGIN = '<!-- probe-gate:begin -->';
  const END = '<!-- probe-gate:end -->';
  const src = readFileSync(INDEX_MD, 'utf8');
  if (!src.includes(BEGIN) || !src.includes(END)) return; // 未埋点则不动（埋点由落成门实装提交带入）
  const lines = [BEGIN, '', '| 臂 | 功能 | 状态 | 数据 |', '|---|---|---|---|'];
  for (const [name, rec] of Object.entries(state.capabilities)) {
    for (const arm of rec.arms || []) {
      lines.push(`| ${arm.id} | ${name} 落成门 | ${arm.reached ? '到达' : '未达'} | sessions/${arm.id}.json |`);
    }
  }
  lines.push('', END);
  const out = src.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}`), lines.join('\n'));
  writeFileSync(INDEX_MD, out);
}

// ---------- 单臂 ----------
async function runArm(cap, armIdx, ts) {
  const slug = createHash('md5').update(cap.name).digest('hex').slice(0, 8);
  const id = `gate-${slug}-${armIdx}-${ts}`;
  const question = `kfmv4 有一个${cap.name}，你觉得它如何？`;
  const sessFile = join(SESS_DIR, `${id}.json`);
  try {
    await runSession({
      sessionId: id,
      messages: [{ role: 'user', content: [{ type: 'text', text: question }] }],
      userText: question,
      model: MODEL, provider: PROVIDER, roleFile: ROLE,
      out: sessFile, readRoot: REPO_ROOT,
    });
  } catch (e) {
    return { id, reached: false, error: String(e.message || e).slice(0, 200) };
  }
  // 机械判（judge-trace 输出 JSON；「任一命中」由 detail 自算）
  // 判卷崩溃 = 臂失败（不拖垮整批——归档格式异常是个体事件，见 §九 null content 事件）
  const truthFile = join(tmpdir(), `probe-truth-${slug}.md`);
  try {
    const raw = execFileSync(process.execPath, [JUDGE_TRACE, '--session', sessFile, '--truth', truthFile], { encoding: 'utf8' });
    const judged = JSON.parse(raw);
    const reached = judged.reachable.detail.some((d) => d.kind === 'required' && d.hit);
    return {
      id, reached,
      requiredHit: judged.reachable.requiredHit,
      requiredTotal: judged.reachable.requiredTotal,
      callsBeforeFirstHit: judged.cost.callsBeforeFirstHit,
      escapeAttempts: judged.cost.escapeAttempts,
    };
  } catch (e) {
    return { id, reached: false, error: `judge 失败: ${String(e.message || e).slice(0, 150)}` };
  }
}

// ---------- 主流程 ----------
if (DRY) {
  for (const cap of rows) {
    console.log(`[dry] ${cap.name} → 题「kfmv4 有一个${cap.name}，你觉得它如何？」必中: ${cap.path}${cap.domain ? ` + docs/domains/${cap.domain}/*.md` : ''}`);
  }
  console.log(`[dry] 共 ${rows.length} 行 × ${ARMS} 臂 = ${rows.length * ARMS} 臂，阈值 ${THRESHOLD}/${ARMS}`);
  process.exit(0);
}

mkdirSync(SESS_DIR, { recursive: true });
const state = loadState();
state.model = MODEL; state.provider = PROVIDER; state.arms = ARMS; state.threshold = THRESHOLD;
const commit = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim(); } catch { return null; } })();

let passCount = 0, failCount = 0;
for (const cap of rows) {
  const slug = createHash('md5').update(cap.name).digest('hex').slice(0, 8);
  const truthFile = join(tmpdir(), `probe-truth-${slug}.md`);
  writeFileSync(truthFile, genTruth(cap));
  const ts = Date.now().toString(36);
  console.log(`[probe] ${cap.name} — ${ARMS} 臂并发中…`);
  const t0 = Date.now();
  const arms = await Promise.all(Array.from({ length: ARMS }, (_, i) => runArm(cap, i + 1, ts)));
  const reached = arms.filter((a) => a.reached).length;
  const pass = reached >= THRESHOLD;
  state.capabilities[cap.name] = {
    probedAt: new Date().toISOString(),
    commit,
    question: `kfmv4 有一个${cap.name}，你觉得它如何？`,
    reached, armsTotal: ARMS, pass,
    arms: arms.map(({ id, reached, error }) => (error ? { id, reached, error } : { id, reached })),
  };
  saveState(state); // 逐行落账：中断不丢已完成探测
  rewriteIndexBlock(state);
  console.log(`[probe] ${cap.name}: ${reached}/${ARMS} 到达 → ${pass ? 'PASS' : 'FAIL'}（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
  pass ? passCount++ : failCount++;
}

console.log(`[probe] 完成：${passCount} 过 / ${failCount} 不过 → ${STATE_FILE}`);
process.exit(failCount ? 1 : 0);
