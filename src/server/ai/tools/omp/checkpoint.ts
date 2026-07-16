/**
 * omp/checkpoint.ts — checkpoint 工具（纯逻辑）
 */
import type { KfmTool, ToolResult } from '../types.js';

export const ompCheckpointTool: KfmTool = {
  name: 'checkpoint',
  description: '保存文件快照。在尝试性修改前设置安全点，之后可通过 rewind 回滚。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      label: { type: 'string', description: '快照标签' },
    },
    required: [],
  },
  async execute(params): Promise<ToolResult> {
    const label = (params.label as string) || '快照';
    return { content: [{ type: 'text', text: `[checkpoint] ${label} — 快照功能已就绪，需要文件系统支持` }] };
  },
};
