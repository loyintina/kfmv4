/**
 * kfmv4 AI 工具注册入口
 *
 * 注册所有可用的 AI 工具，包括：
 * - kfmv4 专用工具（kfm-snapshot, kfm-logs, kfm-exec）
 * - omp 工具（后续集成）
 */

import type { KfmTool, ToolContext, ToolResult } from './types.js';
import { kfmSnapshotTool } from './kfm-snapshot.js';
import { kfmLogsTool } from './kfm-logs.js';
import { kfmExecTool } from './kfm-exec.js';

/** 所有已注册的工具 */
const tools = new Map<string, KfmTool>();

/** 注册工具 */
function registerTool(tool: KfmTool): void {
  tools.set(tool.name, tool);
}

/** 注册所有内置工具 */
function registerBuiltinTools(): void {
  registerTool(kfmSnapshotTool);
  registerTool(kfmLogsTool);
  registerTool(kfmExecTool);
}

// 初始化时注册内置工具
registerBuiltinTools();

/** 获取所有工具 */
export function getAllTools(): KfmTool[] {
  return Array.from(tools.values());
}

/** 获取工具定义（用于 AI 调用） */
export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return getAllTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/** 执行工具 */
export async function executeTool(
  name: string,
  params: Record<string, unknown>,
  ctx: ToolContext,
  onUpdate?: (update: { content: Array<{ type: string; text?: string }> }) => void
): Promise<ToolResult> {
  const tool = tools.get(name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `未知工具: ${name}` }],
      isError: true,
    };
  }

  return tool.execute(params, ctx, onUpdate);
}

/** 检查工具是否存在 */
export function hasTool(name: string): boolean {
  return tools.has(name);
}

/** 获取工具 */
export function getTool(name: string): KfmTool | undefined {
  return tools.get(name);
}

// 导出工具定义
export { kfmSnapshotTool } from './kfm-snapshot.js';
export { kfmLogsTool } from './kfm-logs.js';
export { kfmExecTool } from './kfm-exec.js';
export type { KfmTool, ToolContext, ToolResult, ToolUpdate, ContentBlock } from './types.js';
