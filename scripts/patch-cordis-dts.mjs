/**
 * scripts/patch-cordis-dts.mjs — cordis d.ts 的 node16 兼容补丁（postinstall 挂载）
 *
 * 病因：cordis 的 package.json 声明 "type": "module"（ESM），但其 lib/*.d.ts
 * 内部相对导入全是无扩展名形式（`from './events'`）。tsconfig 的
 * moduleResolution: node16 对 ESM 声明文件强制要求显式扩展名 → 星导出全部
 * 静默失败（TS2305「Module 'cordis' has no exported member 'Context'」），
 * 而 tsx/esbuild（非 node16 语义）不受影响——病只在类型检查面。
 *
 * 处置（采用裁决 (c) 上游直装 + 按需移植）：不动上游源码，安装后对 d.ts
 * 做机械补丁（相对导入补 .js）。**本脚本即升级评估触发点**——cordis 升级时
 * 版本守卫报警，补丁需按新版本重审（d.ts 结构变了就失效，失效=升级评估
 * 必做项）。对应任务图 8.7.1 审计记录「rc.7→rc.8 diff 档案」与契约化升级
 * 纪律。
 *
 * 幂等：已补丁的文件（含 .js 的导入不再匹配）自动跳过；可反复运行。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(ROOT, 'node_modules', 'cordis', 'lib');
const PKG = join(ROOT, 'node_modules', 'cordis', 'package.json');

// 版本守卫：只对 4.0.0-rc.8 应用，其他版本必须走升级评估
const EXPECTED = '4.0.0-rc.8';
let version = null;
try {
  version = JSON.parse(readFileSync(PKG, 'utf-8')).version;
} catch { /* node_modules 未装 cordis */ }
if (!version) {
  console.log('[patch-cordis-dts] cordis 未安装，跳过');
  process.exit(0);
}
if (version !== EXPECTED) {
  console.error(`[patch-cordis-dts] ⛔ cordis 版本 ${version} ≠ 锁定 ${EXPECTED}——升级评估未跑，拒绝打补丁`);
  console.error('[patch-cordis-dts] 流程：升级评估（任务图审计记录 rc.7→rc.8 档案口径）通过后，更新本文件 EXPECTED 再继续');
  process.exit(1);
}

/** 把无扩展名相对导入补 .js：from './x' / from '../x' / import './x' */
function patchSpecifier(line) {
  return line
    .replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (m, pre, spec, post) => {
      return /\.(js|json|mjs|cjs|d\.ts)$/.test(spec) ? m : `${pre}${spec}.js${post}`;
    })
    .replace(/(import\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (m, pre, spec, post) => {
      return /\.(js|json|mjs|cjs|d\.ts)$/.test(spec) ? m : `${pre}${spec}.js${post}`;
    })
    // 模块增强的目标路径同样要补（registry.d.ts 的 declare module './context'
    // 增强 Context 接口——不补则增强脱落，plugin/inject 消失）
    .replace(/(declare\s+module\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (m, pre, spec, post) => {
      return /\.(js|json|mjs|cjs|d\.ts)$/.test(spec) ? m : `${pre}${spec}.js${post}`;
    });
}

const files = existsSync(LIB) ? readdirSync(LIB).filter(f => f.endsWith('.d.ts')) : [];
let patched = 0;
for (const f of files) {
  const p = join(LIB, f);
  const src = readFileSync(p, 'utf-8');
  const out = src.split('\n').map(patchSpecifier).join('\n');
  if (out !== src) {
    writeFileSync(p, out);
    console.log(`[patch-cordis-dts] ✅ ${f}`);
    patched++;
  }
}
console.log(`[patch-cordis-dts] cordis@${version} d.ts 补丁完成（${patched} 个文件，幂等可重跑）`);
