/**
 * KFM v4 — UI Element Registry 完整性验证
 *
 * 检查所有预期注册的 UI 元素是否在源码中有对应的 Registry.register() 调用。
 * 挂入 npm run check，不注册 = 构建中断。
 *
 * 模式与 check-as-any.mjs 相同：
 * - MANIFEST 是硬编码的权威清单
 * - 扫描源码找 Registry.register({...}) 调用，提取 id
 * - 对比 MANIFEST，缺失则报错
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = 'src';

// ========== MANIFEST（权威清单 — 交互层） ==========
// 新增交互元素时，同时在此数组追加对应 id。
// id 必须与 Registry.register({ id: '...' }) 中的值一致。
const ELEMENT_MANIFEST = [
  'orb',                  // orb.ts — AI 对话光球
  'orb-panel',            // orb.ts — AI 对话面板（光球展开后）
  'sidebar',              // ui.ts — 文件树侧栏
  'sidebar-toggle-btn',   // app.ts — 侧栏召唤按钮
  'card-stack-toggle-btn', // app.ts — 卡片堆召唤按钮
  'close-sidebar-btn',    // app.ts — 关闭侧栏按钮
  'eye-btn',              // app.ts — 显示隐藏文件开关
  'card-stack',           // card-stack.ts — 堆叠卡片面板
  'input-bar',            // app.ts / HTML — AI 输入栏
  'operation-toast',      // app.ts — 操作提示
  'file-tree',            // tree-render.ts — Canvas 文件树
];

// ========== CONTENT MANIFEST（权威清单 — 内容层） ==========
const CONTENT_MANIFEST = [
  'file-tree',            // tree-loader.ts — 文件树摘要（registerContentGenerator）
  'card-stack-content',   // card-stack.ts — 卡片堆当前焦点摘要
  'orb-chat',             // orb.ts — AI 对话摘要
];

// ========== CAPABILITY MANIFEST（权威清单 — 能力层） ==========
const CAPABILITY_MANIFEST = [
  'file-search',          // main.ts / capability-executor.ts
  'file-read',            // main.ts / capability-executor.ts
  'file-write',           // main.ts / capability-executor.ts
];

// 匹配 Registry.register({...}) 或 Registry.registerElement({...}, getter)
// 兼容多行参数和多行 getter 回调
const REGISTER_CALL_RE = /Registry\.register(?:Element)?\s*\(\s*\{[\s\S]*?id:\s*'([^']+)'/g;

// 匹配 Registry.registerContent({ id: '...' })
const CONTENT_OBJ_RE = /Registry\.registerContent\s*\(\s*\{[\s\S]*?id:\s*'([^']+)'/g;
// 匹配 Registry.registerContentGenerator('id', ...)
const CONTENT_GEN_RE = /Registry\.registerContentGenerator\s*\(\s*'([^']+)'/g;
// 匹配 Registry.registerCapability({ id: '...' })
const CAPABILITY_CALL_RE = /Registry\.registerCapability\s*\(\s*\{[\s\S]*?id:\s*'([^']+)'/g;

/** 注册调用中必须出现的字段列表 */
const REQUIRED_REGISTER_FIELDS = ['type', 'label', 'description', 'effect', 'enabled'];

// ========== 扫描 ==========

function* walk(dir) {
  const entries = readdirSync(dir);
  for (const name of entries) {
    const full = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'dist') continue;
      yield* walk(full);
    } else if (extname(name) === '.ts') {
      yield full;
    }
  }
}

let hasError = false;

function reportError(msg) {
  console.error(`[check-registry] ${msg}`);
  hasError = true;
}

/**
 * 检查 Registry.register({...}) 的必需字段是否完整。
 * 返回 { id, missing: string[] }[] 列表。
 */
