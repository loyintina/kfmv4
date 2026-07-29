/**
 * agent-runner.mjs — agent 脚本运行时（形态 A：洁净室 agent 原件）
 *
 * 三明治位置：机械组装输入 → 【agent 判断】→ 机械验证输出 → 调用方（agent）消费。
 *
 * 设计（STACK #3 讨论定稿）：
 * - prompt 模板 {{var}} 注入；输入一律由机械层预装，agent 原件不带工具
 * - provider 有序兜底链（providers.config.json；key 从 ~/.kfmv4/providers.json 按 id 读）
 *   调用失败（鉴权/余额/超时）→ 自动落下一个 provider
 * - 输出校验失败 → 带错误反馈重问（同 provider，最多 retries 次）
 * - 返回 { ok, data?, raw, provider, errors } —— ok=false 不是失败，
 *   是「判断权交还调用方（agent）」的常规路径：调用方读 raw/errors 手动处理
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { join } from 'path';

const CHAIN = JSON.parse(
  readFileSync(fileURLToPath(new URL('./providers.config.json', import.meta.url)), 'utf-8'),
);

function loadProviderEntries() {
  const raw = JSON.parse(readFileSync(join(homedir(), '.kfmv4', 'providers.json'), 'utf-8'));
  const map = new Map();
  for (const p of raw) map.set(p.id, p);
  return map;
}

/** {{var}} 模板注入（输入一律机械预装） */
export function renderTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}!MISSING}}`));
}

async function chat(baseUrl, apiKey, model, system, user, maxTokens, params = {}) {
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
    signal: AbortSignal.timeout(60_000),
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
 */
export async function runAgent({ system = '', prompt, validate = null, retries = 2, maxTokens = 2000 }) {
  const entries = loadProviderEntries();
  const errors = [];

  for (const step of CHAIN) {
    const entry = entries.get(step.providerId);
    if (!entry) { errors.push(`${step.providerId}: providers.json 无此条目`); continue; }

    let feedback = '';
    let lastRaw = '';
    let callFailed = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const text = await chat(entry.baseUrl, entry.apiKey, step.model, system, prompt + feedback, maxTokens, step.params);
        lastRaw = text;
        const data = validate ? validate(text) : text;
        if (data !== null) {
          return { ok: true, data, raw: text, provider: `${step.providerId}/${step.model}`, attempts: attempt + 1, errors };
        }
        feedback = '\n\n[校验失败] 上次输出不符合要求格式。只输出要求的 JSON，不要任何多余文字。';
      } catch (e) {
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
