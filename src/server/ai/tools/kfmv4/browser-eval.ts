/**
 * browser-eval.ts — 在用户浏览器里执行 JS
 *
 * 通过 WebSocket 通道把代码推送到前端执行，返回结果。
 * 用途：AI 自测 / 调试 kfmv4 自身的 UI 状态、DOM、内部变量。
 *
 * 相当于一个远程浏览器控制台——可访问 KFMState、Registry、DOM、
 * window 上的所有 kfmv4 内部状态，无需启动额外的 Chromium 进程。
 */

import type { KfmTool, ToolResult } from '../types.js';

export const kfmBrowserEvalTool: KfmTool = {
  name: 'browser_eval',
  description:
    '在 kfmv4 的用户浏览器里执行任意 JavaScript，返回执行结果。' +
    '用于调试 UI 状态、检查 DOM、读取 KFMState / Registry 等前端内部数据。' +
    '代码在页面的全局作用域执行，可访问 window.KFMState、document 等。' +
    '结果通过 return 返回（支持 Promise），超时默认 10s。',
  category: 'kfmv4',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: '要在浏览器里执行的 JS 代码。用 return 返回结果，支持 await。',
      },
      timeout: {
        type: 'number',
        description: '超时毫秒数（默认 10000）',
      },
    },
    required: ['code'],
  },

  async execute(params, ctx): Promise<ToolResult> {
    const code = params.code as string;
    const timeout = (params.timeout as number) || 10_000;

    if (!ctx.wsServer) {
      return {
        content: [{ type: 'text', text: '[browser_eval] wsServer 不可用' }],
        isError: true,
      };
    }

    try {
      const result = await ctx.wsServer.evalInBrowser(code, timeout);
      const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `[browser_eval] ${msg}` }],
        isError: true,
      };
    }
  },
};
