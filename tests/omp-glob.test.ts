// ==========================================================================
// tests/omp-glob.test.ts — glob 截断标记回归钉子（BAR-COMPACT-03）
//
// bug：glob 默认上限 maxResults=200，命中上限时输出无任何截断标记——
// 匹配 500 个文件 AI 会以为 200 就是全部（「未看全」类，grep 有
// `(结果被截断)` 标记而 glob 没有）。真实会话实测：一次 pattern="*"
// 恰好顶到 200 行，无法判断是全部还是截断。
//
// 契约（+1 探针法）：向 native 请求 maxResults+1 个——
//   返回 >maxResults → 只展示 maxResults 条 + 追加 `(结果被截断)` 标记行
//   返回 ≤maxResults → 全展示、无标记（恰好等于上限不算截断）
// 语义与 grep limitReached 同构：「至少还有 1 个未显示」，不声称精确总数。
//
// revert 验证：本钉子先于修复提交，未修复时三条全红。
// ==========================================================================

import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { group, regression } from './runner.js';
import { ompGlobTool } from '../src/server/ai/tools/omp/glob.js';
import type { ToolContext } from '../src/server/ai/tools/types.js';

group('omp/glob — 截断标记（BAR-COMPACT-03）');

// 夹具：临时目录 4 个文件（真实 native glob，不走 mock）
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kfm-glob-trunc-'));
for (const n of ['a1.txt', 'a2.txt', 'a3.txt', 'a4.txt']) {
  fs.writeFileSync(path.join(DIR, n), 'x');
}
const CTX = { cwd: DIR, wsServer: null } as unknown as ToolContext;

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.map(c => c.text || '').join('');
}

regression('BAR-COMPACT-03', 'glob-trunc', '超出上限 → 追加 `(结果被截断)` 标记行', async () => {
  const r = await ompGlobTool.execute({ pattern: '*.txt', path: DIR, maxResults: 2 }, CTX);
  const lines = textOf(r).split('\n').filter(l => l.trim());
  assert(lines.includes('(结果被截断)'), `缺截断标记，得 ${JSON.stringify(lines)}`);
  assert(lines.filter(l => l !== '(结果被截断)').length === 2, '只应展示 maxResults 条');
});

regression('BAR-COMPACT-03', 'glob-trunc', '未超上限 → 无标记', async () => {
  const r = await ompGlobTool.execute({ pattern: '*.txt', path: DIR, maxResults: 10 }, CTX);
  const t = textOf(r);
  assert(!t.includes('(结果被截断)'), `不应有截断标记，得 ${t}`);
  assert(t.split('\n').filter(l => l.trim()).length === 4, '4 个文件全展示');
});

regression('BAR-COMPACT-03', 'glob-trunc', '恰好等于上限 → 无标记（+1 探针的精确性）', async () => {
  const r = await ompGlobTool.execute({ pattern: '*.txt', path: DIR, maxResults: 4 }, CTX);
  const t = textOf(r);
  assert(!t.includes('(结果被截断)'), `恰好顶格不算截断，得 ${t}`);
  assert(t.split('\n').filter(l => l.trim()).length === 4);
});
