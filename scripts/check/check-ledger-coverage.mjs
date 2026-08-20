#!/usr/bin/env node
/**
 * check-ledger-coverage.mjs — v8→v9 迁移总账咬合检查（2026-08-20 立）
 *
 * 出身：用户三连问「眼睛看什么/账准吗/已记录的账准且全吗」——任务图自上
 * 而下写就，完备性只能自下而上对账。capability-review（8-16 一次性扫描）
 * 抓到 5 缺口后停在「初稿待确认」；compact 拆分（8-18）三新文件台账零
 * 提及——无机制则缝隙随时间累积。本检查把「账准且全」从信任问题变成
 * 每次可重答的机械问题。
 *
 * 两层账分工（拍板 2026-08-20）：
 *   清单层 = docs/domains/code-inventory.md（gen-code-inventory 机械生成，
 *            永远准，请勿手改）；
 *   归宿层 = docs/active/nine-zero/nine-point-zero.md「组件台账」节
 *            （人工裁决：每项 v8 资产一行归宿，含 ❌ 移除/退役行）。
 *
 * 检查项：
 *   a. 不全（硬红）：清单层 src/** 每个文件，在归宿层台账节内无任何命中
 *      （命中键：全路径 / 去扩展名路径 / basename / 去扩展名 basename；
 *      另认三种归组覆盖：机读锚点 `<!-- covers: a.ts, dir/ -->`（2026-08-20
 *      43 锚点落地，每行归宿的显式文件清单）；目录引用 `xxx/` 覆盖其下
 *      全部；通配 `md-*` 按 basename 前缀覆盖）。
 *   a2. 死锚（硬红）：covers 锚点点名的 .ts 文件在清单层不存在（文件已删
 *      锚点还在 = 账没跟上代码）。
 *   b. 不准（硬红）：归宿层台账节里形如文件的 `.ts` 引用，磁盘上不存在
 *      且不在清单层（指向已消失文件的死账）。仅核 src/ 形态引用，
 *      外部依赖（cordis@… 等无 .ts 形态）天然不参与。
 *
 * 范围说明：只核 src/** 运行时文件。scripts//docs/tests 属域外工坊层，
 * 由 infra-inventory + 台账「域外」组行覆盖（9.x 工坊线重评后另行机械
 * 化）。KFM_PROBE_ROOT 可注入（宪法探针条款）。
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const INVENTORY = join(ROOT, 'docs/domains/code-inventory.md');
const LEDGER = join(ROOT, 'docs/active/nine-zero/nine-point-zero.md');

let errors = 0;

// ---------- 清单层：code-inventory 的 src/** 文件 ----------
const inv = readFileSync(INVENTORY, 'utf-8');
const files = [...inv.matchAll(/^\| (src\/[^\s|]+\.tsx?) \|/gm)].map((m) => m[1]);
if (files.length === 0) {
  console.error('[check-ledger-coverage] 清单层解析为空——code-inventory.md 格式漂移？');
  process.exit(1);
}

// ---------- 归宿层：nine-point-zero.md「组件台账」节 ----------
const ledgerFull = readFileSync(LEDGER, 'utf-8');
const secStart = ledgerFull.indexOf('## 组件台账');
const secEnd = ledgerFull.indexOf('## 依赖图');
if (secStart === -1 || secEnd === -1 || secEnd <= secStart) {
  console.error('[check-ledger-coverage] 归宿层「组件台账」节定位失败——nine-point-zero.md 结构漂移？');
  process.exit(1);
}
const ledger = ledgerFull.slice(secStart, secEnd);

// 机读锚点：<!-- covers: a.ts, src/x/y.ts, dir/ -->（可多处出现）
const anchorTokens = [...ledger.matchAll(/<!--\s*covers:([^>]*)-->/g)]
  .flatMap((m) => m[1].split(/[，,]/).map((t) => t.trim()).filter(Boolean));
const anchorFiles = new Set(anchorTokens.filter((t) => t.endsWith('.ts')));
const anchorDirs = anchorTokens.filter((t) => t.endsWith('/'));

// 归组覆盖token：目录引用（xxx/）与通配（xxx-*）
const dirRefs = new Set([...ledger.matchAll(/[\w][\w.\-/]*\//g)].map((m) => m[0]));
for (const d of anchorDirs) dirRefs.add(d);
const wildcards = [...ledger.matchAll(/[\w][\w-]*-\*/g)].map((m) => m[0].slice(0, -1)); // 去尾 * 得前缀

function covered(f) {
  const base = f.split('/').pop();
  const noExt = f.replace(/\.tsx?$/, '');
  const baseNoExt = base.replace(/\.tsx?$/, '');
  if (anchorFiles.has(base) || anchorFiles.has(f) || anchorFiles.has(noExt) || anchorFiles.has(baseNoExt)) return true;
  if (ledger.includes(f) || ledger.includes(noExt) || ledger.includes(base) || ledger.includes(baseNoExt)) return true;
  for (const d of dirRefs) if (f.includes(d)) return true;
  for (const w of wildcards) if (baseNoExt.startsWith(w)) return true;
  return false;
}

const fileSet = new Set(files);
const baseSet = new Set(files.map((f) => f.split('/').pop()));

// ---------- a. 不全：有文件无归宿行 ----------
const uncovered = files.filter((f) => !covered(f));
if (uncovered.length) {
  for (const f of uncovered) {
    console.error(`[check-ledger-coverage] a. 无归宿行：${f}（清单层存在，组件台账零提及）`);
  }
  errors += uncovered.length;
}

// ---------- a2. 死锚：锚点点名的文件已不存在 ----------
const deadAnchors = [...anchorFiles].filter((t) => {
  if (!t.includes('/')) return !baseSet.has(t);
  return !fileSet.has(t) && !files.some((f) => f.endsWith('/' + t));
});
if (deadAnchors.length) {
  for (const t of deadAnchors) {
    console.error(`[check-ledger-coverage] a2. 死锚：covers 点名 ${t}，清单层不存在（文件已删锚点还在）`);
  }
  errors += deadAnchors.length;
}

// ---------- b. 不准：归宿行指向不存在文件 ----------
const refs = [...ledger.matchAll(/[\w.\-/]+\.ts\b/g)].map((m) => m[0]);
const dead = [];
for (const r of refs) {
  // 台账引用多为短路径（routes/files.ts 实指 src/server/routes/files.ts）——
  // 后缀匹配清单层；basename 形态查 basename 集合
  if (r.includes('/')) {
    const hit = fileSet.has(r) || files.some((f) => f.endsWith('/' + r));
    if (!hit && !existsSync(join(ROOT, r))) dead.push(r);
  } else {
    if (!baseSet.has(r)) dead.push(r);
  }
}
if (dead.length) {
  for (const r of [...new Set(dead)]) {
    console.error(`[check-ledger-coverage] b. 死账：归宿行引用 ${r}，磁盘与清单层均不存在`);
  }
  errors += dead.length;
}

if (errors) {
  console.error(`[check-ledger-coverage] ${errors} errors——迁移总账未咬合。修复路径：无归宿行 → 补台账行（含 ❌ 移除/退役）；死账 → 修正或标记移除，走 doc-write 规约。`);
  process.exit(1);
}
console.log(`[check-ledger-coverage] OK（src/** ${files.length} 文件全部有归宿行；台账引用零死账）`);
