/**
 * debug-operations.ts — CDP 调试操作层
 *
 * 在这个层，所有 CDP 语义都已完成转换：
 *   - 断点管理（按文件+行号或函数名）
 *   - 执行控制（continue / step_in / step_over / step_out）
 *   - 状态检查（stack_trace / variables / evaluate / scopes）
 *
 * 这个层返回的不是原始 CDP 数据，而是经过整理、适合 LLM 消费的结构化结果。
 */

import { sendCmd, onCdpEvent, type CdpSession, type CdpPausedEvent } from './cdp-connection.js';

// ========== 类型 ==========

export interface Breakpoint {
  id: string;
  location: { scriptId: string; lineNumber: number; columnNumber: number };
  resolved: boolean;
  hitCount: number;
}

export interface StackFrame {
  callFrameId: string;
  functionName: string;
  location: { scriptId: string; lineNumber: number; columnNumber: number };
  scopeChain: Array<{ type: string; description: string }>;
}

export interface Variable {
  name: string;
  value: string;
  type: string;
}

export interface SourceInfo {
  scriptId: string;
  url: string;
  startLine: number;
  endLine: number;
}

// ========== 断点管理 ==========

/**
 * 按文件路径 + 行号设断点
 */
export async function setBreakpoint(
  session: CdpSession,
  file: string,
  line: number
): Promise<Breakpoint> {
  const result = await sendCmd(session, 'Debugger.setBreakpointByUrl', {
    urlRegex: file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), // 转义正则特殊字符
    lineNumber: line - 1, // CDP 是 0-based 行号，用户输入是 1-based
    columnNumber: 0,
  }) as {
    breakpointId: string;
    locations: Array<{ scriptId: string; lineNumber: number; columnNumber: number }>;
  };

  const loc = result.locations?.[0] || { scriptId: 'unknown', lineNumber: line - 1, columnNumber: 0 };

  return {
    id: result.breakpointId,
    location: {
      scriptId: loc.scriptId,
      lineNumber: loc.lineNumber + 1, // 转回 1-based
      columnNumber: loc.columnNumber,
    },
    resolved: true,
    hitCount: 0,
  };
}

/**
 * 按函数名设断点
 */
export async function setFunctionBreakpoint(
  session: CdpSession,
  funcName: string
): Promise<Breakpoint> {
  const result = await sendCmd(session, 'Debugger.setBreakpoint', {
    condition: `/* break on ${funcName} */`,
  }) as {
    breakpointId: string;
    actualLocation: { scriptId: string; lineNumber: number; columnNumber: number };
  };

  return {
    id: result.breakpointId,
    location: {
      scriptId: result.actualLocation?.scriptId || 'unknown',
      lineNumber: (result.actualLocation?.lineNumber || 0) + 1,
      columnNumber: result.actualLocation?.columnNumber || 0,
    },
    resolved: !!result.actualLocation,
    hitCount: 0,
  };
}

/**
 * 移除断点
 */
export async function removeBreakpoint(
  session: CdpSession,
  breakpointId: string
): Promise<boolean> {
  await sendCmd(session, 'Debugger.removeBreakpoint', { breakpointId });
  return true;
}

// ========== 执行控制 ==========

/**
 * 继续执行（从暂停状态恢复）
 */
export async function doContinue(session: CdpSession): Promise<void> {
  await sendCmd(session, 'Debugger.resume');
}

/**
 * 暂停正在运行的进程
 */
export async function doPause(session: CdpSession): Promise<void> {
  await sendCmd(session, 'Debugger.pause');
}

/**
 * 单步进入（Step Into）
 */
export async function stepIn(session: CdpSession): Promise<void> {
  await sendCmd(session, 'Debugger.stepInto');
}

/**
 * 单步跳过（Step Over）
 */
export async function stepOver(session: CdpSession): Promise<void> {
  await sendCmd(session, 'Debugger.stepOver');
}

/**
 * 单步跳出（Step Out）
 */
export async function stepOut(session: CdpSession): Promise<void> {
  await sendCmd(session, 'Debugger.stepOut');
}

// ========== 状态检查 ==========

/**
 * 等待进程暂停，返回暂停事件的调用帧信息
 */
