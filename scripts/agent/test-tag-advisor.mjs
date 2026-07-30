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

import { execFile, execSync } from 'child_process';

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

// 全并发（2026-07-30 用户拍板）：14 对互不依赖，压测证明链路 40 并发全绿——
// 串行 15-25 分钟 → 全并发约 1-2 分钟。结果按原序收集，输出顺序不变。
function runPair([prev, tag]) {
  return new Promise((resolvePromise) => {
    const commits = execSync(`git log ${prev}..${tag} --oneline | wc -l`, { encoding: 'utf-8' }).trim();
    if (commits === '0') return resolvePromise(null);
    execFile('node', ['scripts/agent/tag-advisor.mjs', prev, tag], { encoding: 'utf-8', timeout: 180_000 }, (err, out) => {
      if (err) return resolvePromise({ prev, tag, commits, failed: err.message.slice(0, 80) });
      let suggested = null;
      try { suggested = JSON.parse(out.slice(0, out.indexOf('\n\n'))).level; } catch { /* 落 failed */ }
      if (!suggested) return resolvePromise({ prev, tag, commits, failed: '输出解析失败' });
      resolvePromise({ prev, tag, commits, suggested, actual: actualLevel(prev, tag) });
    });
  });
}

const settled = (await Promise.all(selected.map(runPair))).filter(Boolean);

let agree = 0, total = 0;
const disagreements = [];
for (const r of settled) {
  if (r.failed) { console.log(`${r.prev}→${r.tag}: 运行失败（${r.failed}）`); continue; }
  total++;
  const hit = r.suggested === r.actual;
  if (hit) agree++;
  else disagreements.push({ pair: `${r.prev}→${r.tag}`, commits: r.commits, suggested: r.suggested, actual: r.actual });
  console.log(`${r.prev}→${r.tag}（${r.commits} 提交）: 建议 ${r.suggested} / 实际 ${r.actual} ${hit ? '✅' : '❌'}`);
}

console.log(`\n[test-tag-advisor] 一致率 ${agree}/${total}（${total ? Math.round((agree / total) * 100) : 0}%）`);
if (disagreements.length) {
  console.log('分歧样本（调 prompt 的输入，不必然是错——历史发版本就不规范）：');
  for (const d of disagreements) console.log(`  ${d.pair}: 建议 ${d.suggested} vs 实际 ${d.actual}`);
}
