#!/usr/bin/env node
/**
 * migrate-arms-to-db.mjs — 存量臂文件 → arms.db（design-arm-store.md 一期）
 *
 * 三级解码（按优先级）：
 *   ① 哈希重算：臂 id 带 -xxxxxx 后缀（md5(task|paradigm|model) 前 6 位），
 *      task/model 从文件内容取，遍历已知范式名重算匹配 → decode='hash'
 *   ② 遗留注册表：文档记录在案的批次 paradigms 清单（LEGACY_REGISTRY，
 *      来源逐条注释），裸 id 按 pi 下标查表 → decode='registry'
 *   ③ 未解码：paradigm='?' decode='undecoded'，dry-run 报告全列出，
 *      不丢臂（语义后补，臂数据本身完整）
 *
 * 默认 dry-run（只出报告）；--execute 实写入库并把文件移到
 * ~/.kfmv4/experiments/paradigm/sessions-archive/（归档不删——验收过一个完整
 * 分析周期后才清理，见设计文档）。px 插件实验/考试状态文件不迁移（留文件，
 * 那是人的观测界面）。
 */
import { readdirSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { registerBatch, putArm, hasArm, dbStats } from './arm-store.mjs';

const SCRIPT_DIR = join(homedir(), '.kfmv4', 'sessions', 'script');
const ARCHIVE_DIR = join(homedir(), '.kfmv4', 'experiments', 'paradigm', 'sessions-archive');
const PARADIGMS_DIR = join(homedir(), '.kfmv4', 'agents', 'paradigms');
const EXECUTE = process.argv.includes('--execute');

// 遗留注册表（裸 id 按 pi 下标解码）——逐条文档出处：
const LEGACY_REGISTRY = {
  // results-e1.md：batch-run --paradigms "无,root-cause-first" --prefix e1-
  'e1-t0': ['无', 'root-cause-first'],
  // results-e4-matrix.md：H2 模型矩阵，8 模型 × 无/有（root-cause-first 同主题）
  'e4-t0': ['无', 'root-cause-first'],
  // results-e5.md：8 模型 × 无/有 metacognition；e5b = mm3 加臂（同矩阵）
  'e5-t0': ['无', 'metacognition'],
  'e5b-t0': ['无', 'metacognition'],
  // results-e7-length.md：6 档梯度；e7b/e7c = 同一矩阵向其他模型池扩测
  'e7-t0': ['无', 'metacognition', 'metacognition-32k', 'metacognition-48k', 'metacognition-64k', 'metacognition-96k'],
  'e7b-t0': ['无', 'metacognition', 'metacognition-32k', 'metacognition-48k', 'metacognition-64k', 'metacognition-96k'],
  'e7c-t0': ['无', 'metacognition', 'metacognition-32k', 'metacognition-48k', 'metacognition-64k', 'metacognition-96k'],
  // index.md 实验 11 节批1 命令（A+B 组 192 臂，批1 臂为旧无哈希命名）
  'e11-t0': ['无', 'metacognition', 'metacognition-32k', 'metacognition-48k', 'metacognition-64k', 'metacognition-96k'],
  // results-h1-paradigm.md / results-h5-length.md 复现行
  'pd-t0': ['无', 'measured-decision'],
  'pl-t0': ['无', 'measured-decision', 'measured-decision-full'],
};

const paradigmCandidates = ['无', ...readdirSync(PARADIGMS_DIR)
  .filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''))];

const armHash = (task, paradigm, model) =>
  createHash('md5').update(`${task}|${paradigm}|${model}`).digest('hex').slice(0, 6);

const ID_RE = /^([a-z0-9]+)-(t\d+)p(\d+)m(\d+)r(\d+)(?:-([0-9a-f]{6}))?\.json$/;

const report = { total: 0, decoded: { hash: 0, registry: 0, undecoded: 0 }, skipped: [], byExperiment: {}, undecodedList: [] };
const synthBatches = new Map(); // key → batchId（--execute 时惰性注册）

