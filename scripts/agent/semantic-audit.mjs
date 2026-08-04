/**
 * semantic-audit.mjs — 语义审计探针集群编排器（腿一，agent-runner 二号负载）
 *
 * 定位：概率区对账器（双区管线），**非阻断**——不进 check 链，产出是 SEM 清单草案，
 * 裁决与修复留给会话内 agent（自动化边界 = 检测）。
 *
 * 架构（STACK #3 腿一，2026-07-30 用户拍板）：
 * - 任务清单 semantic-audit.tasks.mjs：一个探针只问一个问题（组内 17 + 组间 6）
 * - 并发 3 洁净室并行：任务间零共享上下文，失败只重问单任务
 * - 增量对账：任务输入（定义 + 文档内容）哈希没变 → 跳过（make 式；--full 强制全量）；
 *   哈希含 AUDIT_VERSION 版本盐——脚本/prompt/复核规则变更时 +1 令旧哈希全失效
 * - 拜占庭对策代码化：LLM 报的发现必须过机械复核（claim/against 的 file:line 真实存在），
 *   幻觉死在复核环节，计入 dropped
 * - 登记豁免：prompt 内置已登记病灶清单（semantic-provenance + bugs + 各域 code-map
 *   **漂移清单节**解析——只扫该节，全文件扫会把普通编号行当豁免、过度抑制真发现），
 *   重复发现不报（试点数据：加规则后重复立案归零）
 * - per-任务记账：reported/kept/dropped/provider/attempts 全量记 state，精确率迭代的数据源
 *
 * 用法：
 *   node scripts/agent/semantic-audit.mjs [--full] [--dry-run] [--task=<id>]
 * exit 0 = 流程跑完（发现是产出不是失败）；exit 2 = 全部任务失败或环境缺 provider
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { runAgent, runAgentTooled, extractJson } from './agent-runner.mjs';
import { TASKS } from './semantic-audit.tasks.mjs';
// SEMANTIC_AUDIT_ROOT：变异基准卷专用——指向 semantic-mutate.mjs 物化的沙盒副本，
// 审计逻辑不变、读的全是副本；活树/账本/check 链无感。生产跑不设此变量。
const ROOT = process.env.SEMANTIC_AUDIT_ROOT
  ? resolve(process.env.SEMANTIC_AUDIT_ROOT)
  : resolve(fileURLToPath(new URL('../../', import.meta.url)));
const STATE_PATH = join(ROOT, 'docs/ledger/semantic-audit-state.json');

// ========== 豁免登记表（EX-xx，新鲜度机制 2026-08-02） ==========
// 结构：docs/ledger/semantic-exemptions.md 表格。探针按「目标（文档:行）」前缀跳过
// keptFindings；chain 负责哈希失效与 review-by 到期提醒。
const EXEMPTIONS_PATH = join(ROOT, 'docs/ledger/semantic-exemptions.md');
let _exemptions = null; // [{id, target, type, reviewBy}]
function loadExemptions() {
  if (_exemptions) return _exemptions;
  _exemptions = [];
  try {
    const raw = readFileSync(EXEMPTIONS_PATH, 'utf-8');
    for (const line of raw.split('\n')) {
      // 列序：id | 核心码 | 目标 | 关键词 | 类型 | review-by
      const m = /^\|\s*(EX-\d+)\s*\|\s*(SEM\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*(\S+?)\s*\|\s*([^|]*?)\s*\|/.exec(line);
      if (!m) continue;
      _exemptions.push({ id: m[1], sem: m[2], target: m[3].trim(), keyword: m[4].trim(), type: m[5], reviewBy: m[6].trim() });
    }
  } catch { /* 表不存在 = 无豁免 */ }
  return _exemptions;
}
let _exemptIdMap = null;
function exemptIdFor(claim) {
  if (!_exemptIdMap) {
    // 匹配：目标文件前缀 + 关键词（探针 claim 是描述式如「cross-domain.md:anim风险列」；
    // 2026-08-02 教训：纯 :行号 前缀匹配会漏，文件+关键词双条件）
    _exemptIdMap = [];
    for (const e of loadExemptions()) {
      const file = e.target.split('（')[0].trim().split(':')[0];
      _exemptIdMap.push({ id: e.id, file, keyword: e.keyword });
    }
  }
  for (const { id, file, keyword } of _exemptIdMap) {
    if (claim.startsWith(file) && (!keyword || claim.includes(keyword))) return id;
  }
  return null;
}
function isExempted(claim) { return exemptIdFor(claim) !== null; }
// 并发：压测定档 10（2026-07-30 变异基准三曲线——conc20 全 Google 22/22 绿、
// 成绩噪声带内不动；conc10 留一倍余量，墙钟收益主要给 23 探针的多波次场景）
const CONCURRENCY = 10;
const SEM_TYPES = ['SEM001', 'SEM002', 'SEM003', 'SEM004', 'SEM005'];

