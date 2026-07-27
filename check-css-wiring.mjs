/**
 * check-css-wiring.mjs — CSS 接线完整性校验（防「接线丢失」类 bug）
 *
 * 病史：CSS 类/keyframes 定义了没人用（.orb-think-collapsing、.orb-msg-new、
 * .orb-tool-md 曾是），或 JS 引用了没定义（@keyframes orb-hint-pulse 曾靠 JS
 * 运行时注入兜底）。两类病都静默——不报错，只是交互细节丢失。
 *
 * 双向校验：
 *   1. JS 引用的 orb-* 类 / animation keyframes 必须在 SCSS 有定义
 *      （否则样式/动画静默失效）
 *   2. SCSS 定义的 orb-* 类 / orb* keyframes 必须被 JS 引用
 *      （否则是丢失的接线或死 CSS）
 *
 * JS 侧收集范围（src/client/**​/*.ts，先剥离注释防注释提及误判为引用）：
 *   - _el('tag', 'className') 第二参数
 *   - classList.add/toggle/contains/remove('x')
 *   - querySelector/querySelectorAll/closest('.x') 选择器中的类名
 *   - innerHTML/模板字符串里的 class="orb-x"
 *   - el.className = 'orb-x' 赋值
 *   - inline style 里 animation:NAME / animation-name:NAME 的 NAME
 *
 * SCSS 侧收集（public/css/*.scss）：
 *   - .orb-* 类定义（选择器 token）
 *   - @keyframes NAME
 *   - SCSS 内部 animation:NAME 引用（keyframes 被哪个类携带也算接线）
 *
 * 白名单（下方数组，克制使用）：
 *   - JS_REF_NO_SCSS：v8 大量 orb-* 类是创建时 inline style 直写的，
 *     本就不需要 SCSS 定义——登记在此防方向 1 误报
 *   - SCSS_DEF_NO_JS：确认的死 CSS / 待用样式——登记在此防方向 2 误报，
 *     每条必须写清原因；接线恢复后应移除条目
 *
 * --check-only：兼容参数（对齐 check-anim 等脚本在构建链中的调用形式），
 * 本脚本无可自动修复项，加不加行为一致。
 *
 * 挂入 npm run check / build.mjs（sass 编译之后），违规 = 构建中断。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = __dirname;

void process.argv.includes('--check-only'); // 兼容参数，见文件头

// ========== 白名单 ==========

/** 方向 1 豁免：JS 引用但 SCSS 未定义——inline style 直写、本就不需要 SCSS 的类 */
const JS_REF_NO_SCSS = [
  'orb-panel',           // orb.ts createPanel：inline cssText 直写
  'orb-header-bar',      // orb-panel.ts 头部栏：innerHTML 模板 + inline style
  'orb-model-bar',       // orb-panel.ts 模型栏：innerHTML 模板 + inline style
  'orb-msg',             // chat-dom 消息容器：inline（content-visibility 裁剪）
  'orb-msg-text',        // chat-dom 正文：inline；marked 产物经 .md-body 约束
  'orb-copy-btn',        // chat-dom 复制按钮：inline
  'orb-tool-card',       // chat-dom 工具卡：inline（随机配色边框）
  'orb-tc-arrow',        // chat-dom 工具卡箭头：inline
  'orb-tool-input-pre',  // chat-dom 工具输入：inline
  'orb-tool-output-pre', // chat-dom 工具输出：inline
  'orb-write-card',      // chat-dom write 卡：inline
  'orb-edit-card',       // chat-dom edit/diff 卡：inline
  'orb-grep-card',       // chat-dom grep 卡：inline
  'orb-glob-card',       // chat-dom glob 卡：inline
  'orb-md-css',          // chat-dom 注入的 <style> 标记节点，本身无样式
  'orb-todo-wrapper',    // orb-chat-hints todo 面板外壳：inline
  'orb-todo-panel',      // orb-chat-hints todo 面板：inline
  'orb-todo-close',      // orb-chat-hints 关闭按钮：inline
];

/** 方向 2 豁免：SCSS 定义但 JS 未引用——确认的死 CSS / 待用接线，每条注明原因 */
const SCSS_DEF_NO_JS = [
  'orb-think-collapsing',// v7 思考框折叠动画残留，当前思考框折叠走 classList collapsed
  'orb-fold-anim',       // v7 折叠动画残留（v8 折叠无动画，直接 .collapsed）
  'orb-tool-md',         // v7 工具卡内 md 渲染残留（v8 工具输出不走 md 管线）
  'orb-tool-reveal',     // v7 工具输出 reveal 动画残留（v8 实时输出走打字机 reveal）
];

// ========== 工具 ==========

let errors = 0;

function error(msg) {
  console.error(`[check-css-wiring] ${msg}`);
  errors++;
}

/** 剥离 // 行注释与 块注释（防注释里提及的类名被误判为引用） */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** 字符串按空白拆成类名 token，只留 orb- 开头的 */
function orbTokens(str) {
  return str.split(/\s+/).filter(t => t.startsWith('orb-'));
}

// ========== 1. 收集 JS 侧引用 ==========

const jsClasses = new Map();   // 类名 → 首个引用位置（报错定位用）
const jsKeyframes = new Map(); // animation 名 → 首个引用位置

function noteJs(map, name, pos) {
  if (!map.has(name)) map.set(name, pos);
}

