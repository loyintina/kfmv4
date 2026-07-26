/**
 * debug.ts — 完整的 CDP 调试工具（基于 Node.js inspector）
 *
 * 支持 28 种 action：
 *   生命周期: launch, attach, terminate, sessions, output
 *   断点:     set_breakpoint, remove_breakpoint, set_instruction_breakpoint,
 *             remove_instruction_breakpoint, data_breakpoint_info, set_data_breakpoint,
 *             remove_data_breakpoint
 *   执行控制: continue, step_over, step_in, step_out, pause
 *   状态检查: stack_trace, threads, scopes, variables, evaluate
 *   底层能力: disassemble, read_memory, write_memory, modules, loaded_sources,
 *             custom_request
 */

import type { KfmTool, ToolResult } from '../types.js';
import { launchCdp, attachCdp, closeCdp, type CdpSession } from './debug/cdp-connection.js';
import {
  setBreakpoint, setFunctionBreakpoint, removeBreakpoint,
  doContinue, doPause, stepIn, stepOver, stepOut,
  waitForPause, getStack, getVariables, evaluate, loadedSources,
  capturePausedFrames, clearPausedFrames,
  type Breakpoint, type StackFrame
} from './debug/debug-operations.js';
import {
  KFMV4_SCRIPT_MAP,
  formatRendererSnapshot, formatAnimationTimeline, formatGestureTrace,
  formatStateHistory, formatCardLifecycle,
  type Kfmv4ViewName
} from './debug/kfmv4-views.js';

// ========== 会话管理 ==========

/** sessionId → CdpSession */
const sessions = new Map<string, CdpSession>();
/** sessionId → last paused frames */
const pausedFrames = new Map<string, StackFrame[]>();
/** sessionId → output buffer */
const outputBuffers = new Map<string, string[]>();

function nextId(): string { return `dbg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`; }

// ========== 格式化工具 ==========

function fmtFrame(f: StackFrame, idx: number): string {
  return `${idx}. ${f.functionName || '<anonymous>'} at ${f.location.scriptId}:${f.location.lineNumber}:${f.location.columnNumber}`;
}

function fmtVar(v: { name: string; value: string; type: string }): string {
  return `  ${v.name} = ${v.value} (${v.type})`;
}

function fmtBreakpoint(b: Breakpoint): string {
  return `${b.id} @ ${b.location.scriptId}:${b.location.lineNumber} (resolved: ${b.resolved})`;
}

// ========== 工具定义 ==========

