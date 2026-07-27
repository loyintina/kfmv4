/**
 * orb-chat.ts — AI 对话模块入口（薄编排层）
 *
 * v8 审计拆分：706 行 → 3 文件
 *   - orb-chat-hints.ts: 等待提示 + 工具提示 + Todo 面板
 *   - orb-chat-run.ts: 持久化运行态 + 流消费 + 重连 + doSend/resumeRun
 *   - orb-chat.ts: 本文件，re-export + 事件钩子 + markdown 渲染
 *
 * 消息采用 content block 数组模型（对齐 Claude/OpenAI 标准）：
 *   ChatMessage.content = Array<TextBlock | ToolBlock | RuleWarningBlock>
 *
 * SSE 协议（服务端 → 客户端）：
 *   message_start → content_block_start/delta/stop → tool_result → message_stop
 */

// ========== Re-exports ==========

export type { ContentBlock, TextBlock, ToolBlock, RuleWarningBlock, ChatMessage } from './orb-chat-run.js';
export {
  doSend, resumeRun, readPersistedRun, clearPersistedRun,
  getActiveRunId, getActiveCursor, settlePendingToolBlocks, setEventHook,
} from './orb-chat-run.js';
export {
  startWaitingIndicator, clearTodoPanel,
  getToolHint, clearToolHint, updateTodoFromTool,
} from './orb-chat-hints.js';

// ========== 依赖 ==========

import { marked } from 'marked';
import { preprocessMd, MARKED_OPTS } from './renderers/md-extensions.js';
import { type MathData } from './renderers/math-diagram.js';


// ========== 异步 Markdown 渲染（用于标题生成等） ==========

export async function renderMarkdownAsync(text: string): Promise<string> {
  const mathData: MathData = { display: [], inline: [] };
  const processed = preprocessMd(text, mathData);
  return await marked.parse(processed, MARKED_OPTS) as string;
}
