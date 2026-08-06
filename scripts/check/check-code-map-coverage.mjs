#!/usr/bin/env node
/**
 * check-code-map-coverage.mjs — 部件级 code-map 覆盖门（2026-08-06 用户拍板，HUD 裸奔事故机械化）
 *
 * 出身：obs-hud.ts（观测台 HUD）上线两日无任何 code-map 覆盖——契约层检查
 *   check-doc-coverage（DOC-FLOW-08）只管「文件名出现在 contract.md 文件清单」，
 *   不管实然测绘层（code-map.md）；语义巡逻 code-map-vs-src 探针只查图→码方向
 *   （图上声称是否还成立），码→图方向（新部件有没有入图）无主人。
 *   部件级三先例（文件树/光球/卡片堆）均有图，HUD 是首个漏网部件。
 *
 * 规则：src/client/main.ts 直接 import 的本地模块（启动编排直挂 = 部件级判据）
 *   其 .ts 文件名必须出现在任一 docs/domains/{域}/code-map.md 中。
 *
 * 表面克制（宁紧勿宽，零误报优先）：
 *   - 只强制 main.ts 直接 import——能进启动编排的都是部件级；
 *   - 工具类/内部模块（被其他模块间接引用）不要求入图（code-map 测绘机制不测绘每个文件）。
 *   - import 解析：./modules/x.js → x.ts 文件名匹配（code-map 按 .ts 文件名登记）。
 *
 * 枚举型检查（每次全量重扫），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 * 修复路径：把部件补登进对应域 code-map.md（实然测绘），走 doc-write.yaml。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
let errors = 0;

// ---------- 语料：全部 code-map.md 并集 ----------
const mapsDir = join(ROOT, DOCS_ROOT, 'domains');
const mapTexts = [];
for (const e of readdirSync(mapsDir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const p = join(mapsDir, e.name, 'code-map.md');
  if (statSync(p, { throwIfNoEntry: false })?.isFile()) mapTexts.push(readFileSync(p, 'utf-8'));
}
const maps = mapTexts.join('\n');

// ---------- 强制面：main.ts 直接 import 的本地模块 ----------
const mainSrc = readFileSync(join(ROOT, 'src/client/main.ts'), 'utf-8');
const imports = [...mainSrc.matchAll(/import\s+(?:[\w{},\s*]+?\s+from\s+)?['"](\.\/[^'"]+)['"]/g)]
  .map(m => m[1]);

const unmapped = [];
for (const spec of imports) {
  const base = spec.split('/').pop().replace(/\.js$/, '.ts');
  if (!maps.includes(base)) unmapped.push(base);
}

if (unmapped.length) {
  for (const f of unmapped) console.error(`[check-code-map-coverage] 部件未入图：${f}（main.ts 直接 import，但任何 code-map.md 都没有它）`);
  console.error('[check-code-map-coverage] ⛳ DOC-FLOW-09：新部件无 code-map 家——补登对应域 code-map.md（实然测绘），走 workflows/doc-write.yaml');
  errors += unmapped.length;
}

if (errors) {
  console.error(`[check-code-map-coverage] ${errors} errors，构建中断。`);
  process.exit(1);
}
console.log(`[check-code-map-coverage] OK（main.ts 直挂部件 ${imports.length} 个全部入图）`);