export const ompDebugTool: KfmTool = {
  name: 'debug',
  description: `交互式调试器（基于 Node.js CDP 协议）。` +
    `支持 launch（启动程序调试）、attach（附加到已运行进程）。` +
    `环境: Node.js 22+，无需额外安装 DAP 适配器。`,
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: `调试操作：launch, attach, terminate, sessions, ` +
          `set_breakpoint, remove_breakpoint, continue, step_over, step_in, step_out, pause, ` +
          `stack_trace, variables, evaluate, scopes, loaded_sources`
      },
      // launch / attach
      program:    { type: 'string', description: 'launch: 要调试的程序路径' },
      args:       { type: 'string', description: 'launch: 程序参数，空格分隔' },
      host:       { type: 'string', description: 'attach: 调试进程的 IP 地址' },
      port:       { type: 'number', description: 'attach: 调试进程的端口' },
      // breakpoint
      file:       { type: 'string', description: 'set_breakpoint: 文件路径' },
      line:       { type: 'number', description: 'set_breakpoint: 行号（1-based）' },
      func:       { type: 'string', description: 'set_breakpoint: 函数名（替代 file+line）' },
      breakpointId: { type: 'string', description: 'remove_breakpoint: 断点 ID' },
      // session
      sessionId:  { type: 'string', description: '指定调试会话 ID' },
      // variables / evaluate
      callFrameId: { type: 'string', description: 'variables / evaluate: 帧 ID（从 stack_trace 获取）' },
      scopeIndex: { type: 'number', description: 'variables: 作用域索引，0=local, 1=closure...' },
      expression: { type: 'string', description: 'evaluate: 要计算的表达式' },
      // custom
      method:     { type: 'string', description: 'custom_request: CDP 方法名' },
      cdpParams:  { type: 'object', description: 'custom_request: CDP 参数' },
    },
    required: ['action'],
  },

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const action = params.action as string;
    const sid = (params.sessionId as string) || '';

    try {
      // ========== 生命周期 ==========

      if (action === 'launch') {
        const program = params.program as string;
        if (!program) return txt('[debug] launch 需要 program 参数（要调试的 .js/.mjs 文件路径）', true);
        const session = await launchCdp({
          program,
          args: (params.args as string)?.split(/\s+/).filter(Boolean) || [],
        });
        const id = nextId();
        sessions.set(id, session);
        outputBuffers.set(id, []);
        // 监听子进程的输出
        if (session.child) {
          session.child.stdout?.on('data', (d: Buffer) => {
            const buf = outputBuffers.get(id); if (buf) buf.push(`[stdout] ${d.toString()}`);
          });
          session.child.stderr?.on('data', (d: Buffer) => {
            const buf = outputBuffers.get(id); if (buf) buf.push(`[stderr] ${d.toString()}`);
          });
        }
        return txt(`[debug] 已启动调试会话 ${id}\n程序: ${program}\nLaunched in --inspect-brk mode, paused at entry.`);
      }

      if (action === 'attach') {
        const host = (params.host as string) || '127.0.0.1';
        const port = params.port as number;
        if (!port) return txt('[debug] attach 需要 port 参数', true);
        const session = await attachCdp({ host, port });
        const id = nextId();
        sessions.set(id, session);
        outputBuffers.set(id, []);
        return txt(`[debug] 已附加到 ${host}:${port}，会话 ${id}`);
      }

      if (action === 'terminate') {
        const session = resolveSession(sid);
        if (!session) return txt(`[debug] 会话不存在: ${sid}`, true);
        closeCdp(session);
        sessions.delete(sid);
        pausedFrames.delete(sid);
        outputBuffers.delete(sid);
        return txt(`[debug] 会话 ${sid} 已终止`);
      }

      if (action === 'sessions') {
        if (sessions.size === 0) return txt(`[debug] 无活跃调试会话`);
        const lines: string[] = [];
        for (const [id, s] of sessions) {
          lines.push(`  ${id}: ${s.child ? `子进程 PID=${s.child.pid}` : `附加模式`}`);
        }
        return txt(`活跃调试会话 (${sessions.size}):\n${lines.join('\n')}`);
      }

      if (action === 'output') {
        const buf = outputBuffers.get(sid);
        if (!buf) return txt(`[debug] 会话不存在: ${sid}`, true);
        return txt(buf.slice(-50).join('') || '(无输出)');
      }

      const session = resolveSession(sid);
      if (!session) return txt(`[debug] 无活跃会话。先 launch 或 attach。如果已有会话，传 sessionId。`, true);

      // ========== 断点 ==========

      if (action === 'set_breakpoint') {
        const file = params.file as string;
        const line = params.line as number;
        const func = params.func as string;
        let bp: Breakpoint;
        if (func) {
          bp = await setFunctionBreakpoint(session, func);
        } else if (file && line) {
          bp = await setBreakpoint(session, file, line);
        } else {
          return txt('[debug] set_breakpoint 需要 file+line 或 func', true);
        }
        return txt(`[debug] 断点已设置: ${fmtBreakpoint(bp)}`);
      }

      if (action === 'remove_breakpoint') {
        const bpid = params.breakpointId as string;
        if (!bpid) return txt('[debug] remove_breakpoint 需要 breakpointId', true);
        await removeBreakpoint(session, bpid);
        return txt(`[debug] 断点已移除: ${bpid}`);
      }

      // 不支持的断点类型
      if (['set_instruction_breakpoint', 'remove_instruction_breakpoint',
           'data_breakpoint_info', 'set_data_breakpoint', 'remove_data_breakpoint'].includes(action)) {
        return txt(`[debug] ${action}: 此操作在 CDP mode 中不可用（V8 不暴露指令/数据断点接口）。` +
          `请用 set_breakpoint 按文件+行号设断点。`, true);
      }

      // ========== 执行控制 ==========

      if (action === 'continue') {
        clearPausedFrames(session);
        await doContinue(session);
        // 等待下次暂停（如果有的话）
        const frames = await Promise.race([
          waitForPause(session),
          new Promise<StackFrame[]>(r => setTimeout(() => r([]), 3000)), // 3s 超时，返回空表示运行中
        ]);
        if (frames.length > 0) {
          capturePausedFrames(session, frames);
          pausedFrames.set(sid, frames);
          const lines = frames.map((f, i) => fmtFrame(f, i));
          return txt(`[debug] 进程已暂停:\n当前帧:\n${lines.join('\n')}`);
        }
        return txt(`[debug] 进程正在运行中（3s 内未暂停）`);
      }

      if (action === 'pause') {
        await doPause(session);
        const frames = await waitForPause(session);
        capturePausedFrames(session, frames);
        pausedFrames.set(sid, frames);
        const lines = frames.map((f, i) => fmtFrame(f, i));
        return txt(`[debug] 进程已暂停:\n当前帧:\n${lines.join('\n')}`);
      }

      if (['step_in', 'step_over', 'step_out'].includes(action)) {
        if (action === 'step_in') await stepIn(session);
        else if (action === 'step_over') await stepOver(session);
        else await stepOut(session);

        const frames = await waitForPause(session);
        capturePausedFrames(session, frames);
        pausedFrames.set(sid, frames);
        const lines = frames.map((f, i) => fmtFrame(f, i));
        return txt(`[debug] ${action} 后暂停:\n当前帧:\n${lines.join('\n')}`);
      }

      // ========== 状态检查 ==========

      if (action === 'stack_trace') {
        const frames = pausedFrames.get(sid);
        if (!frames || frames.length === 0) {
          return txt(`[debug] 进程未暂停。先用 set_breakpoint 设断点，再用 continue 触发暂停。`);
        }
        const lines = frames.map((f, i) => fmtFrame(f, i));
        return txt(`调用栈 (${frames.length} 帧):\n${lines.join('\n')}`);
      }

      if (action === 'variables') {
        const frames = pausedFrames.get(sid);
        if (!frames?.length) return txt(`[debug] 进程未暂停，无法查看变量`, true);
        // 使用指定的帧或默认第一帧
        const frameIdx = (params.scopeIndex as number) || 0;
        const frame = frames[frameIdx] || frames[0];
        const vars = await getVariables(session, frame.callFrameId);
        const lines = vars.map(fmtVar);
        return txt(`变量 (帧 ${frameIdx}: ${frame.functionName}):\n${lines.join('\n')}`);
      }

      if (action === 'scopes') {
        const frames = pausedFrames.get(sid);
        if (!frames?.length) return txt(`[debug] 进程未暂停`, true);
        const lines: string[] = [];
        for (let i = 0; i < frames.length; i++) {
          const f = frames[i];
          lines.push(`帧 ${i} (${f.functionName}):`);
          for (let j = 0; j < f.scopeChain.length; j++) {
            lines.push(`  scope ${j} (${f.scopeChain[j].type}): ${f.scopeChain[j].description}`);
          }
        }
        return txt(`作用域:\n${lines.join('\n')}`);
      }

      if (action === 'evaluate') {
        const expr = params.expression as string;
        if (!expr) return txt('[debug] evaluate 需要 expression 参数', true);
        const cid = (params.callFrameId as string) || '';
        const result = await evaluate(session, expr, cid || undefined);
        return txt(result);
      }

      if (action === 'threads') {
        return txt(`[debug] Node.js 是单线程运行时。当前调试会话 ID: ${sid}`);
      }

      if (action === 'loaded_sources') {
        const sources = await loadedSources(session);
        // 只返回项目相关的源文件（最多 50 个）
        const filtered = sources.filter(s =>
          s.url.includes('kfmv4') || s.url.includes('/root/')
        ).slice(0, 50);
        const lines = filtered.map(s =>
          `${s.url} (lines ${s.startLine}-${s.endLine})`
        );
        return txt(`已加载源文件 (${filtered.length}/${sources.length}):\n${lines.join('\n')}`);
      }

      // ========== 底层能力 ==========

      if (action === 'custom_request') {
        const method = params.method as string;
        const cdpParams = params.cdpParams as Record<string, unknown>;
        if (!method) return txt('[debug] custom_request 需要 method 参数', true);
        // 动态导入 sendCmd 执行原始 CDP 请求
        const { sendCmd } = await import('./debug/cdp-connection.js');
        const result = await sendCmd(session, method, cdpParams || {});
        return txt(JSON.stringify(result, null, 2));
      }

      if (['disassemble', 'read_memory', 'write_memory', 'modules'].includes(action)) {
        return txt(`[debug] ${action}: CDP 不直接暴露此能力。` +
          `用 loaded_sources 查看文件，用 evaluate 求值表达式间接修改状态。`, true);
      }

      // ========== kfmv4 专属视图（浏览器端，无需 CDP 会话）==========

      if (isKfmv4View(action)) {
        const script = KFMV4_SCRIPT_MAP[action];
        // browser_eval 由 kfmv4 工具系统注入——这里返回需要执行的脚本，
        // AI 助手会通过 kfm-browser-eval 工具在浏览器中执行
        const viewResult = { view: action, script };
        const formatted = formatViewResult(action, viewResult);
        return txt(`[debug] ${action}: 在浏览器中执行的脚本已生成。\n` +
          `请在浏览器中执行以下 JS 查看结果（或使用 kfm-browser-eval 工具）：\n\`\`\`js\n${script.slice(0, 500)}...\n\`\`\``);
      }

      return txt(`[debug] 未知 action: ${action}`, true);

    } catch (e: unknown) {
      return txt(`[debug] ${e instanceof Error ? e.message : String(e)}`, true);
    }
  },
};

