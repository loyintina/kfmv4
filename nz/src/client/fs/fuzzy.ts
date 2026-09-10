/**
 * fuzzy.ts — @ 文件引用模糊引擎（v1 判据稿 §4.2；纯函数零依赖，na 可直译）。
 *
 * 匹配域：相对路径。规则按优先级评分（高分在前）：
 *   分段名精确 100 > 分段名前缀 80 > 路径子串 60 > 子序列 40
 * 加权：命中落在文件名段（末段）加分；路径越短加分。大小写不敏感；
 * CJK 按字面子串（拼音 v2）。返回按分数降序、同分按路径短者优先。
 */

// 档位分（×1000 保证加成永不越级——09-10 考卷实锤短路径加成曾跨级）
const TIER = { segExact: 4, segPrefix: 3, substring: 2, subsequence: 1 } as const;

const lc = (s: string): string => s.toLowerCase();

/** 子序列判定：q 的字符按序出现在 s 中 */
function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (const ch of s) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return q.length === 0;
}

/** 单路径评分：null=不命中 */
export function fuzzyScore(path: string, query: string): number | null {
  const q = lc(query.trim());
  if (q === '') return null;
  const p = lc(path);
  if (!p.includes(q) && !isSubsequence(q, p)) return null;

  const segs = p.split('/');
  const fileSeg = segs[segs.length - 1];
  let tier: number;
  if (fileSeg === q) tier = TIER.segExact;
  else if (fileSeg.startsWith(q)) tier = TIER.segPrefix;
  else if (p.includes(q)) tier = TIER.substring;
  else tier = TIER.subsequence;

  let score = tier * 1000;
  if (fileSeg.includes(q)) score += 20; // 文件名段加权
  score += Math.max(0, 20 - Math.floor(p.length / 8)); // 短路径加分（<1000，永不越级）
  return score;
}

/** 批量搜索：评分降序、同分路径短者优先、截取 cap 条 */
export function fuzzySearch(paths: string[], query: string, cap = 20): Array<{ path: string; score: number }> {
  const hits: Array<{ path: string; score: number }> = [];
  for (const p of paths) {
    const score = fuzzyScore(p, query);
    if (score !== null) hits.push({ path: p, score });
  }
  hits.sort((x, y) => y.score - x.score || x.path.length - y.path.length || (x.path < y.path ? -1 : 1));
  return hits.slice(0, cap);
}
