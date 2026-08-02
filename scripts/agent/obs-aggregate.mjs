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
import { readFileSync, existsSync, appendFileSync } from 'fs';
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

const report = out.join('\n');
console.log(report);
if (toMailbox) {
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    const firstLine = out[1] || '- 观测周报（空）';
    appendFileSync(inbox, `- ${stamp} 📊 ${firstLine.replace(/^## /, '').slice(0, 120)}\n`);
  } catch { /* 信箱不可写不阻断 */ }
}
