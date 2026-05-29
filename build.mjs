import { build } from 'esbuild';

// 服务端构建
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
