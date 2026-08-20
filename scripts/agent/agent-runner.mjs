/**
 * agent-runner.mjs — agent 脚本运行时（形态 A：洁净室 agent 原件）
 *
 * 三明治位置：机械组装输入 → 【agent 判断】→ 机械验证输出 → 调用方（agent）消费。
 *
 * 设计（STACK #3 讨论定稿）：
 * - prompt 模板 {{var}} 注入；输入一律由机械层预装，agent 原件不带工具
 * - provider 有序兜底链（providers.config.json；key 从 ~/.kfmv4/providers.json 按 id 读，
 *   ${VAR} 代字经 resolveKey 解析：process.env 优先、.kfmv4/.env 其次）
 *   调用失败（鉴权/余额/超时）→ 自动落下一个 provider
 * - 输出校验失败 → 带错误反馈重问（同 provider，最多 retries 次）
 * - 返回 { ok, data?, raw, provider, errors } —— ok=false 不是失败，
 *   是「判断权交还调用方（agent）」的常规路径：调用方读 raw/errors 手动处理
 */

import { readFileSync, appendFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { join } from 'path';

const CHAIN = JSON.parse(
  readFileSync(fileURLToPath(new URL('./providers.config.json', import.meta.url)), 'utf-8'),
);

// ========== 调用账本（史官制度 8.5：每次 LLM 调用落 append-only 记录，观测台聚合） ==========
const CALLS_PATH = join(homedir(), '.kfmv4', 'ledger', 'agent-calls.jsonl');
function logCall(provider, ms, ok, error = '') {
  try {
    mkdirSync(join(homedir(), '.kfmv4'), { recursive: true });
    appendFileSync(CALLS_PATH, JSON.stringify({
      ts: new Date().toISOString(), provider, ms, ok, error: error.slice(0, 120),
    }) + '\n');
  } catch { /* 账本不可写不阻断调用 */ }
}

function loadProviderEntries() {
  const raw = JSON.parse(readFileSync(join(homedir(), '.kfmv4', 'providers.json'), 'utf-8'));
  const map = new Map();
  for (const p of raw) map.set(p.id, p);
  return map;
}

// ---- apiKey 代字解析（与 src/server/env-store.ts 语义同步：构建边界两侧各一份，
// .env 行格式为冻结契约：KEY=VALUE、# 注释、可选成对引号）----
const ENV_PATH = join(homedir(), '.kfmv4', '.env');
const ENV_REF_RE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

function loadEnvFile() {
  try {
    const vars = {};
    for (const line of readFileSync(ENV_PATH, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      let val = t.slice(eq + 1).trim();
      if (val.length >= 2 && ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))) {
        val = val.slice(1, -1);
      }
      vars[t.slice(0, eq).trim()] = val;
    }
    return vars;
  } catch { return {}; }
}

/** ${VAR} → process.env 优先、.kfmv4/.env 其次；未设置返回 { missingVar } */
function resolveKey(raw) {
  const m = ENV_REF_RE.exec(String(raw ?? '').trim());
  if (!m) return { value: raw, missingVar: null };
  const v = process.env[m[1]] ?? loadEnvFile()[m[1]];
  return v ? { value: v, missingVar: null } : { value: '', missingVar: m[1] };
}

