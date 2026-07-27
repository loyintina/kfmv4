/**
 * check-test-patterns.mjs — 测试计数模式完整性检查
 *
 * check-consistency.mjs 用 /^\s*(?:test|regression)\(/gm 统计测试数量并同步到文档。
 * 如果有人用了其他模式（it(, describe(, 自定义 helper），计数会静默漂移。
 *
 * 本检查扫描 tests/ 下所有测试文件，如果发现不被计数模式覆盖的测试函数调用 → 硬阻断。
 *
 * 挂入 npm run check。
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;
const TEST_DIR = join(ROOT, 'tests');

// 权威计数模式（与 check-consistency.mjs 保持一致）
const COUNTED_PATTERN = /^\s*(?:test|regression)\(/;

// 已知的非测试函数调用（不触发告警）
const KNOWN_NON_TEST = new Set([
  'group', 'import', 'from', 'export', 'const', 'let', 'var',
  'function', 'if', 'for', 'while', 'switch', 'return', 'throw',
  'assert', 'console', 'describe', 'before', 'after', 'beforeEach', 'afterEach',
  'registerCardType',
]);

// 可疑的测试函数模式（可能是测试但不被计数）
const SUSPECT_PATTERNS = [
  { re: /^\s*it\(/, name: 'it(' },
  { re: /^\s*test\.only\(/, name: 'test.only(' },
  { re: /^\s*test\.skip\(/, name: 'test.skip(' },
  { re: /^\s*describe\(/, name: 'describe(' },
];

if (!existsSync(TEST_DIR)) {
  console.error('[check-test-patterns] ERROR — tests/ 目录不存在');
  process.exit(1);
}

let errors = 0;
const files = readdirSync(TEST_DIR).filter(f =>
  f.endsWith('.test.ts') || f.endsWith('.test.mjs')
);

if (files.length === 0) {
  console.error('[check-test-patterns] ERROR — tests/ 下没有测试文件');
  process.exit(1);
}

for (const file of files) {
  const content = readFileSync(join(TEST_DIR, file), 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { re, name } of SUSPECT_PATTERNS) {
      if (re.test(line)) {
        console.error(`[check-test-patterns] ❌ ${file}:${i + 1}: 发现 "${name}" — 此模式不被计数管线覆盖`);
        console.error(`  行内容: ${line.trim().slice(0, 80)}`);
        errors++;
      }
    }
  }
}

// 额外检查：是否有看起来像测试调用但不匹配任何已知模式的行
// 模式：行首是 identifier( 且不在已知列表中
const unknownCallRe = /^\s*([a-zA-Z_]\w*)\(/;
for (const file of files) {
  const content = readFileSync(join(TEST_DIR, file), 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (COUNTED_PATTERN.test(line)) continue;
    const m = line.match(unknownCallRe);
    if (!m) continue;
    const fn = m[1];
    if (KNOWN_NON_TEST.has(fn)) continue;
    // 跳过缩进行（函数体内部的调用）
    if (/^\s{2,}/.test(line)) continue;
    // 跳过注释
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    console.error(`[check-test-patterns] ❌ ${file}:${i + 1}: 顶层调用 "${fn}(" 不被计数模式覆盖`);
    console.error(`  行内容: ${line.trim().slice(0, 80)}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n[check-test-patterns] ${errors} 处不被计数管线覆盖的测试模式。`);
  console.error(`  请改用 test() 或 regression()，或更新 check-consistency.mjs 的计数模式。`);
  process.exit(1);
}

console.log(`[check-test-patterns] OK — ${files.length} 个测试文件，所有测试函数均使用 test()/regression() 模式`);
