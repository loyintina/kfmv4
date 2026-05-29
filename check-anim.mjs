/**
 * KFM v4 - 动画导入检查
 *
 * 扫描 src/client/ 下所有 .ts 文件，确保：
 *   除白名单外，所有文件不直接 import gsap，必须通过 animation-registry。
 *
 * 白名单逐步收紧：每迁移一个模块，就从白名单中移除。
 * 最终只有 animation-registry.ts 和 demo-leafer.ts 留在白名单。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const SRC_DIR = 'src/client';

// ========== 白名单 ==========
// 逐步迁移完一个模块就从这里移除
const WHITELIST = new Set([
  // 注册中心自身 —— 永久允许（唯一 GSAP 入口）
  'modules/animation-registry.ts',
  // 演示文件 —— 不纳入管理
  'demo-leafer.ts',
]);

// ========== 内存预检 ==========

const MEM_WARN = 300;   // MB，低于此值发警告
const MEM_FAIL = 150;   // MB，低于此值中断构建

function checkMemory() {
  const meminfo = readFileSync('/proc/meminfo', 'utf-8');
  const m = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
  if (!m) return;
  const availMB = Math.round(parseInt(m[1], 10) / 1024);
  if (availMB < MEM_FAIL) {
    console.error(`[check-mem] 内存不足: ${availMB}MB 可用，低于 ${MEM_FAIL}MB 阈值`);
    console.error(`[check-mem] 可能原因: browser 标签页未关闭 / 其他进程残留`);
    console.error(`[check-mem] 请检查: ps aux --sort=-%mem | head`);
    process.exit(1);
  }
  if (availMB < MEM_WARN) {
    console.warn(`[check-mem] 警告: 仅 ${availMB}MB 内存可用，tsc 可能变慢`);
  }
}

const GSAP_IMPORT_RE = /import\s+gsap\s+from\s+['"]gsap['"]/;
const GSAP_NAMED_RE = /import\s+\{[^}]*\}\s+from\s+['"]gsap['"]/;

// ========== 扫描 ==========

function* walk(dir) {
  const entries = readdirSync(dir);
  for (const name of entries) {
    const full = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (extname(name) === '.ts' || extname(name) === '.tsx') {
      yield full;
    }
  }
}

function check() {
  let violations = 0;

  checkMemory();

  for (const absPath of walk(SRC_DIR)) {
    // 跳过 declaration 文件
    if (absPath.endsWith('.d.ts')) continue;

    const relPath = relative(SRC_DIR, absPath).replace(/\\/g, '/');
    const content = readFileSync(absPath, 'utf-8');

    const hasImport = GSAP_IMPORT_RE.test(content) || GSAP_NAMED_RE.test(content);
    if (!hasImport) continue;

    if (WHITELIST.has(relPath)) continue;

    console.error(`[check-anim] 违规: ${relPath} 直接导入了 GSAP，请通过 animation-registry`);
    violations++;
  }

  if (violations > 0) {
    console.error(`[check-anim] 共 ${violations} 处违规，构建中断。`);
    process.exit(1);
  }

  console.log('[check-anim] OK');
}

const CHECK_ONLY = process.argv.includes('--check-only');

checkMemory();
if (!CHECK_ONLY) {
  check();
} else {
  console.log('[check-mem] OK');
}