/**
 * build.mjs — kfm-nz 最小构建（骨架期）
 *
 * 只做客户端 bundle（esbuild）；服务端/终端插件按 TASK.md 插件进度表逐项加。
 * 免 kfmv4 检查链——nz 开发期零文档税，收口时整体过 kfmv4 链。
 */
import { build } from 'esbuild';
import { statSync, writeFileSync } from 'fs';

await build({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'public/bundle.js',
  target: ['es2019'],
  minify: true,
  define: { KFM_NZ_BUILD_TIME: JSON.stringify(new Date().toISOString()) },
});

const size = statSync('public/bundle.js').size;
writeFileSync('public/build-info.json', JSON.stringify({ builtAt: new Date().toISOString() }));
console.log(`[build] OK bundle.js ${size} bytes`);
