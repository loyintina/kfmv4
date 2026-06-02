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

// ========== MANIFEST（权威清单） ==========
// 新增交互元素时，同时在此数组追加对应 id。
// id 必须与 Registry.register({ id: '...' }) 中的值一致。
const MANIFEST = [
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
];

// 匹配 Registry.register({ id: '...' }) 或 Registry.register( { id: '...' } )
// 兼容多行参数：Registry.register({ \n   id: '...', \n   ...
const REGISTER_CALL_RE = /Registry\.register\s*\(\s*\{[\s\S]*?id:\s*'([^']+)'/g;

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

function check() {
  const registered = new Set();

  for (const absPath of walk(SRC_DIR)) {
    if (absPath.endsWith('.d.ts')) continue;
    const content = readFileSync(absPath, 'utf-8');
    let match;
    while ((match = REGISTER_CALL_RE.exec(content)) !== null) {
      registered.add(match[1]);
    }
  }

  // 检查 MANIFEST 中是否有未注册的
  const missing = MANIFEST.filter(id => !registered.has(id));

  if (missing.length > 0) {
    console.error(`[check-registry] 以下元素在 MANIFEST 中但未注册：`);
    for (const id of missing) {
      console.error(`  - ${id}`);
    }
    console.error(`\n  有两种可能：`);
    console.error(`  1. 元素已存在但忘记调 Registry.register() → 在对应 init*() 中补上`);
    console.error(`  2. 元素已被删除 → 从 MANIFEST 中移除对应的 id`);
    process.exit(1);
  }

  // 报告不在 MANIFEST 中的注册（非致命，仅提醒）
  const extra = [...registered].filter(id => !MANIFEST.includes(id));
  if (extra.length > 0) {
    console.log(`[check-registry] 以下元素已注册但不在 MANIFEST 中（可能是新增遗漏）：`);
    for (const id of extra) {
      console.log(`  - ${id}`);
    }
  }

  console.log(`[check-registry] OK — ${registered.size} 个元素已注册，MANIFEST 全部匹配`);
}

const CHECK_ONLY = process.argv.includes('--check-only');
check();