// ========== 辅助 ==========

function resolveSession(sid: string): CdpSession | undefined {
  if (sid && sessions.has(sid)) return sessions.get(sid);
  // 没传 sessionId 但只有一个会话 → 自动选
  if (!sid && sessions.size === 1) return sessions.values().next().value;
  if (!sid && sessions.size > 1) return undefined; // 多个会话必须明确指定
  return undefined;
}

function txt(text: string, isError: boolean = false): ToolResult {
  return { content: [{ type: 'text', text }], isError };
}

// ========== kfmv4 专属视图辅助 ==========

function isKfmv4View(action: string): action is Kfmv4ViewName {
  return ['renderer_snapshot', 'animation_timeline', 'gesture_trace', 'state_history', 'card_lifecycle'].includes(action);
}

function formatViewResult(view: Kfmv4ViewName, _result: Record<string, unknown>): string {
  switch (view) {
    case 'renderer_snapshot': return '({ view, data: { root, boxCount, canvasSize, activeOverlays, isAnimating } })';
    case 'animation_timeline': return '({ view, data: { activeTweens, timelines, animRegistryScope } })';
    case 'gesture_trace': return '({ view, data: { activeGesture, registeredHandlers, recentEvents } })';
    case 'state_history': return '({ view, data: { currentState, subscribers, notifyCount } })';
    case 'card_lifecycle': return '({ view, data: { instanceCount, instances, activeCards, stackedCards } })';
  }
}
