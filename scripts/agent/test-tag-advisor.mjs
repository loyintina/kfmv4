/**
 * test-tag-advisor.mjs — tag 检测器回放测试（黄金集 = 历史版本对）
 *
 * 测试协议第一段（STACK #3 定稿）：对每个历史区间（prev_tag → tag），
 * 用当时的提交窗口跑 tag-advisor，对比推荐级别与实际发版级别，算一致率。
 * 分歧样本打印出来供 prompt 调优——不一致不必然错（历史发版本就不规范），
 * 但一致率是投产前必须过的门槛（≥70% 进影子模式，<70% 调 prompt 重测）。
 *
 * 用法：node scripts/agent/test-tag-advisor.mjs [近N对]（默认全部，费 API 调用）
 */

import { execFileSync, execSync } from 'child_process';

const limit = parseInt(process.argv[2] || '0', 10);
const tags = execSync("git tag -l 'v*' --sort=v:refname", { encoding: 'utf-8' }).trim().split('\n')
  .filter(t => /^v\d+\.\d+\.\d+$/.test(t));  // 只保留严格 semver tag（v4.x 后缀快照 tag 是测试集噪音）
const pairs = [];
for (let i = 1; i < tags.length; i++) pairs.push([tags[i - 1], tags[i]]);
const selected = limit > 0 ? pairs.slice(-limit) : pairs;

function actualLevel(prev, tag) {
  const [a1, b1, c1] = prev.replace('v', '').split('.').map(Number);
  const [a2, b2, c2] = tag.replace('v', '').split('.').map(Number);
  if (a2 > a1) return 'major';
  if (b2 > b1) return 'minor';
  if (c2 > c1) return 'patch';
  return 'none';
}

let agree = 0, total = 0;
const disagreements = [];

for (const [prev, tag] of selected) {
  const commits = execSync(`git log ${prev}..${tag} --oneline | wc -l`, { encoding: 'utf-8' }).trim();
  if (commits === '0') continue;
  let suggested = null;
  try {
    const out = execFileSync('node', ['scripts/agent/tag-advisor.mjs', prev, tag], {
      encoding: 'utf-8', timeout: 120_000,
    });
    suggested = JSON.parse(out.slice(0, out.indexOf('\n\n'))).level;
  } catch (e) {
    console.log(`${prev}→${tag}: 运行失败（${e.message.slice(0, 80)}）`);
    continue;
  }
  const actual = actualLevel(prev, tag);
  total++;
  const hit = suggested === actual;
  if (hit) agree++;
  else disagreements.push({ pair: `${prev}→${tag}`, commits, suggested, actual });
  console.log(`${prev}→${tag}（${commits} 提交）: 建议 ${suggested} / 实际 ${actual} ${hit ? '✅' : '❌'}`);
}

console.log(`\n[test-tag-advisor] 一致率 ${agree}/${total}（${total ? Math.round((agree / total) * 100) : 0}%）`);
if (disagreements.length) {
  console.log('分歧样本（调 prompt 的输入，不必然是错——历史发版本就不规范）：');
  for (const d of disagreements) console.log(`  ${d.pair}: 建议 ${d.suggested} vs 实际 ${d.actual}`);
}
