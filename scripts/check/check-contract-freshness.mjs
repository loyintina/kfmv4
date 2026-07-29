/**
 * KFM v4 — 域契约新鲜度检查（check-handbook-sync + check-desc-freshness 合并继任者）
 *
 * 原理：每个 domains/{域}/contract.md 是该域代码的同步契约。如果域内 src 文件
 * 在 contract 最后一次提交之后又积累了 ≥5 次提交，contract 很可能已过时 → 硬阻断。
 *
 * 纯 git 启发式，无 frontmatter 簿记（git 即账本，单一来源）。
 * 解除方式：审查该域 contract 与代码的同步性，做任何实质性更新提交即重置计数。
 *
 * 挂入 npm run check，过期 = 构建中断。
 */

import { execSync } from 'child_process';
import { DOCS_ROOT } from './docs-root-const.mjs';
import { DOMAIN_SRC } from './domain-src.mjs';

const THRESHOLD = 5;

let errors = 0;

for (const [domain, srcPaths] of Object.entries(DOMAIN_SRC)) {
  const contract = `${DOCS_ROOT}/domains/${domain}/contract.md`;
  let last;
  try {
    last = execSync(`git log -1 --format=%ci -- "${contract}"`, { encoding: 'utf-8' }).trim();
  } catch {
    console.error(`[check-contract-freshness] ERROR — 无法读取 ${contract} 的 git 历史`);
    errors++;
    continue;
  }
  if (!last) {
    console.error(`[check-contract-freshness] ERROR — ${contract} 无 git 提交记录（未提交？）`);
    errors++;
    continue;
  }
  const count = parseInt(
    execSync(
      `git log --since="${last}" --format=%H -- ${srcPaths.map(p => `"${p}"`).join(' ')} | wc -l`,
      { encoding: 'utf-8', shell: '/bin/bash' }
    ).trim(),
    10
  );
  if (count >= THRESHOLD) {
    console.error(
      `[CONTRACT OUTDATED] ${contract} 最后提交 (${last.slice(0, 10)}) 之后，域内代码已有 ${count} 次提交`
    );
    console.error(`  → 审查该域 contract 是否与代码同步（#陷阱/文件清单/硬规则），做实质性更新提交即重置`);
    errors++;
  } else {
    console.log(`[check-contract-freshness] ${domain} ✅（${count}/${THRESHOLD}）`);
  }
}

if (errors > 0) {
  console.error(`\n[check-contract-freshness] ${errors} 个域契约疑似过时，构建中断。`);
  process.exit(1);
}
console.log('[check-contract-freshness] OK — 全部域契约在新鲜度阈值内');

// ========== 映射双向健康（v8.2 批 4：防「建立时刻快照」） ==========
// 方向 1：src/ 每个 .ts 必须被某个域的映射覆盖（新文件无归属 = 新鲜度失明）
// 方向 2：映射条目必须真实存在（映射指向已删文件 = 僵尸条目）

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const allPaths = Object.values(DOMAIN_SRC).flat();
let mapErrors = 0;

const srcFiles = walk(join(ROOT, 'src')).filter(f => f.endsWith('.ts'))
  .map(f => f.slice(ROOT.length).replace(/^\//, '').replace(/\\/g, '/'));
for (const f of srcFiles) {
  if (!allPaths.some(p => f === p || f.startsWith(p))) {
    console.error(`[check-contract-freshness] 映射盲区：${f} 不属于任何域——在 DOMAIN_SRC 登记归属，否则新鲜度对它永远失明`);
    mapErrors++;
  }
}

for (const p of allPaths) {
  if (!existsSync(join(ROOT, p))) {
    console.error(`[check-contract-freshness] 僵尸映射：${p} 在 DOMAIN_SRC 登记但文件已不存在（删条目或改指新家）`);
    mapErrors++;
  }
}

if (mapErrors > 0) {
  console.error(`\n[check-contract-freshness] ${mapErrors} 处映射不健康，构建中断。`);
  process.exit(1);
}
console.log(`[check-contract-freshness] 映射健康 ✅（${srcFiles.length} 个 src 文件全部有域归属，${allPaths.length} 条映射无僵尸）`);
