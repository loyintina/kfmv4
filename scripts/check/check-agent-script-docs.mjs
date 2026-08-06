#!/usr/bin/env node
/**
 * check-agent-script-docs.mjs — agent 脚本发现性门（2026-08-06 用户拍板，发现性缺口机械化）
 *
 * 出身：browser-relay.mjs（守视）上线当日，同机另一 agent 进程不知道它存在——
 *   语义上重要的产物脱离第一手作者后，后续接手者无发现路径。code-map 门
 *   （DOC-FLOW-09）管的是 src 部件，agent 脚本（scripts/agent/*.mjs）是另一类
 *   重要产物：它们是 agent 的「四肢」，发现面在 guides/agent-runner.md。
 *
 * 规则：scripts/agent/*.mjs 的文件名必须出现在 docs/guides/agent-runner.md。
 *
 * 表面克制（宁紧勿宽，零误报优先）：
 *   - 只强制文件名出现（子串匹配），不校验登记质量——质量归人，存在归机械；
 *   - exp-*.mjs 豁免：实验臂归实验登记面（experiments/paradigm 实验档案），
 *     不算常驻四肢；
 *   - 只查 scripts/agent/ 一层，不递归。
 *
 * 枚举型检查（每次全量重扫），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 * 修复路径：在 agent-runner.md 补一节负载登记（用途/用法/陷阱），走 doc-write.yaml；
 *   若为一次性实验脚本，改名 exp-*.mjs 并登实验档案。
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
let errors = 0;

const agentDir = join(ROOT, 'scripts/agent');
const scripts = readdirSync(agentDir, { withFileTypes: true })
  .filter(e => e.isFile() && e.name.endsWith('.mjs') && !e.name.startsWith('exp-'))
  .map(e => e.name);

const guide = readFileSync(join(ROOT, DOCS_ROOT, 'guides/agent-runner.md'), 'utf-8');

const undocumented = scripts.filter(name => !guide.includes(name));

if (undocumented.length) {
  for (const f of undocumented) console.error(`[check-agent-script-docs] agent 脚本无登记：${f}（scripts/agent/ 下存在，但 guides/agent-runner.md 没有它）`);
  console.error('[check-agent-script-docs] ⛳ DOC-FLOW-10：新 agent 脚本无发现路径——在 guides/agent-runner.md 补负载登记（走 workflows/doc-write.yaml）；一次性实验脚本请改名 exp-*.mjs');
  errors += undocumented.length;
}

if (errors) {
  console.error(`[check-agent-script-docs] ${errors} errors，构建中断。`);
  process.exit(1);
}
console.log(`[check-agent-script-docs] OK（agent 脚本 ${scripts.length} 个全部有登记，exp-* 豁免）`);
