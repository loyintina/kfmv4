import assert from 'assert';
import { regression } from './harness.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parseOnly, buildPrompt, mechanicalOwners } from '../scripts/agent/semantic-audit.mjs';

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

// BAR-SEMCHAIN-05 家族：SEM001-1/SEM002-1 结晶机械化（2026-08-12 用户拍板）——
// 「数字/区块有机械主人」误报家族 6 判例（EX-007~012）→ prompt 注入机械主人节。
// 铁律：清单必须从活源头现扫（sync-counts TARGETS / gen: 标记），写死文件 = 同根病复发。

regression('BAR-SEMCHAIN-05', 'mechanical-owners-live-derived', '机械主人清单从活源头现扫：sync-counts 回写点 + gen: 生成区', async () => {
  const out = mechanicalOwners();
  assert(out.includes('README.md') && out.includes('docs/guides/testing.md'), 'sync-counts TARGETS 现扫须含 README.md/testing.md');
  assert(/check 脚本数现值 \d+/.test(out), '须含 check 脚本数现值（与 sync-counts 同派生）');
  assert(out.includes('chain:auto'), '须含 chain:auto 短名映射说明（EX-012 判例）');
  assert(out.includes('gen:contract-list'), 'gen: 标记现扫须命中 6 域契约清单');
  assert(out.includes('gen:route-table'), 'gen: 标记现扫须命中 CLAUDE.md 路由表');
  assert(!out.includes(' semantic-audit-state.json'), '账本等非生成区文件不得混入');
});

regression('BAR-SEMCHAIN-05', 'prompt-injects-owners', 'buildPrompt 必须注入【机械主人】节且随 prompt 版本盐失效旧哈希', async () => {
  const prompt = buildPrompt({ question: 'q', sem: ['SEM001'], feeds: [] }, []);
  assert(prompt.includes('【机械主人】'), 'prompt 须含机械主人节');
  assert(prompt.includes('误报，一律跳过'), '节内须带「报它们 = 误报」抑制指令');
  const auditSrc = src('../scripts/agent/semantic-audit.mjs');
  assert(/const AUDIT_VERSION = 7/.test(auditSrc), 'prompt 结构变更须升 AUDIT_VERSION 令旧哈希失效');
});
