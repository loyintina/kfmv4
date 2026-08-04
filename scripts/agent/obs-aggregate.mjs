#!/usr/bin/env node
/**
 * obs-aggregate.mjs — 观测台聚合器（史官制度 8.5）：周报生成
 *
 * 数据流（append-only）：
 *   ~/.kfmv4/agent-calls.jsonl        LLM 调用账本（provider/耗时/成败）
 *   ~/.kfmv4/permission-audit.jsonl   工具调用审计（RiskClass/判定）
 *   docs/ledger/semantic-chain-inbox.md 语义巡逻信箱（文档健康趋势）
 * 产出：周报文本（stdout + 可投信箱），供 cron 每周聚合。
 *
 * 用法：node scripts/agent/obs-aggregate.mjs [--days=7] [--mailbox]
 */
import { readFileSync, existsSync, appendFileSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const REPO = join(fileURLToPath(new URL('../../', import.meta.url)));
const days = parseInt((process.argv.find(a => a.startsWith('--days=')) || '--days=7').slice(7), 10);
const toMailbox = process.argv.includes('--mailbox');
const since = Date.now() - days * 86400_000;

function readLines(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf-8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

const out = [];
const add = s => out.push(s);

// ---- 1. LLM 调用账本 ----
const calls = readLines(join(homedir(), '.kfmv4', 'agent-calls.jsonl')).filter(c => new Date(c.ts).getTime() >= since);
const byProv = {};
for (const c of calls) {
  const p = c.provider.split('/')[0];
  byProv[p] = byProv[p] || { n: 0, ok: 0, ms: 0, errs: {} };
  byProv[p].n++; if (c.ok) byProv[p].ok++; byProv[p].ms += c.ms;
  if (!c.ok) { const k = (c.error || '未知').slice(0, 40); byProv[p].errs[k] = (byProv[p].errs[k] || 0) + 1; }
}
add(`## 观测周报（${days} 天，${new Date().toISOString().slice(0, 10)}）`);
if (calls.length === 0) {
  add('- LLM 调用：0 条（账本为空——agent-runner 是否在跑？）');
} else {
  add(`- LLM 调用：${calls.length} 次 · 成功 ${calls.filter(c => c.ok).length} · 失败 ${calls.filter(c => !c.ok).length} · 平均 ${Math.round(calls.reduce((s, c) => s + c.ms, 0) / calls.length / 1000)}s/次`);
  for (const [p, s] of Object.entries(byProv)) {
    const rate = s.ok / s.n;
    add(`  - ${p}: ${s.n} 次 · 成功率 ${(rate * 100).toFixed(0)}% · 均 ${Math.round(s.ms / s.n / 1000)}s` + (Object.keys(s.errs).length ? ` · 错误: ${Object.entries(s.errs).map(([k, v]) => `${k}×${v}`).join('、')}` : ''));
  }
}

// ---- 2. 工具调用审计（权限影子模式） ----
const audits = readLines(join(homedir(), '.kfmv4', 'permission-audit.jsonl')).filter(a => new Date(a.ts).getTime() >= since);
if (audits.length) {
  const byRisk = {}, byTool = {}, nonAllow = [];
  for (const a of audits) {
    byRisk[a.riskClass] = (byRisk[a.riskClass] || 0) + 1;
    byTool[a.tool] = (byTool[a.tool] || 0) + 1;
    if (a.decision !== 'allow') nonAllow.push(a);
  }
  add(`- 工具调用审计：${audits.length} 次 · 风险分布 ${Object.entries(byRisk).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  add(`  - 高频工具: ${Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  add(`  - ⚠️ 非放行判定 ${nonAllow.length} 次（危险操作候选——影子模式未拦截，8.5.1 参考）`);
  const byRule = {};
  for (const a of nonAllow) byRule[a.rule] = (byRule[a.rule] || 0) + 1;
  for (const [r, v] of Object.entries(byRule)) add(`    - ${r}: ${v} 次`);
} else {
  add('- 工具调用审计：0 条（面板暂无使用）');
}

// ---- 3. 文档健康（信箱趋势） ----
const inbox = join(REPO, 'docs/ledger/semantic-chain-inbox.md');
if (existsSync(inbox)) {
  const lines = readFileSync(inbox, 'utf-8').split('\n').filter(l => l.startsWith('- 2026-'));
  const recent = lines.filter(l => new Date(l.slice(2, 12)).getTime() >= since - 86400_000);
  const warn = recent.filter(l => l.includes('⚠️') && l.includes('待裁决') || l.includes('体检 FAIL'));
  add(`- 文档健康：信箱 ${recent.length} 条巡逻记录，其中 ⚠️/FAIL ${warn.length} 条`);
  if (warn.length) for (const w of warn.slice(0, 5)) add(`    ${w.slice(0, 100)}`);
}

// ---- 4. 文档读取痕迹（价值观测累积日志） ----
// 从面板会话 tool 块挖 read/grep 的 docs/ 路径 → agent 真实读取痕迹。
// 目的：累积「文档被读」数据，对照读/存分类——读类没人读 = 该查；
// 存类被读 = 该考虑升读类；幽灵路径 = 文档已删但旧引用还在。
// ⚠️ 统计口径（2026-08-03 修正）：纯次数有**年龄偏倚**——新文档存在时间短、
// 读取天然少，旧文档存在久、读取多。输出按「文档存在天数」归一为日均读取率
// （git 首次提交时间算年龄）；面板会话过少时标注「积累期」，数据不具代表性。
const SESSIONS_DIR = join(homedir(), '.kfmv4', 'sessions');
const DOC_READ = new Map();   // 相对路径 → 次数
const GHOST = new Map();      // 幽灵路径（当前不存在）→ 次数
let sessionsScanned = 0, toolScanned = 0, sessTimes = [];
const STORE_PREFIXES = ['docs/decisions/', 'docs/ledger/'];

/** 文档存在天数（git 首次提交日期起）；查不到返回 null（不归一） */
function docAgeDays(rel) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--format=%ai', '--', rel], {
      cwd: REPO, encoding: 'utf-8', timeout: 10_000,
    });
    const line = out.split('\n').find(Boolean);
    if (!line) return null;
    return Math.max(1, (Date.now() - new Date(line).getTime()) / 86400_000);
  } catch { return null; }
}
if (existsSync(SESSIONS_DIR)) {
  for (const f of readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'))) {
    let s;
    try { s = JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf-8')); } catch { continue; }
    if (!s || !s.updatedAt || new Date(s.updatedAt).getTime() < since) continue;
    sessionsScanned++;
    sessTimes.push(new Date(s.updatedAt).getTime());    for (const m of (s.messages || [])) {
      if (!Array.isArray(m.content)) continue;
      for (const c of m.content) {
        if (!c || c.type !== 'tool') continue;
        toolScanned++;
        const name = c.name || '';
        const input = c.input || {};
        const paths = [];
        if (name === 'read' && typeof input.path === 'string') paths.push(input.path);
        else if (name === 'grep' && typeof input.path === 'string') paths.push(input.path);
        else if (name === 'bash' && typeof input.command === 'string') {
          for (const m2 of input.command.matchAll(/[\w./-]*docs\/[\w./-]+\.md/g)) paths.push(m2[0]);
        }
        for (let p of paths) {
          p = p.replace(/:\d+.*$/, '').replace(/^\/root\/kfmv4\//, '');
          if (!p.startsWith('docs/')) continue;
          const exists = existsSync(join(REPO, p));
          (exists ? DOC_READ : GHOST).set(p, ((exists ? DOC_READ : GHOST).get(p) || 0) + 1);
        }
      }
    }
  }
}
add(`- 文档读取痕迹：${sessionsScanned} 个周期内会话 · ${toolScanned} 次工具调用` + (sessionsScanned < 3 ? '（⚠️ 积累期：会话过少，数据不具代表性，仅作基线起点）' : ''));
if (sessionsScanned > 0) {
  add(`  - 会话时间范围：${sessTimes.length ? new Date(Math.min(...sessTimes)).toISOString().slice(0, 10) : '?'} ~ ${sessTimes.length ? new Date(Math.max(...sessTimes)).toISOString().slice(0, 10) : '?'}（无近期会话 = 读取数据是旧痕迹，仅作历史参考）`);
}
if (DOC_READ.size === 0) {
  add('  - 无 docs/ 读取记录（会话为空或面板未使用）');
} else {
  // 按日均读取率（次数/年龄天）排序，消除新文档年龄偏倚
  const rated = [...DOC_READ.entries()].map(([p, n]) => {
    const age = docAgeDays(p);
    return { p, n, age, rate: age ? n / age : null };
  });
  const top = rated.slice().sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)).slice(0, 8);
  add(`  - 高频读取（日均率，新文档不吃亏）: ${top.map(({ p, n, rate }) => `${p} ${n}次${rate != null ? `/${rate.toFixed(2)}日` : ''}`).join(' ')}`);
  // 存类被读 = 该考虑升读类
  const storeRead = rated.filter(({ p }) => STORE_PREFIXES.some(pre => p.startsWith(pre)));
  if (storeRead.length) {
    add(`  - ⚠️ 存类被读 ${storeRead.length} 份（decisions/ledger——被频繁读说明该升读类）: ${storeRead.slice(0, 4).map(({ p, n }) => `${p}×${n}`).join(' ')}`);
  }
  // 幽灵路径 = 旧文档残留引用
  if (GHOST.size) {
    add(`  - 👻 幽灵路径 ${GHOST.size} 个（被读但当前不存在——旧文档/迁移残留）: ${[...GHOST.entries()].slice(0, 5).map(([p, n]) => `${p}×${n}`).join(' ')}`);
  }
}