const JS_REF_RES = [
  // _el('tag', 'className') 第二参数
  { re: /_el\(\s*'[^']*'\s*,\s*'([^']*)'/g, pick: (m) => orbTokens(m[1]) },
  // classList.add/toggle/contains/remove('x')
  { re: /classList\.(?:add|toggle|contains|remove)\(\s*'([^']+)'/g, pick: (m) => orbTokens(m[1]) },
  // querySelector/querySelectorAll/closest('.x ...') 选择器中的类名
  { re: /(?:querySelector|querySelectorAll|closest)\(\s*'([^']+)'/g,
    pick: (m) => [...m[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map(t => t[1]).filter(t => t.startsWith('orb-')) },
  // innerHTML/模板字符串里的 class="orb-x y"
  { re: /class\s*=\s*"([^"]+)"/g, pick: (m) => orbTokens(m[1]) },
  // el.className = 'orb-x' 赋值
  { re: /\.className\s*=\s*'([^']+)'/g, pick: (m) => orbTokens(m[1]) },
];

const KEYFRAME_RE = /animation(?:-name)?\s*:\s*([a-zA-Z][\w-]*)/g;
// CSS 关键字不是 keyframes 名
const CSS_KEYWORDS = new Set(['none', 'initial', 'inherit', 'unset', 'revert']);

function* walk(dir, ext) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) { yield* walk(full, ext); }
    else if (name.endsWith(ext)) { yield full; }
  }
}

for (const file of walk(join(ROOT, 'src/client'), '.ts')) {
  const rel = relative(ROOT, file).split('\\').join('/');
  const src = stripComments(readFileSync(file, 'utf-8'));
  for (const { re, pick } of JS_REF_RES) {
    for (const m of src.matchAll(re)) {
      for (const name of pick(m)) noteJs(jsClasses, name, rel);
    }
  }
  for (const m of src.matchAll(KEYFRAME_RE)) {
    if (!CSS_KEYWORDS.has(m[1])) noteJs(jsKeyframes, m[1], rel);
  }
}

// ========== 2. 收集 SCSS 侧定义 ==========

const scssClasses = new Map();   // orb-* 类 → 定义文件
const scssKeyframes = new Map(); // @keyframes 名 → 定义文件
const scssAnimRefs = new Set();  // SCSS 内部 animation:NAME 引用

const cssDir = join(ROOT, 'public/css');
for (const name of readdirSync(cssDir)) {
  if (!name.endsWith('.scss')) continue;
  const rel = `public/css/${name}`;
  const src = stripComments(readFileSync(join(cssDir, name), 'utf-8'));
  for (const m of src.matchAll(/\.(orb-[a-z0-9-]+)/gi)) {
    if (!scssClasses.has(m[1])) scssClasses.set(m[1], rel);
  }
  for (const m of src.matchAll(/@keyframes\s+([\w-]+)/g)) {
    if (!scssKeyframes.has(m[1])) scssKeyframes.set(m[1], rel);
  }
  for (const m of src.matchAll(KEYFRAME_RE)) {
    if (!CSS_KEYWORDS.has(m[1])) scssAnimRefs.add(m[1]);
  }
}

// ========== 3. 双向校验 ==========

// 方向 1a：JS 引用的 orb-* 类，SCSS 必须有定义（否则样式静默失效）
for (const [name, pos] of [...jsClasses.entries()].sort()) {
  if (JS_REF_NO_SCSS.includes(name)) continue;
  if (!scssClasses.has(name)) {
    error(`❌ JS 引用 .${name}（${pos}），但 SCSS 未定义——样式静默失效；若属 inline style 直写，登记 JS_REF_NO_SCSS`);
  }
}

// 方向 1b：JS inline style 引用的 keyframes，SCSS 必须有 @keyframes
// （病史：orb-hint-pulse 曾靠 JS 运行时注入兜底）
for (const [name, pos] of [...jsKeyframes.entries()].sort()) {
  if (!scssKeyframes.has(name)) {
    error(`❌ JS animation:${name}（${pos}），但 SCSS 无 @keyframes ${name}——动画静默失效`);
  }
}

// 方向 2a：SCSS 定义的 orb-* 类，JS 必须引用（否则是丢失的接线或死 CSS）
for (const [name, pos] of [...scssClasses.entries()].sort()) {
  if (SCSS_DEF_NO_JS.includes(name)) continue;
  if (!jsClasses.has(name)) {
    error(`❌ SCSS 定义 .${name}（${pos}），但 JS 完全未引用——可能是丢失的接线或死 CSS；确认死 CSS 后删除或登记 SCSS_DEF_NO_JS`);
  }
}

// 方向 2b：SCSS 定义的 orb* keyframes，必须被 JS inline 或 SCSS 类引用
for (const [name, pos] of [...scssKeyframes.entries()].sort()) {
  if (!/^orb/i.test(name)) continue;
  if (!jsKeyframes.has(name) && !scssAnimRefs.has(name)) {
    error(`❌ SCSS @keyframes ${name}（${pos}）无任何引用——死动画，删除或接线`);
  }
}

// ========== 汇总 ==========

if (errors > 0) {
  console.error(`\n[check-css-wiring] ${errors} 处接线失配，构建中断。`);
  process.exit(1);
}

console.log(`[check-css-wiring] OK — JS 引用 ${jsClasses.size} 类/${jsKeyframes.size} keyframes，SCSS 定义 ${scssClasses.size} 类/${scssKeyframes.size} keyframes，双向接线完整（白名单 ${JS_REF_NO_SCSS.length}+${SCSS_DEF_NO_JS.length} 条）`);
