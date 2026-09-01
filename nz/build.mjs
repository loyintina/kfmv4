/**
 * build.mjs — kfm-nz 最小构建（骨架期）
 *
 * 只做客户端 bundle（esbuild）；服务端/终端插件按 TASK.md 插件进度表逐项加。
 * 免 kfmv4 检查链——nz 开发期零文档税，收口时整体过 kfmv4 链。
 */
import { build } from 'esbuild';
import { createHash } from 'crypto';
import { readFileSync, statSync, writeFileSync } from 'fs';
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib';

await build({
  entryPoints: ['src/client/main.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'public/bundle.js',
  target: ['es2019'],
  minify: true,
  // React 唯一组件系统（2026-09-01 用户拍板）：jsx 走 runtime automatic，
  // .tsx 面板插件直接写 JSX；终端渲染核在 ref 边界内保持自有命令式
  // 帧调度（自有代码非黑盒，React 不进边界内=无双运行时竞态）。
  jsx: 'automatic',
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

// 编码协商预压缩（2026-09-01 bundle 增重插曲：慢隧道首载超考卷预算）：
// gz/br 兄弟文件与 bundle 同生同灭，server 静态层见兄弟+客户端
// Accept-Encoding 才伺服（无兄弟自动回退原文，旧资源不受影响）。
// 实测 281KB→gzip 90KB/br 79KB（32%/28%）。
const bundle = readFileSync('public/bundle.js');
writeFileSync('public/bundle.js.gz', gzipSync(bundle, { level: 9 }));
writeFileSync('public/bundle.js.br', brotliCompressSync(bundle, {
  params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
}));
console.log(`[build] OK bundle.js ${size} bytes (v=${hash}) gzip=${gzipSync(bundle, { level: 9 }).length} br=${brotliCompressSync(bundle, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }).length}`);
