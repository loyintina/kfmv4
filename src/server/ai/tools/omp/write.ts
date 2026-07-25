/**
 * omp/write.ts — 写文件工具（Node.js fs.promises）
 */
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { KfmTool, ToolResult } from '../types.js';

export const ompWriteTool: KfmTool = {
  name: 'write',
  description: '写入文件内容。自动创建父目录，已存在文件会覆盖。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '要写入的文件路径' },
      content: { type: 'string', description: '要写入的内容' },
    },
    required: ['path', 'content'],
  },
  async execute(params): Promise<ToolResult> {
    const filePath = params.path as string;
    const content = params.content as string;
    if (!filePath) return { content: [{ type: 'text', text: '缺少 path 参数' }], isError: true };
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf8');
      const lines = content.split('\n').length;
      const fileName = filePath.split('/').pop() || filePath;
      // 取前 12 行作为预览
      const previewLines = content.split('\n').slice(0, 12);
      const preview = previewLines.join('\n');
      const hasMore = lines > 12;
      return {
        content: [{ type: 'text', text: preview + (hasMore ? `\n...（共 ${lines} 行）` : '') }],
        details: { tool: 'write', path: filePath, name: fileName, size: content.length, lines: lines, preview: true },
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `写入失败: ${e instanceof Error ? e.message : '未知错误'}` }], isError: true };
    }
  },
};
