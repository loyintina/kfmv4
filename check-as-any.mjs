/**
 * KFM v4 - (as any) 逃逸检查
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const SRC_DIR = 'src';

const WHITELIST = new Set([
  'src/client/modules/renderers/math-diagram.ts:67',
  'src/client/modules/renderers/math-diagram.ts:102',
  'src/client/modules/terminal-card-04.ts:143',
  'src/client/modules/state.ts:198',
  'src/client/modules/tree-overlay.ts:16',
  'src/server/index.ts:300',
]);

const AS_ANY_RE = /\bas\s+any\b/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      yield* walk(full);
    } else if (extname(name) === '.ts') {
      yield full;
    }
  }
}

let errors = 0;
for (const file of walk(SRC_DIR)) {
  const rel = relative('.', file);
  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (AS_ANY_RE.test(lines[i])) {
      const key = `${rel}:${i + 1}`;
      if (!WHITELIST.has(key)) {
        console.error(`[check-as-any] 未登记的 (as any) 逃逸: ${key}`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-as-any] ${errors} 处未登记的 (as any) 逃逸，构建中断。`);
  process.exit(1);
} else {
  console.log(`[check-as-any] OK — 仅白名单内已知逃逸`);
}
