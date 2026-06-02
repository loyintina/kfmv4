/**
 * KFM v4 - (as any) 逃逸检查
 *
 * 扫描 src/ 下所有 .ts 文件，确保：
 *   所有 (as any) 必须在白名单中登记（标注为已知的、已追踪的类型逃逸）。
 *   新增的 (as any) 会中断构建 —— 必须先用 getFileRowData() 等类型安全方案替代，
 *   或确认无法避免后在白名单登记并写明原因。
 *
 * 白名单逐步收紧：每修复一个逃逸，就从白名单中移除。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const SRC_DIR = 'src';

// ========== 白名单 ==========
// 格式：'相对路径:行号' —— 行号为文件中 (as any) 起始位置
// 白名单：全部已修复，保持空。新增逃逸会中断构建。
const WHITELIST = new Set([]);

const AS_ANY_RE = /\([\w.\[\]]+\s+as\s+any\)/;

// ========== 扫描 ==========

function* walk(dir) {
  const entries = readdirSync(dir);
  for (const name of entries) {
    const full = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'dist') continue;
      yield* walk(full);
    } else if (extname(name) === '.ts') {
      yield full;
    }
  }
}

function check() {
  let newViolations = 0;
  let knownViolations = 0;

  for (const absPath of walk(SRC_DIR)) {
    if (absPath.endsWith('.d.ts')) continue;

    const relPath = relative(SRC_DIR, absPath).replace(/\\/g, '/');
    const lines = readFileSync(absPath, 'utf-8').split('\n');

    for (let i = 0; i < lines.length; i++) {
      // 跳过注释行
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      const match = AS_ANY_RE.exec(lines[i]);
      if (!match) continue;

      const lineNum = i + 1;
      const key = `${relPath}:${lineNum}`;

      if (WHITELIST.has(key)) {
        knownViolations++;
      } else {
        console.error(`[check-as-any] 未登记的逃逸: ${relPath}:${lineNum}`);
        console.error(`              ${lines[i].trim()}`);
        newViolations++;
      }
    }
  }

  if (knownViolations > 0) {
    console.log(`[check-as-any] 已知逃逸 ${knownViolations} 处（白名单中，待修复）`);
  }

  if (newViolations > 0) {
    console.error(`\n[check-as-any] 新增 ${newViolations} 处未登记的 (as any) 逃逸，构建中断。`);
    console.error(`  使用 getFileRowData() 或类型守卫替代。确无法避免则在 check-as-any.mjs 白名单中登记。`);
    process.exit(1);
  }

  if (knownViolations === 0) {
    console.log('[check-as-any] OK — 无逃逸');
  } else {
    console.log('[check-as-any] OK — 仅白名单内已知逃逸');
  }
}

const CHECK_ONLY = process.argv.includes('--check-only');
check();