const args = process.argv.slice(2);
const FULL = args.includes('--full');
const DRY_RUN = args.includes('--dry-run');
const ONLY = (args.find(a => a.startsWith('--task=')) || '').slice(7) || null;

// ========== 文档装载（目录展开为文件） ==========

function expandPaths(paths) {
  const out = [];
  for (const p of paths) {
    const abs = join(ROOT, p);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isDirectory()) {
      for (const e of readdirSync(abs).sort()) {
        // _ 前缀不排除：_template.yaml 这类下划线文件也是审计对象（二轮教训：漏喂 → 假发现）
        if (/\.(md|yaml)$/.test(e)) out.push(`${p.replace(/\/$/, '')}/${e}`);
      }
    } else out.push(p);
  }
  return out;
}

export function taskFiles(task) {
  return [...new Set([...expandPaths(task.feeds), ...expandPaths(task.baseline)])];
}

function inlineDocs(files) {
  return files.map(f => {
    const content = readFileSync(join(ROOT, f), 'utf-8');
    return `\n===== ${f} =====\n${content}`;
  }).join('\n');
}

// ========== 增量哈希 ==========

// 审计逻辑版本：脚本/prompt/复核规则变更时 +1——任务哈希不含 prompt 内容，
// 不加版本盐，修完脚本旧哈希会跳过复跑（四轮教训：误触发跑出的污染结果被哈希跳过）
// v6（2026-07-30）：输出契约加 quote 引文字段 + recheckQuote 验原文——
// 四臂实验发现「语义侦测对但锚点靠编」（M14 半逮/A 臂假命中），复核升级到内容级
const AUDIT_VERSION = 6;

function taskHash(task, files) {
  const h = createHash('sha1');
  // tools 并入哈希：任务从纯文本改为工具流（或反之）定义变化 → 触发重跑
  h.update(JSON.stringify({ v: AUDIT_VERSION, q: task.question, sem: task.sem, kind: task.kind, tools: task.tools || [] }));
  for (const f of files) h.update(f + '\0' + readFileSync(join(ROOT, f), 'utf-8'));
  return h.digest('hex');
}

function loadState() {
  if (!existsSync(STATE_PATH)) return { tasks: {}, runs: [] };
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf-8')); }
  catch { return { tasks: {}, runs: [] }; }
}

// ========== 登记豁免清单（已登记病灶不算新发现） ==========

