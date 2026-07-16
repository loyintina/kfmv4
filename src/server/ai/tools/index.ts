/**
 * kfmv4 AI 工具注册入口
 *
 * 注册所有可用的 AI 工具：
 * - kfmv4 专用工具（snapshot, logs, exec）
 */

import type { KfmTool, ToolContext, ToolResult, ToolUpdate, ContentBlock } from './types.js';

import { kfmSnapshotTool } from './kfmv4/snapshot.js';
import { kfmLogsTool } from './kfmv4/logs.js';
import { kfmExecTool } from './kfmv4/exec.js';

const tools = new Map<string, KfmTool>();

function registerTool(tool: KfmTool): void {
  tools.set(tool.name, tool);
}

registerTool(kfmSnapshotTool);
registerTool(kfmLogsTool);
registerTool(kfmExecTool);

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
