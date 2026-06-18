/**
 * KFM v4 — console 日志扫描
 *
 * 确保所有客户端日志通过 logger.ts 的 log() 输出，
 * 禁止散落的 console.log/warn/error。
 *
 * 白名单：
 *   src/client/modules/logger.ts       — log() 自身转发到 console.log
 *   src/client/modules/debug-assert.ts — assert 需要 console.error/warn
 *   src/client/main.ts                 — 全局 error handler
 *   src/server/                        — 服务端没有 logger 系统
 *
 * 挂入 npm run check，发现逃逸 → 构建中断。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;

const CONSOLE_RE = /console\.(log|warn|error)\(/;

const WHITELIST = [
  'src/client/modules/logger.ts',
  'src/client/modules/debug-assert.ts',
  'src/client/main.ts',
];

let errors = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) {
      walk(join(dir, entry.name));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs')) {
      const absPath = join(dir, entry.name);
      const relPath = relative(ROOT, absPath);

      // 白名单跳过
      if (WHITELIST.includes(relPath)) continue;
      if (relPath.startsWith('src/server')) continue;
      if (relPath.startsWith('src/client/engine')) continue;

      const content = readFileSync(absPath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (CONSOLE_RE.test(lines[i])) {
          console.error(`[check-console] ${relPath}:${i + 1} 使用 console: ${lines[i].trim()}`);
          errors++;
        }
      }
    }
  }
}

walk(join(ROOT, 'src'));

if (errors > 0) {
  console.error(`\n[check-console] ${errors} console 逃逸 — 请改用 logger.ts 的 log()`);
  process.exit(1);
}

console.log('[check-console] OK — 全部日志通过 log()');
