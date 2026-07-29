/**
 * check-probes.mjs — 检查探针自检（v8.2 批 5）
 *
 * 问题：检查脚本自己可能是坏的——「一切正常」和「检查坏了报不出」是两种
 * 长得一模一样的绿色。探针 = 往医生眼前放一个确定有病的样本：
 *
 *   tests/probes/<名>/ 是一棵迷你假树（负例夹具），运行器以
 *   KFM_PROBE_ROOT=<假树> 跑对应检查，断言：
 *     1. 退出码非零（必须报红）
 *     2. 输出含 expect.txt 字串（报红的原因是种下的病，不是脚本崩溃）
 *
 * 支持探针的检查：ROOT 经 KFM_PROBE_ROOT 注入（检查设计宪法 §探针）。
 * 豁免：输入是 git 历史的检查（freshness/uncommitted/versions/commit-docs/hooks）
 * ——造假 git 历史成本远超收益，且它们每次提交都在真实环境被自然检验。
 *
 * 挂入 npm run check，探针失绿 = 构建中断。
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PROBES_DIR = join(ROOT, 'tests', 'probes');

let errors = 0;
function error(msg) {
  console.error(`[check-probes] ${msg}`);
  errors++;
}

for (const entry of readdirSync(PROBES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const name = entry.name;
  const probeRoot = join(PROBES_DIR, name);

  const expectFile = join(probeRoot, 'expect.txt');
  if (!existsSync(expectFile)) {
    error(`${name}: 缺少 expect.txt（期望报错字串）`);
    continue;
  }
  const expectText = readFileSync(expectFile, 'utf-8').trim();

  // 命名约定：check-<名>.mjs 优先；否则 <名>.mjs + --check-only（如 sync-counts）
  const checkScript = join(ROOT, 'scripts/check', `check-${name}.mjs`);
  const plainScript = join(ROOT, 'scripts/check', `${name}.mjs`);
  let script, args = [];
  if (existsSync(checkScript)) {
    script = checkScript;
  } else if (existsSync(plainScript)) {
    script = plainScript;
    args = ['--check-only'];
  } else {
    error(`${name}: 找不到对应脚本 check-${name}.mjs 或 ${name}.mjs`);
    continue;
  }

  let code = 0;
  let output = '';
  try {
    output = execFileSync('node', [script, ...args], {
      encoding: 'utf-8',
      env: { ...process.env, KFM_PROBE_ROOT: probeRoot },
      stdio: 'pipe',
    });
  } catch (e) {
    code = e.status ?? 1;
    output = String(e.stdout || '') + String(e.stderr || '');
  }

  if (code === 0) {
    error(`❌ ${name}: 检查对负例夹具报绿——检查已失效！`);
  } else if (!output.includes(expectText)) {
    error(`❌ ${name}: 报红了但输出不含期望字串 "${expectText}"（可能是崩溃而非检出）`);
  } else {
    console.log(`[check-probes] ${name} ✅（检出负例）`);
  }
}

if (errors > 0) {
  console.error(`\n[check-probes] ${errors} 个探针失败，构建中断。`);
  process.exit(1);
}
console.log('[check-probes] OK — 全部探针报红且病因正确');
