#!/usr/bin/env node
/**
 * session-retention.mjs — 巡逻会话生命周期（2026-08-06 用户拍板：只进不出必淤积）
 *
 * 出身：sessions/script/ 只进不出——巡逻探针会话（patrol-*.json）是证据链档案
 *   （结论已蒸馏进 semantic-audit-state.json + 信箱，原文价值=回溯/幻觉考古），
 *   值得留但不值得全留热层。用户判断：治淤积的药是生命周期，不是换数据库。
 *
 * 规则：patrol-*.json 且 mtime 超龄（默认 90 天）→ tar.gz 归档进
 *   sessions/script/archive/（按归档运行日命名，追加安全），原件删除。
 *
 * 表面克制（不越界）：
 *   - 只碰 patrol- 前缀——bi-/px-/sandbox- 前缀与 _quarantine 全是 paradigm
 *     实验进程的现场（清理策略归它，2026-08-06 用户分工）；
 *   - 面板区 sessions/*.json（人工会话）绝不进本脚本视野；
 *   - 归档不压缩内容挑选——整文件进出，证据链保真。
 *
 * 用法：node scripts/agent/session-retention.mjs [--days=90] [--dry-run]
 * 测试注入：KFM_DATA_DIR 环境变量可改数据根（默认 ~/.kfmv4）。
 */

import { readdirSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const DATA_DIR = process.env.KFM_DATA_DIR || join(homedir(), '.kfmv4');
const SCRIPT_DIR = join(DATA_DIR, 'sessions', 'script');
const ARCHIVE_DIR = join(SCRIPT_DIR, 'archive');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const daysArg = args.find(a => a.startsWith('--days='));
const DAYS = daysArg ? parseInt(daysArg.slice(7), 10) : 90;
if (!Number.isFinite(DAYS) || DAYS < 1) {
  console.error('[session-retention] --days 必须为正整数');
  process.exit(1);
}

const cutoff = Date.now() - DAYS * 86_400_000;

const expired = readdirSync(SCRIPT_DIR, { withFileTypes: true })
  .filter(e => e.isFile() && e.name.startsWith('patrol-') && e.name.endsWith('.json'))
  .filter(e => statSync(join(SCRIPT_DIR, e.name)).mtimeMs < cutoff)
  .map(e => e.name)
  .sort();

if (!expired.length) {
  console.log(`[session-retention] OK（patrol-* 无超龄 ${DAYS} 天文件）`);
  process.exit(0);
}

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const archiveName = `patrol-expired-${stamp}.tar.gz`;
console.log(`[session-retention] ${expired.length} 个超龄巡逻会话 → archive/${archiveName}${DRY ? '（dry-run，未动）' : ''}`);
for (const f of expired) console.log(`  ${f}`);

if (!DRY) {
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  execSync(`tar -czf ${JSON.stringify(join(ARCHIVE_DIR, archiveName))} -C ${JSON.stringify(SCRIPT_DIR)} ${expired.map(f => JSON.stringify(f)).join(' ')}`);
  for (const f of expired) execSync(`rm ${JSON.stringify(join(SCRIPT_DIR, f))}`);
  console.log(`[session-retention] 归档完成，原件已清`);
}
