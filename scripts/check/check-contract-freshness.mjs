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

const THRESHOLD = 5;

// 域 → src 路径映射。新增模块/目录时必须同步此表（check-doc-coverage 会兜底漏网文件）。
const DOMAIN_SRC = {
  'canvas-tree': [
    'src/client/modules/tree-render.ts', 'src/client/modules/tree-overlay.ts',
    'src/client/modules/tree-animation.ts', 'src/client/modules/tree-swipe.ts',
    'src/client/modules/tree-model.ts', 'src/client/modules/tree-loader.ts',
    'src/client/modules/canvas-cursor.ts', 'src/client/modules/liquid-geometry.ts',
    'src/client/modules/canvas-scroll.ts', 'src/client/modules/canvas-utils.ts',
    'src/client/modules/style-registry.ts', 'src/client/modules/theme.ts',
    'src/client/modules/color-utils.ts', 'src/client/modules/sibling-switcher.ts',
    'src/client/modules/mode-system.ts', 'src/client/modules/file-action-bar.ts',
    'src/client/modules/char-rain.ts', 'src/client/engine/',
  ],
  'floating-card': [
    'src/client/modules/card-registry.ts', 'src/client/modules/card-stack.ts',
    'src/client/modules/floating-card.ts', 'src/client/modules/floating-shared.ts',
    'src/client/modules/floating-fullscreen.ts', 'src/client/modules/terminal-card-04.ts',
    'src/client/modules/tmux-card.ts', 'src/client/cards/', 'src/client/modules/renderers/',
  ],
  'client-shell': [
    'src/client/main.ts', 'src/client/modules/app.ts', 'src/client/modules/ui.ts',
    'src/client/modules/dom-refs.ts', 'src/client/modules/state.ts',
    'src/client/modules/renderer-lifecycle.ts', 'src/client/modules/ui-registry.ts',
    'src/client/modules/gesture-registry.ts', 'src/client/modules/animation-registry.ts',
    'src/client/modules/interaction-constants.ts', 'src/client/modules/drag-handler.ts',
    'src/client/modules/click-queue.ts', 'src/client/modules/z-index-layers.ts',
    'src/client/modules/orb.ts', 'src/client/modules/orb-panel.ts',
    'src/client/modules/orb-state.ts', 'src/client/modules/gestures.ts',
    'src/client/modules/debug-assert.ts', 'src/client/modules/custom-select.ts',
    'src/client/modules/confirm-dialog.ts', 'src/client/modules/card-toast.ts',
    'src/client/modules/logger.ts',
  ],
  'ai-chat': [
    'src/client/modules/orb-chat.ts', 'src/client/modules/orb-chat-run.ts',
    'src/client/modules/orb-chat-hints.ts', 'src/client/modules/chat-dom.ts',
    'src/client/modules/session-client.ts', 'src/client/modules/ws-channel.ts',
    'src/shared/chat-protocol/', 'src/shared/tool-compaction/',
    'src/server/ai/', 'src/server/prompts/', 'src/client/data/waiting-hints.ts',
  ],
  'server': [
    'src/server/index.ts', 'src/server/path-utils.ts', 'src/server/terminal-pty.ts',
    'src/server/ws-server.ts', 'src/server/ai-tools.ts', 'src/server/capability-executor.ts',
    'src/server/routes/',
  ],
  'infra': [
    'build.mjs', 'scripts/check/', 'tests/', 'public/css/',
  ],
};

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
