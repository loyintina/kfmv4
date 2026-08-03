/**
 * check-ledger-commits.mjs — 账本 commit 引用对账（v8.3 语义审计机械化 M3）
 *
 * 靶向成因 G4（双份登记无对账）：bugs.md / drift-provenance.md 大量引用
 * commit hash 作为病灶锚点。hash 写错一位 = 锚点悬空，双账本对账无声断裂。
 *
 * 规则：docs/ledger/*.md 中 7-10 位 hex（反引号内或表格单元格内）必须
 * `git cat-file -t` 可解析为 commit。版本号样式（v8.3.1）与纯数字不匹配。
 *
 * 探针豁免：输入是 git 历史（造假 git 历史成本远超收益，见 check-probes 头注释）。
 * 挂 npm run check，失配 = 中断。
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { DOCS_ROOT } from './docs-root-const.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const HASH_RE = /(?<![0-9a-z])([0-9a-f]{7,10})(?![0-9a-z])/g;
// 常见误配豁免：全数字串（行号/计数）、已知非 hash 标识
const isAllDigits = s => /^\d+$/.test(s);

let errors = 0;
let checked = 0;
const validityCache = new Map();

function isCommit(hash) {
  if (!validityCache.has(hash)) {
    try {
      const t = execFileSync('git', ['cat-file', '-t', hash], { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      validityCache.set(hash, t === 'commit');
    } catch {
      validityCache.set(hash, false);
    }
  }
  return validityCache.get(hash);
}

const ledgerDir = join(ROOT, DOCS_ROOT, 'ledger');
// 已声明丢失的锚点豁免：同行注明「不在当前历史/已丢失/rebase」的 hash 是
// 有意记录的历史尸体（drift-provenance 条目 3 三 commit 被 rebase 吞掉案），不核对。
const LOST_MARK = /不在当前历史|已丢失|rebase/;
for (const f of readdirSync(ledgerDir).filter(f => f.endsWith('.md'))) {
  const lines = readFileSync(join(ledgerDir, f), 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (LOST_MARK.test(lines[i])) continue;
    for (const m of lines[i].matchAll(HASH_RE)) {
      const h = m[1];
      if (isAllDigits(h)) continue;
      checked++;
      if (!isCommit(h)) {
        console.error(`[check-ledger-commits] ledger/${f}:${i + 1}: commit 引用 ${h} 在 git 历史中不存在（锚点悬空）`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n[check-ledger-commits] ${errors} 处 commit 引用失效，构建中断。`);
  console.error('[check-ledger-commits] ⛳ TEST-FLOW-03：账本 commit 引用悬空——读 docs/ledger/history.md §账本纪律，走 workflows/bug-fix.yaml 或修正账本');
  process.exit(1);
}
console.log(`[check-ledger-commits] OK — ${checked} 处 commit 引用全部可解析`);
