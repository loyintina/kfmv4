/**
 * omp/grep.ts — grep 工具（直调 pi-natives grep）
 */
import type { KfmTool, ToolResult } from '../types.js';
import { grep } from './native.js';

export const ompGrepTool: KfmTool = {
  name: 'grep',
  description: '在文件中搜索正则表达式。基于 ripgrep Rust 引擎，支持 gitignore、最大匹配数限制。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '正则表达式搜索模式' },
      path: { type: 'string', description: '搜索路径（文件或目录），默认项目根' },
      ignoreCase: { type: 'boolean', description: '是否不区分大小写' },
      maxCount: { type: 'number', description: '最大匹配数' },
    },
    required: ['pattern'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    const result = await grep({
      pattern: params.pattern as string,
      path: (params.path as string) || ctx.cwd,
      ignoreCase: params.ignoreCase as boolean | undefined,
      maxCount: params.maxCount as number | undefined,
    });
    if (result.matches.length === 0) {
      return { content: [{ type: 'text', text: `未找到匹配 "${params.pattern}"` }] };
    }
    const lines = result.matches.map(m => `${m.path}:${m.lineNumber}: ${m.line}`);
    let text = lines.join('\n');
    if (result.limitReached) text += '\n(结果被截断)';
    return { content: [{ type: 'text', text }], details: { count: result.matches.length, limitReached: result.limitReached } };
  },
};
