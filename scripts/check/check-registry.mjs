/**
 * check-registry.mjs — UI Element Registry 完整性验证
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
  'orb',                  // orb.ts — 悬浮光球（AI Chat 入口）
  'orb-panel',            // orb.ts — AI 对话面板（光球展开后）
  'sidebar',              // ui.ts — 文件树侧栏
  'close-sidebar-btn',    // app.ts — 关闭侧栏按钮
  'eye-btn',              // app.ts — 显示隐藏文件开关
  'card-stack',           // card-stack.ts — 堆叠卡片面板
  'input-bar',            // app.ts / HTML — AI 输入栏
  'operation-toast',      // app.ts — 操作提示
  'file-tree',            // tree-render.ts — Canvas 文件树
  'overlay',              // ui.ts — 遮罩层
  'ai-send-btn',          // app.ts — 发送按钮
];

// ========== CONTENT MANIFEST（权威清单 — 内容层） ==========
const CONTENT_MANIFEST = [
  'file-tree',            // tree-loader.ts — 文件树摘要（registerContentGenerator）
  'card-stack-content',   // card-stack.ts — 卡片堆当前焦点摘要
  'orb-chat',             // orb.ts — AI 对话摘要
];

// ========== 能力层（暂无权威清单） ==========
// 「AI 之手」落地前能力注册面留空（ADR-004 追加裁决：无执行面的注册会误导 AI）。
// AI 之手实施时在此重建 CAPABILITY_MANIFEST + 下方对应检查块。

// ========== data-registry-id 覆盖验证 ==========
// 在 index.html 中有 data-registry-id 属性，AI click 指令可以直接点击。
// 不在列表中 = 必须有 data-registry-id（否则 AI 无法定位）。
// Canvas 渲染、动态 DOM、或纯视觉反馈的元素在此声明豁免，并注明理由。
const NO_DOM_TARGET = new Set([
  'orb-panel',       // 动态 DOM（展开后创建），通过 expand-orb 命令操作
  'card-stack',      // 动态 DOM（GSAP 创建），通过 open/close-card-stack 命令
  'file-tree',       // Canvas 渲染，无 DOM 可点击
  'operation-toast', // 纯视觉反馈 toast，非交互元素，AI 不可点击
]);

// 匹配 Registry.register({...}) 或 Registry.registerElement({...}, getter)
// 兼容多行参数和多行 getter 回调
const REGISTER_CALL_RE = /Registry\.register(?:Element)?\s*\(\s*\{[\s\S]*?id:\s*'([^']+)'/g;

// 匹配 Registry.registerContent({ id: '...' })
const CONTENT_OBJ_RE = /Registry\.registerContent\s*\(\s*\{[\s\S]*?id:\s*'([^']+)'/g;
// 匹配 Registry.registerContentGenerator('id', ...)
const CONTENT_GEN_RE = /Registry\.registerContentGenerator\s*\(\s*'([^']+)'/g;
// 匹配 Registry.registerStateGetter('id', ...)
const STATEGETTER_CALL_RE = /Registry\.registerStateGetter\s*\(\s*'([^']+)'/g;
// 匹配 Registry.registerCapability({ id: '...' })
const CAPABILITY_CALL_RE = /Registry\.registerCapability\s*\(\s*\{[\s\S]*?id:\s*'([^']+)'/g;
// 匹配 wsChannel.onCommand('action', ...)
const COMMAND_CALL_RE = /wsChannel\.onCommand\s*\(\s*'([^']+)'/g;
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

/**
 * 检查 data-registry-id 覆盖：MANIFEST 中每个需要 DOM 定位的元素
 * 必须在 public/index.html 中有 data-registry-id 属性，反之亦然。
 */