// ---- 5. check 失败账本（错误码结晶数据源） ----
// chain.mjs 每次构建中断记一条（含 ⛳ 错误码）。周期内分布 = 流程摩擦面：
// 高频码 = 流程哪步最容易走错 → 结晶回路候选（阈值待数据积累后科学划定）。
const fails = readLines(join(homedir(), '.kfmv4', 'check-failures.jsonl')).filter(f => f.ts && new Date(f.ts).getTime() >= since);
add(`- check 失败账本：${fails.length} 次构建中断`);
if (fails.length) {
  const byCode = {};
  for (const f of fails) { const k = f.code || '（无码）'; byCode[k] = (byCode[k] || 0) + 1; }
  const top = Object.entries(byCode).sort((a, b) => b[1] - a[1]).slice(0, 6);
  add(`  - 错误码分布: ${top.map(([k, v]) => `${k}×${v}`).join(' ')}`);
  const byCheck = {};
  for (const f of fails) byCheck[f.check] = (byCheck[f.check] || 0) + 1;
  const topC = Object.entries(byCheck).sort((a, b) => b[1] - a[1]).slice(0, 4);
  add(`  - 高频失败 check: ${topC.map(([k, v]) => `${k}×${v}`).join(' ')}`);
}

// ---- 6. 工具执行（工具错误流） ----
const execs = readLines(join(homedir(), '.kfmv4', 'tool-exec.jsonl')).filter(e => e.ts && new Date(e.ts).getTime() >= since);
add(`- 工具执行：${execs.length} 次 · 失败 ${execs.filter(e => !e.ok).length} · 平均 ${execs.length ? Math.round(execs.reduce((s, e) => s + e.ms, 0) / execs.length) : 0}ms`);
if (execs.length) {
  const byTool = {};
  for (const e of execs) if (!e.ok) { byTool[e.tool] = (byTool[e.tool] || 0) + 1; }
  const topFail = Object.entries(byTool).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (topFail.length) add(`  - 高频失败工具: ${topFail.map(([k, v]) => `${k}×${v}`).join(' ')}`);
  // 错误类型 top（去工具名的常见错误后缀）
  const errTypes = {};
  for (const e of execs) if (!e.ok && e.error) {
    const k = e.error.replace(/^\[?\w+\]?\s*/, '').slice(0, 40);
    errTypes[k] = (errTypes[k] || 0) + 1;
  }
  const topErr = Object.entries(errTypes).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topErr.length) add(`  - 错误类型: ${topErr.map(([k, v]) => `${k}×${v}`).join(' ')}`);
}