function synthBatchId(prefix, decodeBasis, task, paradigmsNote) {
  const key = `${prefix}|${decodeBasis}`;
  if (!synthBatches.has(key)) {
    synthBatches.set(key, registerBatch({
      prefix, tasks: [task], paradigms: paradigmsNote, models: ['（逐臂见 arms.model）'],
      provider: '（逐臂见 arms.provider）', armsPlanned: 0,
      note: `存量迁移合成批次（${decodeBasis}），2026-08-06 migrate-arms-to-db`,
    }));
  }
  return synthBatches.get(key);
}

for (const f of readdirSync(SCRIPT_DIR)) {
  const m = f.match(ID_RE);
  if (!m) { if (f.endsWith('.json') && !f.startsWith('px-') && !f.startsWith('judge-')) report.skipped.push(f); continue; }
  const [, exp, tIdx, pi, mi, rep, hash] = m;
  const armId = f.replace(/\.json$/, '');
  const prefix = `${exp}-${tIdx}`;
  report.total++;
  report.byExperiment[exp] = (report.byExperiment[exp] || 0) + 1;
  if (EXECUTE && hasArm(armId)) continue; // 幂等：已入库跳过

  let d;
  try { d = JSON.parse(readFileSync(join(SCRIPT_DIR, f), 'utf-8')); }
  catch { report.skipped.push(`${f}（JSON 损坏）`); continue; }
  const model = d.modelId || 'unknown';
  const provider = d.providerId || 'unknown';
  const firstUser = (d.messages || []).find(x => x.role === 'user');
  const task = (firstUser?.content || []).filter(c => c && c.type === 'text').map(c => c.text).join('');

  // 三级解码
  let paradigm = '?', decode = 'undecoded';
  if (hash) {
    for (const p of paradigmCandidates) {
      if (armHash(task, p, model) === hash) { paradigm = p; decode = 'hash'; break; }
    }
  } else if (LEGACY_REGISTRY[prefix]) {
    const list = LEGACY_REGISTRY[prefix];
    if (Number(pi) < list.length) { paradigm = list[Number(pi)]; decode = 'registry'; }
  }
  report.decoded[decode]++;
  if (decode === 'undecoded') report.undecodedList.push(`${armId}（${model} @ ${provider}）`);

  if (EXECUTE) {
    const batchId = synthBatchId(prefix, decode === 'hash' ? '哈希重算' : decode === 'registry' ? '遗留注册表' : '未解码',
      task || '（空）', decode === 'registry' ? LEGACY_REGISTRY[prefix] : ['（逐臂哈希重算/未解码）']);
    putArm({
      batchId, armId, taskIdx: Number(tIdx.slice(1)), paradigmIdx: Number(pi), modelIdx: Number(mi),
      rep: Number(rep), task, paradigm, model, provider, decode, content: d,
    });
    mkdirSync(ARCHIVE_DIR, { recursive: true });
    renameSync(join(SCRIPT_DIR, f), join(ARCHIVE_DIR, f));
  }
}

console.log(`\n===== 存量迁移 ${EXECUTE ? '执行' : 'dry-run'} 报告 =====`);
console.log(`扫描臂文件: ${report.total}，按实验: ${JSON.stringify(report.byExperiment)}`);
console.log(`解码: 哈希重算 ${report.decoded.hash} / 注册表 ${report.decoded.registry} / 未解码 ${report.decoded.undecoded}`);
if (report.undecodedList.length) {
  console.log(`\n未解码臂（paradigm='?'，数据完整、语义后补）:`);
  for (const s of report.undecodedList.slice(0, 40)) console.log(`  ${s}`);
  if (report.undecodedList.length > 40) console.log(`  …共 ${report.undecodedList.length} 个`);
}
if (report.skipped.length) console.log(`\n跳过非臂文件 ${report.skipped.length} 个: ${report.skipped.slice(0, 10).join(', ')}${report.skipped.length > 10 ? '…' : ''}`);
if (EXECUTE) {
  console.log(`\n库状态: ${JSON.stringify(dbStats().byExperiment)}`);
  console.log(`原文件已归档 → ${ARCHIVE_DIR}`);
} else {
  console.log('\n（dry-run，未写入。确认报告后加 --execute 执行）');
}
