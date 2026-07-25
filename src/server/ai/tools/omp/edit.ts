/**
 * omp/edit.ts — 编辑文件工具（字符串替换模式）
 */
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { KfmTool, ToolResult } from '../types.js';

export const ompEditTool: KfmTool = {
  name: 'edit',
  description: '精确编辑文件。在文件中查找 old 文本并替换为 new 文本。仅替换首次出现。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '要编辑的文件路径' },
      old: { type: 'string', description: '要替换的原文本' },
      new: { type: 'string', description: '替换后的新文本' },
    },
    required: ['path', 'old', 'new'],
  },
  async execute(params): Promise<ToolResult> {
    const filePath = params.path as string;
    const oldText = params.old as string;
    const newText = params.new as string;
    try { await access(filePath); } catch {
      return { content: [{ type: 'text', text: `文件不存在: ${filePath}` }], isError: true };
    }
    if (!oldText) return { content: [{ type: 'text', text: '缺少 old 参数' }], isError: true };
    try {
      const content = await readFile(filePath, 'utf8');
      if (!content.includes(oldText)) {
        return { content: [{ type: 'text', text: `未找到匹配文本: "${oldText.slice(0, 80)}${oldText.length > 80 ? '...' : ''}"` }], isError: true };
      }
      const updated = content.replace(oldText, newText);
      await writeFile(filePath, updated, 'utf8');
      const fileName = filePath.split('/').pop() || filePath;
      return {
        content: [{ type: 'text', text: `编辑成功 — ${fileName}` }],
        details: { tool: 'edit', path: filePath, name: fileName, oldText, newText },
      };
    } catch (e) {
      return { content: [{ type: 'text', text: `编辑失败: ${e instanceof Error ? e.message : '未知错误'}` }], isError: true };
    }
  },
};