function registeredFindings(domainFilter = null) {
  const out = [];
  const prov = join(ROOT, 'docs/ledger/semantic-provenance.md');
  if (existsSync(prov)) {
    for (const line of readFileSync(prov, 'utf-8').split('\n')) {
      const m = line.match(/^\| \d+ \| ([^|]+) \|/);
      if (m) out.push('- ' + m[1].trim().slice(0, 60));
    }
  }
  const bugs = join(ROOT, 'docs/ledger/bugs.md');
  if (existsSync(bugs)) {
    for (const line of readFileSync(bugs, 'utf-8').split('\n')) {
      const m = line.match(/^\| (BAR-[\w-]+) \|/);
      if (m) out.push('- ' + m[1]);
    }
  }
  // 各域 code-map 漂移清单条目（已立案的实然≠应然，不算新发现——二轮教训：
  // 豁免只喂两份账本，已登记漂移被重复报告）
  const domainsDir = join(ROOT, 'docs/domains');
  if (existsSync(domainsDir)) {
    for (const d of readdirSync(domainsDir)) {
      // 四轮教训 b：漂移豁免按任务上下文域过滤——全量 218 行喂每个 prompt 太重，
      // 且重复立案只可能发生在 prompt 里能读到的 code-map（其域必在 files 里）
      if (domainFilter && !domainFilter.has(d)) continue;
      const cm = join(domainsDir, d, 'code-map.md');
      if (!existsSync(cm)) continue;
      // 只扫「## 漂移清单」节——四轮教训：放宽正则后若全文件扫，普通编号行
      // 全被当豁免（92 条），会过度抑制真发现
      let inDrift = false;
      for (const line of readFileSync(cm, 'utf-8').split('\n')) {
        if (/^##\s/.test(line)) { inDrift = /^##\s*漂移清单/.test(line); continue; }
        if (!inDrift) continue;
        const t = line.trim();
        if (!t) continue;
        // 四轮教训 a：多主题条目的细节藏在冒号后/缩进续行（canvas-tree 漂移 14
        // 的 rAF 细节在续行），「抓标题到冒号」漏抓 → 重复立案。编号行 + 续行整行喂。
        if (/^\d+\.\s+/.test(t) || /^\s/.test(line)) {
          out.push(`- [${d}漂移] ` + t.replace(/^\d+\.\s+/, '').slice(0, 120));
        }
      }
    }
  }
  return out.join('\n');
}

// ========== prompt 组装 ==========

export function buildPrompt(task, files) {
  const feedSet = new Set(expandPaths(task.feeds));
  const feeds = files.filter(f => feedSet.has(f));
  const baseline = files.filter(f => !feedSet.has(f));
  // 漂移豁免按上下文域过滤（prompt 里读得到的 code-map 才可能被重复报告）
  const domains = new Set(files.map(f => (f.match(/^docs\/domains\/([^/]+)\//) || [])[1]).filter(Boolean));
  return `你是文档语义审计探针，只回答一个问题的发现，不做额外评论。

【审计问题】${task.question}

【病灶类型】只报这几类（其他不报）：
${task.sem.map(s => `- ${s}`).join('\n')}
- SEM900（未分类）：你确认它是真冲突/真漂移，但归不进上述任何已知码的新形态——报 SEM900，
  不要硬塞进最近的码（两层码表定稿 2026-08-02：核心码固定、变体判例法累积，SEM900 是急诊室）

【输出契约】只输出 JSON，不要任何多余文字：
{"findings":[{"type":"SEM001","claim":"出错文档路径:行号","against":"基准出处路径:行号 或 null","quote":"claim 处原文片段（≤15字）","note":"50字内冲突说明"}]}
无发现输出 {"findings":[]}。上限 10 条，拿不准的不报（宁缺勿滥——幻觉发现会死在机械复核环节）。
quote 必须是 claim 行附近的真实原文片段（≤15字）——机械复核会验引文确实存在于
该处；编 quote 与编行号同罪（六轮教训：语义侦测对但锚点是编的，复核只查行界查不出）。
特别注意：承重入口表不枚举全部 30 个 check——「code-map 未提及某 check」不构成
其不存在的证据，「声称 check 存在但实际不存在」类发现**一律不报**（四轮+变异基准
同族假发现复发 6 次教训：check-docs/check-active-stack/check-doc-symbols 等均真实存在）。
扫描范围含**被审文档内部自相矛盾**：同文件两处断言直接打架、状态词与详情语气互搏——
against 填同文件另一处的 路径:行号（变异基准 MID-3/4 双漏教训，v5 硬化）。
精确率条款：事实与基准一致、仅措辞/量词/表述格式不同的变体**一律不报**
（如「440 个测试」与「440 项回归测试」是同实异表——变异基准 M15 误报教训，v5 硬化）。

【登记豁免】以下病灶已在账本登记，**不算新发现，一律跳过**：
${registeredFindings(domains) || '（无）'}

【被审文档】
${inlineDocs(feeds)}

【基准层（对账参照）】
${baseline.length ? inlineDocs(baseline) : '（无）'}`;
}

// ========== 输出校验（validate → data | null） ==========

export function makeValidate() {
  return text => {
    const j = extractJson(text);
    if (!j || !Array.isArray(j.findings)) return null;
    const clean = [];
    for (const f of j.findings.slice(0, 10)) {
      if (!f || !SEM_TYPES.includes(f.type)) continue;
      if (typeof f.claim !== 'string' || !f.claim.includes(':')) continue;
      clean.push({
        type: f.type,
        claim: f.claim.trim(),
        against: typeof f.against === 'string' ? f.against.trim() : null,
        quote: typeof f.quote === 'string' ? f.quote.trim().slice(0, 30) : '',
        note: String(f.note || '').slice(0, 80),
      });
    }
    return { findings: clean };
  };
}

// ========== 机械复核（拜占庭对策：证据必须落在真实文件上） ==========
// 二轮教训：LLM 的引用格式五花八门——范围行 33-34、裸文件名 code-map.md、
// 节锚 ## 标题、「末行」、文件:节名。复核的目标是杀「文件不存在的幻觉」，
// 不是考较格式——全部归一化后再核对；行号只查越界，节锚放宽到文件级。
// 裁决权仍在会话内 agent（复核是筛子不是法官）。

export function recheckRef(ref, ctxFiles = []) {
  if (!ref) return true; // against 可为 null
  // 三轮教训：LLM 把 JSON null 序列化成字符串 'null'/'null:…'——归一为 null，否则误杀
  if (String(ref).trim().toLowerCase() === 'null') return true;
  const s = String(ref).replace(/[`*\s]/g, ' ').trim();
  // 提取文件部分与行号部分：path:123 / path:33-34 / path:末行 / path:## 节 / path
  let pathPart = s, linePart = null;
  const mLine = s.match(/^(.+?):(\d+)(?:\s*[-–~]\s*\d+)?$/);
  const mLast = s.match(/^(.+?):末行$/);
  if (mLine) { pathPart = mLine[1]; linePart = parseInt(mLine[2], 10); }
  else if (mLast) { pathPart = mLast[1]; }
  else if (s.includes(':')) { pathPart = s.slice(0, s.indexOf(':')); } // 节锚等，放宽到文件级

  const candidates = [join(ROOT, pathPart), join(ROOT, 'docs', pathPart)];
  if (!pathPart.includes('/')) {
    // 裸文件名 → 任务上下文文件集解析
    for (const f of ctxFiles) {
      if (f === pathPart || f.endsWith('/' + pathPart)) candidates.push(join(ROOT, f));
    }
  }
  const abs = candidates.find(c => existsSync(c) && statSync(c).isFile());
  if (!abs) return false;
  if (linePart === null) return true; // 文件级证据：文件存在即过
  const lines = readFileSync(abs, 'utf-8').split('\n').length;
  return linePart <= lines;
}

// 引文复核（v6）：quote 必须真实存在于 claim 文件内——锚点不可靠的治本。
// 行号可解析时收窄到 ±10 行窗口（防「引文是真的但不在声称的位置」）。
// 无 quote / 太短（<4 字无鉴别力）/ 文件找不到 → fail-closed 一律杀。
export function recheckQuote(f, ctxFiles = []) {
  const q = String(f.quote || '').trim();
  if (q.length < 4) return false;
  const s = String(f.claim).replace(/[`*\s]/g, ' ').trim();
  let pathPart = s, linePart = null;
  const mLine = s.match(/^(.+?):(\d+)(?:\s*[-–~]\s*\d+)?$/);
  if (mLine) { pathPart = mLine[1]; linePart = parseInt(mLine[2], 10); }
  else if (s.includes(':')) pathPart = s.slice(0, s.indexOf(':'));
  const candidates = [join(ROOT, pathPart), join(ROOT, 'docs', pathPart)];
  if (!pathPart.includes('/')) {
    for (const cf of ctxFiles) {
      if (cf === pathPart || cf.endsWith('/' + pathPart)) candidates.push(join(ROOT, cf));
    }
  }
  const abs = candidates.find(c => existsSync(c) && statSync(c).isFile());
  if (!abs) return false;
  const content = readFileSync(abs, 'utf-8');
  if (linePart === null) return content.includes(q);
  const lines = content.split('\n');
  return lines.slice(Math.max(0, linePart - 11), linePart + 10).join('\n').includes(q);
}

// ========== 并发池 ==========

async function pool(items, n, worker) {
  const results = [];
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  return results;
}

// ========== 主流程（仅直接执行时跑；被 import 只暴露纯函数——
// 四轮教训：实验脚本 import 探测误触发了一次并发全量审计） ==========

const IS_MAIN = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_MAIN) {
const state = loadState();
let selected = TASKS.filter(t => !ONLY || t.id === ONLY);
if (ONLY && selected.length === 0) {
  console.error(`[semantic-audit] 无任务 id=${ONLY}（可选：${TASKS.map(t => t.id).join(', ')}）`);
  process.exit(2);
}

const plan = selected.map(task => {
  const files = taskFiles(task);
  const hash = taskHash(task, files);
  const prev = state.tasks[task.id];
  const skip = !FULL && !ONLY && prev && prev.hash === hash; // 点名任务=必然想跑（豁免登记后单刷 keptFindings 用），增量跳过只对例行巡逻生效
  return { task, files, hash, skip };
});

const willRun = plan.filter(p => !p.skip);
console.log(`[semantic-audit] 任务 ${plan.length} 个：跳过 ${plan.length - willRun.length}（输入未变）· 待跑 ${willRun.length}${DRY_RUN ? '（dry-run）' : ''}`);
if (DRY_RUN) {
  for (const p of plan) console.log(`  ${p.skip ? 'SKIP' : 'RUN '} ${p.task.id}（${p.files.length} 文件）`);
  process.exit(0);
}

let anyOk = false;
const runReport = { date: new Date().toISOString().slice(0, 10), tasks: {}, findingsKept: 0, findingsDropped: 0 };

const results = await pool(willRun, CONCURRENCY, async ({ task, files, hash }) => {
  const tooled = Array.isArray(task.tools) && task.tools.length > 0;
  const baseAgent = {
    system: '你是文档语义审计探针。只输出要求的 JSON，不要任何多余文字。',
    prompt: buildPrompt(task, files),
    validate: makeValidate(),
  };
  const result = tooled
    ? await runAgentTooled({
        ...baseAgent,
        tools: task.tools,
        sessionId: `patrol-${task.id}`,
        // 工具流多轮（读文件→验证→报）比单轮慢，超时给足
        timeoutMs: 600_000,
      })
    : await runAgent({
        ...baseAgent,
        // 首轮教训（2026-07-30）：2000 被推理模型的思考链吃光，三棒全空响应；
        // 审计 prompt 大 → 思考长 → 上限必须给足
        maxTokens: 16000,
        // 2026-08-02 超时根因修复：providers.config.json 全局带 response_format=json_object，
        // 大 prompt+长思考链下 ds-flash 内容空 → 校验重问 → 落链 → 单任务 15-25 分钟。
        // 剥离（extractJson 容错围栏）+ 大 prompt 超时给足——judge-batch 同款药方。
        params: { response_format: undefined },
        timeoutMs: 300_000,
      });
  if (!result.ok) {
    console.error(`[semantic-audit] ${task.id}: agent 失败——${result.errors.join('；')}`);
    runReport.tasks[task.id] = { status: 'failed', tooled, errors: result.errors };
    return { task, hash, ok: false };
  }
  anyOk = true;
  // 工具流降级纯文本（服务端不可达）——巡逻不空窗，但记 fallback 供长跑观测服务端可用性
  if (result.fallback) {
    console.warn(`[semantic-audit] ${task.id}: 服务端不可达 → 已降级纯文本探针（${result.errors.slice(-1)[0] || 'fallback'}）`);
  }
  // 机械复核 + 去重 + 豁免跳过（EX-xx 登记表：已裁决确认的发现不重复上报）
  const kept = [];
  const droppedList = [];
  for (const f of result.data.findings) {
    if (!recheckRef(f.claim, files) || !recheckRef(f.against, files) || !recheckQuote(f, files)) { droppedList.push(f); continue; }
    if (isExempted(f.claim)) { droppedList.push({ ...f, note: `豁免跳过 EX-${exemptIdFor(f.claim)}（${f.note || ''}` }); continue; }
    kept.push(f);
  }
  const dropped = droppedList.length;
  if (dropped) {
    for (const f of droppedList) console.log(`  ✂ 幻觉拦截: [${f.type}] ${f.claim}${f.against ? ` ↔ ${f.against}` : ''} — ${f.note.slice(0, 50)}`);
  }
  runReport.tasks[task.id] = {
    status: result.fallback ? 'ok-fallback' : 'ok',
    tooled, fallback: result.fallback || false,
    reported: result.data.findings.length, kept: kept.length, dropped,
    keptFindings: kept, // 落盘明细——cron 无人值守时裁决轮的唯一入口（首跑教训：只打印 stdout = 发现蒸发）
    droppedFindings: droppedList,
    provider: result.provider, attempts: result.attempts,
  };
  runReport.findingsKept += kept.length;
  runReport.findingsDropped += dropped;
  console.log(`[semantic-audit] ${task.id}: ${tooled ? '工具流' : '纯文本'} 报 ${result.data.findings.length} · 复核保留 ${kept.length} · 幻觉拦截 ${dropped}（${result.provider}，${result.attempts} 次尝试${result.fallback ? '，⚠ 降级纯文本' : ''}）`);
  return { task, hash, ok: true, kept };
});

// 跨任务去重（claim+against+type）
const seen = new Set();
const allFindings = [];
for (const r of results) {
  if (!r || !r.ok) continue;
  for (const f of r.kept) {
    const key = `${f.type}|${f.claim}|${f.against}`;
    if (seen.has(key)) continue;
    seen.add(key);
    allFindings.push({ task: r.task.id, ...f });
  }
}

// state 回写（成功任务才更新哈希——失败任务下轮重跑）
for (const r of results) {
  if (!r || !r.ok) continue;
  state.tasks[r.task.id] = { hash: r.hash, lastRun: runReport.date, ...runReport.tasks[r.task.id] };
}
for (const p of plan.filter(p => p.skip)) {
  // 跳过任务保留旧记账
}
state.runs.push({ date: runReport.date, ran: willRun.length, skipped: plan.length - willRun.length, kept: runReport.findingsKept, dropped: runReport.findingsDropped });
writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');

// ========== 产出：SEM 清单草案 ==========

console.log('\n========== SEM 清单草案 ==========');
if (allFindings.length === 0) {
  console.log('（本轮无新发现）');
} else {
  for (const f of allFindings) {
    console.log(`[${f.type}] ${f.claim}${f.against ? ` ↔ ${f.against}` : ''}（探针 ${f.task}）\n  ${f.note}`);
  }
}
console.log(`\n[semantic-audit] 合计：保留 ${allFindings.length} 条（去重后）· 幻觉拦截 ${runReport.findingsDropped} · state → docs/ledger/semantic-audit-state.json`);

if (!anyOk && willRun.length > 0) {
  console.error('[semantic-audit] 全部任务失败');
  process.exit(2);
}
process.exit(0);
} // IS_MAIN
