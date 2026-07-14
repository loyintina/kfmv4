/**
 * kfmv4 AI 工具类型定义
 *
 * 基于 omp 的工具接口，适配 kfmv4 的需求
 */

import type { WsServer } from '../../ws-server.js';

/** 内容块 */
export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: { type: 'base64'; media_type: string; data: string };
}

/** 工具结果 */
export interface ToolResult {
  content: ContentBlock[];
  details?: Record<string, unknown>;
  isError?: boolean;
}

/** 工具更新（流式输出） */
export interface ToolUpdate {
  content: ContentBlock[];
  details?: Record<string, unknown>;
}

/** 工具上下文 */
export interface ToolContext {
  cwd: string;
  wsServer: WsServer;
}

/** kfmv4 工具定义 */
export interface KfmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  execute(
    params: Record<string, unknown>,
    ctx: ToolContext,
    onUpdate?: (update: ToolUpdate) => void
  ): Promise<ToolResult>;
}