/** {{var}} 模板注入（输入一律机械预装） */
export function renderTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}!MISSING}}`));
}

async function chat(baseUrl, apiKey, model, system, user, maxTokens, params = {}, timeoutMs = 120_000) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
      ...params,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    // 2026-08-18 事故（ledger/bugs.md）：deepseek-v4-flash 默认开思考 → 输出全在
    // reasoning_content、content 空。错误信息带病因，让下一次故障自带诊断：
    // 抽取型负载应显式传 thinking:{type:'disabled'}，推理型负载应读 reasoning_content
    const reasoning = json.choices?.[0]?.message?.reasoning_content;
    const hint = reasoning ? `（内容在思考区 reasoning_content(len=${String(reasoning).length})——v4-flash 默认开思考，抽取型负载应传 thinking:{type:'disabled'}）` : '';
    throw new Error(`空响应${hint}`);
  }
  return text;
}

/** 从文本中提取第一个 JSON 对象（容错 agent 输出多余文字） */
export function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/**
 * 跑一个 agent 任务。
 * validate(text) → data | null：null = 校验失败（触发带反馈重问）
 * params：负载级请求参数覆盖（合并于 provider 的 step.params 之后）——
 *   抽取型负载可传 { thinking: { type: 'disabled' } } 关思考换速度
 *   （deepseek 实测 2026-07-30：真开关，10 倍提速；推理型负载勿用）
 * timeoutMs：单次请求超时（默认 120s——大 prompt 如 inter-workflows 探针 60s 不够）
 */
export async function runAgent({ system = '', prompt, validate = null, retries = 2, maxTokens = 2000, params = {}, timeoutMs = 120_000 }) {
  const entries = loadProviderEntries();
  const errors = [];

  for (const step of CHAIN) {
    const entry = entries.get(step.providerId);
    if (!entry) { errors.push(`${step.providerId}: providers.json 无此条目`); continue; }

    const key = resolveKey(entry.apiKey);
    if (key.missingVar) { errors.push(`${step.providerId}: apiKey 引用 ${key.missingVar} 未设置（.kfmv4/.env 或 export）`); continue; }

    let feedback = '';
    let lastRaw = '';
    let callFailed = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const t0 = Date.now();
      try {
        const text = await chat(entry.baseUrl, key.value, step.model, system, prompt + feedback, maxTokens, { ...step.params, ...params }, timeoutMs);
        lastRaw = text;
        const data = validate ? validate(text) : text;
        if (data !== null) {
          logCall(`${step.providerId}/${step.model}`, Date.now() - t0, true);
          return { ok: true, data, raw: text, provider: `${step.providerId}/${step.model}`, attempts: attempt + 1, errors };
        }
        logCall(`${step.providerId}/${step.model}`, Date.now() - t0, false, '校验失败');
        feedback = '\n\n[校验失败] 上次输出不符合要求格式。只输出要求的 JSON，不要任何多余文字。';
      } catch (e) {
        logCall(`${step.providerId}/${step.model}`, Date.now() - t0, false, e.message);
        // 瞬态错误（空响应/超时/5xx）原地重试一次再落下一个 provider
        if (attempt < retries && /空响应|timeout|HTTP 5/.test(e.message)) {
          errors.push(`${step.providerId}/${step.model}: 瞬态错误原地重试（${e.message.slice(0, 60)}）`);
          continue;
        }
        errors.push(`${step.providerId}/${step.model}: ${e.message}`);
        callFailed = true;
        break; // 非瞬态失败 → 落下一个 provider
      }
    }
    if (!callFailed) errors.push(`${step.providerId}/${step.model}: 校验重试 ${retries + 1} 次均失败`);
  }
  return { ok: false, errors };
}

// ========== 工具流通道（巡逻探针工具化，2026-08-04） ==========
// 设计：探针通过 kfm 服务端 /ai/chat/start（带 tools 白名单 + extraSystem）跑工具流会话，
// 复用服务端工具循环/权限引擎/白名单三层过滤。输出契约与 runAgent 一致（{ok,data,raw}），
// 调用方（semantic-audit）分流即可。服务端不可达 → fallback 纯文本 runAgent（巡逻无人值守，
// 宁可有纯文本结果也别空窗；fallback 计 metrics 长跑观测服务端可用性）。

const KFM_BASE = process.env.KFM_BASE || 'http://localhost:8021/api';

/**
 * 解析 kfm 服务端 SSE 工具流，收集最终文本。
 * 服务端事件封装（routes.ts stream 端点）：data: {"index":N,"event":{...}}
 * 事件协议见 src/server/ai/chat.ts StreamEvent：
 *   event.content_block_delta.deltaType=text_delta → 拼文本（多轮工具调用间分散，全收）
 *   event.error → 抛错（上游失败，文本无效）
 *   __end__（无 event 包装，服务端流结束哨兵）→ 完成
 * 容错：未知 type / 坏 JSON 行跳过；流结束未收到 __end__ 也返回已收集文本。
 * @param {ReadableStreamDefaultReader} reader
 * @returns {Promise<string>}
 */
export async function parseToolStream(reader) {
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      let ev;
      try { ev = JSON.parse(jsonStr); } catch { continue; }
      // 解包服务端封装（{index, event}）；__end__ 是流结束哨兵（无 event 包装）
      if (ev && typeof ev === 'object' && 'event' in ev) ev = ev.event;
      if (ev?.type === '__end__') return text;
      if (ev?.type === 'content_block_delta' && ev.deltaType === 'text_delta' && typeof ev.deltaText === 'string') {
        text += ev.deltaText;
      } else if (ev?.type === 'error') {
        throw new Error(`工具流错误: ${String(ev.content || ev.message || '未知').slice(0, 300)}`);
      } else if (ev?.type === 'done') {
        return text;
      }
    }
  }
  return text;
}

/**
 * 跑一次工具流会话（单个 provider 单次尝试，不含重问/兜底）。
 * @returns {{text:string} | {error:{fallback:boolean, message:string}}}
 *   error.fallback=true = 服务端网络层不可达（连接拒绝/流中断）→ 应降级纯文本；
 *   error.fallback=false = HTTP/上游错误（服务端在但拒绝）→ 落下一个 provider。
 */
async function tooledOnce({ base, sid, system, prompt, model, providerId, tools, maxTokens, params, timeoutMs }) {
  let res;
  try {
    res = await fetch(`${base}/ai/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sid,
        sessionClass: 'script', // 落盘分流 sessions/script/——巡逻会话不得进面板区（BAR-SEMCHAIN-04）
        messages: [{ role: 'user', content: prompt }],
        userText: prompt,
        model,
        provider: providerId,
        tools,
        extraSystem: system,
        maxTokens,
        params,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return { error: { fallback: true, message: `服务端连接失败: ${e.message.slice(0, 100)}` } };
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 200);
    return { error: { fallback: false, message: `start HTTP ${res.status}: ${body}` } };
  }
  const { runId } = await res.json();
  let streamRes;
  try {
    streamRes = await fetch(`${base}/ai/chat/${runId}/stream`, { signal: AbortSignal.timeout(timeoutMs + 15_000) });
  } catch (e) {
    return { error: { fallback: true, message: `流式连接失败: ${e.message.slice(0, 100)}` } };
  }
  if (!streamRes.ok) return { error: { fallback: false, message: `stream HTTP ${streamRes.status}` } };
  try {
    const text = await parseToolStream(streamRes.body.getReader());
    return { text };
  } catch (e) {
    // 上游 error 事件 / 流中断：服务端在但本轮失败——非 fallback（换 provider 有意义）
    return { error: { fallback: false, message: e.message } };
  }
}

