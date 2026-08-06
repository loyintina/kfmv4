#!/usr/bin/env node
/**
 * migrate-px-to-db.mjs — px 插件实验会话 → arms.db（2026-08-06）
 *
 * 背景：migrate-arms-to-db.mjs 一期把 px 实验排除在外（「留文件，那是人的观测
 * 界面」）。但 px 系列已扩到三足（px-base/px-hl/px-ft），盲判/对照分析都要
 * 程序化取臂——统一进库，**文件原地保留**（transcript/exam-state 仍是人的
 * 观测界面，本迁移只做 DB 登记，不做归档移动）。
 *
 * 语义来源：<id>.exam-meta.json（examinerModel/examinerProvider/packName/
 * mountLog/aborted）。paradigm 判定：
 *   - mountLog 有 attach → packName（挂载过即算挂载组）
 *   - 否则 → '无'（px-base 全组、px-c46-4 零挂载对照）
 * experiment 分组：px-base-* / px-hl-* / px-ft-* → 同名；其余 legacy（px-g25-*
 * px-c46-* px-smoke* px-air1）→ 'px-1'。
 * .dead-* 文件（夭折跑的残骸）不入库；无主体 .json 的跑次（只有 meta/transcript）
 * 跳过并列出。
 *
 * 默认 dry-run；--execute 实写。
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { registerBatch, putArm, hasArm, dbStats } from './arm-store.mjs';

const SCRIPT_DIR = join(homedir(), '.kfmv4', 'sessions', 'script');
const EXECUTE = process.argv.includes('--execute');

function experimentOf(id) {
  for (const p of ['px-base', 'px-hl', 'px-ft']) if (id.startsWith(p + '-')) return p;
  return 'px-1';
}

const mains = readdirSync(SCRIPT_DIR)
  .filter(f => /^px-[^/]+\.json$/.test(f)
    && !f.includes('.exam-') && !f.includes('.dead-') && !f.includes('.transcript'))
  .map(f => f.replace(/\.json$/, ''));

const groups = {};
let skipped = 0;
for (const id of mains) {
  const metaPath = join(SCRIPT_DIR, `${id}.exam-meta.json`);
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf-8')) : null;
  const content = JSON.parse(readFileSync(join(SCRIPT_DIR, `${id}.json`), 'utf-8'));
  const mounted = !!(meta?.mountLog || []).some(m => m.action === 'attach');
  const rec = {
    armId: id,
    experiment: experimentOf(id),
    paradigm: mounted ? (meta.packName || '?') : '无',
    model: meta?.examinerModel || content.modelId || '?',
    provider: meta?.examinerProvider || '?',
    status: meta?.aborted ? 'aborted' : 'ok',
    content,
  };
  (groups[rec.experiment] ||= []).push(rec);
  if (!meta) skipped++;
}

console.log(`发现 px 主体会话 ${mains.length} 个（无 exam-meta 的 ${skipped} 个按内容兜底）`);
for (const [exp, recs] of Object.entries(groups)) {
  console.log(`\n[${exp}] ${recs.length} 臂`);
  for (const r of recs.sort((a, b) => a.armId.localeCompare(b.armId)))
    console.log(`  ${r.armId}  paradigm=${r.paradigm}  model=${r.model}  status=${r.status}${hasArm(r.armId) ? '  [已在库]' : ''}`);
}

// 列出无主体 .json 的孤儿 meta（信息项，不处理）
const orphans = readdirSync(SCRIPT_DIR)
  .filter(f => /^px-[^/]+\.exam-meta\.json$/.test(f))
  .map(f => f.replace(/\.exam-meta\.json$/, ''))
  .filter(id => !mains.includes(id));
if (orphans.length) console.log(`\n孤儿 meta（无主体会话，跳过）：${orphans.join(', ')}`);

if (EXECUTE) {
  for (const [exp, recs] of Object.entries(groups)) {
    const batchId = registerBatch({
      prefix: exp + '-', taskFile: 'experiments/paradigm/scenarios/design-discussion.txt',
      tasks: ['design-discussion（plugin-exam 多轮，任务全文见 scenario 文件）'],
      paradigms: [...new Set(recs.map(r => r.paradigm))],
      models: [...new Set(recs.map(r => r.model))],
      provider: '聚光', armsPlanned: recs.length,
      note: 'migrate-px-to-db 迁移（文件原地保留，plugin-exam 多轮会话）',
    });
    let n = 0;
    for (const r of recs) {
      putArm({ batchId, armId: r.armId, task: 'design-discussion', paradigm: r.paradigm,
        model: r.model, provider: r.provider, status: r.status,
        decode: 'registry', experiment: r.experiment, content: r.content });
      n++;
    }
    console.log(`[${exp}] 入库 ${n} 臂（batch ${batchId}）`);
  }
  console.log(JSON.stringify(dbStats().byExperiment.filter(e => e.experiment.startsWith('px')), null, 1));
} else {
  console.log('\n[dry-run] 加 --execute 实写入库');
}
