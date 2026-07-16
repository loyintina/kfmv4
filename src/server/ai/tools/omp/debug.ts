/**
 * omp/debug.ts — 调试工具（占位）
 */
import type { KfmTool, ToolResult } from '../types.js';

export const ompDebugTool: KfmTool = {
  name: 'debug',
  description: '交互式调试器（DAP 协议）。需要配置语言对应的 DAP 适配器。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '调试操作: start, step, continue, breakpoint, variables, stack, stop' },
    },
    required: ['action'],
  },
  async execute(): Promise<ToolResult> {
    return {
      content: [{ type: 'text', text: '[debug] 未配置。DAP 调试器需要安装对应语言的适配器（如 debugpy for Python, js-debug for Node.js）。' }],
      isError: true,
    };
  },
};
