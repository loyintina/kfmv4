#!/usr/bin/env node
/**
 * check-experiment-registry.mjs — 实验产物发现性门（2026-08-06 用户拍板，DOC-FLOW-11）
 *
 * 出身：发现性缺口病型（DOC-FLOW-09/10 同族）在实验线的投影——
 *   ① CLAUDE.md 总入口对 experiments/paradigm 零路由（新 agent 不知道研究线存在）；
 *   ② DOC-FLOW-10 把 exp-* 脚本豁免「归实验登记面」，但实验登记面（index.md）
 *      没有机械主人，纯靠作者记性（活例：meta-pool/arms.db 孤儿文件、
 *      build-e14-combo.mjs 提交时未在 index.md 提名）。
 *
 * 规则：experiments/paradigm/ 的以下产物文件名必须出现在 experiments/paradigm/index.md：
 *   - tools/*.{mjs,py,sh}
 *   - specs/*.json
 *   - 顶层 results-*.md / design-*.md / proposal-*.md / pack-*.md / spec-*.md
 *
 * 表面克制（宁紧勿宽，零误报优先，与 DOC-FLOW-10 同哲学）：
 *   - 只强制文件名出现（子串匹配），不校验登记质量——质量归人，存在归机械；
 *   - 数据区豁免：meta-pool/、arm-artifacts/、fixtures/、scenarios/（任务输入）、
 *     instructors/（考官提示词由 px 文档统辖）——这些是数据不是产物；
 *   - index.md 自身豁免。
 *
 * 枚举型检查（每次全量重扫），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 * 修复路径：在 experiments/paradigm/index.md「产物登记面」节补文件名（一句话即可），
 *   走 doc-write.yaml；一次性脚本归入对应分组行。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const EXP = join(ROOT, 'experiments/paradigm');
let errors = 0;

const targets = [];
// tools/*.{mjs,py,sh}
for (const e of readdirSync(join(EXP, 'tools'), { withFileTypes: true })) {
  if (e.isFile() && /\.(mjs|py|sh)$/.test(e.name)) targets.push(`tools/${e.name}`);
}
// specs/*.json
const specsDir = join(EXP, 'specs');
if (existsSync(specsDir)) {
  for (const e of readdirSync(specsDir, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.json')) targets.push(`specs/${e.name}`);
  }
}
// 顶层文档类产物
for (const e of readdirSync(EXP, { withFileTypes: true })) {
  if (e.isFile() && /^(results|design|proposal|pack|spec)-.+\.md$/.test(e.name)) targets.push(e.name);
}

const index = readFileSync(join(EXP, 'index.md'), 'utf-8');
// 子串匹配按纯文件名（登记面可以只写文件名不带路径）
const unregistered = targets.filter(t => !index.includes(t.split('/').pop()));

if (unregistered.length) {
  for (const f of unregistered) console.error(`[check-experiment-registry] 实验产物无登记：${f}（存在，但 experiments/paradigm/index.md 没有它）`);
  console.error('[check-experiment-registry] ⛳ DOC-FLOW-11：实验产物无发现路径——在 experiments/paradigm/index.md「产物登记面」节补文件名（走 workflows/doc-write.yaml）');
  errors += unregistered.length;
}

if (errors) {
  console.error(`[check-experiment-registry] ${errors} errors，构建中断。`);
  process.exit(1);
}
console.log(`[check-experiment-registry] OK（实验产物 ${targets.length} 个全部有登记，数据区豁免）`);
