/**
 * check-release-radar.mjs — 发版雷达（v8.3.0，warning 模式）
 *
 * 职责：解决「人和 agent 都没意识到该发版了」——机械层负责不忘。
 * 阈值（经 14 历史版本对论证）：距上个 tag commits ≥ 30 或 feat ≥ 10 → 提醒。
 * 雷达只负责「值得看一眼」；级别判断归 scripts/agent/tag-advisor.mjs（语义层），
 * 拍板归人（tag 是 git mutation）。
 *
 * 兑现 release.yaml 铺路字段（≥30 fix → 发版候选提醒 的修订版：fix-only 阈值
 * 历史上命中太少，改为 commits/feat 复合）。
 * 挂入 npm run check，**只提醒不中断**（exit 0）。git 历史型检查，豁免探针。
 */

import { execSync } from 'child_process';

let lastTag, commits;
try {
  lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
  commits = execSync(`git log ${lastTag}..HEAD --format='%s'`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
} catch {
  console.log('[check-release-radar] git 不可用或无 tag，跳过');
  process.exit(0);
}

const feat = commits.filter(s => s.startsWith('feat')).length;
const total = commits.length;
const THRESH_COMMITS = 30;
const THRESH_FEAT = 10;

if (total >= THRESH_COMMITS || feat >= THRESH_FEAT) {
  console.warn(`[check-release-radar][WARN] 距 ${lastTag} 已 ${total} 提交（feat:${feat}）——发版候选`);
  console.warn('[check-release-radar][WARN] 跑 `node scripts/agent/tag-advisor.mjs` 让语义层给级别建议（拍板归人）');
} else {
  console.log(`[check-release-radar] OK — 距 ${lastTag} 共 ${total} 提交（feat:${feat}），未达发版候选线（${THRESH_COMMITS} 提交/${THRESH_FEAT} feat）`);
}
