/**
 * browser.ts — KfmTool 包装：让 AI 控制 headless 浏览器
 *
 * 三个 action:
 *   open  — 打开/导航到 URL
 *   run   — 在 tab 里执行 JS，返回结果
 *   close — 关闭 tab
 */

import type { KfmTool, ToolResult } from '../types.js';
import { acquireTab, runInTab, releaseTab, releaseAllTabs } from './browser/tab-supervisor.js';
import type { SessionSnapshot } from './browser/tab-protocol.js';
import { ToolError } from '../types.js';

export const browserTool: KfmTool = {
  name: 'browser',
  description: '控制 headless 浏览器进行网页交互。三个 action：open（打开 URL）、run（在页面执行 JS）、close（关闭 tab）。',
  category: 'browser',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['open', 'run', 'close'],
        description: 'open: 打开 URL 到指定 tab; run: 在 tab 中执行 JS; close: 关闭 tab',
      },
      url: { type: 'string', description: '要打开的 URL（open action 用）' },
      code: { type: 'string', description: '在页面执行的 JS 代码（run action 用）。可用变量：page, tab, browser, display, assert, wait' },
      name: { type: 'string', description: 'Tab 名称（默认 "main"）', default: 'main' },
      viewport: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
        },
        description: '视口大小（open action 用）',
      },
      timeout: { type: 'number', description: '超时毫秒数（默认 30000）' },
    },
    required: ['action'],
  },

  async execute(params: Record<string, unknown>, ctx, onUpdate): Promise<ToolResult> {
    const action = params.action as string;
    const tabName = (params.name as string) || 'main';
    const timeoutMs = (params.timeout as number) || 30_000;

    try {
      switch (action) {
        case 'open': {
          const url = params.url as string;
          if (!url) throw new ToolError('open action requires url parameter');
          const viewport = params.viewport as { width: number; height: number } | undefined;
          const { info } = await acquireTab(tabName, {
            url,
            viewport,
            timeoutMs,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify({ url: info.url, title: info.title, viewport: info.viewport }, null, 2) }],
          };
        }
        case 'run': {
          const code = params.code as string;
          if (!code) throw new ToolError('run action requires code parameter');
          const session: SessionSnapshot = { cwd: ctx.cwd };
          const result = await runInTab(tabName, { code, timeoutMs, session });
          const content = [];
          for (const display of result.displays) {
            content.push(display);
          }
          if (result.returnValue !== undefined) {
            content.push({
              type: 'text' as const,
              text: typeof result.returnValue === 'string'
                ? result.returnValue
                : JSON.stringify(result.returnValue, null, 2),
            });
          }
          return { content };
        }
        case 'close': {
          const closed = await releaseTab(tabName);
          return {
            content: [{ type: 'text', text: closed ? `Tab "${tabName}" closed.` : `Tab "${tabName}" not found.` }],
          };
        }
        default:
          throw new ToolError(`Unknown browser action: ${action}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `[browser] ${msg}` }],
        isError: true,
      };
    }
  },
};
