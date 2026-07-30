#!/usr/bin/env node
// 冰山工作量验证实验（一次性，STACK #3 登记项，验证 invariants 心法 34 庙算优先）
// 口径（先修尺再量物）：
//   feat  = 提交 subject 匹配 ^feat(\(|:)
//   fix   = 提交 subject 匹配 ^fix(\(|:)
//   fix链 = 某 feat 之后、到下一个 feat 或 tag 之间的 fix 提交数
//   前置讨论 = 该 feat 之前 30 个提交窗口内存在「设计类 docs 提交」
//            （subject 以 docs 开头且含 设计/方案/SPEC/立项/锁定/设计稿）
// 已知测量边界（诚实记录）：
//   ① fix 归属是近邻代理——fix 可能修的是更早的 feat，归因有噪声
//   ② 讨论发生在对话里，仓库只能看到沉淀成 docs 提交的部分——
//     「无前置讨论」=「无 docs 沉淀的讨论」，不等于真的没讨论
// 用法：node scripts/agent/exp-iceberg.mjs [--json]
import { execSync } from 'node:child_process';

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();

const lines = git('log --reverse --pretty=format:"%H|%ad|%s" --date=short').split('\n');
const tagHashes = new Set(
  git('tag').split('\n').filter(Boolean)
    .map((t) => git(`rev-list -n1 ${t}`)),
);

const isFeat = (s) => /^feat(\(|:)/.test(s);
const isFix = (s) => /^fix(\(|:)/.test(s);
const isDesignDoc = (s) =>
  /^docs/.test(s) && /设计|方案|SPEC|spec|立项|锁定|设计稿/.test(s);

const commits = lines.map((l) => {
  const [h, d, ...rest] = l.split('|');
  return { h, d, s: rest.join('|') };
});

const WINDOW = 30;
const feats = [];
for (let i = 0; i < commits.length; i++) {
  const c = commits[i];
  if (!isFeat(c.s)) continue;
  let chain = 0;
  for (let j = i + 1; j < commits.length; j++) {
    if (isFeat(commits[j].s) || tagHashes.has(commits[j].h)) break;
    if (isFix(commits[j].s)) chain++;
  }
  let discussed = false;
  let designRef = null;
  for (let j = i - 1; j >= Math.max(0, i - WINDOW); j--) {
    if (isDesignDoc(commits[j].s)) {
      discussed = true;
      designRef = commits[j].s.slice(0, 50);
      break;
    }
  }
  feats.push({ h: c.h, d: c.d, chain, discussed, designRef, s: c.s });
}

const withD = feats.filter((f) => f.discussed);
const noD = feats.filter((f) => !f.discussed);
const avg = (a) => (a.length ? (a.reduce((x, f) => x + f.chain, 0) / a.length) : NaN);
const med = (a) => {
  if (!a.length) return NaN;
  const s = [...a.map((f) => f.chain)].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// 显著性：置换检验（mean 差，10000 次洗牌，双侧）
const permTest = (a, b, iters = 10000) => {
  const obs = Math.abs(avg(a) - avg(b));
  const all = [...a.map((f) => f.chain), ...b.map((f) => f.chain)];
  let ge = 0;
  for (let k = 0; k < iters; k++) {
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const sa = all.slice(0, a.length).reduce((x, y) => x + y, 0) / a.length;
    const sb = all.slice(a.length).reduce((x, y) => x + y, 0) / b.length;
    if (Math.abs(sa - sb) >= obs) ge++;
  }
  return ge / iters;
};

// 时代混杂控制：以 v7.0.0 为界（文档文化分界点），分两段各自重算
const eraBoundary = git('rev-list -n1 v7.0.0');
const bIdx = commits.findIndex((c) => c.h === eraBoundary);
const eraOf = (f) => (commits.findIndex((c) => c.h === f.h) < bIdx ? 'pre-v7' : 'post-v7');
const eraStats = (era) => {
  const sub = feats.filter((f) => eraOf(f) === era);
  const wd = sub.filter((f) => f.discussed);
  const nd = sub.filter((f) => !f.discussed);
  return { era, wdN: wd.length, wdAvg: +avg(wd).toFixed(2), ndN: nd.length, ndAvg: +avg(nd).toFixed(2) };
};
const eras = [eraStats('pre-v7'), eraStats('post-v7')];

const summary = {
  totals: {
    commits: commits.length,
    feat: commits.filter((c) => isFeat(c.s)).length,
    fix: commits.filter((c) => isFix(c.s)).length,
    designDocs: commits.filter((c) => isDesignDoc(c.s)).length,
    tags: tagHashes.size,
  },
  window: WINDOW,
  discussed: { n: withD.length, avgChain: +avg(withD).toFixed(2), medChain: med(withD), thickTail: withD.filter((f) => f.chain >= 5).length },
  notDiscussed: { n: noD.length, avgChain: +avg(noD).toFixed(2), medChain: med(noD), thickTail: noD.filter((f) => f.chain >= 5).length },
  permTestP: permTest(withD, noD),
  eras,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, feats }, null, 2));
} else {
  console.log('== 冰山工作量验证实验 ==');
  console.log(
    `样本: ${summary.totals.commits} 提交 | feat ${summary.totals.feat} | fix ${summary.totals.fix}` +
      ` | 设计类docs ${summary.totals.designDocs} | tag ${summary.totals.tags} | 窗口 ${WINDOW}`,
  );
  console.log(
    `有前置设计沉淀: n=${summary.discussed.n} 平均fix链=${summary.discussed.avgChain} 中位=${summary.discussed.medChain} 厚尾(链>=5)=${summary.discussed.thickTail}`,
  );
  console.log(
    `无前置设计沉淀: n=${summary.notDiscussed.n} 平均fix链=${summary.notDiscussed.avgChain} 中位=${summary.notDiscussed.medChain} 厚尾(链>=5)=${summary.notDiscussed.thickTail}`,
  );
  console.log(`置换检验 p=${summary.permTestP}（mean 差，10000 次洗牌，双侧）`);
  for (const e of summary.eras) {
    console.log(`  ${e.era}: 有讨论 n=${e.wdN} avg=${e.wdAvg} | 无讨论 n=${e.ndN} avg=${e.ndAvg}`);
  }
  console.log('\n-- fix链 >= 5 的 feat（厚尾明细）--');
  for (const f of feats.filter((f) => f.chain >= 5)) {
    console.log(
      `  ${f.h} ${f.d} 链${f.chain} ${f.discussed ? '[有讨论]' : '[无讨论]'} ${f.s.slice(0, 45)}`,
    );
  }
}
