// /compact 会话压缩 API（L4，2026-08-16 立项——用户定稿：摘要固化 + 真相源不动）
// POST /api/session/compact { sessionId }
//   1. 读会话 messages + 已有 compacts（滚动蒸馏：旧摘要作为输入一部分）
//   2. 保留窗口：最近 8 完整用户回合全保 + 之外 4 轮纯对话（工具折叠）——摘要覆盖到该边界
//   3. 调 deepseek-v4-flash 生成结构化摘要（一次生成，永不重算）
//   4. appendCompact 固化（cutIndex + summary + model + createdAt）
//   5. 返回 { cutIndex, summaryLength, keptFrom } 供客户端提示
import { Router, type Request, type Response } from 'express';
import { getCompacts } from '../ai/session-store.js';
import { runCompact } from '../ai/compact-core.js';
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

compactRouter.post('/session/compact', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'sessionId required' });
      return;
    }
    const result = await runCompact(sessionId);
    if (!result.ok) {
      res.status(result.error?.includes('not found') ? 404 : result.error?.includes('key') ? 500 : 502)
        .json({ error: result.error });
      return;
    }
    if (result.skipped) {
      res.json({ ok: true, skipped: true, reason: result.reason });
      return;
    }
    res.json({ ok: true, cutIndex: result.cutIndex, summaryLength: result.summaryLength, total: result.total });
  } catch (err) {
    res.status(500).json({ error: `compact failed: ${(err as Error).message}` });
  }
});

// GET /api/session/compacts/:id —— 查询已有压缩（调试/展示用）
compactRouter.get('/session/compacts/:id', (req: Request, res: Response) => {
  const list = getCompacts(String(req.params.id));
  res.json(list.map(c => ({ ...c, summary: c.summary.slice(0, 200) + (c.summary.length > 200 ? '…' : '') })));
});
