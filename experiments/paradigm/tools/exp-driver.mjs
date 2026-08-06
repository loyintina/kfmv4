#!/usr/bin/env node
/**
 * exp-driver.mjs — 实验编排器：spec 文件驱动的「跑数重试循环 + 判卷」两段式流程
 *
 * 取代每个实验手写一份 run-*.sh 的做法（样板见 run-e13.sh）：把任务清单、
 * 重试轮数、完成判定、判卷调用全部收敛进一个 spec JSON，driver 统一执行。
 *
 * 用法：
 *   node experiments/paradigm/tools/exp-driver.mjs <spec.json>
 *   node experiments/paradigm/tools/exp-driver.mjs <spec.json> --check   # 只校验不点火
 *   （node:sqlite 在 node v22 免标志可用，仅一条 ExperimentalWarning，与
 *     run-e13.sh / arm-store.mjs 一致，无需 --experimental-sqlite）
 *
 * spec 结构：
 *   {
 *     "experiment": "e14",
 *     "prefix": "e14-",
 *     "retryRounds": 10,
 *     "runs": [
 *       {
 *         "taskFile": "experiments/paradigm/scenarios/e13-t1-verify.txt",
 *         "paradigms": "无,behavior-discipline",
 *         "models": "Qwen/Qwen3.6-35B-A3B,...",
 *         "provider": "硅基流动",
 *         "arms": 8,
 *         "concurrency": 2,
 *         "tools": "read,grep,glob,write",         // 可选，缺省 read,grep,glob
 *         "sandboxTemplate": "experiments/paradigm/fixtures/e13-sandbox-template", // 可选
 *         "plannedArms": 64   // = paradigms数 × models数 × arms，driver 校验，不等即报错退出
 *       }
 *     ],
 *     "judge": {              // 可选；存在则跑数结束后自动判卷
 *       "model": "deepseek-v4-flash",
 *       "provider": "deepseek",
 *       "rubric": "v2",
 *       "concurrency": 4,
 *       "out": "experiments/paradigm/meta-pool/judge-e14.json",
 *       "taskFiles": { "e14-t0": "experiments/paradigm/scenarios/e13-t1-verify.txt" }
 *       // 臂前缀 → 任务文件；judge-llm 的 --prefixes 与 --task-file 一一对应逐个调
 *     }
 *   }
 *
 * 设计决策与教训（继承 run-e13.sh 头部）：
 *   ① batch-run 幂等（语义三键查重），每轮全量重调零浪费，已归档臂自动跳过；
 *   ② runs 内串行、并发按 spec（e11 尸检：并行打满会触发 TPM 429 风暴）；
 *   ③ 完成判定只看 arms.db 实数，不看子进程退出码——被杀进程 exit 也可能是 0
 *     （血泪教训），退出码只用于记日志；
 *   ④ 子进程失败不中断整体循环，记日志进下一轮（断连/429 等瞬态故障靠重试自愈）；
 *   ⑤ plannedArms 由 spec 显式声明并与「paradigms数×models数×arms」乘积校验——
 *     防止 spec 笔误导致「永远到不齐」的空转烧轮次。
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const REPO = join(fileURLToPath(new URL('../../..', import.meta.url)));
const DB_PATH = join(homedir(), '.kfmv4', 'experiments', 'arms.db');
const ROUND_SLEEP_MS = 10_000; // 轮间间隔（e13 手写版是 120s，spec 化后收敛为 10s：batch-run 幂等，轮空转无成本，快轮次更快捕捉补齐）

const ts = () => new Date().toTimeString().slice(0, 8); // HH:MM:SS
const log = (msg) => console.log(`[exp-driver ${ts()}] ${msg}`);
const die = (msg) => { console.error(`[exp-driver ${ts()}] 错误: ${msg}`); process.exit(2); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- 读 spec + 校验 ----------
const specPath = process.argv[2];
if (!specPath) die('用法: node experiments/paradigm/tools/exp-driver.mjs <spec.json>');

let spec;
try {
  spec = JSON.parse(readFileSync(specPath, 'utf-8'));
} catch (e) {
  die(`spec 读取/解析失败: ${specPath}: ${e.message}`);
}

const prefix = spec.prefix;
if (!prefix) die('spec.prefix 必填（臂 id 前缀，如 "e14-"）');
const retryRounds = Number(spec.retryRounds || 10);
const runs = spec.runs;
if (!Array.isArray(runs) || !runs.length) die('spec.runs 必须是非空数组');

// plannedArms 校验：显式声明值必须等于 paradigms数 × models数 × arms
let plannedTotal = 0;
for (const [i, r] of runs.entries()) {
  const np = (r.paradigms || '无').split(',').filter(s => s.trim()).length;
  const nm = (r.models || 'deepseek-v4-flash').split(',').filter(s => s.trim()).length;
  const arms = Number(r.arms || 1);
  const product = np * nm * arms;
  if (Number(r.plannedArms) !== product) {
    die(`runs[${i}] plannedArms=${r.plannedArms} 与乘积不符：${np} 范式 × ${nm} 模型 × ${arms} 重复 = ${product}（spec 笔误会直接判「永远到不齐」，先改正再跑）`);
  }
  plannedTotal += product;
}
log(`spec 加载：${spec.experiment || '(未命名)'} prefix=${prefix} 计划 ${plannedTotal} 臂（${runs.length} 个 run），最多 ${retryRounds} 轮`);

// --check：只校验 spec 不点火（plannedArms 校验在上面已跑；这里打印明细后退出）
if (process.argv.includes('--check')) {
  runs.forEach((r, i) => log(`run[${i}] ${r.taskFile} | ${r.paradigms || '无'} | ${(r.models || '').split(',').length} 模型 × ${r.arms} 臂 = ${r.plannedArms}`));
  if (spec.judge) log(`judge: ${Object.keys(spec.judge.taskFiles || {}).join(', ')} → ${spec.judge.out}`);
  log('--check 通过，未点火');
  process.exit(0);
}

// ---------- arms.db 计数（只读；完成判定只看这里，不看退出码） ----------
function countArms() {
  try {
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    const total = db.prepare('SELECT COUNT(*) c FROM arms WHERE arm_id LIKE ?').get(`${prefix}%`).c;
    const byStatus = db.prepare('SELECT status, COUNT(*) c FROM arms WHERE arm_id LIKE ? GROUP BY status').all(`${prefix}%`);
    db.close();
    return { total, byStatus: byStatus.map(r => `${r.status}:${r.c}`).join(' ') };
  } catch (e) {
    return { total: -1, byStatus: `计数失败: ${e.message}` };
  }
}

// ---------- 跑数阶段 ----------
const splitList = (s, dflt) => (s || dflt).split(',').map(x => x.trim()).filter(Boolean);

for (let round = 1; round <= retryRounds; round++) {
  const before = countArms();
  log(`===== 第 ${round}/${retryRounds} 轮开始（已入库 ${before.total}/${plannedTotal}，${before.byStatus}）=====`);

  for (const [i, r] of runs.entries()) {
    const args = [
      join(REPO, 'experiments/paradigm/tools/batch-run.mjs'),
      '--task-file', r.taskFile,
      '--paradigms', r.paradigms || '无',
      '--models', r.models || 'deepseek-v4-flash',
      '--provider', r.provider || 'Opencode Go Google',
      '--arms', String(Number(r.arms || 1)),
      '--concurrency', String(Number(r.concurrency || 4)),
      '--prefix', prefix,
      '--retries', '4',
      '--tools', splitList(r.tools, 'read,grep,glob').join(','),
    ];
    if (r.sandboxTemplate) args.push('--sandbox-template', r.sandboxTemplate);
    log(`run[${i}] 调 batch-run: ${r.taskFile}`);
    const res = spawnSync('node', args, { stdio: 'inherit', cwd: REPO });
    if (res.error) log(`run[${i}] spawn 失败: ${res.error.message}（不中断，继续）`);
    else if (res.status !== 0) log(`run[${i}] batch-run 退出码 ${res.status}（不中断，继续；完成与否以 arms.db 实数为准）`);
  }

  const after = countArms();
  log(`===== 第 ${round} 轮结束：已入库 ${after.total}/${plannedTotal}（${after.byStatus}）=====`);
  if (after.total >= plannedTotal) {
    log(`${(spec.experiment || prefix).toUpperCase()}-ALL-DONE（${after.total}/${plannedTotal}）`);
    break;
  }
  if (round < retryRounds) {
    log(`未齐，${ROUND_SLEEP_MS / 1000}s 后第 ${round + 1} 轮`);
    await sleep(ROUND_SLEEP_MS);
  }
}

const final = countArms();
const complete = final.total >= plannedTotal;
if (!complete) log(`${(spec.experiment || prefix).toUpperCase()}-INCOMPLETE（${retryRounds} 轮后 ${final.total}/${plannedTotal}，人工看日志）`);

// ---------- 判卷阶段（spec.judge 存在时） ----------
if (spec.judge) {
  const j = spec.judge;
  const entries = Object.entries(j.taskFiles || {});
  if (!entries.length) die('spec.judge.taskFiles 必须是非空对象（臂前缀 → 任务文件）');
  log(`判卷阶段：${entries.length} 个臂前缀，out=${j.out || '(judge-llm 缺省路径)'}`);
  for (const [armPrefix, taskFile] of entries) {
    const args = [
      join(REPO, 'experiments/paradigm/tools/judge-llm.mjs'),
      '--prefixes', armPrefix,
      '--task-file', taskFile,
      '--judge-model', j.model || 'kimi-k3',
      '--judge-provider', j.provider || 'Opencode Go Google',
      '--rubric', j.rubric || 'v1',
      '--concurrency', String(Number(j.concurrency || 8)),
    ];
    if (j.out) args.push('--out', j.out);
    log(`judge: --prefixes ${armPrefix} --task-file ${taskFile}`);
    const res = spawnSync('node', args, { stdio: 'inherit', cwd: REPO });
    if (res.error) log(`judge ${armPrefix} spawn 失败: ${res.error.message}（继续下一个）`);
    else if (res.status !== 0) log(`judge ${armPrefix} 退出码 ${res.status}（继续下一个）`);
  }
  log('判卷阶段结束');
}

process.exit(complete ? 0 : 1);
