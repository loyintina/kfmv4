/**
 * check-agent-inbox.mjs — 跨线评审信箱一致性（2026-08-18 立，信箱审计催生；
 * 同日 D3 台账生成化落地后转型）。
 *
 * 转型前四查里的「a. 双向对应」已删除——台账表格改由 gen-agent-inbox.mjs 从
 * 信件机读头生成（--check-only 挂链），账外信/死链由生成器天然保证，不再手查。
 *
 * 现存检查：
 *   a. 机读头 schema：每封信文首引用块内 7 字段齐全（日期/致/流型/预期表态方/
 *      收敛判据/回/状态）；日期合法 YYYY-MM-DD；流型 ∈ {链条,征集,汇总,线程}
 *      （契约 3 四流型原样）；致 分词 ∈ {kfmv4, kfmv4-9.0, kfm-na, 茉莉, 评审, 主会话, all}
 *      （多线「，」分隔）；状态词前缀 ∈ 合法词表——词表从 README 规则区
 *      「合法状态词表（…）：…」行解析（唯一出处，不另硬编码；允许 emoji 与
 *      ≤4 字署名前缀，如「✅ 茉莉已会签」）。
 *   b. 命名规范：文件名全 ASCII；以 kfm-na 或 kfmv4 开头；结尾类型词 ∈
 *      {submission, review, response, report, verdict, notice, landing,
 *      landing-report}（复合如 review-response 以末词计）。
 *      LEGACY 祖父豁免（2026-08-18 审计遗留 7 封，信件只追加不删改故不更名；
 *      新违规照红）：见下 LEGACY_NAMING。
 *   c. 计数咬合：docs/active/nine-zero/00-index.md 与
 *      nine-zero-decision-index.md 中所有「N 封信」声称必须等于目录实际信件数
 *      （信号源 = 目录实际文件，不变）。
 *   d. 决策索引覆盖：机读头「状态」含 已裁决/终审/已落地/已验证 的信件，
 *      其文件名必须在 nine-zero-decision-index.md 中出现至少一次（信号源 =
 *      目录信件机读头，不再读手写状态列）。
 *   e. 停滞检测（2026-08-18 立，README 活性条款机械化）：「待*」状态 +
 *      发信日期超 7 天 = 报红（⛳ MECH-FLOW-16）。阈值为执行层参数，
 *      调整走本文件，不走契约修订。
 *   f. 代际戳（2026-08-18 D4 落地，契约 3 第三机械件）：状态戳骑在状态
 *      字段括号注里（词表词（YYYY-MM-DD 更新者：备注），全角括号统一）。
 *      f1 戳格式 / f2 戳单调（≥ 发信日）/ f3 头体咬合（信体签名行
 *      「——线名 · 日期」最大日期 ≤ 戳日期，违反 = 旧头覆盖新态，
 *      ⛳ MECH-FLOW-17）。豁免：待* 状态（戳 = 发信日）、纯通报
 *      （收敛判据 = 无需回信）；LEGACY 14 封（前 D4 时代无合规戳，只追加
 *      不改写）f3 判软告警不判红。
 *
 * 机读头解析规则与 gen-agent-inbox.mjs 内联同一份逻辑——改动需两处同步。
 * 枚举型检查（每次全量重扫信箱），KFM_PROBE_ROOT 可注入（宪法探针条款）。
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
function warn(msg) {
  console.log(`[check-agent-inbox] 注意 — ${msg}`);
}

if (!existsSync(README)) {
  console.error('[check-agent-inbox] 台账不存在：docs/ledger/agent-inbox/README.md');
  process.exit(1);
}

const letters = readdirSync(INBOX).filter(f => f.endsWith('.md') && f !== 'README.md').sort();
const readme = readFileSync(README, 'utf-8');

// ---------- a. 机读头 schema ----------
// 与 gen-agent-inbox.mjs 同规则：只扫文首第一个引用块；同名字段取最后一次出现
//（存量信旧头注的全角「回：」「状态：」行由块尾新机读头覆盖）。
const FIELDS = ['日期', '致', '流型', '预期表态方', '收敛判据', '回', '状态'];
const FIELD_RE = /^>\s*(日期|致|流型|预期表态方|收敛判据|回|状态)\s*[:：]\s*(.+?)\s*$/;
function parseHeader(text) {
  const lines = text.split('\n');
  const start = lines.findIndex(l => l.startsWith('>'));
  if (start === -1) return null;
  let end = start;
  while (end + 1 < lines.length && lines[end + 1].startsWith('>')) end++;
  const header = {};
  for (let i = start; i <= end; i++) {
    const m = FIELD_RE.exec(lines[i]);
    if (m) header[m[1]] = m[2];
  }
  return header;
}

const FLOW_TYPES = new Set(['链条', '征集', '汇总', '线程']); // 契约 3 四流型原样
const LINES = new Set(['kfmv4', 'kfmv4-9.0', 'kfm-na', 'dsh', '茉莉', '评审', '主会话', 'all']); // 2026-09-01 登记主会话（用户主会话，tmux 窗口 omp；前端三层规格提案致信实锤，同 dsh 登记先例）

// 合法状态词表：从 README 规则区解析（唯一出处），不硬编码第二份
const wm = /合法状态词表（[^）]*）：([^。]+)。/.exec(readme);
const STATUS_WORDS = wm
  ? wm[1].split('/').map(s => s.replace(/（[^）]*）/g, '').trim()).filter(Boolean)
  : [];
if (!STATUS_WORDS.length) {
  error('a. README 规则区「合法状态词表」解析失败——词表唯一出处结构变了，本检查需跟进');
}
// 状态前缀匹配：剥 emoji/符号前缀后，允许 ≤4 字署名（如「茉莉」）+ 词表词（长词优先）
const STATUS_RE = STATUS_WORDS.length
  ? new RegExp(`^[^\\p{L}\\p{Script=Han}]*(?:\\p{Script=Han}{1,4})?(?:${[...STATUS_WORDS].sort((a, b) => b.length - a.length).join('|')})`, 'u')
  : null;

const headers = new Map();
for (const f of letters) {
  const h = parseHeader(readFileSync(join(INBOX, f), 'utf-8'));
  headers.set(f, h);
  const miss = !h ? FIELDS : FIELDS.filter(k => !(k in h));
  if (miss.length) {
    error(`a. 机读头缺字段：${f} 缺 ${miss.join('、')}——新信必填七字段（⛳ MECH-FLOW-15）`);
    continue;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.日期) || isNaN(Date.parse(h.日期))) {
    error(`a. 机读头日期非法：${f} 「${h.日期}」（须 YYYY-MM-DD）（⛳ MECH-FLOW-15）`);
  }
  if (!FLOW_TYPES.has(h.流型)) {
    error(`a. 机读头流型非法：${f} 「${h.流型}」∉ 链条/征集/汇总/线程（⛳ MECH-FLOW-15）`);
  }
  const toks = h.致.split(/[，,、\s]+/).filter(Boolean);
  if (!toks.length || toks.some(t => !LINES.has(t)) || (toks.includes('all') && toks.length > 1)) {
    error(`a. 机读头「致」非法：${f} 「${h.致}」（线名 ∈ ${[...LINES].join('/')}，多线「，」分隔）（⛳ MECH-FLOW-15）`);
  }
  if (STATUS_RE && !STATUS_RE.test(h.状态)) {
    error(`a. 机读头状态词出表：${f} 「${h.状态.slice(0, 24)}…」前缀不在合法词表（⛳ MECH-FLOW-15）`);
  }
}

// ---------- f. 代际戳（2026-08-18 D4 落地，契约 3 第三机械件） ----------
// 状态戳骑在状态字段括号注里：词表词（YYYY-MM-DD 更新者：备注），全角括号统一。
// 豁免两类：待* 状态（未翻转，戳 = 发信日）；纯通报（收敛判据 = 无需回信）。
// LEGACY_STAMP 14 封（2026-08-18 D4 落地时实证订正：设计稿「7 封」按「状态
// 内有无日期」粗扫估数；正式化戳格式「全角（ + 日期 + 更新者」后实测非合规
// 共 14 封——7 封无日期 + 7 封为「（2026-08-16：…」无更新者或嵌套括号的
// 前 D4 时代写法。均只追加不改写，整体祖父豁免，f3 判软告警；自 D4 送审信
// 起严格执法，增量不回溯）
// 信体签名行「——线名 · YYYY-MM-DD」= 一轮追加的推进证据（D4 设计 f3 只扫签名行）。
const LEGACY_STAMP = new Set([
  'kfm-na-base-design-submission.md',
  'kfm-na-base-landing-report.md',
  'kfm-na-conn-provider-review-response.md',
  'kfm-na-input-ime-review-response.md',
  'kfm-na-term-emu-review-response.md',
  'kfmv4-9.0-broker-contract-review-response.md',
  'kfmv4-9.0-na-rust-synergy-review-response.md',
  'kfm-na-conn-provider-landing-report.md',
  'kfm-na-input-ime-landing-report.md',
  'kfm-na-term-emu-landing-report.md',
  'kfmv4-9.0-phase2-hourglass-submission.md',
  'kfmv4-9.0-progress-review-response.md',
  'kfmv4-9.0-r3-review-response.md',
  'kfmv4-9.0-review-response.md',
]);
const SIGN_RE = /^——[^\n]*?\d{4}-\d{2}-\d{2}/gm;
const SIGN_DATE_RE = /(\d{4}-\d{2}-\d{2})/;
const STAMP_RE = /（(\d{4}-\d{2}-\d{2})\s+(\S+)/; // 全角（ 后接日期 + 更新者 token
const lastTouch = new Map(); // f/e 共用：戳日期，无戳 = 发信日与签名日期的较大者
for (const [f, h] of headers) {
  if (!h || !h.状态) continue;
  const bare = h.状态.replace(/^[^\p{Script=Han}A-Za-z]+/u, '');
  const wait = bare.startsWith('待');
  const notice = (h.收敛判据 || '').startsWith('无需回信');
  const sigs = [...readFileSync(join(INBOX, f), 'utf-8').matchAll(SIGN_RE)]
    .map(m => SIGN_DATE_RE.exec(m[0])[1]).filter(d => !isNaN(Date.parse(d)));
  const sigMax = sigs.length ? Math.max(...sigs.map(d => Date.parse(d))) : NaN;
  let stampMs = NaN;
  if (!wait && !notice) {
    const sm = STAMP_RE.exec(h.状态);
    if (LEGACY_STAMP.has(f)) {
      if (!sm) { /* 豁免：无戳，f1/f2 免检 */ }
      else stampMs = Date.parse(sm[1]);
    } else {
      if (!sm) {
        error(`f1. 状态戳缺失/格式非法：${f} 「${h.状态.slice(0, 26)}…」非豁免状态须带全角括号注（YYYY-MM-DD 更新者）（⛳ MECH-FLOW-17）`);
      } else {
        stampMs = Date.parse(sm[1]);
        if (isNaN(stampMs)) {
          error(`f1. 状态戳日期非法：${f} 「${sm[1]}」（⛳ MECH-FLOW-17）`);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(h.日期 || '') && stampMs < Date.parse(h.日期)) {
          error(`f2. 戳单调：${f} 戳 ${sm[1]} 早于发信日 ${h.日期}（⛳ MECH-FLOW-17）`);
        }
      }
    }
    if (!isNaN(sigMax)) {
      const msg = `f3. 头体咬合：${f} 信体签名行最晚 ${new Date(sigMax).toISOString().slice(0, 10)} 晚于状态戳${isNaN(stampMs) ? '（无戳）' : ' ' + new Date(stampMs).toISOString().slice(0, 10)}——翻转忘更头或旧头覆盖新态（⛳ MECH-FLOW-17）`;
      if (isNaN(stampMs) || sigMax > stampMs) {
        if (LEGACY_STAMP.has(f)) warn(msg + '（LEGACY 豁免软告警）');
        else error(msg);
      }
    }
  } else if (wait) {
    // 待* 未翻转：last-touch 从签名行推进证据取，无则发信日
    if (!isNaN(sigMax)) stampMs = sigMax;
  }
  if (isNaN(stampMs) && /^\d{4}-\d{2}-\d{2}$/.test(h.日期 || '')) stampMs = Date.parse(h.日期);
  lastTouch.set(f, stampMs);
}

