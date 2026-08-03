#!/usr/bin/env node
/**
 * gen-contract-lists.mjs — 契约文件清单生成器（可生成事实登记表 P0）
 *
 * 语义单源 + 生成呈现：各域契约的「文件清单」从 code-inventory.md（机械生成的
 * 域归属表）提取，替换手写清单（手写会漂——canvas-tree 25 vs 实 31 教训）。
 *
 * 契约清单区约定：包在 `<!-- gen:contract-list -->` ... `<!-- /gen:contract-list -->`
 * 内，生成器只改标记内内容；未加标记的契约不碰。
 *
 * 用法：node scripts/check/gen-contract-lists.mjs [--check-only]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const CHECK_ONLY = process.argv.includes('--check-only');

const inventory = readFileSync(join(ROOT, 'docs/domains/code-inventory.md'), 'utf-8');

// 解析 inventory 域节：## <domain>（N 文件 · M 行）→ 文件列（相对路径）
// 节终止 = 下一个 `## ` 节标题或字符串真末尾——注意 JS 无 \Z（被当字面 Z：
// exports 列含 Z 的域节会被截断，floating-card 曾因此丢 card-registry.ts，BAR-GENLIST-01）
function domainFiles() {
  const map = {};
  const secRe = /^## (\S+)（\d+ 文件 · \d+ 行）\n\n\| 文件 \|[\s\S]*?(?=^## |$(?![\s\S]))/gm;
  let m;
  while ((m = secRe.exec(inventory))) {
    const domain = m[1];
    const files = [];
    for (const line of m[0].split('\n')) {
      const fm = /^\| ([^|]+) \| \d+ \|/.exec(line);
      if (fm) files.push(fm[1].trim());
    }
    map[domain] = files;
  }
  return map;
}

const byDomain = domainFiles();
const contractsDir = join(ROOT, 'docs/domains');
let changed = 0, total = 0;

for (const dir of readdirSync(contractsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
  const f = `${dir.name}/contract.md`;
  const path = join(contractsDir, f);
  if (!existsSync(path)) continue;
  const content = readFileSync(path, 'utf-8');
  if (!content.includes('gen:contract-list')) continue;
  const files = byDomain[dir.name];
  if (!files) {
    console.error(`[gen-contract-lists] ${f}: inventory 无域「${dir.name}」`);
    process.exit(1);
  }
  total++;
  const list = files.map(p => '`' + p + '`').join(' ');
  const generated = `<!-- gen:contract-list 自动生成，禁止手改（源：code-inventory） -->\n${list}\n<!-- /gen:contract-list -->`;
  const m = content.match(/<!-- gen:contract-list[\s\S]*?-->[\s\S]*?<!-- \/gen:contract-list -->/);
  if (!m) continue;
  if (m[0] !== generated) {
    if (CHECK_ONLY) {
      console.error(`[gen-contract-lists] ${f}: 文件清单与 inventory 漂移（未同步）`);
      process.exit(1);
    }
    writeFileSync(path, content.replace(m[0], generated));
    changed++;
  }
}

if (total === 0) {
  console.error('[gen-contract-lists] 没有契约启用 gen:contract-list 标记（0 个）');
  process.exit(CHECK_ONLY ? 1 : 0);
}
console.log(`[gen-contract-lists] ${CHECK_ONLY ? '验证' : '生成'}：${total} 个契约清单区，${CHECK_ONLY ? '' : '改写 ' + changed + ' 个，'}全部来自 inventory 单一出处`);
