#!/usr/bin/env node
/**
 * judge-batch.mjs — coldstart 判卷批量驱动（走 agent-runner 的 provider 兜底链，
 * 判卷官=deepseek-v4-flash @ opencode go，不烧 Kimi 配额）。
 *
 * 用法：
 *   node experiments/coldstart/tools/judge-batch.mjs --batch 0   # 第 0 批（31 臂）
 *   node experiments/coldstart/tools/judge-batch.mjs --all       # 全部（断点续跑）
 *   node experiments/coldstart/tools/judge-batch.mjs --arm hy3   # 单臂
 *
 * 特性：并发上限 4；已有合法评分卡的臂自动跳过（可中断续跑）；
 * 失败臂记 derived/scores/_errors.log，不中断整批。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { runAgent, extractJson } from '../../../scripts/agent/agent-runner.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DERIVED = join(homedir(), '.kfmv4', 'experiments', 'coldstart', 'derived');
const SCORES = join(DERIVED, 'scores');
const BATCH_SIZE = 31;
const CONCURRENCY = 4;

mkdirSync(SCORES, { recursive: true });

const judgeSpec = readFileSync(join(REPO, 'experiments/coldstart/prompts/judge-v1.md'), 'utf-8');
const rubric = readFileSync(join(REPO, 'experiments/coldstart/rubric.md'), 'utf-8');
const groundTruth = readFileSync(join(REPO, 'experiments/coldstart/ground-truth.md'), 'utf-8');
const arms = JSON.parse(readFileSync(join(DERIVED, 'arms.json'), 'utf-8'));

function buildPrompt(armId) {
  const arm = arms.find(a => a.armId === armId) || {};
  const epoch = (arm.createdAt || '') < '2026-08-01T02:33' ? 'A' : 'B';
  const epochNote = epoch === 'A'
    ? '时代 A：试卷基线 50badfa——commits 1816 / 测试 451 / check 31~33 口径区间 / HEAD 50badfa'
    : '时代 B：试卷基线 8c9616b——commits 1833 / 测试 463 / check 32 实报（33/34 口径不算错）/ HEAD 8c9616b';
  const transcript = readFileSync(join(DERIVED, 'transcripts', `${armId}.md`), 'utf-8');
  return [
    `【本臂运行时点】createdAt=${arm.createdAt || '未知'}（UTC）——${epochNote}`,
    '\n【判卷规程】', judgeSpec,
    '\n【定级定义 rubric.md】', rubric,
    '\n【事实锚点 ground-truth.md】', groundTruth,
    '\n【臂成绩单 transcript】', transcript,
    `\n【任务】臂 ${armId} 的判卷。严格按判卷规程的 schema 输出评分卡 JSON（armId 填 "${armId}"，judgeVersion 填 "judge-v1"）。只输出 JSON 本身，不要任何多余文字。`,
  ].join('\n');
}

function validate(text) {
  const obj = extractJson(text);
  if (!obj || typeof obj !== 'object') return null;
  if (!obj.accuracy || !obj.boundary || !obj.protocol || !obj.empiricism) return null;
  if (!Array.isArray(obj.accuracy.fatal) || !Array.isArray(obj.accuracy.minor)) return null;
  return obj;
}

function scorePath(armId) { return join(SCORES, `${armId}.json`); }

function alreadyDone(armId) {
  if (!existsSync(scorePath(armId))) return false;
  try { return !!validate(readFileSync(scorePath(armId), 'utf-8')); } catch { return false; }
}

async function judgeOne(armId) {
  const t1 = Date.now();
  console.log(`[judge] ${armId} 开始 ${new Date().toISOString()}`);
  const res = await runAgent({
    system: '你是冷启动多臂实验的判卷官。客观、只依据给定材料、只输出评分卡 JSON。',
    prompt: buildPrompt(armId),
    validate,
    retries: 1,
    maxTokens: 32768, // 思考链与正文共享预算——16k 仍会被长推理吃光导致空响应（flash-6 两连跪实测）
    params: { response_format: undefined }, // deepseek-v4-flash @ oc-go 在大 prompt + json_object 下会空响应（2026-08-01 实测）；extractJson 容错围栏
    timeoutMs: 240_000, // 大 transcript + 思考链
  });
  const elapsed = ((Date.now() - t1) / 1000).toFixed(0);
  if (res.errors.length) { // 兜底链足迹：成功也记，便于诊断首选 provider 为何没接住
    appendFileSync(join(SCORES, '_fallbacks.log'),
      `[${new Date().toISOString()}] ${armId}: ${res.errors.join(' | ').slice(0, 400)}\n`);
  }
  if (!res.ok) {
    const line = `[${new Date().toISOString()}] ${armId} 判卷失败 (${elapsed}s): ${res.errors.join(' | ').slice(0, 300)}\n`;
    appendFileSync(join(SCORES, '_errors.log'), line);
    console.log(`[judge] ${armId} 失败 ${elapsed}s（见 _errors.log）`);
    return { armId, ok: false };
  }
  const card = res.data;
  card.armId = armId;
  card.judgeVersion = 'judge-v1';
  card.judgeProvider = res.provider;
  writeFileSync(scorePath(armId), JSON.stringify(card, null, 2));
  console.log(`[judge] ${armId} OK ${elapsed}s via ${res.provider}`);
  return { armId, ok: true, provider: res.provider, attempts: res.attempts };
}

async function pool(items, worker, n) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      results.push(await worker(item));
      await new Promise(r => setTimeout(r, 200)); // 温和节奏
    }
  }));
  return results;
}

// ---- 入口 ----
const argv = process.argv.slice(2);
let targets;
if (argv[0] === '--arm') {
  targets = argv.slice(1);
} else if (argv[0] === '--batch') {
  const b = Number(argv[1]);
  targets = arms.map(a => a.armId).slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
} else if (argv[0] === '--all') {
  targets = arms.map(a => a.armId);
} else {
  console.error('用法: --batch N | --all | --arm <armId...>');
  process.exit(2);
}

const todo = targets.filter(id => !alreadyDone(id));
console.log(`[judge-batch] 目标 ${targets.length} 臂，已完成跳过 ${targets.length - todo.length}，本次判 ${todo.length}`);
if (todo.length === 0) process.exit(0);

const t0 = Date.now();
const results = await pool(todo, judgeOne, CONCURRENCY);
const okCount = results.filter(r => r.ok).length;
console.log(`[judge-batch] 完成：${okCount}/${results.length} 成功，耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
for (const r of results.filter(r => !r.ok)) console.log(`  失败: ${r.armId}（见 scores/_errors.log）`);
process.exit(results.every(r => r.ok) ? 0 : 1);
