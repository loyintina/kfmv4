// /compact 会话压缩 API（L4，2026-08-16 立项——用户定稿：摘要固化 + 真相源不动）
// POST /api/session/compact { sessionId }
//   1. 读会话 messages + 已有 compacts（滚动蒸馏：旧摘要作为输入一部分）
//   2. 保留窗口：最近 8 完整用户回合全保 + 之外 4 轮纯对话（工具折叠）——摘要覆盖到该边界
//   3. 调 deepseek-v4-flash 生成结构化摘要（一次生成，永不重算）
//   4. appendCompact 固化（cutIndex + summary + model + createdAt）
//   5. 返回 { cutIndex, summaryLength, keptFrom } 供客户端提示
import { Router, type Request, type Response } from 'express';
import { getCompacts, appendCompact } from '../ai/session-store.js';
import { toOpenAiMessages } from '../../shared/chat-protocol/to-openai-messages.js';
import { resolveKey } from '../env-store.js';

export const compactRouter = Router();

const SUMMARY_MODEL = 'deepseek-v4-flash';
const SUMMARY_PROVIDER = 'deepseek';
// 结构化摘要模板（Claude Code 同款栏目：蒸馏工作状态，不是缩写对话）
const SUMMARY_PROMPT = `你是会话压缩器。把以下对话历史蒸馏成一份工作状态摘要，供 AI 后续对话时当作背景。按固定栏目输出：

## 任务与当前状态
## 关键决策（含被否决的方案及原因）
## 涉及的文件/路径/工具发现
## 错误与修复
## 未完成事项
## 用户约束与偏好

要求：
- 只保留对继续工作有用的信息，过程性内容（试错细节、中间输出）丢弃
- 文件路径、commit hash、命令名保留原文
- 摘要末尾加一行：「原文在会话文件可回读」
- 直接输出摘要正文，不要任何前言`;

/** 计算保留边界：最近 8 完整用户回合全保 + 之外 4 轮纯对话。返回 cutIndex（摘要覆盖到这，不含）。 */
export function computeCutIndex(messages: unknown[]): number {
  // 从尾往前数：第 12 个 user 消息的 index = cutIndex（前 8 全保 + 前 4 纯对话）
  let seen = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role?: string };
    if (m?.role === 'user' && ++seen === 12) return i;
  }
  return 0; // 不足 12 轮用户消息 = 没有值得压缩的量（全保）
}

compactRouter.post('/api/session/compact', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }
    // 会话数据从磁盘真相源读（不依赖内存态——compact 可在任意时刻调）
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const os = await import('os');
    const filePath = join(os.homedir(), '.kfmv4', 'sessions', `${sessionId}.json`);
    let raw: { messages?: unknown[]; compacts?: unknown[] };
    try {
      raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      res.status(404).json({ error: `session not found: ${sessionId}` });
      return;
    }
    const messages = Array.isArray(raw.messages) ? raw.messages : [];
    const cutIndex = computeCutIndex(messages);
    if (cutIndex === 0) {
      res.json({ ok: true, skipped: true, reason: '不足 12 轮用户消息，无需压缩' });
      return;
    }
    // 滚动蒸馏输入：旧摘要（若有）+ 被覆盖区间消息的投影
    const prev = Array.isArray(raw.compacts) && raw.compacts.length
      ? (raw.compacts[raw.compacts.length - 1] as { summary?: string }).summary : '';
    const covered = messages.slice(prev ? 0 : 0, cutIndex); // 简化：全量到 cutIndex（旧摘要也在 messages 之前的覆盖范围里）
    const { apiMessages } = toOpenAiMessages(covered as never, { compact: true });
    const digest = apiMessages
      .map((m: { role?: string; content?: unknown }) => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 2000) : JSON.stringify(m.content).slice(0, 500)}`)
      .join('\n')
      .slice(0, 120000); // 输入截断保护（flash 128k 窗口）

    // 调 deepseek-v4-flash 生成摘要
    const keyRes = resolveKey('${KFM_PROVIDER_KEY}'); // deepseek 的 key 按现有约定（env-store 中文名 fallback）
    if (!keyRes.value) {
      res.status(500).json({ error: `摘要模型 key 解析失败: ${keyRes.missingVar || 'unknown'}` });
      return;
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
      res.status(502).json({ error: `摘要模型调用失败 ${apiResp.status}: ${errText.slice(0, 200)}` });
      return;
    }
    const data = (await apiResp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const summary = data.choices?.[0]?.message?.content?.trim() || '';
    if (!summary) {
      res.status(502).json({ error: '摘要模型返回空内容' });
      return;
    }
    // 固化（真相源追加）
    appendCompact(sessionId, {
      cutIndex,
      summary,
      model: `${SUMMARY_PROVIDER}/${SUMMARY_MODEL}`,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true, cutIndex, summaryLength: summary.length, total: messages.length });
  } catch (err) {
    res.status(500).json({ error: `compact failed: ${(err as Error).message}` });
  }
});

// GET /api/session/compacts/:id —— 查询已有压缩（调试/展示用）
compactRouter.get('/api/session/compacts/:id', (req: Request, res: Response) => {
  const list = getCompacts(String(req.params.id));
  res.json(list.map(c => ({ ...c, summary: c.summary.slice(0, 200) + (c.summary.length > 200 ? '…' : '') })));
});
