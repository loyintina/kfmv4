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

// 全量代码质量检查（对齐 npm run check，零错误通过才构建）
execSync('node check-versions.mjs', { stdio: 'inherit' });

// 未提交提醒（不阻断）
try { execSync('node check-uncommitted.mjs', { stdio: 'inherit' }); } catch {}
execSync('node check-checks.mjs', { stdio: 'inherit' });
execSync('node check-doc-coverage.mjs', { stdio: 'inherit' });

// SCSS 编译（语法校验 + 输出 .css）
try {
  execSync('npx sass --no-source-map public/css/:public/css/', { stdio: 'inherit' });
} catch {
  console.error('[sass] SCSS 编译失败，构建中断。');
  process.exit(1);
}

execSync('node check-anim.mjs --check-only', { stdio: 'inherit' });
execSync('node check-as-any.mjs --check-only', { stdio: 'inherit' });
execSync('node check-card-meta.mjs', { stdio: 'inherit' });
execSync('node check-registry.mjs --check-only', { stdio: 'inherit' });
execSync('node check-zindex.mjs', { stdio: 'inherit' });
execSync('node check-console.mjs', { stdio: 'inherit' });
execSync('node check-docs.mjs', { stdio: 'inherit' });
execSync('node check-linecount.mjs', { stdio: 'inherit' });
execSync('node check-consistency.mjs', { stdio: 'inherit' });
execSync('node check-cards.mjs', { stdio: 'inherit' });
execSync('node check-handbook-sync.mjs', { stdio: 'inherit' });
execSync('npx tsc --noEmit', { stdio: 'inherit' });

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
  external: ['express','fs','path','os','ws','events','node-pty-prebuilt-multiarch'],
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

// 冒烟：验证 HTML 引用了 bundle.js 且 bundle.js 非空
const html2 = readFileSync('public/index.html', 'utf-8');
if (!html2.includes('bundle.js')) { console.error('[smoke] ❌ public/index.html 未引用 bundle.js'); process.exit(1); }
if (statSync('public/bundle.js').size < 100) { console.error('[smoke] ❌ public/bundle.js 异常小（可能构建失败）'); process.exit(1); }
// 自动更新 bundle.js 版本号（防止浏览器缓存旧 bundle）
// 用完整时间戳而非仅日期——同一天内多次构建也必须刷新缓存
const buildStamp = Date.now();
const html3 = html2.replace(/bundle\.js\?v=\d+/, `bundle.js?v=${buildStamp}`);
if (html3 !== html2) writeFileSync('public/index.html', html3);
console.log('[smoke] ✅ index.html 引用 bundle.js, 大小 ' + statSync('public/bundle.js').size + ' bytes');

console.log('Build OK');
