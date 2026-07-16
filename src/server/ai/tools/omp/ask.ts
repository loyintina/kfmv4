/**
 * omp/ask.ts — ask 工具（纯逻辑）
 */
import type { KfmTool, ToolResult } from '../types.js';

export const ompAskTool: KfmTool = {
  name: 'ask',
  description: '向用户提问。当 AI 需要确认信息或做出选择时使用。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '要问用户的问题' },
      options: { type: 'array', description: '可选回答列表' },
    },
    required: ['question'],
  },
  async execute(params): Promise<ToolResult> {
    const question = params.question as string;
    const options = params.options as string[] | undefined;
    let text = `[提问] ${question}`;
    if (options && options.length > 0) {
      text += '\n可选项: ' + options.join(', ');
    }
    return { content: [{ type: 'text', text }] };
  },
};