export function waitForPause(session: CdpSession): Promise<StackFrame[]> {
  return new Promise(resolve => {
    onCdpEvent(session, 'Debugger.paused', (params) => {
      const paused = params as CdpPausedEvent;
      const frames: StackFrame[] = (paused.callFrames || []).map(f => ({
        callFrameId: f.callFrameId,
        functionName: f.functionName,
        location: {
          scriptId: f.location.scriptId,
          lineNumber: f.location.lineNumber + 1,
          columnNumber: f.location.columnNumber,
        },
        scopeChain: (f.scopeChain || []).map(s => ({
          type: s.type,
          description: s.object?.description || s.object?.type || 'unknown',
        })),
      }));
      resolve(frames);
    });
  });
}

/**
 * 获取调用栈
 */
export async function getStack(session: CdpSession): Promise<StackFrame[]> {
  // 如果当前已在暂停状态，直接从 session 中读取
  if (session.pausedCallFrames) {
    return session.pausedCallFrames as StackFrame[];
  }
  // 否则，暂停然后读
  await doPause(session);
  const frames = await waitForPause(session);
  return frames;
}

/**
 * 查看指定帧的作用域变量
 */
export async function getVariables(
  session: CdpSession,
  callFrameId: string,
  scopeType: string = 'local'
): Promise<Variable[]> {
  const result = await sendCmd(session, 'Debugger.evaluateOnCallFrame', {
    callFrameId,
    expression: 'Object.keys(this).reduce((acc, k) => { acc[k] = typeof this[k] === "function" ? "[Function: " + k + "]" : this[k]; return acc; }, {})',
  }) as { result: { value?: string; description?: string; type: string; objectId?: string } };

  const r = result.result;
  if (r.type === 'object' && r.objectId) {
    const props = await sendCmd(session, 'Runtime.getProperties', {
      objectId: r.objectId,
      ownProperties: true,
    }) as { result: Array<{ name: string; value: { value: unknown; type: string; description: string } }> };

    return (props.result || []).slice(0, 50).map((p: { name: string; value: { value: unknown; type: string; description: string } }) => ({
      name: p.name,
      value: p.value?.value !== undefined ? String(p.value.value).slice(0, 200) : (p.value?.description || 'undefined'),
      type: p.value?.type || 'unknown',
    }));
  }

  return [{ name: 'result', value: r.value || r.description || 'undefined', type: r.type }];
}

/**
 * 在调试上下文中求值表达式
 */
export async function evaluate(
  session: CdpSession,
  expression: string,
  callFrameId?: string
): Promise<string> {
  const params: Record<string, unknown> = { expression };
  if (callFrameId) params.callFrameId = callFrameId;

  const result = await sendCmd(session, callFrameId ? 'Debugger.evaluateOnCallFrame' : 'Runtime.evaluate', params) as {
    result: { value?: string; description?: string; type: string; className?: string };
    exceptionDetails?: { text: string };
  };

  if (result.exceptionDetails) {
    return `[Error] ${result.exceptionDetails.text}`;
  }

  const r = result.result;
  return r.value !== undefined ? String(r.value).slice(0, 500) : (r.description || r.className || 'undefined');
}

/**
 * 列出所有已加载的 JS 源文件
 */
export async function loadedSources(session: CdpSession): Promise<SourceInfo[]> {
  const sources: SourceInfo[] = [];

  // 监听 Debugger.scriptParsed 事件
  const handler = (params: unknown) => {
    const p = params as { scriptId: string; url: string; startLine: number; endLine: number };
    sources.push({
      scriptId: p.scriptId,
      url: p.url,
      startLine: p.startLine,
      endLine: p.endLine,
    });
  };

  onCdpEvent(session, 'Debugger.scriptParsed', handler);

  // 返回当前已经加载的
  return sources;
}

// ========== 暂停事件管理 ==========

/**
 * 保存最新的暂停帧数据到 session
 */
export function capturePausedFrames(session: CdpSession, frames: StackFrame[]): void {
  session.pausedCallFrames = frames as unknown[];
}

/**
 * 清除暂停帧缓存
 */
export function clearPausedFrames(session: CdpSession): void {
  session.pausedCallFrames = undefined;
}
