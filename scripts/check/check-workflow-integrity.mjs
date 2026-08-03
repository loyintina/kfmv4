/**
 * check-workflow-integrity.mjs — 工作流卡引用完整性（v8.2 新增，v8.3 扩展 M2）
 *
 * workflows/*.yaml 的 reads/writes 字段是 agent 的导航命脉。规则：
 * 1. 每条 reads/writes 条目指向的路径必须存在（DOCS_ROOT 相对或项目根相对）。
 *    含 {占位符} 的条目跳过（模板形态）；目录以 / 结尾。
 * 2. 卡内任意位置提到的 check-*.mjs 脚本名必须在 scripts/check/ 存在
 *    （v8.3 语义审计 B3：yaml 引用已改名的 check-desc-freshness 长达数天无人发现——
 *    脚本名也是引用，引用就会悬空）。豁免登记 SCRIPT_WHITELIST。
 *
 * 挂入 npm run check，失败 → 构建中断。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = resolve(process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
let errors = 0;
function error(msg) {
  console.error(`[check-workflow-integrity] ${msg}`);
  errors++;
}

// 非脚本 token 豁免（注释原因）
const SCRIPT_WHITELIST = new Set([
  'check-only', // --check-only 命令行旗标，非脚本名
]);

const wfDir = join(ROOT, DOCS_ROOT, 'workflows');
let checked = 0;
let scriptsChecked = 0;

for (const f of readdirSync(wfDir).filter(f => f.endsWith('.yaml'))) {
  const content = readFileSync(join(wfDir, f), 'utf-8');
  // 规则 3（2026-08-02 加，可生成事实登记表 P0）：新工作流卡必须进 CLAUDE.md 路由表——
  // 路由表是 agent 导航命脉，手写清单靠人记得加（新工作流迷路 = 路由表升档候选）
  const routeTable = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf-8');
  const wfName = f.replace(/\.yaml$/, '');
  if (!routeTable.includes(wfName)) {
    error(`${f}: 未出现在 CLAUDE.md 路由表（新工作流必须在路由表登记一行，见 generateable-facts P0）`);
  }
  // 提取 reads:/writes: 块下的列表项（- 开头的行）
  for (const field of ['reads', 'writes']) {
    const blockRe = new RegExp(`^${field}:\\n((?:^\\s+-.*\\n)+)`, 'm');
    const block = content.match(blockRe);
    if (!block) continue;
    for (const line of block[1].split('\n')) {
      const itemRe = /^\s+-\s+(\S+)/;
      const im = line.match(itemRe);
      if (!im) continue;
      let p = im[1].replace(/（.*$/, '').split('#')[0].trim(); // 去全角括号注释与锚点
      if (p.includes('{') || p.includes('*')) continue; // 占位符/通配
      if (!p.includes('/')) continue; // 非路径（单个词）
      checked++;
      // 数据目录引用（~/ 前缀 → homedir 展开，如 ~/.kfmv4/discussion-log.jsonl）
      if (p.startsWith('~/')) {
        const homePath = join(homedir(), p.slice(2));
        if (!existsSync(homePath)) error(`${f}: ${field} 引用 "${p}" 不存在`);
        continue;
      }
      const full = [join(ROOT, DOCS_ROOT, p), join(ROOT, p)];
      if (!full.some(c => existsSync(c))) {
        error(`${f}: ${field} 引用 "${p}" 不存在`);
      }
    }
  }
  // 脚本名引用核对：卡内出现的 check-xxx(.mjs) 必须落在 scripts/check/
  for (const m of content.matchAll(/\bcheck-[a-z0-9]+(?:-[a-z0-9]+)*(\.mjs)?\b/g)) {
    const name = m[1] ? m[0] : m[0] + '.mjs';
    if (SCRIPT_WHITELIST.has(m[0])) continue;
    scriptsChecked++;
    if (!existsSync(join(ROOT, 'scripts', 'check', name))) {
      error(`${f}: 引用脚本 "${m[0]}" 在 scripts/check/ 不存在（脚本改名/删除后引用面未同步）`);
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-workflow-integrity] ${errors} 条工作流引用失效，构建中断。`);
  console.error('[check-workflow-integrity] ⛳ MECH-FLOW-05：工作流引用失效——读 docs/guides/doc-architecture.md §工作流约定，走 workflows/doc-tree-sync.yaml');
  process.exit(1);
}
console.log(`[check-workflow-integrity] OK — ${checked} 条 reads/writes 引用 + ${scriptsChecked} 处脚本名引用全部有效`);
