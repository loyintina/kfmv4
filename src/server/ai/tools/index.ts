/**
 * kfmv4 AI 工具注册入口
 *
 * 注册所有可用的 AI 工具：
 * - kfmv4 专用工具（logs, browser_eval, restart）
 * - omp 工具（bash, read, write, edit, grep, glob, todo, eval, checkpoint, rewind, browser, debug, web_search）
 *
 * v8.1.0 删除 kfm-snapshot（眼睛机制 page-state.md 是其严格上位：更新鲜/更丰富/零调用成本）
 * 与 kfm-exec（与 bash 同一实现的双胞胎，且逃逸 bash 重试弧线统计）——见 TOOL_IO_COMPACTION.md。
 */

import type { KfmTool, ToolContext, ToolResult, ToolUpdate, ContentBlock } from './types.js';

// kfmv4 专用工具
import { kfmLogsTool } from './kfmv4/logs.js';
import { kfmBrowserEvalTool } from './kfmv4/browser-eval.js';
import { kfmRestartTool } from './kfmv4/restart.js';

// omp 核心文件工具
import { ompBashTool } from './omp/bash.js';
import { ompReadTool } from './omp/read.js';
import { ompWriteTool } from './omp/write.js';
import { ompEditTool } from './omp/edit.js';
import { ompGrepTool } from './omp/grep.js';
import { ompGlobTool } from './omp/glob.js';

// omp 扩展工具
import { ompEvalTool } from './omp/eval.js';
import { ompTodoTool } from './omp/todo.js';
import { ompCheckpointTool } from './omp/checkpoint.js';
import { ompRewindTool } from './omp/rewind.js';

// omp 待配置工具
import { browserTool } from './omp/browser.js';
import { ompDebugTool } from './omp/debug.js';
import { ompWebSearchTool } from './omp/web-search.js';

const tools = new Map<string, KfmTool>();

function registerTool(tool: KfmTool): void {
  tools.set(tool.name, tool);
}

// kfmv4
registerTool(kfmLogsTool);
registerTool(kfmBrowserEvalTool);
registerTool(kfmRestartTool);

// omp 核心文件
registerTool(ompBashTool);
registerTool(ompReadTool);
registerTool(ompWriteTool);
registerTool(ompEditTool);
registerTool(ompGrepTool);
registerTool(ompGlobTool);

// omp 扩展
registerTool(ompEvalTool);
registerTool(ompTodoTool);
registerTool(ompCheckpointTool);
registerTool(ompRewindTool);

// omp 待配置
registerTool(browserTool);
registerTool(ompDebugTool);
registerTool(ompWebSearchTool);

export function getAllTools(): KfmTool[] {
  return Array.from(tools.values());
}

export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>;
}> {
  return getAllTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    category: tool.category,
    parameters: tool.parameters,
  }));
}

export async function executeTool(
  name: string,
  params: Record<string, unknown>,
  ctx: ToolContext,
  onUpdate?: (update: ToolUpdate) => void
): Promise<ToolResult> {
  const tool = tools.get(name);
  if (!tool) {
    return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true };
  }
  return tool.execute(params, ctx, onUpdate);
}

export function hasTool(name: string): boolean {
  return tools.has(name);
}

export function getTool(name: string): KfmTool | undefined {
  return tools.get(name);
}

export type { KfmTool, ToolContext, ToolResult, ToolUpdate, ContentBlock };