function checkRegisterCompleteness() {
  // 匹配整个 register 块（包含 id 和所有字段），兼容 register 和 registerElement
  // 注意：register 以 ) 结尾，registerElement 以 , getter) 结尾
  const BLOCK_RE = /Registry\.register(?:Element)?\s*\(\s*\{([\s\S]*?)\}\s*[,)]/g;
  const results = [];

  for (const absPath of walk(SRC_DIR)) {
    if (absPath.endsWith('.d.ts') || absPath.endsWith('ui-registry.ts')) continue;
    const content = readFileSync(absPath, 'utf-8');
    let match;
    while ((match = BLOCK_RE.exec(content)) !== null) {
      const block = match[1];
      const idMatch = block.match(/id:\s*'([^']+)'/);
      if (!idMatch) continue; // 非标准格式，跳过
      const id = idMatch[1];
      const missing = REQUIRED_REGISTER_FIELDS.filter(field => {
        const re = new RegExp(`\\b${field}:\\s*`);
        return !re.test(block);
      });
      if (missing.length > 0) {
        results.push({ id, missing, file: absPath });
      }
    }
  }
  return results;
}

function check() {
  const registeredElements = new Set();
  const registeredContents = new Set();
  const registeredCapabilities = new Set();

  for (const absPath of walk(SRC_DIR)) {
    if (absPath.endsWith('.d.ts')) continue;
    const content = readFileSync(absPath, 'utf-8');
    let match;

    // 扫描交互元素注册
    while ((match = REGISTER_CALL_RE.exec(content)) !== null) {
      registeredElements.add(match[1]);
    }

    // 扫描内容层注册（两种调用格式）
    while ((match = CONTENT_OBJ_RE.exec(content)) !== null) {
      registeredContents.add(match[1]);
    }
    while ((match = CONTENT_GEN_RE.exec(content)) !== null) {
      registeredContents.add(match[1]);
    }

    // 扫描能力层注册
    while ((match = CAPABILITY_CALL_RE.exec(content)) !== null) {
      registeredCapabilities.add(match[1]);
    }
  }

  // ===== 检查交互层 MANIFEST =====
  const missingElements = ELEMENT_MANIFEST.filter(id => !registeredElements.has(id));
  if (missingElements.length > 0) {
    reportError(`以下交互元素在 MANIFEST 中但未注册：${missingElements.join(', ')}`);
  }

  const extraElements = [...registeredElements].filter(id => !ELEMENT_MANIFEST.includes(id));
  if (extraElements.length > 0) {
    console.log(`[check-registry] 以下元素已注册但不在 ELEMENT_MANIFEST 中（可能是新增遗漏）：`);
    for (const id of extraElements) {
      console.log(`  - ${id}`);
    }
  }

  // ===== 检查内容层 MANIFEST =====
  const missingContents = CONTENT_MANIFEST.filter(id => !registeredContents.has(id));
  if (missingContents.length > 0) {
    reportError(`以下内容块在 CONTENT_MANIFEST 中但未注册：${missingContents.join(', ')}`);
  }

  // ===== 检查能力层 MANIFEST =====
  const missingCaps = CAPABILITY_MANIFEST.filter(id => !registeredCapabilities.has(id));
  if (missingCaps.length > 0) {
    reportError(`以下能力在 CAPABILITY_MANIFEST 中但未注册：${missingCaps.join(', ')}`);
  }

  // ===== 参数完整性检查 =====
  const incomplete = checkRegisterCompleteness();
  for (const { id, missing, file } of incomplete) {
    reportError(`${id}（${file}）缺少必需字段: ${missing.join(', ')}`);
  }

  // ===== 汇总 =====
  if (hasError) {
    console.error(`\n[check-registry] 缺失项见上，构建中断。`);
    process.exit(1);
  }

  console.log(`[check-registry] OK — ${registeredElements.size} 个交互元素、${registeredContents.size} 个内容块、${registeredCapabilities.size} 个能力已注册，全部 MANIFEST 匹配，参数完整性检查通过`);
}

const CHECK_ONLY = process.argv.includes('--check-only');
check();
