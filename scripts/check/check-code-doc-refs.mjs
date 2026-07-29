/**
 * check-code-doc-refs.mjs — 代码中的文档引用有效性（v8.2 新增）
 *
 * 源码注释里的文档引用（@see docs/...、见 docs/...、`docs/...md`）是腐烂高发区
 * （2026-06-13 审计：6/13 引用已腐烂）。规则：src/ 与根脚本中的
 * docs/…md / newdoc/…md 引用必须指向存在的文件。
 *
 * 挂入 npm run check，失败 → 构建中断。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let errors = 0;
function error(msg) {
  console.error(`[check-code-doc-refs] ${msg}`);
  errors++;
}

function collect(dir, ext) {
  const results = [];
  function walk(d) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(ext)) results.push(full);
    }
  }
  walk(dir);
  return results;
}

const files = [
  ...collect(join(ROOT, 'src'), '.ts'),
  ...readdirSync(ROOT)
    .filter(f => f.startsWith('check-') && f.endsWith('.mjs') && f !== 'check-code-doc-refs.mjs')
    .map(f => join(ROOT, f)),
  join(ROOT, 'build.mjs'),
];

// 引用形态：docs/…md 或 newdoc/…md（注释里的文档路径）
const refRe = /(?:(?:docs|newdoc)\/[\w./-]+\.md)/g;

let checked = 0;
for (const fp of files) {
  const content = readFileSync(fp, 'utf-8');
  let m;
  const seen = new Set();
  while ((m = refRe.exec(content)) !== null) {
    const ref = m[0];
    if (seen.has(ref)) continue;
    seen.add(ref);
    checked++;
    if (!existsSync(join(ROOT, ref))) {
      error(`${fp.replace(ROOT + '/', '')}: 引用 ${ref} 不存在（文档引用腐烂）`);
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-code-doc-refs] ${errors} 处文档引用腐烂，构建中断。`);
  process.exit(1);
}
console.log(`[check-code-doc-refs] OK — 代码中 ${checked} 处文档引用全部有效`);
