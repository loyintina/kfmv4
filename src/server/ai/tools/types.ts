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
  /** run 级中止信号（用户取消 / 停摆看门狗）——能中止的工具必须传入底层 */
  signal?: AbortSignal;
  /** 沙箱根（script 会话写监狱，2026-08-06 e13 逃逸事故）：设置后 write/edit
   *  的 path 强制限制在该目录内，逃逸在 executeTool 扼点直接拒绝。
   *  提示词约定不防呆——V3 曾写穿 fixture 模板、27B 曾写进真仓库 docs/。 */
  sandboxRoot?: string;
  /** 读监狱根（2026-08-08 docprobe 试点 v2 污染事件）：设置后 read/grep/glob
   *  的 path 强制限制在该目录内——考场边界由构造保证，不靠提示词自律。
   *  与 sandboxRoot 正交：写监狱防破坏，读监狱防越界取证（答案在试卷语料外
   *  也须不可读）。只收不放：设置后访问面只会变窄，无安全反噬。 */
  readRoot?: string;
  /** 会话 ID（面板对话会话才有；kfm-compact 等会话级工具用） */
  sessionId?: string;
}

/** kfmv4 工具定义 */
export interface KfmTool {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>; // JSON Schema
  execute(
    params: Record<string, unknown>,
    ctx: ToolContext,
    onUpdate?: (update: ToolUpdate) => void
  ): Promise<ToolResult>;
}

/**
 * Base error for tool execution failures.
 */
export class ToolError extends Error {
  context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'ToolError';
    this.context = context;
  }

  render(): string {
    return this.message;
  }
}

/**
 * Error thrown when a tool operation is aborted via AbortSignal.
 */
export class ToolAbortError extends Error {
  static readonly MESSAGE = 'Operation aborted';

  constructor(message: string = ToolAbortError.MESSAGE, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ToolAbortError';
  }
}

/**
 * Throw ToolAbortError if the signal is aborted.
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const reason = signal.reason instanceof Error ? signal.reason : undefined;
    throw reason instanceof ToolAbortError ? reason : new ToolAbortError(undefined, { cause: signal.reason });
  }
}

/**
 * Render an error for LLM consumption.
 */
export function renderError(e: unknown): string {
  if (e instanceof ToolError) {
    return e.render();
  }
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}
