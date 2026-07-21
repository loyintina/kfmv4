/**
 * check-cards.mjs — 卡片注册表完整性校验
 *
 * 规则 A（原有）：getCardType('xxx') 字面量引用的 typeId 必须已注册。
 *
 * 规则 B（新增）：每个 registerCardType({ typeId:'xxx' }) 注册的 typeId，
 *   若代码中有字面量 getCardType('yyy') / getCardHandler('yyy') 调用，
 *   且该 typeId 未被任何字面量引用，视为「孤立注册」——警告（不中断构建）。
 *
 *   背景：动态调用路径（getAllCardTypes() / getCardType(getCardId(i))）会在运行时
 *   覆盖所有注册类型，无法静态分析。因此孤立注册不一定意味着 bug（可能只走动态路径），
 *   降级为 warn 而非 error，让开发者自行判断是否为真正的遗弃类型。
 *
 * 用法：node check-cards.mjs [--check-only]
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR   = join(__dirname, 'src', 'client', 'modules');
const PLUGINS_DIR = join(__dirname, 'src', 'client', 'cards', 'plugins');
const CARDS_DIR   = join(__dirname, 'src', 'client', 'cards');

let errCount = 0;
function error(msg) { console.error('[check-cards] ' + msg); errCount++; }
function warn(msg)  { console.warn('[check-cards] ' + msg); }

// ========== 文件扫描 ==========

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { yield* walk(full); continue; }
    if (entry.name.endsWith('.ts')) yield full;
  }
}

const ALL_DIRS = [SRC_DIR, PLUGINS_DIR, CARDS_DIR];

// ========== 规则 A：字面量引用 → 必须已注册 ==========

const regTypeRe  = /registerCardType\s*\(\s*\{[^}]*typeId:\s*['"]([^'"]+)['"]/g;
const refLitRe   = /(?:getCardType|getCardHandler)\s*\(\s*['"]([^'"]+)['"]/g;

const registered  = new Set();   // 所有已注册 typeId
const refLiteral  = new Map();   // 字面量引用 typeId → [file]
const hasDynamic  = { any: false }; // 是否有动态调用路径

for (const dir of ALL_DIRS) {
  for (const f of walk(dir)) {
    const content = readFileSync(f, 'utf-8');
    let m;
    // 注册
    const rr = /registerCardType\s*\(\s*\{[^}]*typeId:\s*['"]([^'"]+)['"]/g;
    while ((m = rr.exec(content)) !== null) registered.add(m[1]);
    // 字面量引用
    const rl = /(?:getCardType|getCardHandler)\s*\(\s*['"]([^'"]+)['"]/g;
    while ((m = rl.exec(content)) !== null) {
      const id = m[1];
      if (!refLiteral.has(id)) refLiteral.set(id, []);
      refLiteral.get(id).push(relative(__dirname, f));
    }
    // 动态调用检测（getAllCardTypes / getCardType(variable)）
    if (/getAllCardTypes\s*\(/.test(content) ||
        /getCardType\s*\([^'"]\s*[^)'"]*\)/.test(content)) {
      hasDynamic.any = true;
    }
  }
}

// 规则 A：字面量引用的 typeId 必须已注册
for (const [typeId, files] of refLiteral) {
  if (!registered.has(typeId)) {
    error(`getCardType('${typeId}') 引用了未登记的卡片类型，出现在: ${files.join(', ')}`);
    error(`  请添加 registerCardType({ typeId: '${typeId}', ... }); 声明`);
  }
}

// 规则 B：已注册但无字面量引用（仅当有字面量引用存在时才有意义警告）
if (refLiteral.size > 0) {
  const orphans = [...registered].filter(t => !refLiteral.has(t));
  if (orphans.length > 0) {
    if (hasDynamic.any) {
      // 有动态路径（getAllCardTypes/变量 getCardType）会覆盖这些类型 → 汇总一行，不逐条刷屏
      warn(`${orphans.length} 个类型仅经动态路径引用（${orphans.join(', ')}）——正常，删除前请确认无动态使用`);
    } else {
      for (const typeId of orphans) {
        error(`'${typeId}' 已注册但无任何引用（孤立注册，可安全删除）`);
      }
    }
  }
}
// ========== 结果 ==========

if (errCount > 0) {
  console.error(`[check-cards] ${errCount} error(s) — BLOCKED`);
  process.exit(1);
}
console.log(`[check-cards] OK — ${registered.size} types registered, ${refLiteral.size} literal-referenced` +
  (hasDynamic.any ? ` (+ dynamic getAllCardTypes/variable path)` : ''));
