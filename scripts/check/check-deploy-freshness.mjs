/**
 * check-deploy-freshness.mjs — 部署新鲜度硬门（纪律机械化 SOP：旧包验证病灶收编）
 *
 * 病灶：修复后未重新构建/重启，用户验证的是旧包——「反复修反复没效果」
 * 历史高发模式（diagnostics 构建/Bundle #4「环境版本错位」，kfmv4.0 起反复出现）。
 * 检测手段（版本握手 BAR-BUILD-05 + deploy.sh 闭环）早已存在，但靠自觉想起去跑
 * → 自觉是最不可靠的部件 → 机械化：源码比包新 = 链红，部署前交付永远不过。
 *
 * 口径：max(最后一个改 src/ 的提交时间, src/ 最新 .ts mtime) > dist/build-info.json 的 buildTime → fail。
 *   - 「最后一个改 src/ 的提交时间」覆盖「已提交未部署」——只改非 src（如 public/index.html
 *     构建戳）的提交不算未部署（2026-08-04 根治：build 戳提交必然晚于 buildTime，
 *     旧口径 HEAD 时间导致「提交戳 → freshness 红 → 再部署 → 再提交戳」自锁）
 *   - src mtime 覆盖「改了没提交」（check-uncommitted 只管 >3 文件，漏小改动）
 * build.mjs 构建中途源码必然比包新 → 构建内调用链时以 --soft=check-deploy-freshness 跳过本步。
 *
 * 解除方式：bash scripts/deploy-fast.sh（会话中途快通道）或 bash scripts/deploy.sh（交付全链）。
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const red = s => `[31m${s}[0m`;
const box = (title, lines) => {
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error(`║  🚫 ${title}`);
  console.error('╠══════════════════════════════════════════════════════════════╣');
  for (const l of lines) console.error(`║  ${l}`);
  console.error('╚══════════════════════════════════════════════════════════════╝');
};

// dist/build-info.json 缺失 = 从未构建（或构建不完整）——同样阻断
if (!existsSync('dist/build-info.json')) {
  box('部署新鲜度：dist/build-info.json 不存在', [
    '从未构建（或构建不完整）。先跑 bash scripts/deploy.sh 建立基线。',
  ]);
  process.exit(1);
}

const buildTime = JSON.parse(readFileSync('dist/build-info.json', 'utf-8')).buildTime;
const buildMs = Date.parse(buildTime);
if (!buildTime || Number.isNaN(buildMs)) {
  box('部署新鲜度：build-info.json 损坏', ['无法解析 buildTime，重跑 bash scripts/deploy.sh 重建。']);
  process.exit(1);
}

// 最后一个改 src/ 的提交时间（已提交未部署的口径）——只改非 src（build 戳）不算未部署，
// 根治「提交戳 → freshness 红 → 再部署 → 再提交戳」自锁（2026-08-04）
let lastSrcCommitMs = 0;
try {
  const lastSrc = execSync('git log -1 --format=%cI -- src/', { encoding: 'utf-8' }).trim();
  if (lastSrc) lastSrcCommitMs = Date.parse(lastSrc);
} catch { /* 无 git 历史时只靠 mtime */ }

// src/ 最新 .ts mtime（改了没提交的口径）
let newestSrcMs = 0, newestSrcFile = '';
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (extname(full) === '.ts' && st.mtimeMs > newestSrcMs) { newestSrcMs = st.mtimeMs; newestSrcFile = full; }
  }
})('src');

const staleByCommit = lastSrcCommitMs > buildMs;
const staleBySource = newestSrcMs > buildMs;

if (staleByCommit || staleBySource) {
  const lines = [
    `包体 buildTime: ${buildTime}`,
  ];
  if (staleByCommit) lines.push(`最后一个 src/ 提交更晚: ${new Date(lastSrcCommitMs).toISOString()}（已提交未部署）`);
  if (staleBySource) lines.push(`源码文件更晚: ${newestSrcFile}（有未构建的改动）`);
  lines.push(
    '',
    '⛔ 源码比包新——在旧包上验证修复会得到假阴性（旧包验证病灶）。',
    '会话中途快部署: bash scripts/deploy-fast.sh',
    '交付验证全链路: bash scripts/deploy.sh',
  );
  box(red('部署新鲜度：源码比包新，交付被阻断'), lines);
  process.exit(1);
}

console.log(`[check-deploy-freshness] OK — 包体不旧于源码（buildTime: ${buildTime}）`);
