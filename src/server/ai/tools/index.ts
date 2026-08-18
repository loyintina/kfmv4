/**
 * kfmv4 AI 工具注册入口
 *
 * 注册所有可用的 AI 工具：
 * - kfmv4 专用工具（logs, browser_eval, restart）
 * - omp 工具（bash, read, write, edit, grep, glob, todo, eval, checkpoint, rewind, browser, debug, web_search）
 *
 * v8.1.0 删除 kfm-snapshot（眼睛机制 page-state.md 是其严格上位：更新鲜/更丰富/零调用成本）
 * 与 kfm-exec（与 bash 同一实现的双胞胎，且逃逸 bash 重试弧线统计）——见 docs/domains/ai-chat/detail-tool-compaction.md。
 */

import type { KfmTool, ToolContext, ToolResult, ToolUpdate, ContentBlock } from './types.js';
import { evaluate } from '../permissions.js';
import { appendFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve, sep } from 'path';
import { homedir } from 'os';

/**
 * 工具执行账本（观测台：工具错误流数据源）
 * 每次工具调用记一条 {ts, tool, ok, error, ms}——周报聚合高频失败工具/
 * 错误类型/平均耗时。append-only，异步不阻塞（失败吞掉不影响工具执行）。
 */
const TOOL_EXEC_LOG = join(homedir(), '.kfmv4', 'ledger', 'tool-exec.jsonl');
function recordToolExec(tool: string, ok: boolean, error: string, ms: number): void {
  try {
    appendFileSync(TOOL_EXEC_LOG, JSON.stringify({
      ts: new Date().toISOString(), tool, ok, error: error.slice(0, 120), ms,
    }) + '\n');
  } catch { /* 账本不可写不阻断 */ }
}

/** 从工具结果提取错误文本（截断） */
function resultErrorText(result: ToolResult): string {
  const t = result.content?.[0]?.type === 'text' ? (result.content[0].text ?? '') : '';
  return t.length > 120 ? t.slice(0, 120) : t;
}

// kfmv4 专用工具
import { kfmLogsTool } from './kfmv4/logs.js';
import { kfmBrowserEvalTool } from './kfmv4/browser-eval.js';
import { kfmRestartTool } from './kfmv4/restart.js';
import { kfmCompactTool } from './kfmv4/compact.js';
import { kfmHandMoveTool } from './kfmv4/hand.js';

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
registerTool(kfmCompactTool);
registerTool(kfmHandMoveTool);

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
  // 写监狱（2026-08-06 e13 沙箱逃逸事故）：sandboxRoot 设置时，write/edit 的
  // path 必须落在沙箱内——逃逸在扼点拒绝，不进执行。omp write/edit 用 fs 直写
  // （相对路径按 process.cwd() 解析），与 ctx.cwd 语义并存——两者任一落在沙箱外
  // 即拒（fail-closed；生产里两者同为 PROJECT_ROOT，判定一致）。
  if (ctx.sandboxRoot && (name === 'write' || name === 'edit') && typeof params.path === 'string') {
    const jail = resolve(ctx.sandboxRoot);
    const candidates = [resolve(ctx.cwd, params.path), resolve(process.cwd(), params.path)];
    if (candidates.some(r => r !== jail && !r.startsWith(jail + sep))) {
      return { content: [{ type: 'text', text: `沙箱限制：只能写沙箱目录（${ctx.sandboxRoot}）内的文件，` +
        `「${params.path}」在沙箱外，已拒绝。请改用沙箱内路径。` }], isError: true };
    }
  }
  // 读监狱（2026-08-08 docprobe 试点 v2 污染事故）：readRoot 设置时，read/grep/glob
  // 的 path 必须落在读监狱内——被试 agent 顺设计文档里的绝对路径直读私有区答案，
  // 提示词层面无法防（路径就写在仓内文档里），只能在扼点构造性拒绝。
  // grep/glob 缺省 path = ctx.cwd（生产=PROJECT_ROOT，落在监狱内，无需拦截）。
  if (ctx.readRoot && (name === 'read' || name === 'grep' || name === 'glob') && typeof params.path === 'string') {
    const jail = resolve(ctx.readRoot);
    const candidates = [resolve(ctx.cwd, params.path), resolve(process.cwd(), params.path)];
    if (candidates.some(r => r !== jail && !r.startsWith(jail + sep))) {
      return { content: [{ type: 'text', text: `沙箱限制：只能读指定目录（${ctx.readRoot}）内的内容，` +
        `「${params.path}」在范围外，已拒绝。` }], isError: true };
    }
  }
  // 8.5.0 权限引擎影子模式：判定 + 审计（不拦截）；8.5.1 起 deny/ask 真正生效
  const decision = evaluate(name, params, ctx);
  if (decision.action !== 'allow') {
    // 影子模式：记录后照常执行（破界率基线）；8.5.1 在此返回 denied
  }
  const t0 = Date.now();
  try {
    const result = await tool.execute(params, ctx, onUpdate);
    recordToolExec(name, !result.isError, result.isError ? resultErrorText(result) : '', Date.now() - t0);
    return result;
  } catch (e) {
    recordToolExec(name, false, e instanceof Error ? e.message : '未知错误', Date.now() - t0);
    throw e;
  }
}

export function hasTool(name: string): boolean {
  return tools.has(name);
}

export function getTool(name: string): KfmTool | undefined {
  return tools.get(name);
}

export type { KfmTool, ToolContext, ToolResult, ToolUpdate, ContentBlock };
