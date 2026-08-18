/**
 * compact-core.ts — 压缩核心逻辑（单一出处）
 *
 * POST /api/session/compact 与 kfm-compact 工具共用 runCompact()——
 * 摘要生成的唯一生产者（心法 16：一个数据对象只能有一个生产者）。
 * 从 routes/compact.ts 的 handler 抽出，逻辑原样搬运（2026-08-18）。
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { resolveKey } from '../env-store.js';
import { appendCompact } from './session-store.js';
import { toOpenAiMessages } from '../../shared/chat-protocol/to-openai-messages.js';

export const SUMMARY_PROVIDER = 'deepseek';
export const SUMMARY_MODEL = 'deepseek-v4-flash';
export const SUMMARY_PROMPT = `你是会话摘要专家。把长对话蒸馏成结构化摘要，供 AI 继续工作时作为背景。
输出固定栏目（没有的写"(none)"）：
## 任务与当前状态
## 关键决策（含被否决的方案及原因）
## 涉及文件/路径
## 错误与修复
## 未完成事项
## 用户约束与偏好
要求：保留结论与状态，压缩过程；文件路径和提交号原样保留；中文输出；不超过 2000 字。`;

export interface CompactResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  cutIndex?: number;
  summaryLength?: number;
  total?: number;
  error?: string;
}

/** 保留窗口边界：最近 12 个完整用户回合之外即压缩区（8 全保 + 4 纯对话） */
export function computeCutIndex(messages: unknown[]): number {
  const msgs = messages as Array<{ role?: string }>;
  let userRounds = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.role === 'user') {
      userRounds++;
      if (userRounds >= 12) return i; // 第 12 个 user 消息处开切（其之前是压缩区）
    }
  }
  return 0; // 不足 12 轮：无需压缩
}

/**
 * 执行一次压缩（滚动蒸馏：旧摘要 + 新增对话 → 新摘要 → 固化）。
 * 数据从磁盘真相源读，不依赖内存态——任意时刻可调。
 */
export async function runCompact(sessionId: string): Promise<CompactResult> {
  const filePath = join(homedir(), '.kfmv4', 'sessions', `${sessionId}.json`);
  let raw: { messages?: unknown[]; compacts?: unknown[] };
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return { ok: false, error: `session not found: ${sessionId}` };
  }
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  const cutIndex = computeCutIndex(messages);
  if (cutIndex === 0) {
    return { ok: true, skipped: true, reason: '不足 12 轮用户消息，无需压缩' };
  }
  const prev = Array.isArray(raw.compacts) && raw.compacts.length
    ? (raw.compacts[raw.compacts.length - 1] as { summary?: string }).summary : '';
  const covered = messages.slice(0, cutIndex);
  const { apiMessages } = toOpenAiMessages(covered as never, { compact: true });
  const digest = apiMessages
    .map((m: { role?: string; content?: unknown }) => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 2000) : JSON.stringify(m.content).slice(0, 500)}`)
    .join('\n')
    .slice(0, 120000); // 输入截断保护（flash 128k 窗口）

  const keyRes = resolveKey('${KFM_PROVIDER_DEEPSEEK}');
  if (!keyRes.value) {
    return { ok: false, error: `摘要模型 key 解析失败: ${keyRes.missingVar || 'unknown'}` };
  }
  const apiResp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyRes.value}` },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: (prev ? `【旧摘要（在此基础上滚动更新）】\n${prev}\n\n【新增对话】\n` : '') + digest },
      ],
      max_tokens: 4096,
      stream: false,
    }),
  });
  if (!apiResp.ok) {
    const errText = await apiResp.text().catch(() => '');
    return { ok: false, error: `摘要模型调用失败 ${apiResp.status}: ${errText.slice(0, 200)}` };
  }
  const data = (await apiResp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const summary = data.choices?.[0]?.message?.content?.trim() || '';
  if (!summary) {
    return { ok: false, error: '摘要模型返回空内容' };
  }
  appendCompact(sessionId, {
    cutIndex,
    summary,
    model: `${SUMMARY_PROVIDER}/${SUMMARY_MODEL}`,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, cutIndex, summaryLength: summary.length, total: messages.length };
}
