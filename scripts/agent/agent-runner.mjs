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
const CALLS_PATH = join(homedir(), '.kfmv4', 'agent-calls.jsonl');
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
  if (!text) throw new Error('空响应');
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
