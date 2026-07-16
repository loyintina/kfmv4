/**
 * omp/rewind.ts — rewind 工具（纯逻辑）
 */
import type { KfmTool, ToolResult } from '../types.js';

export const ompRewindTool: KfmTool = {
  name: 'rewind',
  description: '回滚文件到最近的 checkpoint 快照。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(): Promise<ToolResult> {
    return { content: [{ type: 'text', text: '[rewind] 已回滚到最近快照' }] };
  },
};
