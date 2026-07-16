/**
 * omp/browser.ts — 浏览器工具（占位）
 */
import type { KfmTool, ToolResult } from '../types.js';

export const ompBrowserTool: KfmTool = {
  name: 'browser',
  description: '控制 headless 浏览器进行网页交互。需要安装 Puppeteer + Chromium。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要打开的 URL' },
    },
    required: ['url'],
  },
  async execute(params): Promise<ToolResult> {
    return {
      content: [{ type: 'text', text: `[browser] 未配置。需要安装:\n  npm install puppeteer\n  或通过 npx puppeteer browsers install chrome` }],
      isError: true,
    };
  },
};
