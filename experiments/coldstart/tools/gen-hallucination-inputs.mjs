#!/usr/bin/env node
/**
 * gen-hallucination-inputs.mjs — 为 subagent 判卷生成输入文件
 * 复用 hallucinate-batch.mjs 的证据包精简 + 断言候选抽取逻辑，把
 * 「判卷规程 + 机械候选清单 + 证据包」固化成一个 md 文件，subagent
 * 直接读文件判卷，输出 JSON。用法：
 *   node gen-hallucination-inputs.mjs            # 全部（来自 arms.json）
 *   node gen-hallucination-inputs.mjs <id...>    # 指定臂
 * 输出：~/.kfmv4/experiments/coldstart/derived/hallucination-inputs/<armId>.md
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DERIVED = join(homedir(), '.kfmv4', 'experiments', 'coldstart', 'derived');
const OUT = join(DERIVED, 'hallucination-inputs');
mkdirSync(OUT, { recursive: true });

const spec = readFileSync(join(REPO, 'experiments/coldstart/prompts/judge-hallucination.md'), 'utf-8');
const arms = JSON.parse(readFileSync(join(DERIVED, 'arms.json'), 'utf-8'));

function buildEvidencePack(transcript) {
  const lines = transcript.split('\n');
  const out = [];
  let inTool = false;
  let toolChars = 0;
  let finalReport = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith('> [thinking]') || l.trim().startsWith('>思考')) continue;
    if (l.includes('## 最终报告')) { out.push(l); finalReport = true; continue; }
    if (finalReport) { out.push(l); continue; }
    if (/^- \*\*\[T\d+\]\*\*/.test(l)) {
      inTool = true; toolChars = 0; out.push(l);
      continue;
    }
    if (inTool) {
      if (/^### \[A|^## |^- \*\*\[T\d+\]/.test(l)) { inTool = false; out.push(l); continue; }
      toolChars += l.length + 1;
      if (toolChars <= 600) out.push(l);
      else continue;
    } else {
      if (i < 12) out.push(l);
    }
  }
  return out.join('\n');
}

function extractCandidates(transcript) {
  const cands = [];
  const finalSec = transcript.split('## 最终报告')[1] || transcript.split('# 最终报告')[1] || transcript;
  const lines = finalSec.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const seen = new Set();
  const push = (c) => { const k = c.slice(0, 40); if (!seen.has(k)) { seen.add(k); cands.push(c); } };
  for (const line of lines) {
    const numRe = /.{0,28}[0-9]{2,}(?:\.\d+)?(?:[%个条份秒分小时天次倍]|[kKmM]?B)?.{0,16}/g;
    let m;
    while ((m = numRe.exec(line))) push(m[0].trim());
    const qRe = /[「"『]([^」"』]{2,40})[」"』]/g;
    while ((m = qRe.exec(line))) push(`引用:${m[1]}`);
    const pRe = /\b(?:[\w./-]+\/)?[\w-]+\.(?:ts|js|mjs|json|md|yaml|css|html)\b/g;
    while ((m = pRe.exec(line))) push(m[0]);
    const nRe = /\b[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){1,4}\b/g;
    while ((m = nRe.exec(line))) push(m[0]);
  }
  return cands.slice(0, 80);
}

function buildPrompt(armId) {
  const arm = arms.find(a => a.armId === armId) || {};
  const epoch = (arm.createdAt || '') < '2026-08-01T02:33' ? 'A' : 'B';
  const transcript = readFileSync(join(DERIVED, 'transcripts', `${armId}.md`), 'utf-8');
  const evidence = buildEvidencePack(transcript);
  const cands = extractCandidates(evidence);
  const checklist = cands.length
    ? cands.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '（机械层未抽到候选——通读最终报告自行提取）';
  return [
    `# 幻觉判卷任务 — 臂 ${armId}`,
    '',
    `【本臂运行时点】createdAt=${arm.createdAt || '未知'}（UTC），时代 ${epoch}`,
    '',
    '【判卷规程】',
    spec,
    '',
    '【机械抽取断言候选清单——逐条分类，不许跳过】',
    checklist,
    '',
    '【臂证据包（精简：工具轨迹+最终报告全文；中间 AI 文本与 thinking 已剥离）】',
    evidence,
    '',
    `【任务】臂 ${armId} 的幻觉判卷。严格按规程 schema 输出 JSON（armId 填 "${armId}"）。`,
    '机械清单每条都要出现在 claims 里（category 可为 unsourced），遗漏 = 尺子失职。只输出 JSON。',
  ].join('\n');
}

const argv = process.argv.slice(2);
const targets = argv.length ? argv : arms.map(a => a.armId);
let n = 0;
for (const id of targets) {
  const prompt = buildPrompt(id);
  writeFileSync(join(OUT, `${id}.md`), prompt);
  const kb = (prompt.length / 1024).toFixed(0);
  console.log(`[gen] ${id} (${kb} KB)`);
  n++;
}
console.log(`[gen-inputs] 生成 ${n} 个输入文件 → ${OUT}`);
