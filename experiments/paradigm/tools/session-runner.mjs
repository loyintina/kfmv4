#!/usr/bin/env node
/**
 * session-runner.mjs — 会话驱动内核（paradigm 实验基建）
 *
 * 离线跑 kfm 工具流会话：参数化角色/provider/model/范式包，POST /ai/chat/start
 * → SSE 消费 → 落盘归档。复用 routine-entry-validation 的驱动机制（已验证）。
 *
 * 用法（CLI）：
 *   node experiments/paradigm/tools/session-runner.mjs \
 *     --prompt "探索 kfmv4-lab" --provider "Opencode Go Google" --model "deepseek-v4-flash" \
 *     [--role 蔚然] [--paradigm 证据纪律] [--session 自定义id] [--out 输出路径]
 *
 * 作为模块（导出 runSession）：
 *   import { runSession } from './session-runner.js';
 *   const r = await runSession({ sessionId, messages, userText, model, provider, roleFile, paradigm, base });
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const REPO = join(fileURLToPath(new URL('../../..', import.meta.url)));
const SESSIONS = join(homedir(), '.kfmv4', 'sessions');
const PARADIGMS = join(homedir(), '.kfmv4', 'paradigms');
const BASE = process.env.KFM_BASE || 'http://localhost:8021/api';

function validSessionId(id) {
  return /^[\p{L}\p{N}_-]{1,128}$/u.test(id);
}

/** 范式包拼进首条 user 消息（示范性上下文——AI 被同化到范式，非指令注入） */
function applyParadigm(messages, paradigm) {
  if (!paradigm) return messages;
  return messages.map((m, i) => i === 0 && m.role === 'user'
    ? { ...m, content: `〔范式包〕以下是你要同化的思维/行为范式（示范性上下文）：\n\n${paradigm}\n\n————\n${m.content}` }
    : m);
}

/** 读范式包文件（.kfmv4/paradigms/<name>.md） */
export function loadParadigm(name) {
  if (!name) return '';
  const p = join(PARADIGMS, `${name}.md`);
  return existsSync(p) ? readFileSync(p, 'utf-8') : '';
}

/** 读已有会话的历史消息（续写用）——支持 sessionId 或直接路径 */
export function loadSessionMessages(sessionId) {
  const cands = sessionId.includes('/')
    ? [sessionId]
    : [join(SESSIONS, `${sessionId}.json`), join(homedir(), '.kfmv4', 'experiments', 'paradigm', 'sessions', `${sessionId}.json`)];
  for (const p of cands) {
    if (existsSync(p)) {
      const o = JSON.parse(readFileSync(p, 'utf-8'));
      return { messages: o.messages || [], sessionPath: p };
    }
  }
  return null;
}

async function startRun(sessionId, messages, userText, model, provider, roleFile) {
  const res = await fetch(`${BASE}/ai/chat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      messages,
      userText,
      model,
      provider,
      ...(roleFile ? { roleFile } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`start 失败 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function waitRun(runId, maxMs = 600_000) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/ai/chat/${runId}/stream`, { signal: AbortSignal.timeout(maxMs + 15_000) });
  if (!res.ok) throw new Error(`stream HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let events = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    events += 1;
    buf = buf.replace(/^.*?\n\n/s, '');
    if (Date.now() - t0 > maxMs) throw new Error(`run ${runId} 超时 ${maxMs}ms`);
  }
  return { events, ms: Date.now() - t0 };
}

/**
 * 跑一个 kfm 工具流会话。
 * @param {object} opts
 * @param {string} opts.sessionId 合法 sessionId（BAR-SEC-14 白名单）
 * @param {Array}  opts.messages 完整消息列表（续写 = 历史 + 新消息全量重发）
 * @param {string} opts.userText 落盘原文（防 ts 前缀污染）
 * @param {string} opts.model
 * @param {string} opts.provider
 * @param {string} [opts.roleFile] 角色卡名（.kfmv4/roles/<name>.json）
 * @param {string} [opts.paradigm] 范式包名（.kfmv4/paradigms/<name>.md）或直接文本
 * @param {string} [opts.out] 归档路径（默认 ~/.kfmv4/sessions/<sessionId>.json）
 * @returns {Promise<{runId, events, ms, sessionPath}>}
 */
export async function runSession({ sessionId, messages, userText, model, provider, roleFile, paradigm, out }) {
  if (!validSessionId(sessionId)) throw new Error(`sessionId 不合法: ${sessionId}`);
  const paradigmText = paradigm && !paradigm.includes('\n')
    ? loadParadigm(paradigm) || paradigm   // 名字→读文件；不是文件名则当文本
    : (paradigm || '');
  const msgs = applyParadigm(messages, paradigmText);
  const { runId } = await startRun(sessionId, msgs, userText, model, provider, roleFile);
  const { events, ms } = await waitRun(runId);
  // 等服务端 flush 会话文件
  await new Promise(r => setTimeout(r, 1500));
  const src = join(SESSIONS, `${sessionId}.json`);
  if (!existsSync(src)) throw new Error(`会话未落盘: ${src}`);
  if (out) {
    mkdirSync(join(out, '..'), { recursive: true });
    copyFileSync(src, out);
    rmSync(src); // 清理生产区副本
    return { runId, events, ms, sessionPath: out };
  }
  return { runId, events, ms, sessionPath: src };
}

// ====== CLI ======
const argv = process.argv.slice(2);
if (argv.length > 0) {
  const get = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const prompt = get('prompt');
  const cont = get('continue');
  if (!prompt && !cont) { console.error('用法: --prompt <文本> [--continue <会话id/路径>] [--provider <名>] [--model <名>] [--role <角色>] [--paradigm <范式包名>] [--session <id>] [--out <路径>]'); process.exit(2); }
  const provider = get('provider') || 'Opencode Go Google';
  const model = get('model') || 'deepseek-v4-flash';
  const role = get('role');
  const paradigm = get('paradigm');
  const sessionId = get('session') || (cont ? (cont.includes('/') ? 'bi-cont' : cont) : `bi-${Date.now().toString(36)}`);
  const out = get('out');

  // 续写：读历史 → 追加新 user 消息 → 全量重发（服务端 to-openai-messages 原生处理 role:'ai'）
  let history = [];
  if (cont) {
    const loaded = loadSessionMessages(cont);
    if (!loaded) { console.error(`[session-runner] 会话不存在: ${cont}`); process.exit(1); }
    history = loaded.messages;
    console.log(`[session-runner] 续写会话（历史 ${history.length} 条消息）`);
  }
  const messages = [...history, { role: 'user', content: [{ type: 'text', text: prompt }] }];

  const t0 = Date.now();
  console.log(`[session-runner] ${model} @ ${provider}${role ? ` 角色=${role}` : ''}${paradigm ? ` 范式包=${paradigm}` : ''} 会话=${sessionId}${cont ? '（多轮）' : ''}`);
  const res = await runSession({
    sessionId, messages, userText: prompt, model, provider, roleFile: role, paradigm, out,
  });
  console.log(`[session-runner] 完成（${((Date.now() - t0) / 1000).toFixed(0)}s，${res.events} 事件）→ ${res.sessionPath}`);
}
