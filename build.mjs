import { build } from 'esbuild';
import { execSync } from 'child_process';
import { statSync, readdirSync, readFileSync, writeFileSync, cpSync, mkdirSync, appendFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, extname } from 'path';
import { homedir } from 'os';

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
const BUILD_T0 = Date.now();

// 本次构建时间：一处生成，客户端 bundle define 与 build-info.json 共用——
// version-watch 横幅靠「bundle 内嵌时间 == 服务端 buildTime」判定旧包，两出处必须同值
// F4 确定性构建（2026-08-04）：BUILD_TIME 用 git 提交时间而非 Date.now()——
// 同一提交多次构建：bundle 内嵌时间不变 → bundle 内容不变 → index.html 版本戳
// 不变（消灭脏树）；新提交 → 时间变 → 版本握手提示刷新（语义仍正确）
const BUILD_TIME = (() => {
  try { return execSync('git log -1 --format=%cI').toString().trim(); }
  catch { return new Date().toISOString(); }
})();
// --fast：deploy-fast.sh 会话中途快通道——跳过全链（链在交付 deploy.sh 才完整跑）
const FAST = process.argv.includes('--fast');

/** 构建耗时账本（观测台，2026-08-08 ledger/ 收拢后路径含 ledger） */
const BUILD_METRIC_LOG = join(homedir(), '.kfmv4', 'ledger', 'build-metrics.jsonl');
function recordBuildMetric(ms, ok) {
  try { appendFileSync(BUILD_METRIC_LOG, JSON.stringify({ ts: new Date().toISOString(), phase: 'build', ms, ok }) + '\n'); } catch {}
}

// 全量代码质量检查（唯一链出处 scripts/check/chain.mjs——禁止在此回潮手写单个 check；
// build 中 check-uncommitted 按 --soft 降级为提醒，其余零错误通过才构建。
// check-deploy-freshness 也必须 --soft：构建中途源码必然比包新，硬跑会自锁）
if (!FAST) {
  execSync('node scripts/check/chain.mjs --soft=check-uncommitted --soft=check-deploy-freshness', { stdio: 'inherit' });
}

// 复制 stealth 脚本到 dist（launch.ts 在运行时读取这些文件）
const puppeteerSrc = 'src/server/ai/tools/omp/browser/puppeteer';
const puppeteerDst = 'dist/server/puppeteer';
mkdirSync(puppeteerDst, { recursive: true });
cpSync(puppeteerSrc, puppeteerDst, { recursive: true });

// 服务端 + 客户端（2026-08-02 并行化：产物独立、BUILD_TIME 预计算共享，Promise.all 减半 esbuild 耗时）
await Promise.all([
  build({
    entryPoints: ['src/server/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: 'dist/server/index.js',
    // CJS 依赖必须 external——bundle 进 ESM 产物会触发 Dynamic require of "buffer" 启动崩溃
    external: ['express','compression','fs','path','os','ws','events','node-pty-prebuilt-multiarch'],
    minify: true,
  }),
  build({
    entryPoints: ['src/client/main.ts'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: 'public/bundle.js',
    target: ['es2019'],
    external: ['katex', 'mermaid'],
    minify: true,
    // 把构建时间烙进 bundle：version-watch 横幅据此与服务端 buildTime 比对报旧包
    define: { KFM_BUILD_TIME: JSON.stringify(BUILD_TIME) },
  }),
]);

// 校验产物新鲜度
checkFreshness('dist/server/index.js', 'server');
checkFreshness('public/bundle.js', 'client');

// 版本握手：写构建信息（/api/system/info 暴露，deploy.sh 据此验证运行进程已加载新包；
// 与客户端 bundle define 共用 BUILD_TIME——version-watch 横幅比对两边同值才不误报）
writeFileSync('dist/build-info.json', JSON.stringify({
  buildTime: BUILD_TIME,
  version: JSON.parse(readFileSync('package.json', 'utf-8')).version,
}));

// 冒烟：验证 HTML 引用了 bundle.js 且 bundle.js 非空
const html2 = readFileSync('public/index.html', 'utf-8');
if (!html2.includes('bundle.js')) { console.error('[smoke] ❌ public/index.html 未引用 bundle.js'); process.exit(1); }
if (statSync('public/bundle.js').size < 100) { console.error('[smoke] ❌ public/bundle.js 异常小（可能构建失败）'); process.exit(1); }
// 自动更新 bundle.js 版本号（防止浏览器缓存旧 bundle）
// F4 确定性戳（2026-08-04）：内容 hash 而非 Date.now()——bundle/css 内容不变则
// index.html 不重写（消灭「每次构建产生脏树」——git 跟踪的 index.html 被噪声
// 重写稀释「未提交=危险」铁律）；内容变则戳变（缓存刷新仍正确）
function contentStamp() {
  const h = createHash('sha1');
  const files = ['public/bundle.js',
    ...(existsSync('public/css') ? readdirSync('public/css').filter(f => f.endsWith('.css')).map(f => 'public/css/' + f) : [])];
  for (const f of files) { try { h.update(readFileSync(f)); } catch {} }
  return h.digest('hex').slice(0, 10);
}
const buildStamp = contentStamp();
// query 部分用贪婪匹配 [^"'\s>]* —— 历史上叠加过 ?v=A?v=forceB 的畸形 query 也能整段吞掉，收敛为单个 ?v=
let html3 = html2.replace(/bundle\.js(\?[^"'\s>]*)?/, `bundle.js?v=${buildStamp}`);
// CSS 也加版本号（防浏览器缓存旧样式——动画/布局改动后必须刷新）
// 匹配 css/xxx.css 或 css/xxx.css?v=任意旧值（含畸形叠加），统一替换为带新版本号
html3 = html3.replace(/(css\/[\w-]+\.css)(\?[^"'\s>]*)?/g, `$1?v=${buildStamp}`);
if (html3 !== html2) writeFileSync('public/index.html', html3);
console.log('[smoke] ✅ index.html 引用 bundle.js, 大小 ' + statSync('public/bundle.js').size + ' bytes');

recordBuildMetric(Date.now() - BUILD_T0, true);
console.log('Build OK');
