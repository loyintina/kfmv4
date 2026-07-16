/**
 * omp/web-search.ts — 网页搜索工具（占位）
 */
import type { KfmTool, ToolResult } from '../types.js';

export const ompWebSearchTool: KfmTool = {
  name: 'web_search',
  description: '搜索网页内容。需要配置搜索服务 API key（如 Exa、Brave Search）。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索查询' },
    },
    required: ['query'],
  },
  async execute(): Promise<ToolResult> {
    return {
      content: [{ type: 'text', text: '[web_search] 未配置。需要:\n  1. 在 providers.json 中注册搜索 API（Exa/Brave）\n  2. 提供对应的 API key' }],
      isError: true,
    };
  },
};
