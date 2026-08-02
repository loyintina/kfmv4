/**
 * omp/bash.ts — bash 工具
 *
 * 后端：node:child_process（BAR-BASH-HANG-01 后端换芯，2026-08-01）。
 * 曾用 pi-natives executeShell（brush 进程内 shell）——其进程替换管道实现
 * 把写端泄漏进 node 进程（/proc 实证：node 持有同一管道 4 个写端，fd 表
 * 92 项/50 pipe 慢性泄漏），`comm -13 <(sort …) <(sort …)` 死锁 100 分钟
 * 挂死整轮 run。kfmv4 只用 command/cwd/timeout/signal 四参（brush 会话态
 * 特性零使用），换 node:child_process——CLOEXEC 语义正确、几十年战场验证，
 * 整个 fd 泄漏 bug 类从我们的用法里消失。
 * 换芯保语义：流式输出拼 stdout+stderr、缺省超时 300s、signal 中止、
 * 超时/中止杀整棵进程组（detached + 负 pid SIGKILL，进程替换子进程不漏杀）。
 */
import { spawn } from 'child_process';
import type { KfmTool, ToolResult } from '../types.js';

/** 输出上限（字符）：防 `yes` 类失控输出撑爆内存；截断后补标记行 */
const MAX_OUTPUT_CHARS = 1024 * 1024;

export const ompBashTool: KfmTool = {
  name: 'bash',
  description: '在项目目录执行 shell 命令。支持超时、环境变量注入、流式输出。',
  category: 'omp',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的 shell 命令' },
      cwd: { type: 'string', description: '工作目录，缺省 = 项目根（会话内固定，不随服务启动位置漂移）。跨仓库/跨目录操作请显式传 cwd（如 /root/kfmv4-lab）' },
      timeout: { type: 'number', description: '超时秒数，默认 300' },
    },
    required: ['command'],
  },
  async execute(params, ctx): Promise<ToolResult> {
    // 缺省也必须带超时（BAR-BASH-HANG-01：缺省=无超时=挂死无兜底）
    const timeoutMs = (params.timeout as number) ? (params.timeout as number) * 1000 : 300_000;
    const command = params.command as string;
    const cwd = (params.cwd as string) || ctx.cwd;

    return await new Promise<ToolResult>((resolve) => {
      // /bin/bash 而非 sh：AI 会写进程替换等 bash 特性，dash 不支持
      // detached: 子进程自成进程组，超时/中止时负 pid 杀整组（含进程替换后代）
      const child = spawn('/bin/bash', ['-c', command], { cwd, detached: true });
      let output = '';
      let truncated = false;
      let settled = false;

      const finish = (exitCode?: number, timedOut = false, cancelled = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ctx.signal?.removeEventListener('abort', onAbort);
        const body = output.trim() + (truncated ? '\n(输出过大被截断)' : '');
        const text = body || ((exitCode === 0 || exitCode === undefined) ? '(命令执行成功)' : `(退出码: ${exitCode})`);
        resolve({
          content: [{ type: 'text', text }],
          isError: cancelled || timedOut || (exitCode !== undefined && exitCode !== 0),
        });
      };

      const killTree = () => {
        try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); }
        catch { try { child.kill('SIGKILL'); } catch { /* 已退出 */ } }
      };

      const timer = setTimeout(() => { killTree(); finish(undefined, true); }, timeoutMs);
      const onAbort = () => { killTree(); finish(undefined, false, true); };
      ctx.signal?.addEventListener('abort', onAbort);

      const onData = (chunk: Buffer | string) => {
        if (output.length < MAX_OUTPUT_CHARS) output += chunk;
        else truncated = true;
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.on('error', () => finish(1)); // spawn 失败（如 cwd 不存在）
      child.on('close', (code) => finish(code ?? undefined));
    });
  },
};
