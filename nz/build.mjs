/**
 * build.mjs — kfm-nz 最小构建（骨架期）
 *
 * 只做客户端 bundle（esbuild）；服务端/终端插件按 TASK.md 插件进度表逐项加。
 * 免 kfmv4 检查链——nz 开发期零文档税，收口时整体过 kfmv4 链。
 */
import { build } from 'esbuild';
import { createHash } from 'crypto';
import { readFileSync, statSync, writeFileSync } from 'fs';

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

// 缓存破坏：index.html 的 bundle 引用带内容哈希 —— 真机浏览器缓存旧包
// 会让「修复实测」测到旧代码（8.8.3b 上浮被盖排查的干扰源之一）。
// 哈希随内容变才变，不造成无意义 churn。
const hash = createHash('sha256').update(readFileSync('public/bundle.js')).digest('hex').slice(0, 8);
const html = readFileSync('public/index.html', 'utf8');
const stamped = html.replace(/bundle\.js(\?v=[a-f0-9]{8})?/, `bundle.js?v=${hash}`);
if (stamped !== html) writeFileSync('public/index.html', stamped);
console.log(`[build] OK bundle.js ${size} bytes (v=${hash})`);
