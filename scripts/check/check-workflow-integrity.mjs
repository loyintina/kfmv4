/**
 * check-workflow-integrity.mjs — 工作流卡引用完整性（v8.2 新增）
 *
 * workflows/*.yaml 的 reads/writes 字段是 agent 的导航命脉。规则：
 * 每条 reads/writes 条目指向的路径必须存在（DOCS_ROOT 相对或项目根相对）。
 * 含 {占位符} 的条目跳过（模板形态）；目录以 / 结尾。
 *
 * 挂入 npm run check，失败 → 构建中断。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let errors = 0;
function error(msg) {
  console.error(`[check-workflow-integrity] ${msg}`);
  errors++;
}

const wfDir = join(ROOT, DOCS_ROOT, 'workflows');
let checked = 0;

for (const f of readdirSync(wfDir).filter(f => f.endsWith('.yaml'))) {
  const content = readFileSync(join(wfDir, f), 'utf-8');
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
      const full = p.endsWith('/')
        ? [join(ROOT, DOCS_ROOT, p), join(ROOT, p)]
        : [join(ROOT, DOCS_ROOT, p), join(ROOT, p)];
      if (!full.some(c => existsSync(c))) {
        error(`${f}: ${field} 引用 "${p}" 不存在`);
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-workflow-integrity] ${errors} 条工作流引用失效，构建中断。`);
  process.exit(1);
}
console.log(`[check-workflow-integrity] OK — ${checked} 条 reads/writes 引用全部有效`);
