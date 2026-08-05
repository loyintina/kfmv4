import assert from 'assert';
import { regression } from './harness.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parseOnly } from '../scripts/agent/semantic-audit.mjs';

// BAR-SEMCHAIN-03 家族：semantic-audit --task 多任务并发（2026-08-05 裁决轮基建）。
// 单跑验证由串行 ~15 分钟降到并发 3-5 分钟；防「退回单任务」退化（旧实现 t.id === ONLY）。

const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const src = (rel: string) => readFileSync(url(rel), 'utf-8');

regression('BAR-SEMCHAIN-03', 'parse-only-multi', '--task 支持逗号分隔多任务；空/缺省 → null（全量模式语义不变）', async () => {
  assert.strictEqual(parseOnly([]), null, '无 --task → null（全量模式）');
  assert.strictEqual(parseOnly(['--task=']), null, '空 --task → null');
  assert.deepStrictEqual(parseOnly(['--task=stack-vs-ledger']), ['stack-vs-ledger'], '单任务兼容');
  assert.deepStrictEqual(parseOnly(['--task=a,b,c']), ['a', 'b', 'c'], '逗号分隔多任务解析');
  assert.deepStrictEqual(parseOnly(['--task=a, b, c']), ['a', 'b', 'c'], '空白 trim');
});

regression('BAR-SEMCHAIN-03', 'selected-includes', '任务选择须用 ONLY.includes——防退回 === 单任务退化', async () => {
  const auditSrc = src('../scripts/agent/semantic-audit.mjs');
  assert(auditSrc.includes('ONLY.includes(t.id)'), 'selected 过滤须用 ONLY.includes——退回 === 即单任务退化');
  assert(auditSrc.includes("raw.split(',')"), '解析须含 split(,)（逗号分隔契约）');
});
