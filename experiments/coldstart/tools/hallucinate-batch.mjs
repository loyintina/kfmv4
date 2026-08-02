#!/usr/bin/env node
/**
 * hallucinate-batch.mjs — 第二把尺批量驱动（出处反查，幻觉率测量）
 * 骨架同 judge-batch.mjs；判卷提示词 judge-hallucination.md，输出
 * derived/hallucination-scores/<armId>.json。断点续跑、并发 4。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { runAgent, extractJson } from '../../../scripts/agent/agent-runner.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DERIVED = join(homedir(), '.kfmv4', 'experiments', 'coldstart', 'derived');
const OUT = join(DERIVED, 'hallucination-scores');
const BATCH_SIZE = 31;
const CONCURRENCY = 4;
mkdirSync(OUT, { recursive: true });

const spec = readFileSync(join(REPO, 'experiments/coldstart/prompts/judge-hallucination.md'), 'utf-8');
const arms = JSON.parse(readFileSync(join(DERIVED, 'arms.json'), 'utf-8'));

function extractCandidates(transcript) {
  // 从最终报告段机械抽取断言候选：数字（含上下文）、引号内容、特定专有名词形态。
  // 抽取宁全勿漏——判官必须逐条分类，漏判一条编造 = 尺子失职。
  const cands = [];
  const finalSec = transcript.split('## 最终报告')[1] || transcript.split('# 最终报告')[1] || transcript;
  const lines = finalSec.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const seen = new Set();
  const push = (c) => { const k = c.slice(0, 40); if (!seen.has(k)) { seen.add(k); cands.push(c); } };
  for (const line of lines) {
    // 数字断言（≥2 位数字，取行内上下文）
    const numRe = /.{0,28}[0-9]{2,}(?:\.\d+)?(?:[%个条份秒分小时天次倍]|[kKmM]?B)?.{0,16}/g;
    let m;
    while ((m = numRe.exec(line))) push(m[0].trim());
    // 引号/书名号内容
    const qRe = /[「"『]([^」"』]{2,40})[」"』]/g;
    while ((m = qRe.exec(line))) push(`引用:${m[1]}`);
    // 路径/文件名形态
    const pRe = /\b(?:[\w./-]+\/)?[\w-]+\.(?:ts|js|mjs|json|md|yaml|css|html)\b/g;
    while ((m = pRe.exec(line))) push(m[0]);
    // 英文专有名词（2-5 词大写开头）
    const nRe = /\b[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){1,4}\b/g;
    while ((m = nRe.exec(line))) push(m[0]);
  }
  // 去重去空，最多 80 条（超出取前 80，判官可补充）
  return cands.slice(0, 80);
}

function buildPrompt(armId) {
  const arm = arms.find(a => a.armId === armId) || {};
  const epoch = (arm.createdAt || '') < '2026-08-01T02:33' ? 'A' : 'B';
  const transcript = readFileSync(join(DERIVED, 'transcripts', `${armId}.md`), 'utf-8');
  const cands = extractCandidates(transcript);
  const checklist = cands.length
    ? cands.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '（机械层未抽到候选——通读最终报告自行提取）';
  return [
    `【本臂运行时点】createdAt=${arm.createdAt || '未知'}（UTC），时代 ${epoch}`,
    '\n【判卷规程】', spec,
    '\n【机械抽取断言候选清单——逐条分类，不许跳过】\n' + checklist,
    '\n【臂成绩单 transcript】', transcript,
    `\n【任务】臂 ${armId} 的幻觉判卷。严格按规程 schema 输出 JSON（armId 填 "${armId}"）。`
    + ' 机械清单每条都要出现在 claims 里（category 可为 unsourced），遗漏 = 尺子失职。只输出 JSON。',
  ].join('\n');
}

function validate(text) {
  const obj = extractJson(text);
  if (!obj || !Array.isArray(obj.claims) || !obj.stats || typeof obj.hardFabricationCount !== 'number') return null;
  return obj;
}

const outPath = id => join(OUT, `${id}.json`);
const done = id => existsSync(outPath(id)) ? (() => { try { return !!validate(readFileSync(outPath(id), 'utf-8')); } catch { return false; } })() : false;

async function judgeOne(armId) {
  const t1 = Date.now();
  console.log(`[halluc] ${armId} 开始 ${new Date().toISOString()}`);
  const res = await runAgent({
    system: '你是幻觉判卷官（第二把尺）。只依据给定成绩单的轨迹证据分类断言，只输出 JSON。',
    prompt: buildPrompt(armId),
    validate,
    retries: 1,
    maxTokens: 16000,
    params: { response_format: undefined },
    timeoutMs: 300_000,
  });
  const elapsed = ((Date.now() - t1) / 1000).toFixed(0);
  if (!res.ok) {
    appendFileSync(join(OUT, '_errors.log'), `[${new Date().toISOString()}] ${armId} (${elapsed}s): ${res.errors.join(' | ').slice(0, 250)}\n`);
    console.log(`[halluc] ${armId} 失败 ${elapsed}s`);
    return { armId, ok: false };
  }
  const card = res.data;
  card.armId = armId;
  card.judgeVersion = 'judge-hallucination-v1';
  card.judgeProvider = res.provider;
  writeFileSync(outPath(armId), JSON.stringify(card, null, 2));
  console.log(`[halluc] ${armId} OK ${elapsed}s via ${res.provider}（fab=${card.hardFabricationCount} cont=${card.contradictionCount}）`);
  return { armId, ok: true };
}

async function pool(items, worker, n) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      results.push(await worker(item));
      await new Promise(r => setTimeout(r, 200));
    }
  }));
  return results;
}

const argv = process.argv.slice(2);
let targets;
if (argv[0] === '--arm') targets = argv.slice(1);
else if (argv[0] === '--batch') { const b = Number(argv[1]); targets = arms.map(a => a.armId).slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE); }
else if (argv[0] === '--all') targets = arms.map(a => a.armId);
else { console.error('用法: --all | --batch N | --arm <id...>'); process.exit(2); }

const todo = targets.filter(id => !done(id));
console.log(`[halluc-batch] 目标 ${targets.length}，跳过 ${targets.length - todo.length}，本次 ${todo.length}`);
if (!todo.length) process.exit(0);
const t0 = Date.now();
const results = await pool(todo, judgeOne, CONCURRENCY);
const ok = results.filter(r => r.ok).length;
console.log(`[halluc-batch] 完成 ${ok}/${results.length}，耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(results.every(r => r.ok) ? 0 : 1);
