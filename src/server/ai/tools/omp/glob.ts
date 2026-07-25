/**
 * omp/glob.ts — glob 工具（直调 pi-natives glob）
 */
import type { KfmTool, ToolResult } from '../types.js';
import { glob } from './native.js';

export const ompGlobTool: KfmTool = {
  name: 'glob',
  description: '按模式查找文件。基于 walkdir Rust 引擎，支持隐藏文件、gitignore 过滤。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob 模式（如 "*.ts"），默认 "*"' },
      path: { type: 'string', description: '搜索目录，默认项目根' },
      hidden: { type: 'boolean', description: '是否包含隐藏文件' },
      maxResults: { type: 'number', description: '最大结果数，默认 200' },
    },
    required: [],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const result = await glob({
      pattern: (params.pattern as string) || '*',
      path: (params.path as string) || ctx.cwd,
      hidden: params.hidden as boolean | undefined,
      maxResults: (params.maxResults as number) || 200,
    });
    if (result.matches.length === 0) {
      return { content: [{ type: 'text', text: '未找到匹配文件' }] };
    }
    const text = result.matches.map(m => `${m.path}${m.fileType === 2 ? '/' : ''}`).join('\n');
    return { content: [{ type: 'text', text }], details: { count: result.matches.length } };
  },
};
