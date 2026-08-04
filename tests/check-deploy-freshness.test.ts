import assert from 'assert';
import { regression } from './harness.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// BAR-FRESH-01 家族：deploy-freshness 自锁根治（2026-08-04）
// 病根：旧口径「HEAD 提交时间 > buildTime」→ build 戳提交（只动 public/index.html）
// 必然晚于 buildTime → 红 → 再部署 → 新 buildTime → 再提交戳 → 再红，死循环。
// 修复口径：只查「最后一个改 src/ 的提交时间」——只改非 src 的提交不算未部署。

const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

regression('BAR-FRESH-01', 'src-only-commit', 'deploy-freshness 必须只查 src/ 提交（裸 HEAD 时间 = 戳提交必红的自锁根因）', async () => {
  const src = readFileSync(url('../scripts/check/check-deploy-freshness.mjs'), 'utf-8');
  assert(!/git log -1 --format=%cI'/.test(src), '不得用裸 HEAD 提交时间——build 戳提交晚于 buildTime 必红，回到自锁');
  assert(/git log -1 --format=%cI -- src\//.test(src), '必须限定 src/ 路径——只改非 src 的提交（构建戳）不算未部署');
  assert(src.includes('lastSrcCommitMs'), '必须用 lastSrcCommitMs（最后一个 src 提交）作为已提交未部署口径');
});
