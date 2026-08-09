#!/usr/bin/env node
// check-kfmv4-data.mjs — 数据区结构机械门（~/.kfmv4，2026-08-08 重构定稿）
//
// 规范：docs/guides/kfmv4-data.md。执法三条已定规则（只执法已拍板的，不预设）：
//   1. sessions/ 根目录不得出现测试残留（s1/s2/s3/s-err/s-buf/s-cancel/
//      sess-ok/sess-x/s-basic——源头 tests/ 已根治，再出现 = 隔离回归）
//   2. paradigms/ 池不得混实验梯度档（metacognition-*k/meta-corpus-*/dup 等，
//      实验档在 experiments/paradigm/paradigm-packs/）
//   3. workspaces/ agent 工作区空位必须存在
// 另查必在目录。数据区缺席（KFM_DATA_HOME 未设且 ~/.kfmv4 不存在）→ 优雅跳过，
// 对齐 check-experiment-index 先例（开源克隆无数据区）。

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DATA_HOME = process.env.KFM_PROBE_ROOT || process.env.KFM_DATA_HOME || join(homedir(), '.kfmv4');
const errors = [];
const warnings = [];

if (!existsSync(DATA_HOME)) {
  console.log('[check-kfmv4-data] OK — 无数据区，跳过（开源克隆/未初始化）');
  process.exit(0);
}

// ---------- 必在目录 ----------
const REQUIRED_DIRS = ['agents/roles', 'agents/configs', 'agents/prompts', 'agents/paradigms', 'sessions', 'sessions/script', 'experiments', 'experiments/materials', 'logs', 'workspaces', 'ledger'];
for (const d of REQUIRED_DIRS) {
  if (!existsSync(join(DATA_HOME, d))) errors.push(`缺目录: ${d}`);
}

// ---------- 规则 0：账本不得回潮根目录（2026-08-08 ledger/ 收拢定稿） ----------
const LEDGER_FILES = ['agent-calls.jsonl', 'build-metrics.jsonl', 'check-failures.jsonl', 'discussion-log.jsonl', 'permission-audit.jsonl', 'semantic-chain-metrics.jsonl', 'sys-metrics.json', 'tool-exec.jsonl'];
for (const f of LEDGER_FILES) {
  if (existsSync(join(DATA_HOME, f))) {
    errors.push(`账本 ${f} 回潮根目录 —— 应归 ledger/（2026-08-08 收拢，代码路径已改 obs.ts/chain/agent-runner 等）`);
  }
}

// ---------- 规则 1：sessions/ 根测试残留 ----------
// 精确清单（源头已根治；出现即隔离回归）。广义正则只警告不报错（防误伤真实
// 中文标题会话，历史教训 BAR-SEC-14）。
const TEST_SESSION_IDS = ['s1', 's2', 's3', 's-err', 's-buf', 's-cancel', 'sess-ok', 'sess-x', 's-basic'];
const sessRoot = join(DATA_HOME, 'sessions');
if (existsSync(sessRoot)) {
  for (const id of TEST_SESSION_IDS) {
    if (existsSync(join(sessRoot, `${id}.json`))) {
      errors.push(`sessions/ 出现测试残留 ${id}.json —— 隔离回归！源头：tests/run-manager.test.ts + server-routes.test.ts，读 docs/guides/kfmv4-data.md §历史`);
    }
  }
  for (const f of readdirSync(sessRoot)) {
    if (/^s\d+\.json$/.test(f) || /^sess-\w+\.json$/.test(f)) {
      warnings.push(`sessions/ 疑似新测试残留 ${f}（广义模式）——确认为测试产物请按源头修复，勿只删文件`);
    }
  }
}

// ---------- 规则 2：paradigms/ 池实验档 ----------
const pool = join(DATA_HOME, 'agents', 'paradigms');
if (existsSync(pool)) {
  for (const f of readdirSync(pool)) {
    if (/^(metacognition-\d+k|metacognition-h\d+k|meta-corpus-\d+k|.*-dup)\.md$/.test(f)) {
      errors.push(`paradigms/ 池混入实验档 ${f} —— 实验档归 experiments/paradigm/paradigm-packs/（loadParadigm 已加回退）`);
    }
  }
}

// ---------- 规则 3：workspaces/ 空位（存在性已在必在目录覆盖，此处仅提示内容规范） ----------
const wsReadme = join(DATA_HOME, 'workspaces', 'README.md');
if (existsSync(join(DATA_HOME, 'workspaces')) && !existsSync(wsReadme)) {
  warnings.push('workspaces/ 缺 README.md（工作区命名规范说明）');
}

for (const w of warnings) console.log('[check-kfmv4-data] 注意 — ' + w);
if (errors.length) {
  console.error('[check-kfmv4-data] FAIL — 数据区结构违例:');
  for (const e of errors) console.error('  ✗ ' + e);
  console.error('[check-kfmv4-data] 读 docs/guides/kfmv4-data.md（规范与历史）');
  process.exit(1);
}
console.log('[check-kfmv4-data] OK — 数据区结构合规');
process.exit(0);
