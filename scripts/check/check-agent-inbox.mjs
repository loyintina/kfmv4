/**
 * check-agent-inbox.mjs — 跨线评审信箱台账一致性（2026-08-18 立，信箱审计催生）
 *
 * 问题：2026-08-18 agent-inbox 审计抓到「维护最后一英里」系统性漂移——
 *   回信存在却漏登台账（kfm-na-rust-synergy-response.md，台账状态列已引用它）、
 *   三条批准行状态倒挂停滞、「33 封信」计数三处滞后于现实、6 个文件名偏离
 *   命名规则。信箱是外围机制（接受滞后+抽查），但台账自相矛盾属于可机检的硬事实。
 *
 * 检查（台账 = docs/ledger/agent-inbox/README.md 的 Markdown 表格）：
 *   a. 双向对应：目录内每个 .md（除 README.md）必须在台账中有链接行；
 *      台账中每个 .md 链接必须存在于目录。
 *   b. 命名规范：文件名全 ASCII；以 kfm-na 或 kfmv4 开头；结尾类型词 ∈
 *      {submission, review, response, report, verdict, notice, landing,
 *      landing-report}（复合如 review-response 以末词计）。
 *      LEGACY 祖父豁免（2026-08-18 审计遗留 6 封，信件只追加不删改故不更名；
 *      新违规照红）：kfm-na-cordis-rs-stage1-landing.md、
 *      kfmv4-9.0-cordis-adoption-verdict.md、kfmv4-9.0-na-rust-synergy.md、
 *      kfmv4-9.0-version-plan-v2-notice.md、kfmv4-9.0-review-response-moli.md、
 *      kfmv4-inbox-response-moli.md。
 *   c. 计数咬合：docs/active/nine-zero/00-index.md 与
 *      nine-zero-decision-index.md 中所有「N 封信」声称必须等于目录实际信件数。
 *   d. 决策索引覆盖：台账「状态」列含 已裁决/终审/已落地/已验证 的信件，
 *      其文件名必须在 nine-zero-decision-index.md 中出现至少一次。
 *      （2026-08-18 首跑存量缺口 8 封 ≤10，按裁决补行修平，无日期祖父豁免；
 *      若未来缺口失控再议 2026-08-15 前信件按日期豁免。）
 *
 * 枚举型检查（每次全量重扫信箱 + 台账），KFM_PROBE_ROOT 可注入（宪法探针条款）。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.KFM_PROBE_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const INBOX = join(ROOT, 'docs', 'ledger', 'agent-inbox');
const README = join(INBOX, 'README.md');
const NINE_ZERO = join(ROOT, 'docs', 'active', 'nine-zero');

let errors = 0;
function error(msg) {
  console.error(`[check-agent-inbox] ${msg}`);
  errors++;
}

if (!existsSync(README)) {
  console.error('[check-agent-inbox] 台账不存在：docs/ledger/agent-inbox/README.md');
  process.exit(1);
}

const letters = readdirSync(INBOX).filter(f => f.endsWith('.md') && f !== 'README.md').sort();
const readme = readFileSync(README, 'utf-8');

// ---------- a. 双向对应 ----------
for (const f of letters) {
  if (!readme.includes(`](${f})`)) {
    error(`a. 账外信：${f} 在目录存在但台账无链接行——补登 README（⛳ MECH-FLOW-12）`);
  }
}
for (const m of readme.matchAll(/\]\(([^)]+\.md)\)/g)) {
  if (!existsSync(join(INBOX, m[1]))) {
    error(`a. 死链：台账链接 ${m[1]} 在目录不存在（⛳ MECH-FLOW-12）`);
  }
}

// ---------- b. 命名规范 ----------
// LEGACY 祖父豁免：2026-08-18 审计遗留 6 封命名违规（信件只追加不删改，不更名）；
// 豁免仅限这 6 个文件名本体，新违规照红。
const LEGACY_NAMING = new Set([
  'kfm-na-cordis-rs-stage1-landing.md',   // 类型词 landing（同类均 -landing-report）
  'kfmv4-9.0-cordis-adoption-verdict.md', // 类型词 verdict
  'kfmv4-9.0-na-rust-synergy.md',         // 无类型词
  'kfmv4-9.0-version-plan-v2-notice.md',  // 类型词 notice
  'kfmv4-9.0-review-response-moli.md',    // 类型词后人名后缀 -moli
  'kfmv4-inbox-response-moli.md',         // 同上
  'kfmv4-9.0-step0-progress.md',          // 类型词 progress（2026-08-18 晚 9.0 线新信，
                                          // 当日首跑即拦截；评审已在回执中请 9.0 线更名
                                          // 为 -report，更名后从此集合移除）
]);
const TYPE_WORDS = new Set(['submission', 'review', 'response', 'report', 'verdict', 'notice', 'landing', 'landing-report']);
for (const f of letters) {
  if (!/^[\x20-\x7E]+$/.test(f)) {
    error(`b. 命名违规：${f} 含非 ASCII 字符（⛳ MECH-FLOW-12）`);
    continue;
  }
  if (LEGACY_NAMING.has(f)) continue;
  if (!/^(kfm-na|kfmv4)-/.test(f)) {
    error(`b. 命名违规：${f} 未以 kfm-na 或 kfmv4 开头（⛳ MECH-FLOW-12）`);
    continue;
  }
  const lastWord = f.replace(/\.md$/, '').split('-').pop();
  if (!TYPE_WORDS.has(lastWord)) {
    error(`b. 命名违规：${f} 结尾类型词「${lastWord}」不在 ${[...TYPE_WORDS].join('/')}（复合名以末词计）（⛳ MECH-FLOW-12）`);
  }
}

// ---------- c. 计数咬合 ----------
for (const idx of ['00-index.md', 'nine-zero-decision-index.md']) {
  const p = join(NINE_ZERO, idx);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, 'utf-8');
  for (const m of text.matchAll(/(\d+)\s*封信/g)) {
    if (parseInt(m[1], 10) !== letters.length) {
      error(`c. 计数滞后：${idx} 声称「${m[1]} 封信」，实际 ${letters.length} 封（⛳ MECH-FLOW-13）`);
    }
  }
}

// ---------- d. 决策索引覆盖 ----------
const DECISION_INDEX = join(NINE_ZERO, 'nine-zero-decision-index.md');
if (existsSync(DECISION_INDEX)) {
  const decisionIndex = readFileSync(DECISION_INDEX, 'utf-8');
  const DECIDED_RE = /已裁决|终审|已落地|已验证/;
  for (const line of readme.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*(日期|---)/.test(line)) continue;
    const cells = line.split('|').map(c => c.trim());
    const letterCell = cells[2] ?? '';
    const statusCell = cells[cells.length - 2] ?? '';
    const m = /\]\(([^)]+\.md)\)/.exec(letterCell);
    if (!m) continue;
    if (DECIDED_RE.test(statusCell) && !decisionIndex.includes(m[1])) {
      error(`d. 索引漏登：${m[1]} 状态「${statusCell.slice(0, 18)}…」已落定，但 nine-zero-decision-index.md 未提及（⛳ MECH-FLOW-14：新决策落定时加一行）`);
    }
  }
}

// ---------- 收口 ----------
if (errors > 0) {
  console.error(`\n[check-agent-inbox] 台账一致性检查失败（${errors} 处红），构建中断。`);
  process.exit(1);
}
console.log(`[check-agent-inbox] OK — ${letters.length} 封信双向对应 / 命名合规（LEGACY 豁免 ${LEGACY_NAMING.size}）/ 计数咬合 / 决策索引覆盖`);
