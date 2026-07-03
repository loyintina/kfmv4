/**
 * KFM v4 - card.meta 类型逃逸检查
 *
 * 扫描 src/client/modules/ 下所有 .ts 文件，确保 card.meta 字段访问
 * 不通过 as 断言进行类型窄化。
 *
 * 正确的做法：使用类型守卫函数（如 tcard() / tmcard()）将 CardInstance
 * 窄化为特化类型，然后在守卫函数内做唯一的 as 逃逸。文件内其他所有
 * card.meta 访问都不应出现 as。
 *
 * 如果此检查报错，说明某处 card.meta.xxx as YYY 绕过了类型系统——
 * 应在对应文件中定义 CardMeta 接口并添加守卫函数。
 *
 * 本检查与 check-as-any.mjs 互补：
 *   check-as-any  → (as any) 逃逸，零容忍
 *   check-card-meta → card.meta 的 as 逃逸（as string/as Terminal 等）
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const SRC_DIR = 'src/client/modules';

const META_AS_RE = /card\.meta\..*?\bas\b/;

// ========== 扫描 ==========

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (extname(full) === '.ts' && !full.endsWith('.d.ts')) {
      yield full;
    }
  }
}

// ========== 主逻辑 ==========

let errors = 0;

for (const file of walk(SRC_DIR)) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 排除注释行
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (META_AS_RE.test(line)) {
      const rel = relative('.', file);
      console.error(`[FAIL] ${rel}:${i + 1} — card.meta 访问使用了 as 断言`);
      console.error(`       ${line.trim()}`);
      console.error(`       应在文件中定义 CardMeta 接口 + 守卫函数，然后通过守卫访问 meta 字段`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n✗ ${errors} 处 card.meta 类型逃逸。请为对应文件添加类型定义。`);
  process.exit(1);
} else {
  console.log(`✓ check-card-meta: 零逃逸`);
}
