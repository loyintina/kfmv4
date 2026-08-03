import assert from 'assert';
import { regression } from './harness.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// 2026-08-03 裁决流双钉：机械层「体检者与被体检者同病相认」家族第二、三例
//（首例 BAR-GENLIST-01 \Z 截断）——生成器静默丢事实，check-only 共享坏解析 → 全绿放行。

const url = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const src = (rel: string) => readFileSync(url(rel), 'utf-8');

regression('BAR-GENLIST-01', 'no-literal-Z-lookahead', 'gen-contract-lists 节终止前瞻不得回退到 \\Z（JS 无此转义，被当字面 Z 截断域节——探针夹具 tests/probes/gen-contract-lists/ 同钉）', async () => {
  const gen = src('../scripts/check/gen-contract-lists.mjs');
  assert(!/\\Z/.test(gen), 'gen-contract-lists 再现 \\Z 字面——回到 BAR-GENLIST-01 病根');
});

regression('BAR-GENINV-01', 'explicit-files-not-filtered', 'gen-code-inventory 显式登记文件不得被 CODE_EXT 过滤（deploy.sh/package.json 曾因此从清单蒸发）', async () => {
  const gen = src('../scripts/check/gen-code-inventory.mjs');
  assert(!/isFile\(\)\s*&&\s*CODE_EXT/.test(gen), '显式文件分支重新挂上 CODE_EXT 过滤 = 回到 BAR-GENINV-01 病根');
  const inventory = src('../docs/domains/code-inventory.md');
  for (const f of ['| scripts/deploy.sh |', '| package.json |', '| .githooks/commit-msg |']) {
    assert(inventory.includes(f), `inventory 缺少显式登记文件行 ${f}——生成器又在丢事实`);
  }
});

regression('BAR-SYNCCOUNTS-01', 'chain-enum-complete', 'chain:auto 枚举必须覆盖 STEPS 全部 check-*/gen-* 步（gen-* 曾被映射静默丢弃，枚举缺 7 步仍全绿）', async () => {
  const chain = src('../scripts/check/chain.mjs');
  const stepsBlock = chain.match(/STEPS\s*=\s*\[([\s\S]*?)\n\];/);
  assert(stepsBlock, 'chain.mjs 找不到 STEPS 数组');
  const steps = stepsBlock[1].match(/'([^']+)'/g)!.map(s => s.slice(1, -1));
  const contract = src('../docs/domains/infra/contract.md');
  const block = contract.match(/<!-- chain:auto[\s\S]*?<!-- \/chain:auto -->/);
  assert(block, 'infra 契约缺少 chain:auto 生成区');
  for (const step of steps) {
    const cm = step.match(/check-([\w-]+)\.mjs/);
    const gm = step.match(/gen-([\w-]+)\.mjs/);
    if (cm) assert(block[0].includes(cm[1]), `chain:auto 漏列链步 check-${cm[1]}`);
    else if (gm) assert(block[0].includes('gen-' + gm[1]), `chain:auto 漏列链步 gen-${gm[1]}`);
  }
});
