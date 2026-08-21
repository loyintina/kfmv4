#!/usr/bin/env node
/**
 * check-git-hygiene.mjs — git 卫生 v0（2026-08-21 评审立项，两次链红入仓实证）
 * MODE: warning（commit-msg 钩 warn-only；--probe 链模式 hard-fail 自测）
 *
 * 背景：874 混入事故（commit 6b1ba5ce 扫入 15 个他线 WIP）+ 0820 总账落地
 * 链红入仓（注册表黑户 / 锚点失效 / 台账滞后共四组）——「入仓后跑全链」
 * 靠自觉守不住，升机械。契约 3 点名「commit 前脚本化检查」的本格落地。
 *
 * 两件（v0 只警告不拦截——拦住紧急跨线修复不是目的，让 commit 的人
 * 停半秒看一眼才是）：
 *   R1 跨区混合警告：暂存区同时出现 nz/ 与本体执行面（src/|scripts/|public/）
 *      ——874 混入的形态；纯 docs 跨区不警（评审/通报类 commit 天然跨 docs）。
 *   R2 快链子集：commit 时跑秒级检查（注册表/锚点/计数/台账 gen），红降为
 *      警告——别把 master 链红带进仓（0820 四组红全是快链可拦）。
 *
 * 模式：
 *   --staged   commit-msg 钩模式：读暂存区跑 R1 + R2，恒 exit 0（warn-only）
 *   --probe    链模式：R1 分类器自测（合成暂存清单断言），红 = 构建中断
 * KFM_PROBE_ROOT 可注入（宪法探针条款）。
 */

import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const ROOT = resolve(process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url)));

// ========== R1 分类器（纯函数，probe 可测） ==========

/** 暂存文件分区：nz 线 / 本体执行面 / 其他（docs 等不警） */
export function classifyZones(files) {
  const nz = [];
  const core = [];
  for (const f of files) {
    if (f.startsWith('nz/')) nz.push(f);
    else if (/^(src|scripts|public)\//.test(f)) core.push(f);
  }
  return { nz, core, zoneMix: nz.length > 0 && core.length > 0 };
}

// ========== R2 快链子集（秒级检查，commit 时红降警告） ==========

const FAST_STEPS = [
  'check-mechanism-registry.mjs',
  'check-mutation-anchors.mjs',
  'check-checks.mjs',
  'sync-counts.mjs --check-only',
  'gen-scripts-catalog.mjs --check-only',
  'gen-code-inventory.mjs --check-only',
  'gen-contract-lists.mjs --check-only',
  'gen-agent-inbox.mjs --check-only',
  'check-agent-inbox.mjs',
];

function runFastSubset() {
  const reds = [];
  for (const step of FAST_STEPS) {
    const [script, ...args] = step.split(' ');
    const r = spawnSync('node', [`scripts/check/${script}`, ...args], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (r.status !== 0) reds.push(step);
  }
  return reds;
}

// ========== 模式 ==========

const mode = process.argv[2];

if (mode === '--probe') {
  // R1 分类器自测：合成暂存清单，断言警告形态
  const cases = [
    { files: ['nz/src/client/x.ts', 'nz/TASK.md'], want: false, note: '纯 nz 提交' },
    { files: ['nz/src/client/x.ts', 'src/client/ctx.ts'], want: true, note: '874 混入形态（nz + 本体 src）' },
    { files: ['nz/TASK.md', 'scripts/check/check-foo.mjs'], want: true, note: 'nz + 本体 scripts' },
    { files: ['docs/ledger/agent-inbox/a.md', 'docs/active/nine-zero/00-index.md'], want: false, note: '纯 docs 跨区不警' },
    { files: ['scripts/check/check-foo.mjs', 'docs/active/mechanism-registry.md'], want: false, note: '本体基建提交' },
  ];
  let bad = 0;
  for (const c of cases) {
    const got = classifyZones(c.files).zoneMix;
    if (got !== c.want) {
      console.error(`[check-git-hygiene] probe 红：${c.note}——期望警告=${c.want} 实际=${got}`);
      bad++;
    }
  }
  if (bad > 0) {
    console.error(`[check-git-hygiene] probe ${bad}/${cases.length} 红——R1 分类器失真，构建中断。`);
    process.exit(1);
  }
  console.log(`[check-git-hygiene] OK — R1 分类器自测 ${cases.length} 例全过（R2 快链子集 ${FAST_STEPS.length} 步，commit 钩 warn-only）`);
  process.exit(0);
}

if (mode === '--staged') {
  // commit-msg 钩模式：warn-only，恒 exit 0
  let staged = [];
  try {
    staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch {
    console.log('[check-git-hygiene] ⚠ 暂存区读取失败（非 git 环境？），跳过');
    process.exit(0);
  }

  const { nz, core, zoneMix } = classifyZones(staged);
  if (zoneMix) {
    console.log(`[check-git-hygiene] ⚠ R1 跨区混合：暂存区同时有 nz/（${nz.length} 个）与本体执行面（${core.length} 个）`);
    console.log(`  本体侧文件：${core.slice(0, 10).join(', ')}${core.length > 10 ? ' …' : ''}`);
    console.log('  → 874 混入即此形态。若非有意跨区修复，请 unstage 本体侧文件后重提。');
  }

  const reds = runFastSubset();
  if (reds.length > 0) {
    console.log(`[check-git-hygiene] ⚠ R2 快链 ${reds.length} 步红：${reds.join('；')}`);
    console.log('  → 确认这些红不是本提交造成/没被本提交带进 master（0820 链红入仓即此形态）。');
  }
  if (!zoneMix && reds.length === 0) {
    console.log('[check-git-hygiene] OK — 暂存区跨区清白 / 快链子集全绿');
  }
  process.exit(0); // v0 只警告不拦截
}

console.error('[check-git-hygiene] 用法：--staged（commit 钩，warn-only）| --probe（链模式自测）');
process.exit(2);