// ---- 7. 构建/检查耗时 ----
const metrics = readLines(join(homedir(), '.kfmv4', 'build-metrics.jsonl')).filter(m => m.ts && new Date(m.ts).getTime() >= since);
if (metrics.length) {
  const byPhase = {};
  for (const m of metrics) (byPhase[m.phase] = byPhase[m.phase] || []).push(m);
  for (const [phase, arr] of Object.entries(byPhase)) {
    const ok = arr.filter(m => m.ok).length;
    const avg = Math.round(arr.reduce((s, m) => s + m.ms, 0) / arr.length / 1000);
    add(`- ${phase} 耗时：${arr.length} 次（成功 ${ok}）· 平均 ${avg}s/次`);
  }
}

// ---- 8. 巡逻 metric（F5 记录层：语义巡逻耗时/成败趋势，长期收集） ----
const patrol = readLines(join(homedir(), '.kfmv4', 'semantic-chain-metrics.jsonl')).filter(m => m.ts && new Date(m.ts).getTime() >= since);
if (patrol.length) {
  const ok = patrol.filter(m => m.ok).length;
  const avg = Math.round(patrol.reduce((s, m) => s + (m.ms || 0), 0) / patrol.length / 1000);
  add(`- 巡逻：${patrol.length} 次 · 成功 ${ok} · 平均 ${avg}s/次`);
  const fails = patrol.filter(m => !m.ok);
  if (fails.length) add(`  - ⚠️ 失败 ${fails.length} 次: ${fails.slice(0, 2).map(f => (f.fail || '').slice(0, 60)).join(' | ')}`);
}

const report = out.join('\n');
console.log(report);
if (toMailbox) {
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    const firstLine = out[1] || '- 观测周报（空）';
    appendFileSync(inbox, `- ${stamp} 📊 ${firstLine.replace(/^## /, '').slice(0, 120)}\n`);
  } catch { /* 信箱不可写不阻断 */ }
}