// ---------- e. 停滞检测（2026-08-18 立，README 活性条款机械化；同日 D4 换 last-touch 时钟） ----------
// 「待*」状态 + 最后推进超阈值 = 停滞报红——活性条款从「用户抽查」升级为巡逻发现。
// 阈值 7 天 = 送审问题 2 草案值；契约 3「不定死天数」指不在契约文本定死，
// 机检阈值是执行层参数（调整走本文件，不走契约修订）。
// 时钟 v2 = last-touch（代际戳；待* 无戳时 = 签名行推进日期，无则发信日）。
const STALE_DAYS = 7;
const now = Date.now();
for (const [f, h] of headers) {
  if (!h || !h.状态 || !/^\d{4}-\d{2}-\d{2}$/.test(h.日期 || '')) continue;
  const bare = h.状态.replace(/^[^\p{Script=Han}A-Za-z]+/u, '');
  if (!bare.startsWith('待')) continue;
  const lt = lastTouch.get(f);
  if (typeof lt !== 'number' || isNaN(lt)) continue;
  const ageDays = (now - lt) / 86400000;
  if (ageDays > STALE_DAYS) {
    error(`e. 停滞：${f} 「${bare.slice(0, 16)}…」最后推进 ${Math.floor(ageDays)} 天前（阈值 ${STALE_DAYS}）——归属线 ${h.致} 应按阅信纪律处理或说明（⛳ MECH-FLOW-16）`);
  }
}

