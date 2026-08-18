/**
 * kfmv4/compact.ts — 会话压缩工具（AI 可自主调用）
 *
 * 用户定稿（2026-08-18）：注册 kfm_compact 工具，AI 可以自己压缩自己——
 * 工具框显示压缩动作（可寻址的丢失 = 可见的动作）。
 *
 * 实现复用 POST /api/session/compact 的核心逻辑（同源单一出处——compact.ts
 * routes 的 handler 也改为调 runCompact()，不复制两份摘要逻辑）。
 *
 * sessionId 来源：ToolContext.sessionId（chat.ts 从 run-manager 透传）。
 * 工具返回压缩交接（cutIndex/摘要长度/三数字变化），提示下一轮的自己去
 * read 真相源回读细节。
 */
import { KFM_DATA_DIR } from '../../../path-utils.js';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

import { runCompact } from '../../compact-core.js';
import { toOpenAiMessages } from '../../../../shared/chat-protocol/to-openai-messages.js';
import type { KfmTool, ToolResult } from '../types.js';

export const kfmCompactTool: KfmTool = {
  name: 'kfm-compact',
  description:
    '压缩当前会话的上下文：把远期对话蒸馏成结构化摘要（deepseek-v4-flash），固化后会话卡三数字变小、载荷下降。' +
    '适用时机：上下文接近窗口上限（90% 自动压缩失败时的兜底）、完成大任务后主动瘦身、会话卡 token 数字过大。' +
    '真相源不删——全文随时可 read 回读（可寻址的丢失，不是遗忘）。',
  category: 'kfmv4',
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: '压缩原因（记录用，如「上下文接近上限」「任务完成瘦身」）',
      },
    },
    required: [],
  },

  async execute(params, ctx): Promise<ToolResult> {
    const sessionId = ctx.sessionId;
    if (!sessionId) {
      return {
        content: [{ type: 'text', text: '[kfm-compact] 无 sessionId 上下文（脚本会话不支持压缩）' }],
        isError: true,
      };
    }
    const reason = typeof params.reason === 'string' ? params.reason : 'AI 主动压缩';
    const before = _stats(sessionId);

    const result = await runCompact(sessionId);
    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `[kfm-compact] 压缩失败：${result.error}` }],
        isError: true,
      };
    }
    if (result.skipped) {
      return {
        content: [{ type: 'text', text: `[kfm-compact] 跳过：${result.reason ?? '无需压缩'}` }],
      };
    }
    const after = _stats(sessionId);
    return {
      content: [{
        type: 'text',
        text: `[kfm-compact] ✅ 压缩完成（${reason}）\n` +
          `  摘要覆盖到第 ${result.cutIndex} 条 · 摘要 ${result.summaryLength} 字符 · 真相源 ${result.total} 条不动\n` +
          `  载荷变化：${before.a} → ${after.a} tokens（a=实际请求）\n` +
          `  下一轮生效。细节回读：~/.kfmv4/sessions/${sessionId}.json（compacts 数组）`,
      }],
    };
  },
};

/** 压缩前后三数字（本地快速估算，与 sessions/list 同口径） */
function _stats(sessionId: string): { a: number } {
  try {
    const p = join(KFM_DATA_DIR, 'sessions', `${sessionId}.json`);
    if (!existsSync(p)) return { a: 0 };
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as {
      messages?: unknown[]; compacts?: Array<{ cutIndex: number }>; tokenCount?: number;
    };
    const messages = Array.isArray(raw.messages) ? raw.messages : [];
    const compacts = Array.isArray(raw.compacts) ? raw.compacts : [];
    const last = compacts[compacts.length - 1];
    const cut = last && typeof last.cutIndex === 'number' ? Math.min(last.cutIndex, messages.length) : 0;
    const { apiMessages } = toOpenAiMessages(messages as never, { compact: true, compactCutIndex: cut });
    let tc = 0;
    for (const m of apiMessages) {
      tc += ((m as { content?: unknown }).content as string | undefined)?.length ?? 0;
    }
    return { a: Math.round(tc / 3) };
  } catch { return { a: 0 }; }
}