function checkDataRegistryId() {
  const htmlPath = 'public/index.html';
  let html;
  try {
    html = readFileSync(htmlPath, 'utf-8');
  } catch {
    reportError(`无法读取 ${htmlPath}，跳过 data-registry-id 验证`);
    return;
  }

  const DATA_RE = /data-registry-id="([^"]+)"/g;
  const domIds = new Set();
  let m;
  while ((m = DATA_RE.exec(html)) !== null) {
    domIds.add(m[1]);
  }

  // 检查 1：MANIFEST 中需要 DOM 定位但没有 data-registry-id 的元素
  for (const id of ELEMENT_MANIFEST) {
    if (!NO_DOM_TARGET.has(id) && !domIds.has(id)) {
      reportError(`${id} 在 ELEMENT_MANIFEST 中但未在 public/index.html 中找到 data-registry-id 属性。`
        + ` 如果在 DOM 中无对应元素，请将其 id 加入 NO_DOM_TARGET 并注明理由。`);
    }
  }

  // 检查 2：HTML 中有 data-registry-id 但不在 ELEMENT_MANIFEST 中的元素（孤儿）
  for (const id of domIds) {
    if (!ELEMENT_MANIFEST.includes(id)) {
      reportError(`${id} 在 public/index.html 中有 data-registry-id 属性但未在 ELEMENT_MANIFEST 中注册。`
        + ` 如果这是新增元素，请先在 MANIFEST 中注册。如果这是多余的属性，请从 HTML 中移除。`);
    }
  }
}

/**
 * 检查孤立 state getter：registerStateGetter('id') 是否有对应的 register({ id }) 或 registerElement({ id })。
 * 没有对应元素的 getter 永远不会被调用，属于死代码或漏注册。
 */
function checkOrphanGetters() {
  const registeredElements = new Set();
  const stateGetterIds = new Set();

  for (const absPath of walk(SRC_DIR)) {
    if (absPath.endsWith('.d.ts') || absPath.endsWith('ui-registry.ts')) continue;
    const content = readFileSync(absPath, 'utf-8');
    let match;
    while ((match = REGISTER_CALL_RE.exec(content)) !== null) {
      registeredElements.add(match[1]);
    }
    while ((match = STATEGETTER_CALL_RE.exec(content)) !== null) {
      stateGetterIds.add(match[1]);
    }
  }

  for (const id of stateGetterIds) {
    if (!registeredElements.has(id)) {
      reportError(`孤立 state getter: registerStateGetter('${id}') 没有对应的 register/registerElement 调用。getter 永远不会被执行。`);
    }
  }
}

/**
 * 检查命令注册重复：wsChannel.onCommand('action') 是否在多个文件中出现。
 * 同一个 action 被多个模块注册会导致前一个被静默覆盖。
 */
function checkCommandDuplicates() {
  const commandFiles = new Map(); // action → [file1, file2, ...]

  for (const absPath of walk(SRC_DIR)) {
    if (absPath.endsWith('.d.ts')) continue;
    const content = readFileSync(absPath, 'utf-8');
    let match;
    while ((match = COMMAND_CALL_RE.exec(content)) !== null) {
      const action = match[1];
      if (!commandFiles.has(action)) {
        commandFiles.set(action, []);
      }
      commandFiles.get(action).push(absPath);
    }
  }

  for (const [action, files] of commandFiles) {
    const uniqueFiles = [...new Set(files)];
    if (uniqueFiles.length > 1) {
      reportError(`命令 "${action}" 在多个文件中注册：${uniqueFiles.join(', ')}。后注册的会静默覆盖先注册的。`);
    }
  }
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

    // 扫描能力层��册
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
    reportError(`以下元素已注册但不在 ELEMENT_MANIFEST 中（请更新 MANIFEST）：${extraElements.join(', ')}`);
  }

  // ===== 检查内容层 MANIFEST =====
  const missingContents = CONTENT_MANIFEST.filter(id => !registeredContents.has(id));
  if (missingContents.length > 0) {
    reportError(`以下内容块在 CONTENT_MANIFEST 中但未注册：${missingContents.join(', ')}`);
  }

  // ===== 能力层检查（暂缺——AI 之手落地时随 CAPABILITY_MANIFEST 重建） =====

  // ===== 参数完整性检查 =====
  const incomplete = checkRegisterCompleteness();
  for (const { id, missing, file } of incomplete) {
    reportError(`${id}（${file}）缺少必需字段: ${missing.join(', ')}`);
  }

  // ===== data-registry-id 覆盖验证 =====
  checkDataRegistryId();
  // ===== 孤立 state getter 检查 =====
  checkOrphanGetters();
  // ===== 命令注册重复检查 =====
  checkCommandDuplicates();
  // ===== 汇总 =====
  if (hasError) {
    console.error(`\n[check-registry] 缺失项见上，构建中断。`);
    process.exit(1);
  }

  console.log(`[check-registry] OK — ${registeredElements.size} 个交互元素、${registeredContents.size} 个内容块、${registeredCapabilities.size} 个能力已注册，全部 MANIFEST 匹配，参数完整性和能力一致性检查通过`);
}

const CHECK_ONLY = process.argv.includes('--check-only');
check();