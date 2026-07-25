#!/usr/bin/env node
/**
 * npm 残留临时目录清理脚本
 *
 * npm install 被中断时会在 node_modules/ 下留下 .<pkg>-<random> 临时目录。
 * 下次 install 时 npm 试图 rename 已有包 → ENOTEMPTY 报错 → 升级失败
 * → AI 在安全模式下无法 rm -rf → 死循环 → 整机卡死。
 *
 * 这个脚本作为 npm preinstall hook 自动运行，在问题发生前就清除隐患。
 *
 * 用法: node scripts/clean-npm-temp.js
 * 在 package.json 中: "preinstall": "node scripts/clean-npm-temp.js"
 */

const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const nm = path.join(root, 'node_modules');

if (!fs.existsSync(nm)) {
  process.exit(0);
}

let count = 0;
const entries = fs.readdirSync(nm, { withFileTypes: true });

for (const entry of entries) {
  // npm 临时目录模式: .<package-name>-<random-chars>
  // 通常以 . 开头，包含 - 或随机字符，且不是 .bin / .package-lock.json
  if (entry.name.startsWith('.') && entry.name !== '.bin' && entry.name !== '.package-lock.json') {
    const fullPath = path.join(nm, entry.name);
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      count++;
    } catch {
      // 如果删除失败（如正在使用），跳过
    }
  }
}

if (count > 0) {
  console.log(`[clean-npm-temp] 已清理 ${count} 个残留临时目录`);
}
