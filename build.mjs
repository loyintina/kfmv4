import { build } from 'esbuild';
import { execSync } from 'child_process';

// SCSS 编译（语法校验 + 输出 .css）
try {
  execSync('sass --no-source-map public/css/:public/css/', { stdio: 'inherit' });
} catch {
  console.error('[sass] SCSS 编译失败，构建中断。');
  process.exit(1);
}
console.log('[sass] OK');


await build({
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/server/index.js',
  external: ['express','fs','path','os'],
});

// 客户端构建（单 bundle）
await build({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'public/bundle.js',
  target: ['es2019'],
  supported: { 'nullish-coalescing': false },
});

console.log('Build OK');
