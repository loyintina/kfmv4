/**
 * omp/github.ts — GitHub 工具（占位）
 */
import type { KfmTool, ToolResult } from '../types.js';

export const ompGithubTool: KfmTool = {
  name: 'github',
  description: '操作 GitHub Issues 和 Pull Requests。需要安装 gh CLI 并登录。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: '操作: list, view, create, comment, close' },
    },
    required: ['action'],
  },
  async execute(): Promise<ToolResult> {
    return {
      content: [{ type: 'text', text: '[github] 未配置。需要:\n  1. 安装 gh CLI: https://cli.github.com/\n  2. 运行 gh auth login' }],
      isError: true,
    };
  },
};
