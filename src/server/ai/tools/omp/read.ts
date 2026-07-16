/**
 * omp/read.ts — 读文件工具（Node.js fs.promises）
 */
import { readFile, access } from 'fs/promises';
import type { KfmTool, ToolResult } from '../types.js';

const MAX_BYTES = 1024 * 1024; // 1MB

export const ompReadTool: KfmTool = {
  name: 'read',
  description: '读取文件内容。支持文本文件、行范围选择（path:50-100）、超过 1MB 自动截断。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径，支持 :行号 选择器（如 src/index.ts:50-100）' },
      raw: { type: 'boolean', description: '是否原样读取不截断' },
    },
    required: ['path'],
  },
  async execute(params): Promise<ToolResult> {
    let rawPath = params.path as string;
    let selector: string | null = null;
    const colonIdx = rawPath.lastIndexOf(':');
    if (colonIdx > 1 && !rawPath.startsWith('/') ? false : colonIdx > 0) {
      const potential = rawPath.slice(colonIdx + 1);
      if (/^\d+(-\d+)?$/.test(potential)) {
        selector = potential;
        rawPath = rawPath.slice(0, colonIdx);
      }
    }
    try {
      await access(rawPath);
    } catch {
      return { content: [{ type: 'text', text: `文件不存在: ${rawPath}` }], isError: true };
    }
    try {
      let content = await readFile(rawPath, 'utf8');
      const truncated = !params.raw && content.length > MAX_BYTES;
      if (truncated) content = content.slice(0, MAX_BYTES) + '\n(文件被截断，使用 raw=true 读取完整内容)';
      if (selector) {
        const [start, end] = selector.split('-').map(Number);
        const lines = content.split('\n');
        const s = Math.max(1, start) - 1;
        const e = end ? Math.min(lines.length, end) : lines.length;
        content = lines.slice(s, e).join('\n');
      }
      return { content: [{ type: 'text', text: content }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `读取失败: ${e instanceof Error ? e.message : '未知错误'}` }], isError: true };
    }
  },
};
