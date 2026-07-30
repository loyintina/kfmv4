import { build } from 'esbuild';
import { execSync } from 'child_process';
import { statSync, readdirSync, readFileSync, writeFileSync, cpSync, mkdirSync } from 'fs';
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

// 全量代码质量检查（唯一链出处 scripts/check/chain.mjs——禁止在此回潮手写单个 check；
// build 中 check-uncommitted 按 --soft 降级为提醒，其余零错误通过才构建）
execSync('node scripts/check/chain.mjs --soft=check-uncommitted', { stdio: 'inherit' });

// 复制 stealth 脚本到 dist（launch.ts 在运行时读取这些文件）
const puppeteerSrc = 'src/server/ai/tools/omp/browser/puppeteer';
const puppeteerDst = 'dist/server/puppeteer';
mkdirSync(puppeteerDst, { recursive: true });
cpSync(puppeteerSrc, puppeteerDst, { recursive: true });

// 服务端
await build({
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/server/index.js',
  // CJS 依赖必须 external——bundle 进 ESM 产物会触发 Dynamic require of "buffer" 启动崩溃
  external: ['express','compression','fs','path','os','ws','events','node-pty-prebuilt-multiarch'],
  minify: true,
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
  minify: true,
});

// 校验产物新鲜度
checkFreshness('dist/server/index.js', 'server');
checkFreshness('public/bundle.js', 'client');

// 版本握手：写构建信息（/api/system/info 暴露，deploy.sh 据此验证运行进程已加载新包）
writeFileSync('dist/build-info.json', JSON.stringify({
  buildTime: new Date().toISOString(),
  version: JSON.parse(readFileSync('package.json', 'utf-8')).version,
}));

// 冒烟：验证 HTML 引用了 bundle.js 且 bundle.js 非空
const html2 = readFileSync('public/index.html', 'utf-8');
if (!html2.includes('bundle.js')) { console.error('[smoke] ❌ public/index.html 未引用 bundle.js'); process.exit(1); }
if (statSync('public/bundle.js').size < 100) { console.error('[smoke] ❌ public/bundle.js 异常小（可能构建失败）'); process.exit(1); }
// 自动更新 bundle.js 版本号（防止浏览器缓存旧 bundle）
// 用完整时间戳而非仅日期——同一天内多次构建也必须刷新缓存
const buildStamp = Date.now();
// query 部分用贪婪匹配 [^"'\s>]* —— 历史上叠加过 ?v=A?v=forceB 的畸形 query 也能整段吞掉，收敛为单个 ?v=
let html3 = html2.replace(/bundle\.js(\?[^"'\s>]*)?/, `bundle.js?v=${buildStamp}`);
// CSS 也加版本号（防浏览器缓存旧样式——动画/布局改动后必须刷新）
// 匹配 css/xxx.css 或 css/xxx.css?v=任意旧值（含畸形叠加），统一替换为带新版本号
html3 = html3.replace(/(css\/[\w-]+\.css)(\?[^"'\s>]*)?/g, `$1?v=${buildStamp}`);
if (html3 !== html2) writeFileSync('public/index.html', html3);
console.log('[smoke] ✅ index.html 引用 bundle.js, 大小 ' + statSync('public/bundle.js').size + ' bytes');

console.log('Build OK');