// ---------- b. 命名规范 ----------
// LEGACY 祖父豁免：2026-08-18 审计遗留 7 封命名违规（信件只追加不删改，不更名）；
// 豁免仅限这 7 个文件名本体，新违规照红。
const LEGACY_NAMING = new Set([
  'kfm-na-cordis-rs-stage1-landing.md',   // 类型词 landing（同类均 -landing-report）
  'kfmv4-9.0-cordis-adoption-verdict.md', // 类型词 verdict
  'kfmv4-9.0-na-rust-synergy.md',         // 无类型词
  'kfmv4-9.0-version-plan-v2-notice.md',  // 类型词 notice
  'kfmv4-9.0-review-response-moli.md',    // 类型词后人名后缀 -moli
  'kfmv4-inbox-response-moli.md',         // 同上
  'kfmv4-9.0-step0-progress.md',          // 类型词 progress
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

// ---------- d. 决策索引覆盖（信号源 = 信件机读头「状态」字段） ----------
const DECISION_INDEX = join(NINE_ZERO, 'nine-zero-decision-index.md');
if (existsSync(DECISION_INDEX)) {
  const decisionIndex = readFileSync(DECISION_INDEX, 'utf-8');
  const DECIDED_RE = /已裁决|终审|已落地|已验证/;
  for (const f of letters) {
    const h = headers.get(f);
    if (!h || !h.状态) continue;
    if (DECIDED_RE.test(h.状态) && !decisionIndex.includes(f)) {
      error(`d. 索引漏登：${f} 状态「${h.状态.slice(0, 18)}…」已落定，但 nine-zero-decision-index.md 未提及（⛳ MECH-FLOW-14：新决策落定时加一行）`);
    }
  }
}

// ---------- 收口 ----------
if (errors > 0) {
  console.error(`\n[check-agent-inbox] 信箱一致性检查失败（${errors} 处红），构建中断。`);
  process.exit(1);
}
console.log(`[check-agent-inbox] OK — ${letters.length} 封信机读头 schema 合规 / 命名合规（LEGACY 豁免 ${LEGACY_NAMING.size}）/ 计数咬合 / 决策索引覆盖 / 停滞检测（待* 最后推进超 ${STALE_DAYS} 天报红）/ 代际戳 f 查（戳格式/单调/头体咬合，LEGACY ${LEGACY_STAMP.size} 封软告警）（台账双向对应由 gen-agent-inbox --check-only 保证）`);
