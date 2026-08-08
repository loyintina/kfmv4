#!/usr/bin/env node
// check-probe-state.mjs — 落成门检查门（docprobe 落成门 v1）
//
// 账本消费端：scripts/capability-map.manifest.json 每个登记行，都必须在
// docs/ledger/probe-state.json 里有「通过」记录，且记录新于 manifest 最后改动
// （git 即账本：git log -1 --format=%cI -- <manifest>；无 git 环境退化为文件 mtime）。
//
// 通过判定口径（probe-capability.mjs 产出时写入，本检查只读账本不跑臂）：
//   单臂 read 命中应达文档集任一路径 = 到达；4 臂中 >=2 到达 = 通过。
//
// 豁免：manifest 行带 probeExempt 字段（原因字符串）——打印提醒但不中断。
// 探针：tests/probes/probe-state/（KFM_PROBE_ROOT 注入，缺失记录必报红）。

import { readFileSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const MANIFEST_REL = join('scripts', 'capability-map.manifest.json');
const STATE_REL = join('docs', 'ledger', 'probe-state.json');
const manifestPath = join(ROOT, MANIFEST_REL);
const statePath = join(ROOT, STATE_REL);

const errors = [];
const warnings = [];

if (!existsSync(manifestPath)) {
  console.log('[check-probe-state] OK — 无 capability-map manifest，跳过（旧版仓库）');
  process.exit(0);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// manifest 最后改动时间：git log 优先（克隆/checkout 会重置 mtime，git 历史才是真账本）
function manifestLastChange() {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', MANIFEST_REL], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (out) return Date.parse(out);
  } catch { /* 无 git 环境（探针夹具）退化 mtime */ }
  return statSync(manifestPath).mtimeMs;
}
const manifestTs = manifestLastChange();

if (!existsSync(statePath)) {
  console.error('[check-probe-state] FAIL — 落成门账本不存在: ' + STATE_REL);
  errors.push('账本缺失');
} else {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const recs = state.capabilities || {};
  for (const cap of manifest.capabilities || []) {
    if (cap.probeExempt) {
      warnings.push(`${cap.name}: probeExempt 豁免（${cap.probeExempt}）`);
      continue;
    }
    const rec = recs[cap.name];
    if (!rec) {
      errors.push(`${cap.name}: 无落成门探头通过记录——跑 node experiments/docprobe/tools/probe-capability.mjs --capability "${cap.name}"`);
      continue;
    }
    if (!rec.pass) {
      errors.push(`${cap.name}: 探头未通过（${rec.reached}/${rec.armsTotal} 到达）——文档侧修路后重跑 probe-capability.mjs --capability "${cap.name}"`);
      continue;
    }
    const probedAt = Date.parse(rec.probedAt || '');
    if (!probedAt || probedAt < manifestTs) {
      errors.push(`${cap.name}: 探头记录陈旧（probedAt=${rec.probedAt || '无效'}，manifest 最后改动=${new Date(manifestTs).toISOString()}）——重跑 probe-capability.mjs --capability "${cap.name}"`);
    }
  }
}

for (const w of warnings) console.log('[check-probe-state] 注意 — ' + w);
if (errors.length) {
  console.error('[check-probe-state] FAIL — 落成门未过:');
  for (const e of errors) console.error('  ✗ ' + e);
  console.error('[check-probe-state] ⛳ MECH-FLOW-11：功能登记后须过落成门探头——读 experiments/docprobe/index.md §落成门，跑 probe-capability.mjs 补探测');
  process.exit(1);
}
console.log(`[check-probe-state] OK — ${(manifest.capabilities || []).length} 行均有有效通过记录${warnings.length ? `（${warnings.length} 行豁免）` : ''}`);
process.exit(0);
