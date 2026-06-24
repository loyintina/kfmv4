import { build } from 'esbuild';
import { execSync } from 'child_process';
import { statSync, readdirSync } from 'fs';
import { join, extname } from 'path';

// ========== 构建后校验 ==========

/** 递归遍历目录，返回所有文件路径 */
function* walkSync(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) { yield* walkSync(full); }
    else { yield full; }
  }
}

/** 确保产物不比任何源文件旧（构建完整性校验） */
function checkFreshness(outfile, label) {
  if (!statSync(outfile, { throwIfNoEntry: false })) {
    console.error(`[build] ${label} 不存在，构建不完整`);
    process.exit(1);
  }
  const outTime = statSync(outfile).mtimeMs;
  for (const f of walkSync('src')) {
    if (extname(f) === '.ts' && statSync(f).mtimeMs > outTime) {
      console.error(`[build] ${label} 产物 ${outTime} 早于源文件 ${f}，构建不完整`);
      process.exit(1);
    }
  }
}

// ========== 构建 ==========

// SCSS 编译（语法校验 + 输出 .css）
try {
  execSync('npx sass --no-source-map public/css/:public/css/', { stdio: 'inherit' });
} catch {
  console.error('[sass] SCSS 编译失败，构建中断。');
  process.exit(1);
}
console.log('[sass] OK');

// 服务端
await build({
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/server/index.js',
  external: ['express','fs','path','os','ws','events'],
});

// 客户端
await build({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'public/bundle.js',
  target: ['es2019'],
  external: ['katex', 'mermaid'],
});

// 校验产物新鲜度
checkFreshness('dist/server/index.js', 'server');
checkFreshness('public/bundle.js', 'client');

console.log('Build OK');
