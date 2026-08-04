#!/usr/bin/env node
/**
 * extract-convo.mjs — 从 kimi code wire.jsonl 提取对话流（范式包素材矿）
 *
 * 用途：范式包制作工艺第 1 步「定位」——把 wire 原始记录压成可读对话流，
 * 人工/探针据此切片高思维密度段落（spec-v1.md 四、制作工艺）。
 * 通用性：任何 kimi code 会话目录的 agents/main/wire.jsonl 都可用
 * （未来扫描 qoder/omp/opencode 会话时，各自格式需适配，本脚本是 kimi 格式）。
 *
 * 过滤：只留 user/assistant 文本；origin=injected（system-reminder）跳过；
 * 工具调用只留「→ 工具名」一行标记（内容不展开——S2 范式包要纯对话，
 * 工具执行细节是噪音，spec-v1 验收 5）。
 *
 * 用法：
 *   node experiments/paradigm/tools/extract-convo.mjs [--wire <路径>] [--out <路径>] [--min-len <字符>]
 *   默认 wire = 当前会话 agents/main/wire.jsonl（会话目录从环境/参数推）
 *   输出：对话流文本（[MM-DD HH:MM] role + 文本）
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const argv = process.argv.slice(2);
const get = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

// 默认定位当前会话 wire（从本文件路径反推 kimi-code sessions 目录不可靠——
// 用通配：取 ~/.kimi-code/sessions/*/session_*/agents/main/wire.jsonl 最新一个）
function findLatestWire() {
  const root = join(homedir(), '.kimi-code', 'sessions');
  if (!existsSync(root)) return null;
  let best = null, bestMs = 0;
  for (const wd of readdirSync(root)) {
    const wdPath = join(root, wd);
    if (!statSync(wdPath).isDirectory()) continue;
    for (const s of readdirSync(wdPath)) {
      const p = join(wdPath, s, 'agents', 'main', 'wire.jsonl');
      if (!existsSync(p)) continue;
      const st = statSync(p);
      if (st.mtimeMs > bestMs) { bestMs = st.mtimeMs; best = p; }
    }
  }
  return best;
}

const wire = get('wire') || findLatestWire();
if (!wire || !existsSync(wire)) { console.error('[extract-convo] wire.jsonl 不存在'); process.exit(2); }
const out = get('out');
const MIN_LEN = parseInt(get('min-len') || '0', 10);

let lines = [];
const parts = []; // {time, role, text}
for (const line of readFileSync(wire, 'utf-8').split('\n')) {
  if (!line.trim()) continue;
  let d;
  try { d = JSON.parse(line); } catch { continue; }
  if (d.type === 'context.append_message') {
    const m = d.message || {};
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const origin = m.origin?.kind || '';
    if (origin === 'injected') continue; // system-reminder 等注入
    const blocks = Array.isArray(m.content) ? m.content : [];
    const texts = blocks.filter(b => b?.type === 'text' && b.text).map(b => b.text);
    if (texts.length === 0) continue;
    const joined = texts.join('\n');
    if (joined.trim().startsWith('<system-reminder>')) continue; // 系统提醒
    parts.push({ time: d.time, role: m.role, text: joined.trim() });
  } else if (d.type === 'context.append_loop_event') {
    // assistant 流式回复文本（part.type='text'；'think' 是内部思考链，S2 不用）
    const e = d.event || {};
    if (e.type === 'content.part' && e.part?.type === 'text' && e.part.text) {
      parts.push({ time: d.time, role: 'assistant', text: e.part.text, part: true });
    }
  }
}
// 按 step 聚合 content.part（同 step 多个流式块拼成一条），再按时间排序
const merged = [];
const stepBuf = new Map();
for (const p of parts) {
  if (p.part) {
    const key = `${p.time}`;
    const prev = stepBuf.get(key);
    if (prev) prev.text += p.text;
    else stepBuf.set(key, { ...p });
  } else {
    merged.push(p);
  }
}
for (const v of stepBuf.values()) merged.push(v);
merged.sort((a, b) => (a.time || 0) - (b.time || 0));

const fmt = (ts) => {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

for (const p of merged) {
  lines.push(`[${fmt(p.time)}] ${p.role}`);
  lines.push(p.text);
  lines.push('');
}

const result = lines.join('\n');
if (out) {
  writeFileSync(out, result);
  console.log(`[extract-convo] ${result.length} 字符 → ${out}`);
} else {
  console.log(result);
}
