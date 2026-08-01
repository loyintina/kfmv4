/**
 * omp/bash.ts — bash 工具（直调 pi-natives executeShell）
 */
import type { KfmTool, ToolResult } from '../types.js';
import { executeShell } from './native.js';

export const ompBashTool: KfmTool = {
  name: 'bash',
  description: '在项目目录执行 shell 命令。支持超时、环境变量注入、流式输出。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的 shell 命令' },
      cwd: { type: 'string', description: '工作目录，默认当前项目根' },
      timeout: { type: 'number', description: '超时秒数，默认 300' },
    },
    required: ['command'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    // BAR-BASH-HANG-01：缺省也必须带超时（描述承诺「默认 300」但旧代码缺省传
    // undefined → 原生层无超时）。2026-08-01 生产实锤：进程替换管道死锁
    // （comm 读 <(sort …)，pi-natives spawn fd 泄漏致 node 持有管道写端，
    // EOF 永不到达），executeShell Promise 悬挂 100 分钟，整轮 run 卡死。
    const timeoutMs = (params.timeout as number) ? (params.timeout as number) * 1000 : 300_000;
    let output = '';
    const result = await executeShell({
      command: params.command as string,
      cwd: (params.cwd as string) || ctx.cwd,
      timeoutMs,
      signal: ctx.signal, // run 中止信号：看门狗/用户取消时杀死原生子进程
    }, (err, chunk) => {
      if (!err) output += chunk;
    });
    const exitCode = result.exitCode;
    const text = output.trim() || ((exitCode === 0 || exitCode === undefined) ? '(命令执行成功)' : `(退出码: ${exitCode})`);
    return {
      content: [{ type: 'text', text }],
      isError: result.cancelled || result.timedOut || (exitCode !== undefined && exitCode !== 0),
    };
  },
};
