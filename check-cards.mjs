/**
 * check-cards.mjs — 卡片注册表完整性校验
 *
 * 验证规则：
 *   每个 getCardType('xxx') 调用引用的 typeId 必须对应一个
 *   registerCardType({ typeId: 'xxx' }) 声明。
 *
 * 用法：node check-cards.mjs [--check-only]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, 'src', 'client', 'modules');

let errCount = 0;
function error(msg) { console.error('[check-cards] ' + msg); errCount++; }

// ========== 扫描 ==========

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { yield* walk(full); continue; }
    if (entry.name.endsWith('.ts')) yield full;
  }
}

// ========== 规则 A：getCardType('xxx') 必须对应 registerCardType({ typeId: 'xxx' }) ==========

const regTypeRe = /registerCardType\s*\(\s*\{[^}]*typeId:\s*['"]([^'"]+)['"]/g;
const refTypeRe = /getCardType\s*\(\s*['"]([^'"]+)['"]/g;

const registered = new Set();
const referenced = new Map(); // typeId → [file]

for (const f of walk(SRC_DIR)) {
  const content = readFileSync(f, 'utf-8');
  let m;
  while ((m = regTypeRe.exec(content)) !== null) {
    registered.add(m[1]);
  }
  while ((m = refTypeRe.exec(content)) !== null) {
    const id = m[1];
    if (!referenced.has(id)) referenced.set(id, []);
    referenced.get(id).push(relative(SRC_DIR, f));
  }
}

for (const [typeId, files] of referenced) {
  if (!registered.has(typeId)) {
    error('getCardType(\'' + typeId + '\') 引用了未登记的卡片类型，出现在: ' + files.join(', '));
    error('  请添加 registerCardType({ typeId: \'' + typeId + '\', ... }); 声明');
  }
}

// ========== 结果 ==========

if (errCount > 0) {
  console.error('[check-cards] ' + errCount + ' error(s) — BLOCKED');
  process.exit(1);
}
console.log('[check-cards] OK — ' + registered.size + ' types registered, ' + referenced.size + ' referenced');