/**
 * 跑一个带工具白名单的 agent 任务（工具流形态，服务端通道）。
 * 与 runAgent 同契约：{ok, data, raw, provider, attempts, errors}；另附 tooled:true、
 * fallback:true（服务端不可达降级纯文本，errors 带降级说明）。
 * @param {object} opts
 * @param {string}  opts.system    探针系统约束（经 extraSystem 注入服务端 system 段）
 * @param {string}  opts.prompt    任务问题
 * @param {Function} [opts.validate] 校验函数（同 runAgent）
 * @param {number}  [opts.retries]  校验失败带反馈重问次数（默认 2）
 * @param {string[]} [opts.tools]   工具白名单（不给 = 空，AI 只用文字）
 * @param {number}  [opts.maxTokens] 单轮输出预算（默认 32000——工具流思考型探针：
 *   思考链计入 max_tokens，预算被吃光则 text 为 0（2026-08-04 试点事故），
 *   故比纯文本路径的 16000 更宽；服务端默认 16384）
 * @param {object}  [opts.params]   上游请求参数透传（provider 特定：thinking 开关/
 *   reasoning_effort 档位——官方 deepseek 真 low/high/max（flash 映射 low→low），
 *   中转 opencode 档位差弱（1.5 倍）；服务端合并进 requestBody）
 * @param {string}  [opts.preferProvider] 优先 provider（从 CHAIN 该位开始，失败仍落下一个兜底）
 * @param {number}  [opts.timeoutMs] 单次流式会话总超时（默认 600s——工具流多轮比单轮慢）
 * @param {string}  [opts.sessionId] 会话 id 前缀（默认 patrol）
 */
export async function runAgentTooled({ system = '', prompt, validate = null, retries = 2, tools = [], maxTokens = 32000, params = {}, preferProvider = null, timeoutMs = 600_000, sessionId = 'patrol' }) {
  const entries = loadProviderEntries();
  const errors = [];
  // 从 preferProvider 位置开始的链（默认全链），失败落下一个——保留兜底语义
  const startIdx = preferProvider ? CHAIN.findIndex(s => s.providerId === preferProvider) : 0;
  const chain = startIdx >= 0 ? [...CHAIN.slice(startIdx), ...CHAIN.slice(0, startIdx)] : CHAIN;

  const fallbackToPlain = async (msg) => {
    errors.push(msg);
    const fb = await runAgent({ system, prompt, validate, retries, maxTokens: 16000, params, timeoutMs: 300_000 });
    return { ...fb, fallback: true, errors: [...errors, ...(fb.errors || [])] };
  };

  for (const step of chain) {
    const entry = entries.get(step.providerId);
    if (!entry) { errors.push(`${step.providerId}: providers.json 无此条目`); continue; }
    const key = resolveKey(entry.apiKey);
    if (key.missingVar) { errors.push(`${step.providerId}: apiKey 引用 ${key.missingVar} 未设置（.kfmv4/.env 或 export）`); continue; }

    let feedback = '';
    let callFailed = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const t0 = Date.now();
      // 每次尝试独立会话（校验失败重问 = 新会话带反馈重发，不污染前一轮）
      const sid = `${sessionId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const out = await tooledOnce({ base: KFM_BASE, sid, system, prompt: prompt + feedback, model: step.model, providerId: step.providerId, tools, maxTokens, params, timeoutMs });
      if (out.error) {
        logCall(`${step.providerId}/${step.model}`, Date.now() - t0, false, out.error.message);
        if (out.error.fallback) return await fallbackToPlain(out.error.message);
        errors.push(`${step.providerId}/${step.model}: ${out.error.message}`);
        callFailed = true;
        break; // 非网络错误 → 落下一个 provider
      }
      const text = out.text;
      const data = validate ? validate(text) : text;
      if (data !== null) {
        logCall(`${step.providerId}/${step.model}`, Date.now() - t0, true);
        return { ok: true, data, raw: text, provider: `${step.providerId}/${step.model}`, attempts: attempt + 1, errors, tooled: true };
      }
      logCall(`${step.providerId}/${step.model}`, Date.now() - t0, false, '校验失败');
      feedback = '\n\n[校验失败] 上次输出不符合要求格式。只输出要求的 JSON，不要任何多余文字。';
    }
    if (!callFailed) errors.push(`${step.providerId}/${step.model}: 校验重试 ${retries + 1} 次均失败`);
  }
  return { ok: false, errors, tooled: true };
}
