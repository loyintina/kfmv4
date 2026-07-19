/**
 * KFM v4 — Z-Index 层级注册表完整性校验
 *
 * 挂入 npm run check / build，违规 = 构建中断。
 *
 * 两项校验：
 *  1. 数值一致性：src/client/modules/z-index-layers.ts 的 Z.* 常量
 *     必须与 public/css/z-index.css 的 :root --z-* 变量一一对应且数值相等。
 *  2. 零散落：src 下任何 DOM z-index 字面量都必须来自注册表（引用 Z.* 或 var(--z-*)）。
 *     白名单例外：引擎 Box.zIndex（canvas 内部渲染排序）、第三方 xterm、
 *     卡内相对定位 z-index:1、动态基数 BASE + index。
 *
 * 层级图景见 z-index-layers.ts 头部注释。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';

const SRC_DIR = 'src';
const JS_TABLE = 'src/client/modules/z-index-layers.ts';
const CSS_TABLE = 'public/css/z-index.css';

// camelCase/UPPER_SNAKE → kebab：ORB_PANEL → orb-panel
function constToVar(name) {
  return name.toLowerCase().replace(/_/g, '-');
}

let errors = 0;

// ========== 校验 1：JS ↔ CSS 数值一致 ==========
const jsSrc = readFileSync(JS_TABLE, 'utf-8');
const cssSrc = readFileSync(CSS_TABLE, 'utf-8');

// 解析 JS：  NAME: 1234,
const jsEntries = new Map();
for (const m of jsSrc.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*(\d+)\s*,/gm)) {
  jsEntries.set(m[1], Number(m[2]));
}
// 解析 CSS： --z-name: 1234;
const cssEntries = new Map();
for (const m of cssSrc.matchAll(/--z-([a-z0-9-]+)\s*:\s*(\d+)\s*;/g)) {
  cssEntries.set(m[1], Number(m[2]));
}

if (jsEntries.size === 0) { console.error('[check-zindex] ❌ 未能从 JS 表解析出任何常量'); errors++; }
if (cssEntries.size === 0) { console.error('[check-zindex] ❌ 未能从 CSS 表解析出任何变量'); errors++; }

for (const [name, val] of jsEntries) {
  const varName = constToVar(name);
  if (!cssEntries.has(varName)) {
    console.error(`[check-zindex] ❌ JS 常量 Z.${name} 缺少 CSS 对应 --z-${varName}`);
    errors++;
  } else if (cssEntries.get(varName) !== val) {
    console.error(`[check-zindex] ❌ Z.${name}=${val} 与 --z-${varName}=${cssEntries.get(varName)} 数值不一致`);
    errors++;
  }
}
for (const [varName, val] of cssEntries) {
  // CSS 侧允许多出（如 --z-center-content 纯记录），但若与 JS 同名必须一致（上面已查）
  void val; void varName;
}

// ========== 校验 2：零散落 DOM z-index 字面量 ==========
// 白名单：文件:行 → 该行的字面量是合法例外
const LITERAL_WHITELIST = new Set([
  // 引擎 Box.zIndex（canvas 内部渲染层级，非 DOM 层级表管辖）
  'src/client/modules/char-rain.ts:133',
  'src/client/modules/char-rain.ts:159',
  'src/client/modules/char-rain.ts:201',
  'src/client/modules/char-rain.ts:225',
  // 卡内相对定位按钮（全屏卡标题栏按钮，局部 stacking，非全局层）
  'src/client/modules/floating-fullscreen.ts:58',
  'src/client/modules/floating-fullscreen.ts:64',
  // 角色卡 prompt 文件拖拽：被拖项在兄弟列表内抬升（局部 stacking，非全局层）
  'src/client/cards/plugins/role.card.ts:466',
]);

// 匹配 DOM z-index 字面量：'z-index:数字'、"z-index: 数字"、`z-index:数字`、zIndex = 数字（DOM）
// 不匹配引用形式（Z.* / var(--z-*)）
const DOM_Z_LITERAL_RE = /z-?index\s*[:=]\s*['"`]?\s*\d/i;
// 引用形式（合法）识别：出现 Z. 或 var(--z- 即视为已注册
const REF_RE = /Z\.[A-Z]|var\(--z-/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      yield* walk(full);
    } else if (extname(name) === '.ts') {
      yield full;
    }
  }
}

for (const file of walk(SRC_DIR)) {
  const rel = relative('.', file).split('\\').join('/');
  // 层级表自身与引擎 box.ts 定义跳过
  if (rel === JS_TABLE) continue;
  if (rel === 'src/client/engine/v2/box.ts' || rel === 'src/client/engine/v2/renderer.ts' || rel === 'src/client/engine/v2/types.ts') continue;
  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!DOM_Z_LITERAL_RE.test(line)) continue;
    if (REF_RE.test(line)) continue; // 引用注册表 = 合法
    const key = `${rel}:${i + 1}`;
    if (LITERAL_WHITELIST.has(key)) continue;
    console.error(`[check-zindex] ❌ 未注册的散落 z-index 字面量: ${key}`);
    console.error(`             → ${line.trim()}`);
    console.error(`             改为引用 Z.* (JS) 或 var(--z-*) (CSS)，并在 z-index-layers.ts + z-index.css 注册`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n[check-zindex] ${errors} 处问题，构建中断。`);
  process.exit(1);
} else {
  console.log(`[check-zindex] OK — JS/CSS 层级表一致 (${jsEntries.size} 常量)，无散落 z-index`);
}
